import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

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
    const eventId = searchParams.get('event_id');
    const fileType = searchParams.get('type'); // 'photo' or 'video'

    let query = `
      SELECT d.*, 
             u.name as uploaded_by_name,
             e.title as event_title
      FROM documentation d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN family_events e ON d.event_id = e.id
      WHERE d.family_id = ?
    `;
    const params: any[] = [session.family_id];

    if (eventId) {
      query += ' AND d.event_id = ?';
      params.push(eventId);
    }

    if (fileType) {
      query += ' AND d.file_type = ?';
      params.push(fileType);
    }

    query += ' ORDER BY d.created_at DESC';

    const [rows] = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching documentation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documentation' },
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

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const fileType = formData.get('file_type') as string;
    const eventId = formData.get('event_id') as string;
    const file = formData.get('file') as File;

    if (!title || !fileType || !file) {
      return NextResponse.json(
        { error: 'Title, file type, and file are required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (fileType !== 'photo' && fileType !== 'video') {
      return NextResponse.json(
        { error: 'Invalid file type. Must be photo or video' },
        { status: 400 }
      );
    }

    // Validate file
    const maxSize = fileType === 'photo' ? 10 * 1024 * 1024 : 100 * 1024 * 1024; // 10MB for photos, 100MB for videos
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed size (${fileType === 'photo' ? '10MB' : '100MB'})` },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', fileType);
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const filePath = join(uploadsDir, fileName);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Generate file URL
    const fileUrl = `/uploads/${fileType}/${fileName}`;

    // For videos, we might want to generate a thumbnail later
    // For now, we'll use the first frame or a placeholder
    let thumbnailUrl = null;
    if (fileType === 'video') {
      // Placeholder for video thumbnail - can be enhanced later
      thumbnailUrl = '/video-placeholder.png';
    }

    // Verify event belongs to user's family if eventId is provided
    if (eventId) {
      const [eventCheck]: any = await pool.query(
        'SELECT id FROM family_events WHERE id = ? AND family_id = ?',
        [parseInt(eventId), session.family_id]
      );
      if (eventCheck.length === 0) {
        return NextResponse.json(
          { error: 'Event not found or does not belong to your family' },
          { status: 400 }
        );
      }
    }

    // Insert into database
    const [result]: any = await pool.query(
      `INSERT INTO documentation 
       (family_id, title, description, file_type, file_url, thumbnail_url, event_id, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.family_id,
        title,
        description || null,
        fileType,
        fileUrl,
        thumbnailUrl,
        eventId ? parseInt(eventId) : null,
        session.id,
      ]
    );

    const [newDoc] = await pool.query(
      `SELECT d.*, 
              u.name as uploaded_by_name,
              e.title as event_title
       FROM documentation d
       LEFT JOIN users u ON d.uploaded_by = u.id
       LEFT JOIN family_events e ON d.event_id = e.id
       WHERE d.id = ?`,
      [result.insertId]
    );

    return NextResponse.json(newDoc[0], { status: 201 });
  } catch (error: any) {
    console.error('Error uploading documentation:', error);
    return NextResponse.json(
      { error: 'Failed to upload documentation' },
      { status: 500 }
    );
  }
}
