import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    
    if (!session || !session.family_id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!session.family_id) {
      return NextResponse.json(
        { error: 'Family ID not found' },
        { status: 401 }
      );
    }

    // Get documentation info and verify it belongs to user's family
    const [docs]: any = await pool.query(
      'SELECT * FROM documentation WHERE id = ? AND family_id = ?',
      [params.id, session.family_id]
    );

    if (docs.length === 0) {
      return NextResponse.json(
        { error: 'Documentation not found' },
        { status: 404 }
      );
    }

    const doc = docs[0];

    // Delete file from filesystem
    const filePath = join(process.cwd(), 'public', doc.file_url);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }

    // Delete thumbnail if exists
    if (doc.thumbnail_url && doc.thumbnail_url.startsWith('/uploads/')) {
      const thumbnailPath = join(process.cwd(), 'public', doc.thumbnail_url);
      if (existsSync(thumbnailPath)) {
        await unlink(thumbnailPath);
      }
    }

    // Delete from database
    await pool.query('DELETE FROM documentation WHERE id = ? AND family_id = ?', [params.id, session.family_id]);

    return NextResponse.json({ message: 'Documentation deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting documentation:', error);
    return NextResponse.json(
      { error: 'Failed to delete documentation' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    
    if (!session || !session.family_id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!session.family_id) {
      return NextResponse.json(
        { error: 'Family ID not found' },
        { status: 401 }
      );
    }

    // Verify documentation belongs to user's family
    const [docCheck]: any = await pool.query(
      'SELECT id FROM documentation WHERE id = ? AND family_id = ?',
      [params.id, session.family_id]
    );
    if (docCheck.length === 0) {
      return NextResponse.json(
        { error: 'Documentation not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, description, event_id } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Verify event belongs to user's family if event_id is provided
    if (event_id) {
      const [eventCheck]: any = await pool.query(
        'SELECT id FROM family_events WHERE id = ? AND family_id = ?',
        [parseInt(event_id), session.family_id]
      );
      if (eventCheck.length === 0) {
        return NextResponse.json(
          { error: 'Event not found or does not belong to your family' },
          { status: 400 }
        );
      }
    }

    await pool.query(
      `UPDATE documentation 
       SET title = ?, description = ?, event_id = ?
       WHERE id = ? AND family_id = ?`,
      [title, description || null, event_id || null, params.id, session.family_id]
    );

    const [updated] = await pool.query(
      `SELECT d.*, 
              u.name as uploaded_by_name,
              e.title as event_title
       FROM documentation d
       LEFT JOIN users u ON d.uploaded_by = u.id
       LEFT JOIN family_events e ON d.event_id = e.id
       WHERE d.id = ?`,
      [params.id]
    );

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    console.error('Error updating documentation:', error);
    return NextResponse.json(
      { error: 'Failed to update documentation' },
      { status: 500 }
    );
  }
}
