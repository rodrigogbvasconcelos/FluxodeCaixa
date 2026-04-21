import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit, getIp } from '../middleware/audit';

const router = Router();
router.use(authenticate);

const VALID_TYPES = new Set(['income', 'expense']);
const MAX_PAGE_SIZE = 200;

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

router.get('/', (req: AuthRequest, res: Response) => {
  const { project_id, type, category_id, start_date, end_date } = req.query;
  const rawPage  = parseInt(String(req.query.page  || '1'),  10);
  const rawLimit = parseInt(String(req.query.limit || '50'), 10);

  const page  = isNaN(rawPage)  || rawPage  < 1 ? 1  : rawPage;
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, MAX_PAGE_SIZE);

  if (type && !VALID_TYPES.has(String(type))) {
    return res.status(400).json({ error: 'Tipo inválido' });
  }

  let where = '1=1';
  const params: any[] = [];

  if (project_id)  { where += ' AND t.project_id = ?';   params.push(project_id); }
  if (type)        { where += ' AND t.type = ?';          params.push(type); }
  if (category_id) { where += ' AND t.category_id = ?';  params.push(category_id); }
  if (start_date)  { where += ' AND t.date >= ?';         params.push(start_date); }
  if (end_date)    { where += ' AND t.date <= ?';         params.push(end_date); }

  const offset = (page - 1) * limit;

  const total = (db.prepare(`SELECT COUNT(*) as c FROM transactions t WHERE ${where}`).get(...params) as any).c;
  const rows = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.type as category_type,
      c.parent_id as category_parent_id,
      pc.name as category_parent_name, pc.color as category_parent_color,
      p.name as project_name, u.name as created_by_name,
      i.original_name as invoice_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN categories pc ON pc.id = c.parent_id
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.created_by
    LEFT JOIN invoices i ON i.id = t.invoice_id
    WHERE ${where}
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ data: rows, total, page, limit });
});

