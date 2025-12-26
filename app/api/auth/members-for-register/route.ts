import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Public endpoint to get list of members for registration
 * Returns minimal information: id, name, and family name
 * This allows users to select which family to join during registration
 */
export async function GET() {
  try {
    const [rows]: any = await pool.query(
      `SELECT 
        m.id, 
        m.name,
        f.name as family_name
       FROM family_members m
       INNER JOIN families f ON m.family_id = f.id
       ORDER BY f.name ASC, m.name ASC`
    );

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching members for register:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}
