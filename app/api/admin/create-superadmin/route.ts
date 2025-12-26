import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, name } = body;

    if (!username || !password || !name) {
      return NextResponse.json(
        { error: 'Username, password, and name are required' },
        { status: 400 }
      );
    }

    // Check if superadmin already exists
    const [existing]: any = await pool.query(
      "SELECT * FROM users WHERE role = 'superadmin'"
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Superadmin already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = hashPassword(password);

    // Create superadmin
    await pool.query(
      `INSERT INTO users (username, password, name, role, status)
       VALUES (?, ?, ?, 'superadmin', 'approved')`,
      [username, hashedPassword, name]
    );

    return NextResponse.json({
      message: 'Superadmin created successfully!',
      username,
    });
  } catch (error: any) {
    console.error('Error creating superadmin:', error);
    return NextResponse.json(
      { error: 'Failed to create superadmin' },
      { status: 500 }
    );
  }
}
