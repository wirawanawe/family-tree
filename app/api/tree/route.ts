import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type MemberRow = {
  id: number;
  family_id: number;
  member_code?: string | null;
  name: string;
  gender: 'male' | 'female';
  birth_date: string | null;
  death_date: string | null;
  father_id: number | null;
  mother_id: number | null;
  spouse_id: number | null;
  no_hp: string | null;
  alamat: string | null;
  email: string | null;
  child_order: number | null;
  photo_url: string | null;
  notes: string | null;
};

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

    // Get all members with their relationships for the user's family
    const [members]: any = await pool.query(
      `SELECT 
        id, family_id, member_code, name, gender, birth_date, death_date, 
        father_id, mother_id, spouse_id, child_order, no_hp, alamat, email, photo_url, notes
       FROM family_members 
       WHERE family_id = ?
       ORDER BY birth_date ASC`,
      [session.family_id]
    );

    const memberIds = members.map((m: any) => m.id).filter(Boolean);
    const spouseIds = members.map((m: any) => m.spouse_id).filter(Boolean);

    let extraMembers: any[] = [];

    // If spouses are from other families, include them and their children so the tree is complete
    if (spouseIds.length > 0) {
      const placeholders = spouseIds.map(() => '?').join(',');

      // Spouses not in current family
      const [externalSpouses]: any = await pool.query(
        `SELECT 
          id, family_id, member_code, name, gender, birth_date, death_date,
          father_id, mother_id, spouse_id, child_order, no_hp, alamat, email, photo_url, notes
         FROM family_members
         WHERE id IN (${placeholders}) AND family_id <> ?`,
        [...spouseIds, session.family_id]
      );

      // Children linked to any parent in current family or external spouses
      const parentIds = [...memberIds, ...spouseIds];
      const parentPlaceholders = parentIds.map(() => '?').join(',');
      const [relatedChildren]: any = parentIds.length
        ? await pool.query(
            `SELECT 
              id, family_id, member_code, name, gender, birth_date, death_date,
              father_id, mother_id, spouse_id, child_order, no_hp, alamat, email, photo_url, notes
             FROM family_members
             WHERE father_id IN (${parentPlaceholders}) OR mother_id IN (${parentPlaceholders})`,
            [...parentIds, ...parentIds]
          )
        : [[]];

      // Merge and ensure family_id follows current family for children shown in this tree
      const merged: any[] = [];
      const seen = new Set<number>();
      [...externalSpouses, ...relatedChildren].forEach((m: any) => {
        if (seen.has(m.id)) return;
        seen.add(m.id);
        merged.push({
          ...m,
          family_id: session.family_id, // normalize to current family context
        });
      });

      extraMembers = merged;
    }

    const allMembers: MemberRow[] = [...members, ...extraMembers];

    const childOrderMap = computeChildOrder(allMembers as MemberRow[]);

    // Build tree structure
    const memberMap = new Map();
    const roots: any[] = [];

    // First pass: create all member nodes (without circular references)
    allMembers.forEach((member: any) => {
      memberMap.set(member.id, {
        id: member.id,
        family_id: member.family_id,
        member_code: member.member_code,
        name: member.name,
        gender: member.gender,
        birth_date: member.birth_date,
        death_date: member.death_date,
        father_id: member.father_id,
        mother_id: member.mother_id,
        spouse_id: member.spouse_id,
        no_hp: member.no_hp,
        alamat: member.alamat,
        email: member.email,
        photo_url: member.photo_url,
        notes: member.notes,
        child_order: childOrderMap.get(member.id) ?? null,
        children: [],
      });
    });

    // Second pass: build parent-child relationships
    allMembers.forEach((member: any) => {
      const node = memberMap.get(member.id);

      if (member.father_id && memberMap.has(member.father_id)) {
        const father = memberMap.get(member.father_id);
        if (!father.children.find((c: any) => c.id === member.id)) {
          father.children.push(node);
        }
      }

      if (member.mother_id && memberMap.has(member.mother_id)) {
        const mother = memberMap.get(member.mother_id);
        if (!mother.children.find((c: any) => c.id === member.id)) {
          mother.children.push(node);
        }
      }

      // If no parents, it's a root
      if (!member.father_id && !member.mother_id) {
        if (!roots.find((r) => r.id === member.id)) {
          roots.push(node);
        }
      }
    });

    // Sort children per node by child_order -> birth_date -> id
    const sortChildren = (arr: any[]) => {
      arr.sort((a, b) => {
        const ao = a.child_order ?? Infinity;
        const bo = b.child_order ?? Infinity;
        if (ao !== bo) return ao - bo;
        const da = a.birth_date ? new Date(a.birth_date).getTime() : Infinity;
        const db = b.birth_date ? new Date(b.birth_date).getTime() : Infinity;
        if (da !== db) return da - db;
        return a.id - b.id;
      });
      arr.forEach((child) => sortChildren(child.children || []));
    };

    roots.forEach((r) => sortChildren(r.children || []));

    // Convert to plain objects to avoid circular references
    const serializeTree = (node: any): any => {
      return {
        id: node.id,
        family_id: node.family_id,
        member_code: node.member_code,
        name: node.name,
        gender: node.gender,
        birth_date: node.birth_date,
        death_date: node.death_date,
        father_id: node.father_id,
        mother_id: node.mother_id,
        spouse_id: node.spouse_id,
        no_hp: node.no_hp,
        alamat: node.alamat,
        email: node.email,
        photo_url: node.photo_url,
        notes: node.notes,
        child_order: node.child_order ?? null,
        children: node.children.map((child: any) => serializeTree(child)),
      };
    };

    const serializedRoots = roots.map((root) => serializeTree(root));
    const serializedMembers = Array.from(memberMap.values()).map((member) => serializeTree(member));

    return NextResponse.json({
      roots: serializedRoots,
      members: serializedMembers,
    });
  } catch (error: any) {
    console.error('Error fetching tree:', error);
    return NextResponse.json(
      { error: 'Failed to fetch family tree' },
      { status: 500 }
    );
  }
}
