import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Public endpoint to get member basic info by ID
 * Used for fetching spouse information that might be from other families
 * Returns minimal info: id, name, member_code, gender
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [rows]: any = await pool.query(
      'SELECT id, name, member_code, gender FROM family_members WHERE id = ?',
      [params.id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    console.error('Error fetching member by id:', error);
    return NextResponse.json(
      { error: 'Failed to fetch member' },
      { status: 500 }
    );
  }
}
