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
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'string') {
    return value.split('T')[0].split(' ')[0];
  }
  return value;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.family_id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    let query = 'SELECT * FROM family_events WHERE family_id = ?';
    const params: any[] = [session.family_id];

    if (month && year) {
      query += ' AND YEAR(event_date) = ? AND MONTH(event_date) = ?';
      params.push(year, month);
    }

    query += ' ORDER BY event_date ASC, event_time ASC';

    const [rows]: any = await pool.query(query, params);
    
    // Normalize dates to YYYY-MM-DD format
    const normalizedRows = rows.map((row: any) => ({
      ...row,
      event_date: normalizeDateResponse(row.event_date),
    }));
    
    return NextResponse.json(normalizedRows);
  } catch (error: any) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.family_id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // All authenticated users can create events

    const body = await request.json();
    const { title, description, event_date, event_time, location, created_by } = body;

    if (!title || !event_date) {
      return NextResponse.json(
        { error: 'Title and event date are required' },
        { status: 400 }
      );
    }

    const [result]: any = await pool.query(
      `INSERT INTO family_events 
       (family_id, title, description, event_date, event_time, location, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        session.family_id,
        title,
        description || null,
        normalizeDate(event_date),
        event_time || null,
        location || null,
        created_by || session.member_id || null,
      ]
    );

    const [newEvent]: any = await pool.query(
      'SELECT * FROM family_events WHERE id = ?',
      [result.insertId]
    );

    // Normalize date format
    const event = {
      ...newEvent[0],
      event_date: normalizeDateResponse(newEvent[0].event_date),
    };

    return NextResponse.json(event, { status: 201 });
  } catch (error: any) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
