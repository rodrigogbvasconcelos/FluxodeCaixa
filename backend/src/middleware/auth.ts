import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Never fall back to a hard-coded secret — require explicit env var
const JWT_SECRET = process.env.JWT_SECRET || '';

if (JWT_SECRET.length < 32) {
  console.warn('[SEGURANÇA] JWT_SECRET deve ter pelo menos 32 caracteres.');
}

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string; name: string };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.slice(7);
  if (token.length > 2048) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded.id || !decoded.email || !decoded.role) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

export function requireRole(...roles: string[]) {
  const validRoles = new Set(['admin', 'manager', 'operator', 'viewer']);
  for (const r of roles) {
    if (!validRoles.has(r)) throw new Error(`requireRole: role inválida '${r}'`);
  }
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
}

// Exported only for use in auth routes (token signing)
export const JWT_SECRET_KEY = JWT_SECRET;
