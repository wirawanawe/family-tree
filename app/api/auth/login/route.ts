import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword, verifyPassword, setSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, family_code } = body;

    if (!username || !password || !family_code) {
      return NextResponse.json(
        { error: 'Username, password, dan kode keluarga wajib diisi' },
        { status: 400 }
      );
    }

    const normalizedFamilyCode = (family_code as string)?.toUpperCase().trim();
    if (!normalizedFamilyCode) {
      return NextResponse.json(
        { error: 'Kode keluarga tidak boleh kosong' },
        { status: 400 }
      );
    }

    const [rows]: any = await pool.query(
      `SELECT u.*, f.family_code, f.name AS family_name, m.name AS member_name, m.member_code
       FROM users u 
       LEFT JOIN families f ON u.family_id = f.id
       LEFT JOIN family_members m ON u.member_id = m.id
       WHERE u.username = ? AND f.family_code = ?`,
      [username, normalizedFamilyCode]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Username, kode keluarga, atau password salah' },
        { status: 401 }
      );
    }

    const user = rows[0];
    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Username, kode keluarga, atau password salah' },
        { status: 401 }
      );
    }

    await setSession(user.id);

    return NextResponse.json({
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
    });
  } catch (error: any) {
    console.error('Error during login:', error);
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    );
  }
}
