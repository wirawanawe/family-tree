import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, action } = body; // action: 'approve' or 'reject'

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'User ID and action are required' },
        { status: 400 }
      );
    }

    const status = action === 'approve' ? 'approved' : 'rejected';

    await pool.query(
      'UPDATE users SET status = ? WHERE id = ?',
      [status, userId]
    );

    return NextResponse.json({ 
      message: `User ${action === 'approve' ? 'approved' : 'rejected'} successfully` 
    });
  } catch (error: any) {
    console.error('Error approving user:', error);
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}
