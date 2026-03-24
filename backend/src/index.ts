import express from 'express';
import cors from 'cors';
import path from 'path';
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

// Enforce strong JWT_SECRET in production
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'fluxo-caixa-secret-2024') {
  const isProduction = process.env.NODE_ENV === 'production';
  const message = '[SEGURANÇA] JWT_SECRET não configurado ou usando valor padrão inseguro. Defina a variável de ambiente JWT_SECRET com uma string aleatória forte (mínimo 32 caracteres).';
  if (isProduction) {
    console.error(message);
    process.exit(1);
  } else {
    console.warn(message);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.removeHeader('X-Powered-By');
  next();
});

// CORS
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., curl, Postman in dev) only in non-production
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('Origem não permitida'), false);
      }
      return callback(null, true);
    }
    if (origin === allowedOrigin) return callback(null, true);
    callback(new Error('Origem não permitida pelo CORS'), false);
  },
  credentials: true,
}));

// Body size limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// NOTE: /uploads is intentionally NOT served as static.
// Downloads must go through the authenticated /api/invoices/:id/download route.

// Global rate limiter: 200 req / 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});
app.use('/api', globalLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/contacts', contactRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// Initialize database and start server
initDatabase();
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});

export default app;
