import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Update user name
    await pool.query(
      'UPDATE users SET name = ? WHERE id = ?',
      [name, session.id]
    );

    // Get updated user with family/member info
    const [users]: any = await pool.query(
      `SELECT u.id, u.username, u.name, u.role, u.status, u.member_id, u.family_id,
              f.name AS family_name, f.family_code, m.name AS member_name, m.member_code
       FROM users u
       LEFT JOIN families f ON u.family_id = f.id
       LEFT JOIN family_members m ON u.member_id = m.id
       WHERE u.id = ?`,
      [session.id]
    );

    return NextResponse.json(users[0]);
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
