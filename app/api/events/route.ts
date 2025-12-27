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

// Helper function to calculate birthday date for a specific year based on birth_date
function calculateBirthdayForYear(birthDate: string | Date | null, year: number): string | null {
  if (!birthDate) return null;
  
  try {
    let month: string;
    let day: string;
    
    // Handle Date object from MySQL
    if (birthDate instanceof Date) {
      // Use local date components to avoid timezone issues
      month = String(birthDate.getMonth() + 1).padStart(2, '0');
      day = String(birthDate.getDate()).padStart(2, '0');
    } else if (typeof birthDate === 'string') {
      // Parse date string directly to avoid timezone issues
      // Expected format: YYYY-MM-DD
      let dateStr = birthDate.split('T')[0].split(' ')[0];
      const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dateMatch) return null;
      [, , month, day] = dateMatch;
    } else {
      return null;
    }
    
    // Format as YYYY-MM-DD directly, avoiding Date object timezone issues
    return `${year}-${month}-${day}`;
  } catch (error) {
    return null;
  }
}

// Helper function to create birthday event automatically for a specific year
async function createBirthdayEvent(
  memberId: number,
  memberName: string,
  birthDate: string | Date | null,
  familyId: number,
  createdBy: number | null,
  targetYear: number
): Promise<void> {
  if (!birthDate) {
    console.log(`[Birthday Event] Skipping - no birth_date for member ${memberId}`);
    return;
  }
  
  const birthdayDate = calculateBirthdayForYear(birthDate, targetYear);
  if (!birthdayDate) {
    console.log(`[Birthday Event] Skipping - invalid birth_date format: ${birthDate} for member ${memberId}`);
    return;
  }
  
  try {
    // Check if birthday event already exists for this member on this specific date
    const [existing]: any = await pool.query(
      `SELECT id FROM family_events 
       WHERE family_id = ? 
       AND (
         (title = ? AND event_date = ?)
         OR (title LIKE ? AND event_date = ?)
       )`,
      [
        familyId,
        `Ulang Tahun ${memberName}`,
        birthdayDate,
        `%Ulang Tahun ${memberName}%`,
        birthdayDate
      ]
    );
    
    // If event already exists, skip creation
    if (Array.isArray(existing) && existing.length > 0) {
      console.log(`[Birthday Event] Already exists for ${memberName} on ${birthdayDate}`);
      return;
    }
    
    // Calculate age for the target year - extract year from birth_date
    let birthYear: number;
    if (birthDate instanceof Date) {
      birthYear = birthDate.getFullYear();
    } else if (typeof birthDate === 'string') {
      const dateStr = birthDate.split('T')[0].split(' ')[0];
      const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dateMatch) {
        console.log(`[Birthday Event] Invalid date format: ${birthDate}`);
        return;
      }
      birthYear = parseInt(dateMatch[1], 10);
    } else {
      console.log(`[Birthday Event] Invalid date type: ${typeof birthDate}`);
      return;
    }
    
    const ageForYear = targetYear - birthYear;
    
    // Create birthday event
    const [result]: any = await pool.query(
      `INSERT INTO family_events 
       (family_id, title, description, event_date, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        familyId,
        `Ulang Tahun ${memberName}`,
        `Ulang tahun ke-${ageForYear} ${memberName}`,
        birthdayDate,
        createdBy,
      ]
    );
    
    console.log(`[Birthday Event] Created for ${memberName} on ${birthdayDate} (age ${ageForYear})`);
  } catch (error) {
    console.error(`[Birthday Event] Error creating birthday event for ${memberName}:`, error);
  }
}

// Sync birthday events for all members with birth_date - creates events for multiple years
async function syncBirthdayEvents(familyId: number, createdBy: number | null): Promise<void> {
  try {
    // Get all members with birth_date (IS NOT NULL is sufficient for DATE type)
    const [members]: any = await pool.query(
      'SELECT id, name, birth_date FROM family_members WHERE family_id = ? AND birth_date IS NOT NULL',
      [familyId]
    );
    
    if (!Array.isArray(members)) {
      console.log(`[Sync Birthday] No members found for family ${familyId}`);
      return;
    }
    
    console.log(`[Sync Birthday] Found ${members.length} members with birth_date for family ${familyId}`);
    
    const currentYear = new Date().getFullYear();
    const yearsToCreate = 10; // Create events for 10 years ahead
    
    // Create birthday events for each member for multiple years
    for (const member of members) {
      if (member.birth_date) {
        // Create events for current year and future years
        for (let yearOffset = 0; yearOffset < yearsToCreate; yearOffset++) {
          const targetYear = currentYear + yearOffset;
          await createBirthdayEvent(
            member.id,
            member.name,
            member.birth_date,
            familyId,
            createdBy,
            targetYear
          );
        }
      }
    }
    
    console.log(`[Sync Birthday] Completed syncing birthday events for ${yearsToCreate} years`);
  } catch (error) {
    console.error('[Sync Birthday] Error syncing birthday events:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.family_id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Sync birthday events for all members (ensure all birthdays are in calendar)
    // Use null for created_by since these are system-generated birthday events
    await syncBirthdayEvents(session.family_id, null);

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
