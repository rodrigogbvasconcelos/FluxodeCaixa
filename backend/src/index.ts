import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { initDatabase } from './database';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import projectRoutes from './routes/projects';
import categoryRoutes from './routes/categories';
import transactionRoutes from './routes/transactions';
import budgetRoutes from './routes/budgets';
import invoiceRoutes from './routes/invoices';
import reportRoutes from './routes/reports';
import contactRoutes from './routes/contacts';
import auditRoutes from './routes/audit';
import payablesRoutes from './routes/payables';
import backupRoutes from './routes/backup';

// ── Environment validation ───────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'fluxo-caixa-secret-2024') {
  const msg = '[SEGURANÇA] JWT_SECRET não configurado ou usando valor padrão. Defina JWT_SECRET com pelo menos 32 caracteres aleatórios.';
  if (isProduction) { console.error(msg); process.exit(1); }
  else console.warn(msg);
}

if (isProduction && !process.env.FRONTEND_URL) {
  console.error('[SEGURANÇA] FRONTEND_URL é obrigatório em produção.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security headers (helmet) ────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  hsts: isProduction ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      if (isProduction) return callback(new Error('Origem não permitida'), false);
      return callback(null, true);
    }
    if (origin === allowedOrigin) return callback(null, true);
    callback(new Error('Origem não permitida pelo CORS'), false);
  },
  credentials: true,
}));

// ── Compression (gzip/brotli) ────────────────────────────────────────────────
app.use(compression());

// ── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// NOTE: /uploads is intentionally NOT served as static.
// Downloads go through the authenticated /api/invoices/:id/download route.

// ── Rate limiters ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

// Stricter limiter for sensitive write operations
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições para esta operação.' },
});

app.use('/api', globalLimiter);
app.use('/api/auth/change-password', strictLimiter);
app.use('/api/backup', strictLimiter);

// ── Cache headers helper ──────────────────────────────────────────────────────
// Short-lived cache for read-heavy, rarely-changing data
export function cacheFor(seconds: number) {
  return (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('Cache-Control', `private, max-age=${seconds}`);
    next();
  };
}

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/payables', payablesRoutes);
app.use('/api/backup', backupRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// ── Start ─────────────────────────────────────────────────────────────────────
initDatabase();
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});

export default app;
