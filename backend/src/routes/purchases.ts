import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// List purchase orders
router.get('/', (req: AuthRequest, res: Response) => {
  const { project_id, status } = req.query;
  let where = '1=1';
  const params: any[] = [];
  if (project_id) { where += ' AND po.project_id = ?'; params.push(project_id); }
  if (status)     { where += ' AND po.status = ?';     params.push(status); }

  const orders = db.prepare(`
    SELECT po.*,
      p.name as project_name,
      c.name as supplier_name,
      (SELECT COUNT(*) FROM purchase_order_items WHERE order_id = po.id) as items_count
    FROM purchase_orders po
    LEFT JOIN projects p ON p.id = po.project_id
    LEFT JOIN contacts c ON c.id = po.supplier_id
    WHERE ${where}
    ORDER BY po.order_date DESC, po.created_at DESC
  `).all(...params);

  res.json(orders);
});

// Get single purchase order with items
router.get('/:id', (req: AuthRequest, res: Response) => {
  const order = db.prepare(`
    SELECT po.*,
      p.name as project_name,
      c.name as supplier_name, c.phone as supplier_phone, c.email as supplier_email
    FROM purchase_orders po
    LEFT JOIN projects p ON p.id = po.project_id
    LEFT JOIN contacts c ON c.id = po.supplier_id
    WHERE po.id = ?
  `).get(req.params.id);

  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

  const items = db.prepare(`
    SELECT poi.*, cat.name as category_name, cat.color as category_color
    FROM purchase_order_items poi
    LEFT JOIN categories cat ON cat.id = poi.category_id
    WHERE poi.order_id = ?
    ORDER BY rowid
  `).all(req.params.id);

  res.json({ ...order as any, items });
});

// Create purchase order
router.post('/', (req: AuthRequest, res: Response) => {
  const { project_id, supplier_id, order_date, expected_date, notes, items = [] } = req.body;
  if (!project_id) return res.status(400).json({ error: 'Obra é obrigatória' });
  if (!order_date) return res.status(400).json({ error: 'Data do pedido é obrigatória' });
  if (!items.length) return res.status(400).json({ error: 'Adicione pelo menos um item' });

  const id = uuidv4();

  const totalAmount = (items as any[]).reduce((s: number, i: any) =>
    s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);

  db.prepare(`
    INSERT INTO purchase_orders (id, project_id, supplier_id, status, order_date, expected_date, notes, total_amount, created_by)
    VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)
  `).run(id, project_id, supplier_id || null, order_date, expected_date || null, notes || null, totalAmount, req.user!.id);

  const insertItem = db.prepare(`
    INSERT INTO purchase_order_items (id, order_id, description, unit, quantity, unit_price, category_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const item of items as any[]) {
    insertItem.run(uuidv4(), id, item.description, item.unit || null,
      Number(item.quantity) || 1, Number(item.unit_price) || 0,
      item.category_id || null, item.notes || null);
  }

  res.status(201).json({ id });
});

// Update purchase order
router.put('/:id', (req: AuthRequest, res: Response) => {
  const { project_id, supplier_id, order_date, expected_date, notes, items } = req.body;
  const existing = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Pedido não encontrado' });
  if (existing.status === 'received' || existing.status === 'cancelled') {
    return res.status(400).json({ error: 'Não é possível editar pedido recebido ou cancelado' });
  }

  const totalAmount = items
    ? (items as any[]).reduce((s: number, i: any) => s + (Number(i.quantity)||0) * (Number(i.unit_price)||0), 0)
    : existing.total_amount;

  db.prepare(`
    UPDATE purchase_orders SET project_id=?, supplier_id=?, order_date=?, expected_date=?,
      notes=?, total_amount=?, updated_at=datetime('now') WHERE id=?
  `).run(project_id || existing.project_id, supplier_id || null,
    order_date || existing.order_date, expected_date || null,
    notes || null, totalAmount, req.params.id);

  if (items) {
      db.prepare('DELETE FROM purchase_order_items WHERE order_id = ?').run(req.params.id);
    const insertItem = db.prepare(`
      INSERT INTO purchase_order_items (id, order_id, description, unit, quantity, unit_price, category_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of items as any[]) {
      insertItem.run(uuidv4(), req.params.id, item.description, item.unit || null,
        Number(item.quantity) || 1, Number(item.unit_price) || 0,
        item.category_id || null, item.notes || null);
    }
  }

  res.json({ ok: true });
});

// Change status
router.patch('/:id/status', (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const allowed = ['draft', 'pending', 'approved', 'received', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Status inválido' });

  const existing = db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Pedido não encontrado' });

  db.prepare("UPDATE purchase_orders SET status=?, updated_at=datetime('now') WHERE id=?")
    .run(status, req.params.id);
  res.json({ ok: true });
});

// Delete purchase order
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Pedido não encontrado' });
  if (existing.status === 'received') {
    return res.status(400).json({ error: 'Não é possível excluir pedido já recebido' });
  }
  db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
