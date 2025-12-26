import { cookies } from 'next/headers';
import crypto from 'crypto';
import pool from './db';

// Simple password hashing using crypto (for development)
// In production, use bcryptjs
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const hashed = hashPassword(password);
  return hashed === hashedPassword;
}

export async function getSession() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session')?.value;
    
    if (!sessionId) {
      return null;
    }

    // In production, use proper session storage (Redis, database, etc.)
    // For now, we'll check if user exists
    const [rows]: any = await pool.query(
      `SELECT u.*, f.name AS family_name, f.family_code, m.name AS member_name, m.member_code
       FROM users u
       LEFT JOIN families f ON u.family_id = f.id
       LEFT JOIN family_members m ON u.member_id = m.id
       WHERE u.id = ?`,
      [sessionId]
    );

    if (rows.length === 0) {
      return null;
    }

    const user = rows[0];
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      status: user.status,
      family_id: user.family_id,
      member_id: user.member_id,
      family_name: user.family_name,
      family_code: user.family_code,
      member_name: user.member_name,
      member_code: user.member_code,
    };
  } catch (error) {
    return null;
  }
}

export async function setSession(userId: number) {
  const cookieStore = await cookies();
  cookieStore.set('session', userId.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
