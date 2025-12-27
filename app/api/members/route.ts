import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createMemberAuditLog } from '@/lib/audit';
import { generateMemberCode, getMemberByCode } from '@/lib/member-code';

type MemberRow = {
  id: number;
  family_id: number;
  member_code: string;
  name: string;
  gender: 'male' | 'female';
  birth_date: string | null;
  death_date: string | null;
  father_id: number | null;
  mother_id: number | null;
  spouse_id: number | null;
  child_order: number | null;
  no_hp: string | null;
  alamat: string | null;
  email: string | null;
  photo_url: string | null;
  notes: string | null;
};

const normalizeDate = (value: any) => {
  if (!value) return null;
  if (typeof value === 'string') {
    return value.split('T')[0] || null;
  }
  return null;
};

// Helper function to calculate birthday date for current year based on birth_date
function calculateBirthdayThisYear(birthDate: string | null): string | null {
  if (!birthDate) return null;
  
  try {
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;
    
    const currentYear = new Date().getFullYear();
    const birthdayThisYear = new Date(currentYear, birth.getMonth(), birth.getDate());
    
    // Format as YYYY-MM-DD
    const year = birthdayThisYear.getFullYear();
    const month = String(birthdayThisYear.getMonth() + 1).padStart(2, '0');
    const day = String(birthdayThisYear.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    return null;
  }
}

// Helper function to create birthday event automatically
async function createBirthdayEvent(
  memberId: number,
  memberName: string,
  birthDate: string | null,
  familyId: number,
  createdBy: number | null
): Promise<void> {
  if (!birthDate) return;
  
  // Normalize birth_date format (handle various formats)
  let normalizedBirthDate = birthDate;
  if (typeof birthDate === 'string') {
    normalizedBirthDate = birthDate.split('T')[0].split(' ')[0];
  }
  
  const birthdayThisYear = calculateBirthdayThisYear(normalizedBirthDate);
  if (!birthdayThisYear) return;
  
  try {
    // Check if birthday event already exists for this member this year
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
        birthdayThisYear,
        `%Ulang Tahun ${memberName}%`,
        birthdayThisYear
      ]
    );
    
    // If event already exists, skip creation
    if (Array.isArray(existing) && existing.length > 0) {
      return;
    }
    
    // Calculate age
    const birth = new Date(normalizedBirthDate);
    if (isNaN(birth.getTime())) return;
    
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    const dayDiff = today.getDate() - birth.getDate();
    const actualAge = (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) ? age - 1 : age;
    
    // Create birthday event
    await pool.query(
      `INSERT INTO family_events 
       (family_id, title, description, event_date, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        familyId,
        `Ulang Tahun ${memberName}`,
        `Ulang tahun ke-${actualAge + 1} ${memberName}`,
        birthdayThisYear,
        createdBy,
      ]
    );
  } catch (error) {
    console.error('Error creating birthday event:', error);
  }
}

type CloneMeta = {
  originFamilyId?: number;
  originMemberId?: number;
};

async function cloneMemberToFamily(
  source: MemberRow,
  targetFamilyId: number,
  spouseId: number | null,
  meta: CloneMeta = {}
) {
  const memberCode = await generateMemberCode();
  const marker =
    meta.originFamilyId && meta.originMemberId
      ? `CLONED_FROM:${meta.originFamilyId}:${meta.originMemberId}`
      : '';
  const mergedNotes = [source.notes, marker].filter(Boolean).join(' ').trim() || null;
  const [result]: any = await pool.query(
    `INSERT INTO family_members
     (family_id, member_code, name, gender, birth_date, death_date, father_id, mother_id, spouse_id, child_order, no_hp, alamat, email, photo_url, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      targetFamilyId,
      memberCode,
      source.name,
      source.gender,
      normalizeDate(source.birth_date),
      normalizeDate(source.death_date),
      null,
      null,
      spouseId,
      source.child_order ?? null,
      source.no_hp ?? null,
      source.alamat ?? null,
      source.email ?? null,
      source.photo_url ?? null,
      mergedNotes,
    ]
  );

  const [rows]: any = await pool.query(
    'SELECT * FROM family_members WHERE id = ?',
    [result.insertId]
  );
  return rows[0] as MemberRow;
}

async function fetchFamilyMembers(familyId: number): Promise<MemberRow[]> {
  const [rows]: any = await pool.query(
    'SELECT * FROM family_members WHERE family_id = ?',
    [familyId]
  );
  return (Array.isArray(rows) ? rows : []) as MemberRow[];
}

