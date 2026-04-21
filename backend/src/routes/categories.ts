import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY type, name').all();
  res.json(categories);
});

router.post('/', requireRole('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const { name, type, color, icon, parent_id } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });

  const id = uuidv4();
  db.prepare('INSERT INTO categories (id, name, type, color, icon, parent_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, type, color || '#6B7280', icon || 'tag', parent_id || null);
  res.status(201).json({ id, name, type });
});

router.put('/:id', requireRole('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const { name, color, icon, parent_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  const result = db.prepare('UPDATE categories SET name = ?, color = ?, icon = ?, parent_id = ? WHERE id = ?')
    .run(name, color, icon, parent_id || null, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Categoria não encontrada' });
  res.json({ message: 'Categoria atualizada' });
});

router.delete('/:id', requireRole('admin'), (req: AuthRequest, res: Response) => {
  const used = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE category_id = ?').get(req.params.id) as any;
  if (used.c > 0) return res.status(400).json({ error: `Categoria em uso em ${used.c} lançamento(s) e não pode ser excluída` });

  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Categoria não encontrada' });
  res.json({ message: 'Categoria excluída' });
});

export default router;
