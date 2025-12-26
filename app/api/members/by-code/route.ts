import { NextRequest, NextResponse } from 'next/server';
import { getMemberByCode } from '@/lib/member-code';

/**
 * Public endpoint to get member by member_code
 * This allows users to validate spouse_code from other families
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Kode member diperlukan' },
        { status: 400 }
      );
    }

    // Normalize to uppercase for consistency
    const normalizedCode = code.trim().toUpperCase();
    const member = await getMemberByCode(normalizedCode);

    if (!member) {
      return NextResponse.json(
        { error: 'Kode member tidak ditemukan' },
        { status: 404 }
      );
    }

    // Return minimal info: name, gender, family_id (to check if from different family)
    return NextResponse.json({
      id: member.id,
      name: member.name,
      gender: member.gender,
      member_code: member.member_code,
      family_id: member.family_id,
    });
  } catch (error: any) {
    console.error('Error fetching member by code:', error);
    return NextResponse.json(
      { error: 'Failed to fetch member' },
      { status: 500 }
    );
  }
}
