import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(__dirname, '..', 'data', 'cashflow.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ── Mutable connection — replaced in-place on restore ────────────────────────
let _db = new Database(DB_PATH);
_db.pragma('journal_mode = WAL');
_db.pragma('foreign_keys = ON');

// Proxy forwards every call to the current _db.
// When reinitDb() replaces _db, all subsequent route calls use the new instance
// without any import changes in route files.
const db = new Proxy({} as InstanceType<typeof Database>, {
  get(_, prop: string | symbol) {
    const val = (_db as any)[prop as string];
    return typeof val === 'function' ? (val as Function).bind(_db) : val;
  },
}) as InstanceType<typeof Database>;

export function initDatabase() {
  _db.exec(`
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
      parent_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
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

    CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_table   ON audit_logs(table_name);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

    CREATE INDEX IF NOT EXISTS idx_tx_project   ON transactions(project_id);
    CREATE INDEX IF NOT EXISTS idx_tx_category  ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_tx_date      ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_tx_type      ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_tx_created   ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_tx_proj_type ON transactions(project_id, type);
    CREATE INDEX IF NOT EXISTS idx_tx_proj_date ON transactions(project_id, date);

    CREATE INDEX IF NOT EXISTS idx_proj_status  ON projects(status);

    CREATE INDEX IF NOT EXISTS idx_budget_proj  ON budgets(project_id);
    CREATE INDEX IF NOT EXISTS idx_budget_cat   ON budgets(category_id);

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

    CREATE INDEX IF NOT EXISTS idx_contact_name ON contacts(name);
    CREATE INDEX IF NOT EXISTS idx_contact_type ON contacts(type);

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      supplier_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      order_date TEXT NOT NULL,
      expected_date TEXT,
      notes TEXT,
      total_amount REAL NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (supplier_id) REFERENCES contacts(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      description TEXT NOT NULL,
      unit TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      category_id TEXT,
      notes TEXT,
      FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE INDEX IF NOT EXISTS idx_po_project ON purchase_orders(project_id);
    CREATE INDEX IF NOT EXISTS idx_po_status  ON purchase_orders(status);
    CREATE INDEX IF NOT EXISTS idx_poi_order  ON purchase_order_items(order_id);
  `);

  const txMigrations: [string, string][] = [
    ['due_date',           'ALTER TABLE transactions ADD COLUMN due_date TEXT'],
    ['payment_date',       'ALTER TABLE transactions ADD COLUMN payment_date TEXT'],
    ['status',             "ALTER TABLE transactions ADD COLUMN status TEXT NOT NULL DEFAULT 'paid'"],
    ['installments',       'ALTER TABLE transactions ADD COLUMN installments INTEGER NOT NULL DEFAULT 1'],
    ['installment_number', 'ALTER TABLE transactions ADD COLUMN installment_number INTEGER NOT NULL DEFAULT 1'],
    ['parent_id',          'ALTER TABLE transactions ADD COLUMN parent_id TEXT'],
  ];
  for (const [, sql] of txMigrations) {
    try { _db.exec(sql); } catch { /* column already exists */ }
  }

  const postMigrationIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status)',
    'CREATE INDEX IF NOT EXISTS idx_tx_due    ON transactions(due_date)',
  ];
  for (const sql of postMigrationIndexes) {
    try { _db.exec(sql); } catch { /* index already exists */ }
  }

  const projectMigrations: string[] = [
    'ALTER TABLE projects ADD COLUMN progress_pct REAL NOT NULL DEFAULT 0',
  ];
  for (const sql of projectMigrations) {
    try { _db.exec(sql); } catch { /* column already exists */ }
  }

  const adminExists = _db.prepare('SELECT id FROM users WHERE email = ?').get('admin@empresa.com');
  if (!adminExists) {
    const hash = bcrypt.hashSync('Admin123', 10);
    _db.prepare(`INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`)
      .run(uuidv4(), 'Administrador', 'admin@empresa.com', hash, 'admin');
    console.warn('[SEGURANÇA] Usuário administrador padrão criado. TROQUE A SENHA IMEDIATAMENTE: admin@empresa.com');
  }

  const catCount = _db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number };
  if (catCount.c === 0) {
    const defaultCategories = [
      { name: 'Mão de Obra', type: 'expense', color: '#EF4444', icon: 'hard-hat' },
      { name: 'Materiais de Construção', type: 'expense', color: '#F97316', icon: 'package' },
      { name: 'Equipamentos', type: 'expense', color: '#EAB308', icon: 'wrench' },
      { name: 'Subempreiteiros', type: 'expense', color: '#84CC16', icon: 'users' },
      { name: 'Projetos e Licenças', type: 'expense', color: '#06B6D4', icon: 'file-text' },
      { name: 'Transporte e Frete', type: 'expense', color: '#8B5CF6', icon: 'truck' },
      { name: 'Administrativo', type: 'expense', color: '#EC4899', icon: 'briefcase' },
      { name: 'Outros Gastos', type: 'expense', color: '#6B7280', icon: 'more-horizontal' },
      { name: 'Medição Contratual', type: 'income', color: '#10B981', icon: 'trending-up' },
      { name: 'Adiantamento', type: 'income', color: '#3B82F6', icon: 'dollar-sign' },
      { name: 'Retenção Liberada', type: 'income', color: '#6366F1', icon: 'unlock' },
      { name: 'Outras Receitas', type: 'income', color: '#14B8A6', icon: 'plus-circle' },
    ];
    const insert = _db.prepare(`INSERT INTO categories (id, name, type, color, icon, is_default) VALUES (?, ?, ?, ?, ?, 1)`);
    for (const cat of defaultCategories) {
      insert.run(uuidv4(), cat.name, cat.type, cat.color, cat.icon);
    }
  }
}

/**
 * Replace the database file with a restored backup and reopen the connection
 * in-place — no process restart required.
 */
export function reinitDb(newDbPath: string) {
  _db.pragma('wal_checkpoint(FULL)');
  _db.close();
  fs.copyFileSync(newDbPath, DB_PATH);
  for (const ext of ['-wal', '-shm']) {
    const f = DB_PATH + ext;
    if (fs.existsSync(f)) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
  }
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initDatabase();
  console.log('[DB] Banco de dados restaurado e reconectado sem reiniciar o processo.');
}

export { DB_PATH };
export default db;
