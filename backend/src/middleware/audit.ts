import { v4 as uuidv4 } from 'uuid';
import db from '../database';

interface AuditParams {
  userId?: string;
  userName?: string;
  userEmail?: string;
  action: string;
  tableName: string;
  recordId: string;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  ip?: string;
}

export function logAudit(params: AuditParams): void {
  try {
    db.prepare(`
      INSERT INTO audit_logs
        (id, user_id, user_name, user_email, action, table_name, record_id, old_data, new_data, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      params.userId ?? null,
      params.userName ?? null,
      params.userEmail ?? null,
      params.action,
      params.tableName,
      params.recordId,
      params.oldData ? JSON.stringify(params.oldData) : null,
      params.newData ? JSON.stringify(params.newData) : null,
      params.ip ?? null,
    );
  } catch (err) {
    console.error('[AUDIT] Falha ao registrar log de auditoria:', err);
  }
}

export function getIp(req: { headers: any; ip?: string }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || 'unknown';
}
