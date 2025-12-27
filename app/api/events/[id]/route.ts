import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

const normalizeDate = (value: any) => {
  if (!value) return null;
  if (typeof value === 'string') {
    return value.split('T')[0] || null;
  }
  return null;
};

const normalizeDateResponse = (value: any) => {
  if (!value) return null;
  if (value instanceof Date) {
    // Use local date components instead of toISOString() to avoid timezone shifts
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'string') {
    return value.split('T')[0].split(' ')[0];
  }
  return value;
};

export async function GET(
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

    const [rows]: any = await pool.query(
      'SELECT * FROM family_events WHERE id = ? AND family_id = ?',
      [params.id, session.family_id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Normalize date format
    const event = {
      ...rows[0],
      event_date: normalizeDateResponse(rows[0].event_date),
    };

    return NextResponse.json(event);
  } catch (error: any) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
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

    // All authenticated users can update events

    // Verify event belongs to user's family
    const [eventCheck]: any = await pool.query(
      'SELECT id FROM family_events WHERE id = ? AND family_id = ?',
      [params.id, session.family_id]
    );
    if (eventCheck.length === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, description, event_date, event_time, location } = body;

    if (!title || !event_date) {
      return NextResponse.json(
        { error: 'Title and event date are required' },
        { status: 400 }
      );
    }

    await pool.query(
      `UPDATE family_events 
       SET title = ?, description = ?, event_date = ?, event_time = ?, location = ?
       WHERE id = ? AND family_id = ?`,
      [
        title,
        description || null,
        normalizeDate(event_date),
        event_time || null,
        location || null,
        params.id,
        session.family_id,
      ]
    );

    const [updated]: any = await pool.query(
      'SELECT * FROM family_events WHERE id = ?',
      [params.id]
    );

    // Normalize date format
    const event = {
      ...updated[0],
      event_date: normalizeDateResponse(updated[0].event_date),
    };

    return NextResponse.json(event);
  } catch (error: any) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

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

    // All authenticated users can delete events

    // Verify event belongs to user's family
    const [eventCheck]: any = await pool.query(
      'SELECT id FROM family_events WHERE id = ? AND family_id = ?',
      [params.id, session.family_id]
    );
    if (eventCheck.length === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    await pool.query('DELETE FROM family_events WHERE id = ? AND family_id = ?', [params.id, session.family_id]);
    return NextResponse.json({ message: 'Event deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}
