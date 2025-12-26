import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.name, u.role, u.status, u.created_at, u.member_id,
              m.name as member_name
       FROM users u
       LEFT JOIN family_members m ON u.member_id = m.id
       WHERE u.status = 'pending' AND u.role = 'admin'
       ORDER BY u.created_at DESC`
    );

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching pending users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending users' },
      { status: 500 }
    );
  }
}
