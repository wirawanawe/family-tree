import pool from './db';

interface AuditLogData {
  member_id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changed_by: number | null;
  changed_fields?: string[];
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
}

/**
 * Create audit log entry for member changes
 */
export async function createMemberAuditLog(data: AuditLogData) {
  try {
    const { member_id, action, changed_by, changed_fields, old_values, new_values } = data;

    await pool.query(
      `INSERT INTO member_audit_log 
       (member_id, action, changed_by, changed_fields, old_values, new_values)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        member_id,
        action,
        changed_by || null,
        changed_fields ? JSON.stringify(changed_fields) : null,
        old_values ? JSON.stringify(old_values) : null,
        new_values ? JSON.stringify(new_values) : null,
      ]
    );
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit log failure shouldn't break the main operation
  }
}

/**
 * Compare two objects and return changed fields
 */
export function getChangedFields(oldData: Record<string, any>, newData: Record<string, any>): string[] {
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  
  for (const key of allKeys) {
    if (oldData[key] !== newData[key]) {
      changed.push(key);
    }
  }
  
  return changed;
}
