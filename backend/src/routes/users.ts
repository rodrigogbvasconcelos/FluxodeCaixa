import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', requireRole('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const users = db.prepare('SELECT id, name, email, role, active, created_at FROM users ORDER BY name').all();
  res.json(users);
});

router.post('/', requireRole('admin'), (req: AuthRequest, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(400).json({ error: 'Email já cadastrado' });

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, email, hash, role);

  res.status(201).json({ id, name, email, role });
});

router.put('/:id', requireRole('admin'), (req: AuthRequest, res: Response) => {
  const { name, email, role, active } = req.body;
  db.prepare('UPDATE users SET name = ?, email = ?, role = ?, active = ?, updated_at = datetime("now") WHERE id = ?')
    .run(name, email, role, active ? 1 : 0, req.params.id);
  res.json({ message: 'Usuário atualizado' });
});

router.put('/:id/reset-password', requireRole('admin'), (req: AuthRequest, res: Response) => {
  const { newPassword } = req.body;
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?')
    .run(hash, req.params.id);
  res.json({ message: 'Senha redefinida' });
});

router.delete('/:id', requireRole('admin'), (req: AuthRequest, res: Response) => {
  if (req.params.id === req.user!.id) {
    return res.status(400).json({ error: 'Não é possível excluir o próprio usuário' });
  }
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Usuário desativado' });
});

export default router;
