import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const VALID_ROLES = new Set(['admin', 'manager', 'operator', 'viewer']);
const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

function isStrongPassword(password: string): boolean {
  if (typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 128) return false;
  if (!/[a-zA-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

router.get('/', requireRole('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const users = db.prepare('SELECT id, name, email, role, active, created_at FROM users ORDER BY name').all();
  res.json(users);
});

router.post('/', requireRole('admin'), (req: AuthRequest, res: Response) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role ||
      typeof name !== 'string' || typeof email !== 'string' ||
      typeof password !== 'string' || typeof role !== 'string') {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  if (name.trim().length < 2 || name.length > 100) {
    return res.status(400).json({ error: 'Nome deve ter entre 2 e 100 caracteres' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  if (!VALID_ROLES.has(role)) {
    return res.status(400).json({ error: 'Role inválida' });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres, incluindo letras e números' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (exists) return res.status(400).json({ error: 'Email já cadastrado' });

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(id, name.trim(), normalizedEmail, hash, role);

  res.status(201).json({ id, name: name.trim(), email: normalizedEmail, role });
});

router.put('/:id', requireRole('admin'), (req: AuthRequest, res: Response) => {
  const { name, email, role, active } = req.body;

  if (!name || !email || !role ||
      typeof name !== 'string' || typeof email !== 'string' || typeof role !== 'string') {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  if (name.trim().length < 2 || name.length > 100) {
    return res.status(400).json({ error: 'Nome inválido' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  if (!VALID_ROLES.has(role)) {
    return res.status(400).json({ error: 'Role inválida' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check for email conflict with another user
  const conflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalizedEmail, req.params.id);
  if (conflict) return res.status(400).json({ error: 'Email já cadastrado para outro usuário' });

  db.prepare('UPDATE users SET name = ?, email = ?, role = ?, active = ?, updated_at = datetime("now") WHERE id = ?')
    .run(name.trim(), normalizedEmail, role, active ? 1 : 0, req.params.id);

  res.json({ message: 'Usuário atualizado' });
});

router.put('/:id/reset-password', requireRole('admin'), (req: AuthRequest, res: Response) => {
  const { newPassword } = req.body;

  if (!newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'Nova senha é obrigatória' });
  }

  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres, incluindo letras e números' });
  }

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