function collectDescendants(rootId: number, members: MemberRow[]) {
  if (!Array.isArray(members)) {
    return [];
  }
  const byParent: Record<string, MemberRow[]> = {};
  members.forEach((m) => {
    const keyFather = m.father_id ? `f-${m.father_id}` : null;
    const keyMother = m.mother_id ? `m-${m.mother_id}` : null;
    if (keyFather) {
      if (!byParent[keyFather]) byParent[keyFather] = [];
      byParent[keyFather].push(m);
    }
    if (keyMother) {
      if (!byParent[keyMother]) byParent[keyMother] = [];
      byParent[keyMother].push(m);
    }
  });

  const descendants: MemberRow[] = [];
  const queue: number[] = [rootId];
  const visited = new Set<number>([rootId]);

  while (queue.length) {
    const current = queue.shift()!;
    const children = [
      ...(byParent[`f-${current}`] || []),
      ...(byParent[`m-${current}`] || []),
    ];
    children.forEach((child) => {
      if (!visited.has(child.id)) {
        visited.add(child.id);
        descendants.push(child);
        queue.push(child.id);
      }
    });
  }

  return descendants;
}

async function cloneDescendants(
  sourceRoot: MemberRow,
  newRootId: number,
  targetFamilyId: number
) {
  const members = await fetchFamilyMembers(sourceRoot.family_id);
  const descendants = collectDescendants(sourceRoot.id, members);
  const idMap = new Map<number, number>();
  idMap.set(sourceRoot.id, newRootId);

  for (const member of descendants) {
    const mappedFather = member.father_id ? idMap.get(member.father_id) || null : null;
    const mappedMother = member.mother_id ? idMap.get(member.mother_id) || null : null;
    const cloned = await cloneMemberToFamily(
      member,
      targetFamilyId,
      null, // spouse is not cloned here to avoid cross-family links
      member.family_id !== targetFamilyId
        ? { originFamilyId: member.family_id, originMemberId: member.id }
        : {}
    );

    // Update parents after insert if we have mappings
    await pool.query(
      'UPDATE family_members SET father_id = ?, mother_id = ? WHERE id = ?',
      [mappedFather, mappedMother, cloned.id]
    );

    idMap.set(member.id, cloned.id);
  }
}

