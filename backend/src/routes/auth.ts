import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authenticate, AuthRequest, JWT_SECRET_KEY } from '../middleware/auth';
import { logAudit, getIp } from '../middleware/audit';

const router = Router();

// Strict rate limiting for login: 10 attempts / 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
});

// Validate password strength: ≥8 chars, at least 1 letter and 1 number
function isStrongPassword(password: string): boolean {
  if (typeof password !== 'string') return false;
  if (password.length < 8) return false;
  if (!/[a-zA-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

router.post('/login', loginLimiter, (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  if (email.length > 254 || password.length > 128) {
    return res.status(400).json({ error: 'Credenciais inválidas' });
  }

  const ip = getIp(req);
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email.toLowerCase().trim()) as any;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    logAudit({
      userId: user?.id,
      userName: user?.name,
      userEmail: email.toLowerCase().trim(),
      action: 'LOGIN_FAILED',
      tableName: 'users',
      recordId: user?.id ?? uuidv4(),
      newData: { email: email.toLowerCase().trim() },
      ip,
    });
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET_KEY,
    { expiresIn: '8h' }
  );

  logAudit({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'LOGIN', tableName: 'users', recordId: user.id,
    ip,
  });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json(user);
});

router.put('/change-password', authenticate, (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword || typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'Senhas são obrigatórias' });
  }

  if (currentPassword.length > 128 || newPassword.length > 128) {
    return res.status(400).json({ error: 'Senha inválida' });
  }

  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 8 caracteres, incluindo letras e números' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Senha atual incorreta' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?')
    .run(hash, req.user!.id);

  logAudit({
    userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
    action: 'CHANGE_PASSWORD', tableName: 'users', recordId: req.user!.id,
    ip: getIp(req),
  });

  res.json({ message: 'Senha alterada com sucesso' });
});

export default router;
