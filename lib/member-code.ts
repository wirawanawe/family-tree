import pool from './db';

/**
 * Generate unique member code
 * Format: MEM + timestamp + random string (MEM20241201123456ABC123)
 */
export async function generateMemberCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const memberCode = `MEM${timestamp}${randomStr}`;

    // Check if code already exists
    const [existing]: any = await pool.query(
      'SELECT id FROM family_members WHERE member_code = ?',
      [memberCode]
    );

    if (existing.length === 0) {
      return memberCode;
    }

    attempts++;
  }

  // Fallback if all attempts fail
  return `MEM${Date.now()}${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}

/**
 * Get member by member_code (can be from any family)
 * Code is case-insensitive (normalized to uppercase)
 */
export async function getMemberByCode(memberCode: string) {
  const normalizedCode = memberCode.toUpperCase().trim();
  const [rows]: any = await pool.query(
    'SELECT * FROM family_members WHERE UPPER(member_code) = ?',
    [normalizedCode]
  );
  return rows.length > 0 ? rows[0] : null;
}