router.post('/', requireRole('admin', 'manager', 'operator'), (req: AuthRequest, res: Response) => {
  const { project_id, category_id, type, amount, description, vendor, document_number,
          date, payment_method, notes, invoice_id, due_date, payment_date, installments } = req.body;

  if (!project_id || !category_id || !type || amount === undefined || !description || !date) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  if (!VALID_TYPES.has(type)) {
    return res.status(400).json({ error: 'Tipo inválido. Use "income" ou "expense"' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount < 0) {
    return res.status(400).json({ error: 'Valor inválido' });
  }

  if (typeof description !== 'string' || description.trim().length === 0 || description.length > 500) {
    return res.status(400).json({ error: 'Descrição inválida' });
  }

  const numInstallments = Math.max(1, Math.min(60, parseInt(installments) || 1));
  const status = payment_date ? 'paid' : 'pending';
  const ip = getIp(req);

  if (numInstallments === 1) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO transactions (id, project_id, category_id, type, amount, description, vendor,
        document_number, date, payment_method, notes, invoice_id, created_by,
        due_date, payment_date, status, installments, installment_number, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
    `).run(id, project_id, category_id, type, parsedAmount, description.trim(), vendor || null,
           document_number || null, date, payment_method || null, notes || null,
           invoice_id || null, req.user!.id,
           due_date || null, payment_date || null, status, id);

    logAudit({
      userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
      action: 'CREATE', tableName: 'transactions', recordId: id,
      newData: { project_id, category_id, type, amount: parsedAmount, description: description.trim(),
                 due_date, payment_date, status, installments: 1 },
      ip,
    });

    return res.status(201).json({ id });
  }

  // Multiple installments
  const parentId = uuidv4();
  const centTotal = Math.round(parsedAmount * 100);
  const centPerInstallment = Math.floor(centTotal / numInstallments);
  const ids: string[] = [];

  const insertStmt = db.prepare(`
    INSERT INTO transactions (id, project_id, category_id, type, amount, description, vendor,
      document_number, date, payment_method, notes, invoice_id, created_by,
      due_date, payment_date, status, installments, installment_number, parent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (let i = 0; i < numInstallments; i++) {
      const id = i === 0 ? parentId : uuidv4();
      ids.push(id);
      const cents = i === numInstallments - 1
        ? centTotal - centPerInstallment * (numInstallments - 1)
        : centPerInstallment;
      const installmentAmount = cents / 100;
      const installmentDueDate = due_date ? addMonths(due_date, i) : null;
      const installmentDesc = `${description.trim()} (${i + 1}/${numInstallments})`;

      insertStmt.run(
        id, project_id, category_id, type, installmentAmount, installmentDesc, vendor || null,
        document_number || null, date, payment_method || null, notes || null,
        i === 0 ? (invoice_id || null) : null, req.user!.id,
        installmentDueDate, payment_date || null, status,
        numInstallments, i + 1, parentId
      );
    }
  })();

  logAudit({
    userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
    action: 'CREATE', tableName: 'transactions', recordId: parentId,
    newData: { project_id, category_id, type, amount: parsedAmount, description: description.trim(),
               due_date, status, installments: numInstallments },
    ip,
  });

  res.status(201).json({ id: parentId, installments: numInstallments, ids });
});

router.put('/:id', requireRole('admin', 'manager', 'operator'), (req: AuthRequest, res: Response) => {
  const { project_id, category_id, type, amount, description, vendor, document_number,
          date, payment_method, notes, invoice_id, due_date, payment_date } = req.body;

  if (!project_id || !category_id || !type || amount === undefined || !description || !date) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  if (!VALID_TYPES.has(type)) {
    return res.status(400).json({ error: 'Tipo inválido' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount < 0) {
    return res.status(400).json({ error: 'Valor inválido' });
  }

  if (typeof description !== 'string' || description.trim().length === 0 || description.length > 500) {
    return res.status(400).json({ error: 'Descrição inválida' });
  }

  const status = payment_date ? 'paid' : 'pending';
  const old = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id) as any;

  db.prepare(`
    UPDATE transactions SET project_id = ?, category_id = ?, type = ?, amount = ?,
      description = ?, vendor = ?, document_number = ?, date = ?, payment_method = ?,
      notes = ?, invoice_id = ?, due_date = ?, payment_date = ?, status = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(project_id, category_id, type, parsedAmount, description.trim(), vendor || null,
         document_number || null, date, payment_method || null, notes || null,
         invoice_id || null, due_date || null, payment_date || null, status, req.params.id);

  logAudit({
    userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
    action: 'UPDATE', tableName: 'transactions', recordId: req.params.id,
    oldData: old ?? null,
    newData: { project_id, category_id, type, amount: parsedAmount, description: description.trim(),
               due_date, payment_date, status },
    ip: getIp(req),
  });

  res.json({ message: 'Lançamento atualizado' });
});

// Register payment/receipt for a pending transaction
router.patch('/:id/pay', requireRole('admin', 'manager', 'operator'), (req: AuthRequest, res: Response) => {
  const { payment_date, payment_method } = req.body;

  if (!payment_date || typeof payment_date !== 'string') {
    return res.status(400).json({ error: 'Data de pagamento é obrigatória' });
  }

  const old = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id) as any;
  if (!old) return res.status(404).json({ error: 'Lançamento não encontrado' });
  if (old.status === 'paid') return res.status(400).json({ error: 'Lançamento já está pago' });

  db.prepare(`
    UPDATE transactions
    SET status = 'paid', payment_date = ?, payment_method = COALESCE(?, payment_method),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(payment_date, payment_method || null, req.params.id);

  logAudit({
    userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
    action: old.type === 'expense' ? 'PAYMENT_REGISTERED' : 'RECEIPT_REGISTERED',
    tableName: 'transactions', recordId: req.params.id,
    oldData: { status: old.status, payment_date: old.payment_date },
    newData: { status: 'paid', payment_date, payment_method },
    ip: getIp(req),
  });

  res.json({ message: 'Pagamento registrado com sucesso' });
});

router.delete('/:id', requireRole('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const old = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id) as any;
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);

  logAudit({
    userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
    action: 'DELETE', tableName: 'transactions', recordId: req.params.id,
    oldData: old ?? null,
    ip: getIp(req),
  });

  res.json({ message: 'Lançamento excluído' });
});

export default router;
