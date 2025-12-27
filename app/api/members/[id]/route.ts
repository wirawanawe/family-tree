import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createMemberAuditLog, getChangedFields } from '@/lib/audit';
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
  // accept 'YYYY-MM-DD' or ISO string; trim to date part
  if (typeof value === 'string') {
    return value.split('T')[0] || null;
  }
  return null;
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

// Helper function to delete all birthday events for a member (by old name)
async function deleteBirthdayEvents(familyId: number, oldMemberName: string): Promise<void> {
  try {
    await pool.query(
      `DELETE FROM family_events 
       WHERE family_id = ? 
       AND title LIKE ?`,
      [familyId, `%Ulang Tahun ${oldMemberName}%`]
    );
    console.log(`[Birthday Event] Deleted old birthday events for ${oldMemberName}`);
  } catch (error) {
    console.error(`[Birthday Event] Error deleting birthday events for ${oldMemberName}:`, error);
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

// Sync birthday events for a specific member - creates events for multiple years
async function syncMemberBirthdayEvents(
  memberId: number,
  memberName: string,
  birthDate: string | Date | null,
  familyId: number,
  createdBy: number | null,
  oldMemberName?: string
): Promise<void> {
  try {
    // Always delete old birthday events (with old name) when member is updated
    if (oldMemberName) {
      await deleteBirthdayEvents(familyId, oldMemberName);
    }
    
    // If birth_date is removed, also delete events with new name
    if (!birthDate) {
      await deleteBirthdayEvents(familyId, memberName);
      console.log(`[Sync Birthday] No birth_date for member ${memberId}, deleted all birthday events`);
      return;
    }
    
    const currentYear = new Date().getFullYear();
    const yearsToCreate = 10; // Create events for 10 years ahead
    
    // Create birthday events for multiple years
    for (let yearOffset = 0; yearOffset < yearsToCreate; yearOffset++) {
      const targetYear = currentYear + yearOffset;
      await createBirthdayEvent(
        memberId,
        memberName,
        birthDate,
        familyId,
        createdBy,
        targetYear
      );
    }
    
    console.log(`[Sync Birthday] Completed syncing birthday events for ${memberName}`);
  } catch (error) {
    console.error('[Sync Birthday] Error syncing birthday events:', error);
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
      null, // spouse not linked across families
      member.family_id !== targetFamilyId
        ? { originFamilyId: member.family_id, originMemberId: member.id }
        : {}
    );

    await pool.query(
      'UPDATE family_members SET father_id = ?, mother_id = ? WHERE id = ?',
      [mappedFather, mappedMother, cloned.id]
    );

    idMap.set(member.id, cloned.id);
  }
}

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
      'SELECT * FROM family_members WHERE id = ? AND family_id = ?',
      [params.id, session.family_id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Family member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    console.error('Error fetching member:', error);
    return NextResponse.json(
      { error: 'Failed to fetch family member' },
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

    // All authenticated users can update members

    // Get old member data for audit log
    const [oldMemberRows]: any = await pool.query(
      'SELECT * FROM family_members WHERE id = ? AND family_id = ?',
      [params.id, session.family_id]
    );
    if (oldMemberRows.length === 0) {
      return NextResponse.json(
        { error: 'Family member not found' },
        { status: 404 }
      );
    }
    const oldMember = oldMemberRows[0];

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

    // Get old spouse_id to handle bidirectional update
    const oldSpouseId = oldMember.spouse_id;

    await pool.query(
      `UPDATE family_members 
       SET name = ?, gender = ?, birth_date = ?, death_date = ?,
           father_id = ?, mother_id = ?, spouse_id = ?, child_order = ?, no_hp = ?, alamat = ?, email = ?, photo_url = ?, notes = ?
       WHERE id = ? AND family_id = ?`,
      [
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
        params.id,
        session.family_id,
      ]
    );

    if (clonedSpouse) {
      await pool.query(
        'UPDATE family_members SET spouse_id = ? WHERE id = ?',
        [parseInt(params.id), clonedSpouse.id]
      );

      // Clone descendants of the spouse into current family and connect to the updating member as other parent
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

          // If the original parent was the spouse being cloned, set the other parent to the current member
          if (member.father_id === spouseFromOtherFamily.id || member.mother_id === spouseFromOtherFamily.id) {
            if (gender === 'male') {
              fatherId = fatherId ?? parseInt(params.id);
            } else {
              motherId = motherId ?? parseInt(params.id);
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

    if (oldSpouseId && !finalSpouseId) {
      // If spouse was removed (finalSpouseId is null), also remove from the other side
      // This handles both same family and cross-family spouse removal
      const [oldSpouseData]: any = await pool.query(
        'SELECT * FROM family_members WHERE id = ?',
        [oldSpouseId]
      );
      if (Array.isArray(oldSpouseData) && oldSpouseData.length > 0) {
        // Always remove reverse link if it still points back
        if (oldSpouseData[0].spouse_id === parseInt(params.id)) {
          await pool.query(
            'UPDATE family_members SET spouse_id = NULL WHERE id = ?',
            [oldSpouseId]
          );
        }

        // If spouse is a cloned partner in this family, remove the record but keep descendants.
        const isClonedSpouse =
          oldSpouseData[0].family_id === session.family_id &&
          typeof oldSpouseData[0].notes === 'string' &&
          oldSpouseData[0].notes.includes('CLONED_FROM:');

        if (isClonedSpouse) {
          await pool.query(
            `UPDATE family_members
             SET father_id = CASE WHEN father_id = ? THEN NULL ELSE father_id END,
                 mother_id = CASE WHEN mother_id = ? THEN NULL ELSE mother_id END
             WHERE family_id = ? AND (father_id = ? OR mother_id = ?)`,
            [oldSpouseId, oldSpouseId, session.family_id, oldSpouseId, oldSpouseId]
          );

          await pool.query(
            'DELETE FROM family_members WHERE id = ? AND family_id = ?',
            [oldSpouseId, session.family_id]
          );
        }
      }
    }

    if (finalSpouseId && oldSpouseId && finalSpouseId !== oldSpouseId) {
      // If spouse changed (different spouse_id), remove old spouse's connection too
      const [oldSpouseData]: any = await pool.query(
        'SELECT family_id, spouse_id FROM family_members WHERE id = ?',
        [oldSpouseId]
      );
      if (Array.isArray(oldSpouseData) && oldSpouseData.length > 0 && oldSpouseData[0].spouse_id === parseInt(params.id)) {
        // Remove old spouse's connection
        await pool.query(
          'UPDATE family_members SET spouse_id = NULL WHERE id = ?',
          [oldSpouseId]
        );
      }
    }

    if (finalSpouseId && !clonedSpouse) {
      const [spouseData]: any = await pool.query(
        'SELECT family_id FROM family_members WHERE id = ?',
        [finalSpouseId]
      );
      if (Array.isArray(spouseData) && spouseData.length > 0 && spouseData[0].family_id === session.family_id) {
        await pool.query(
          'UPDATE family_members SET spouse_id = ? WHERE id = ?',
          [parseInt(params.id), finalSpouseId]
        );
      }
    }

    const [updated] = await pool.query(
      'SELECT * FROM family_members WHERE id = ?',
      [params.id]
    );

    // Create audit log for member update
    const newMember = updated[0];
    const changedFields = getChangedFields(oldMember, newMember);
    if (changedFields.length > 0) {
      const oldValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};
      changedFields.forEach(field => {
        oldValues[field] = oldMember[field];
        newValues[field] = newMember[field];
      });

      await createMemberAuditLog({
        member_id: parseInt(params.id),
        action: 'UPDATE',
        changed_by: session.id,
        changed_fields: changedFields,
        old_values: oldValues,
        new_values: newValues,
      });
    }

    // Sync birthday events when member is updated
    // This will delete old events and create new ones for 10 years ahead
    // Always sync to handle name changes, birth_date changes, or birth_date removal
    const oldMemberName = oldMember.name;
    await syncMemberBirthdayEvents(
      parseInt(params.id),
      name,
      normalizeDate(birth_date),
      session.family_id,
      null, // Use null for system-generated events
      oldMemberName
    );

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Failed to update family member' },
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

    // All authenticated users can delete members

    // Get member data for audit log before deletion
    const [memberCheck]: any = await pool.query(
      'SELECT * FROM family_members WHERE id = ? AND family_id = ?',
      [params.id, session.family_id]
    );
    if (memberCheck.length === 0) {
      return NextResponse.json(
        { error: 'Family member not found' },
        { status: 404 }
      );
    }

    // Create audit log for member deletion
    await createMemberAuditLog({
      member_id: parseInt(params.id),
      action: 'DELETE',
      changed_by: session.id,
      old_values: memberCheck[0],
    });

    await pool.query('DELETE FROM family_members WHERE id = ? AND family_id = ?', [params.id, session.family_id]);
    return NextResponse.json({ message: 'Family member deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      { error: 'Failed to delete family member' },
      { status: 500 }
    );
  }
}
