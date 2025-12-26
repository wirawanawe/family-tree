import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword, setSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, name, role = 'member', family_code, family_name } = body;

    if (!username || !password || !name) {
      return NextResponse.json(
        { error: 'Username, password, and name are required' },
        { status: 400 }
      );
    }

    if (!family_code) {
      return NextResponse.json(
        { error: 'Kode keluarga wajib diisi' },
        { status: 400 }
      );
    }

    // Normalize family_code to uppercase for consistency
    const normalizedFamilyCode = family_code.toUpperCase().trim();

    if (!normalizedFamilyCode) {
      return NextResponse.json(
        { error: 'Kode keluarga tidak boleh kosong' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const [existing]: any = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = hashPassword(password);
    
    // Determine family_id based on family_code
    let familyId: number | null = null;
    
    // Check if family_code already exists; family codes must be unique
    const [existingFamily]: any = await pool.query(
      'SELECT id FROM families WHERE family_code = ?',
      [normalizedFamilyCode]
    );

    if (existingFamily.length > 0) {
      return NextResponse.json(
        { error: 'Kode keluarga sudah digunakan. Silakan pilih kode lain.' },
        { status: 400 }
      );
    }

    // Family code doesn't exist, create new family with this code
    const familyName = family_name || `${name}'s Family`;
    const [familyResult]: any = await pool.query(
      `INSERT INTO families (name, description, family_code) VALUES (?, ?, ?)`,
      [familyName, `Family tree for ${name}`, normalizedFamilyCode]
    );
    familyId = familyResult.insertId;

    // All users are automatically approved (no approval needed)
    const status = 'approved';

    const [result]: any = await pool.query(
      `INSERT INTO users (username, password, name, role, status, family_id, member_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, name, role, status, familyId, null]
    );

    // Set session immediately (all users are approved)
    await setSession(result.insertId);

    const [newUser] = await pool.query(
      `SELECT u.id, u.username, u.name, u.role, u.status, u.family_id, u.member_id,
              f.name AS family_name, f.family_code, m.name AS member_name, m.member_code
       FROM users u
       LEFT JOIN families f ON u.family_id = f.id
       LEFT JOIN family_members m ON u.member_id = m.id
       WHERE u.id = ?`,
      [result.insertId]
    );

    return NextResponse.json({
      ...newUser[0],
      message: `Registrasi berhasil. Keluarga baru "${family_name || `${name}'s Family`}" dibuat dengan kode "${normalizedFamilyCode}".`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error during registration:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to register' },
      { status: 500 }
    );
  }
}
