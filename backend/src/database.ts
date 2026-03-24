import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '..', 'data', 'cashflow.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      client TEXT,
      address TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      total_budget REAL NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      color TEXT NOT NULL DEFAULT '#6B7280',
      icon TEXT NOT NULL DEFAULT 'tag',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      month INTEGER,
      year INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      extracted_data TEXT,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      vendor TEXT,
      document_number TEXT,
      date TEXT NOT NULL,
      payment_method TEXT,
      notes TEXT,
      invoice_id TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      user_email TEXT,
      action TEXT NOT NULL,
      table_name TEXT,
      record_id TEXT,
      old_data TEXT,
      new_data TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_logs(table_name);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('client', 'supplier', 'both')),
      document_type TEXT CHECK(document_type IN ('cpf', 'cnpj')),
      document_number TEXT,
      phone TEXT,
      email TEXT,
      cep TEXT,
      address TEXT,
      number TEXT,
      complement TEXT,
      neighborhood TEXT,
      city TEXT,
      state TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations: add new columns to existing tables if not present
  const txMigrations: [string, string][] = [
    ['due_date',           'ALTER TABLE transactions ADD COLUMN due_date TEXT'],
    ['payment_date',       'ALTER TABLE transactions ADD COLUMN payment_date TEXT'],
    ['status',             "ALTER TABLE transactions ADD COLUMN status TEXT NOT NULL DEFAULT 'paid'"],
    ['installments',       'ALTER TABLE transactions ADD COLUMN installments INTEGER NOT NULL DEFAULT 1'],
    ['installment_number', 'ALTER TABLE transactions ADD COLUMN installment_number INTEGER NOT NULL DEFAULT 1'],
    ['parent_id',          'ALTER TABLE transactions ADD COLUMN parent_id TEXT'],
  ];
  for (const [, sql] of txMigrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  // Seed default admin user if not exists
  // IMPORTANT: Change the default password immediately after first login.
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@empresa.com');
  if (!adminExists) {
    const { v4: uuidv4 } = require('uuid');
    const hash = bcrypt.hashSync('Admin123', 10); // Must be changed on first login
    db.prepare(`INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`)
      .run(uuidv4(), 'Administrador', 'admin@empresa.com', hash, 'admin');
    console.warn('[SEGURANÇA] Usuário administrador padrão criado. TROQUE A SENHA IMEDIATAMENTE: admin@empresa.com');
  }

  // Seed default categories
  const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number };
  if (catCount.c === 0) {
    const { v4: uuidv4 } = require('uuid');
    const defaultCategories = [
      // Expenses
      { name: 'Mão de Obra', type: 'expense', color: '#EF4444', icon: 'hard-hat' },
      { name: 'Materiais de Construção', type: 'expense', color: '#F97316', icon: 'package' },
      { name: 'Equipamentos', type: 'expense', color: '#EAB308', icon: 'wrench' },
      { name: 'Subempreiteiros', type: 'expense', color: '#84CC16', icon: 'users' },
      { name: 'Projetos e Licenças', type: 'expense', color: '#06B6D4', icon: 'file-text' },
      { name: 'Transporte e Frete', type: 'expense', color: '#8B5CF6', icon: 'truck' },
      { name: 'Administrativo', type: 'expense', color: '#EC4899', icon: 'briefcase' },
      { name: 'Outros Gastos', type: 'expense', color: '#6B7280', icon: 'more-horizontal' },
      // Income
      { name: 'Medição Contratual', type: 'income', color: '#10B981', icon: 'trending-up' },
      { name: 'Adiantamento', type: 'income', color: '#3B82F6', icon: 'dollar-sign' },
      { name: 'Retenção Liberada', type: 'income', color: '#6366F1', icon: 'unlock' },
      { name: 'Outras Receitas', type: 'income', color: '#14B8A6', icon: 'plus-circle' },
    ];
    const insert = db.prepare(`INSERT INTO categories (id, name, type, color, icon, is_default) VALUES (?, ?, ?, ?, ?, 1)`);
    for (const cat of defaultCategories) {
      insert.run(uuidv4(), cat.name, cat.type, cat.color, cat.icon);
    }
  }
}

export default db;