function computeChildOrder(members: MemberRow[]) {
  const orderMap = new Map<number, number>();
  const groups = new Map<string, MemberRow[]>();

  members.forEach((m) => {
    if (!m.father_id && !m.mother_id) return;
    const key = `${m.father_id ?? 'null'}-${m.mother_id ?? 'null'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  });

  groups.forEach((group) => {
    group
      .sort((a, b) => {
        const ao = a.child_order ?? Infinity;
        const bo = b.child_order ?? Infinity;
        if (ao !== bo) return ao - bo;
        const da = a.birth_date ? new Date(a.birth_date).getTime() : Infinity;
        const db = b.birth_date ? new Date(b.birth_date).getTime() : Infinity;
        if (da !== db) return da - db;
        return a.id - b.id;
      })
      .forEach((member, idx) => {
        const existing = member.child_order;
        orderMap.set(member.id, existing ?? idx + 1);
      });
  });

  return orderMap;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.family_id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const [rows]: any = await pool.query(
      'SELECT * FROM family_members WHERE family_id = ? ORDER BY created_at DESC',
      [session.family_id]
    );
    const orderMap = computeChildOrder(rows as MemberRow[]);
    const withOrder = (rows as MemberRow[]).map((m) => ({
      ...m,
      child_order: orderMap.get(m.id) ?? null,
    }));
    return NextResponse.json(withOrder);
  } catch (error: any) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch family members' },
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

    // All authenticated users can add members

    const body = await request.json();
    const {
      name,
      gender,
      birth_date,
      death_date,
      father_id,
      mother_id,
      spouse_id,
      spouse_code, // New: code for spouse from another family
      child_order,
      no_hp,
      alamat,
      email,
      photo_url,
      notes,
    } = body;

    if (!name || !gender) {
      return NextResponse.json(
        { error: 'Name and gender are required' },
        { status: 400 }
      );
    }

    // Generate unique member_code
    const memberCode = await generateMemberCode();

    // Handle spouse connection - if spouse_code is provided from other family,
    // clone their data into the current family as a new member.
    let finalSpouseId = spouse_id || null;
    let clonedSpouse: MemberRow | null = null;
    let spouseFromOtherFamily: MemberRow | null = null;

    if (spouse_code && !spouse_id) {
      const spouseMember = await getMemberByCode(spouse_code);
      if (!spouseMember) {
        return NextResponse.json(
          { error: 'Kode pasangan tidak ditemukan. Pastikan kode pasangan sudah benar.' },
          { status: 400 }
        );
      }

      if (spouseMember.family_id !== session.family_id) {
        spouseFromOtherFamily = spouseMember as MemberRow;
        clonedSpouse = await cloneMemberToFamily(
          spouseMember as MemberRow,
          session.family_id,
          null,
          { originFamilyId: spouseMember.family_id, originMemberId: spouseMember.id }
        );
        finalSpouseId = clonedSpouse.id;
      } else {
        finalSpouseId = spouseMember.id;
      }
    }

    // Verify that parent members belong to the same family
    // But spouse can be from different family (handled above)
    if (father_id || mother_id) {
      const parentIds = [father_id, mother_id].filter(Boolean);
      if (parentIds.length > 0) {
        const placeholders = parentIds.map(() => '?').join(',');
        const [parentCheck]: any = await pool.query(
          `SELECT id FROM family_members WHERE id IN (${placeholders}) AND family_id = ?`,
          [...parentIds, session.family_id]
        );
        if (!Array.isArray(parentCheck) || parentCheck.length !== parentIds.length) {
          return NextResponse.json(
            { error: 'Orang tua harus berasal dari keluarga yang sama' },
            { status: 400 }
          );
        }
      }
    }

    const [result]: any = await pool.query(
      `INSERT INTO family_members 
       (family_id, member_code, name, gender, birth_date, death_date, father_id, mother_id, spouse_id, child_order, no_hp, alamat, email, photo_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.family_id,
        memberCode,
        name,
        gender,
        normalizeDate(birth_date),
        normalizeDate(death_date),
        father_id || null,
        mother_id || null,
        finalSpouseId,
        child_order || null,
        no_hp || null,
        alamat || null,
        email || null,
        photo_url || null,
        notes || null,
      ]
    );

    if (clonedSpouse) {
      // Link the cloned spouse inside the current family to this new member
      await pool.query(
        'UPDATE family_members SET spouse_id = ? WHERE id = ?',
        [result.insertId, clonedSpouse.id]
      );
      
      // Clone descendants of the spouse into current family and connect to the new member as other parent
      if (spouseFromOtherFamily) {
        const members = await fetchFamilyMembers(spouseFromOtherFamily.family_id);
        const descendants = collectDescendants(spouseFromOtherFamily.id, members);
        const idMap = new Map<number, number>();
        idMap.set(spouseFromOtherFamily.id, clonedSpouse.id);

        for (const member of descendants) {
          const mappedFather = member.father_id ? idMap.get(member.father_id) || null : null;
          const mappedMother = member.mother_id ? idMap.get(member.mother_id) || null : null;

          let fatherId = mappedFather;
          let motherId = mappedMother;

          // If the original parent was the spouse being cloned, set the other parent to the new member
          if (member.father_id === spouseFromOtherFamily.id || member.mother_id === spouseFromOtherFamily.id) {
            if (gender === 'male') {
              fatherId = fatherId ?? result.insertId;
            } else {
              motherId = motherId ?? result.insertId;
            }
          }

          const clonedDesc = await cloneMemberToFamily(
            member,
            session.family_id,
            null,
            member.family_id !== session.family_id
              ? { originFamilyId: member.family_id, originMemberId: member.id }
              : {}
          );

          await pool.query(
            'UPDATE family_members SET father_id = ?, mother_id = ? WHERE id = ?',
            [fatherId, motherId, clonedDesc.id]
          );

          idMap.set(member.id, clonedDesc.id);
        }
      }
    } 
    // Removed bidirectional link for cross-family spouses (no mutation to other family)
    if (!clonedSpouse && finalSpouseId) {
      // Keep bidirectional link only within the same family; avoid touching other families
      const [spouseData]: any = await pool.query(
        'SELECT family_id FROM family_members WHERE id = ?',
        [finalSpouseId]
      );
      if (Array.isArray(spouseData) && spouseData.length > 0 && spouseData[0].family_id === session.family_id) {
        await pool.query(
          'UPDATE family_members SET spouse_id = ? WHERE id = ?',
          [result.insertId, finalSpouseId]
        );
      }
    }

    const [newMember] = await pool.query(
      'SELECT * FROM family_members WHERE id = ?',
      [result.insertId]
    );

    // Create audit log for member creation
    await createMemberAuditLog({
      member_id: result.insertId,
      action: 'CREATE',
      changed_by: session.id,
      new_values: newMember[0] as any,
    });

    // Create birthday event if birth_date is provided
    if (birth_date) {
      await createBirthdayEvent(
        result.insertId,
        name,
        normalizeDate(birth_date),
        session.family_id,
        session.id
      );
    }

    return NextResponse.json(newMember[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating member:', error);
    return NextResponse.json(
      { error: 'Failed to create family member' },
      { status: 500 }
    );
  }
}
