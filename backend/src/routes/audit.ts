import { Router, Response } from 'express';
import db from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', (req: AuthRequest, res: Response) => {
  const { user_id, action, table_name, record_id, start_date, end_date } = req.query;
  const rawPage  = parseInt(String(req.query.page  || '1'),  10);
  const rawLimit = parseInt(String(req.query.limit || '50'), 10);
  const page  = isNaN(rawPage)  || rawPage  < 1 ? 1  : rawPage;
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 200);
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params: any[] = [];

  if (user_id)    { where += ' AND user_id = ?';                            params.push(user_id); }
  if (action)     { where += ' AND action = ?';                             params.push(action); }
  if (table_name) { where += ' AND table_name = ?';                         params.push(table_name); }
  if (record_id)  { where += ' AND record_id = ?';                          params.push(record_id); }
  if (start_date) { where += " AND date(created_at) >= ?";                  params.push(start_date); }
  if (end_date)   { where += " AND date(created_at) <= ?";                  params.push(end_date); }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM audit_logs WHERE ${where}`).get(...params) as any).c;
  const rows  = db.prepare(`SELECT * FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  res.json({ data: rows, total, page, limit });
});

// Distinct values for filter dropdowns
router.get('/actions', (_req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action').all();
  res.json((rows as any[]).map((r) => r.action));
});

router.get('/tables', (_req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT DISTINCT table_name FROM audit_logs WHERE table_name IS NOT NULL ORDER BY table_name').all();
  res.json((rows as any[]).map((r) => r.table_name));
});

export default router;
