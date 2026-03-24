/**
 * Optional: Run this to seed sample data for testing
 * Usage: npx tsx src/seed.ts
 */
import db, { initDatabase } from './database';
import { v4 as uuidv4 } from 'uuid';

initDatabase();

const adminId = (db.prepare("SELECT id FROM users WHERE email = 'admin@empresa.com'").get() as any)?.id;
if (!adminId) { console.error('Admin user not found'); process.exit(1); }

// Sample projects
const projects = [
  { name: 'Edifício Residencial Aurora', client: 'Construtora ABC', address: 'Av. Paulista, 1000', budget: 2500000, start_date: '2024-01-15', end_date: '2025-06-30' },
  { name: 'Reforma Industrial Galpão Norte', client: 'Indústria XYZ Ltda', address: 'Rod. Anhanguera, km 42', budget: 850000, start_date: '2024-03-01', end_date: '2024-12-31' },
  { name: 'Condomínio Parque das Flores', client: 'Incorporadora Delta', address: 'R. das Rosas, 200', budget: 4200000, start_date: '2024-06-01', end_date: '2026-12-31' },
];

const projIds: string[] = [];
for (const p of projects) {
  const existing = db.prepare('SELECT id FROM projects WHERE name = ?').get(p.name) as any;
  if (existing) { projIds.push(existing.id); continue; }
  const id = uuidv4();
  projIds.push(id);
  db.prepare(`INSERT INTO projects (id, name, client, address, total_budget, start_date, end_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, p.name, p.client, p.address, p.budget, p.start_date, p.end_date, adminId);
}

// Get categories
const cats = db.prepare('SELECT id, name FROM categories').all() as any[];
const getCat = (name: string) => cats.find(c => c.name.includes(name))?.id;

// Sample transactions
const transactions = [
  // Project 1
  { proj: 0, type: 'income', catName: 'Medição', amount: 350000, desc: 'Medição #1 - Fundações', date: '2024-02-15' },
  { proj: 0, type: 'income', catName: 'Adiantamento', amount: 250000, desc: 'Adiantamento inicial', date: '2024-01-20' },
  { proj: 0, type: 'expense', catName: 'Mão de Obra', amount: 85000, desc: 'Equipe de fundações - Fev', vendor: 'Empreiteira Silva', date: '2024-02-28' },
  { proj: 0, type: 'expense', catName: 'Materiais', amount: 120000, desc: 'Concreto e ferragem - Fundações', vendor: 'Concreto Sul', date: '2024-02-20' },
  { proj: 0, type: 'expense', catName: 'Equipamentos', amount: 15000, desc: 'Aluguel de grua - Fev', vendor: 'Equipa Locações', date: '2024-02-10' },
  { proj: 0, type: 'income', catName: 'Medição', amount: 420000, desc: 'Medição #2 - Estrutura', date: '2024-04-15' },
  { proj: 0, type: 'expense', catName: 'Mão de Obra', amount: 92000, desc: 'Equipe de estrutura - Abr', vendor: 'Empreiteira Silva', date: '2024-04-30' },
  { proj: 0, type: 'expense', catName: 'Materiais', amount: 185000, desc: 'Aço CA-50 e formas', vendor: 'Distribuidora Metro', date: '2024-04-15' },

  // Project 2
  { proj: 1, type: 'income', catName: 'Adiantamento', amount: 200000, desc: 'Mobilização - 25%', date: '2024-03-10' },
  { proj: 1, type: 'expense', catName: 'Mão de Obra', amount: 45000, desc: 'Equipe de demolição', vendor: 'Dem. Express', date: '2024-03-30' },
  { proj: 1, type: 'expense', catName: 'Materiais', amount: 65000, desc: 'Materiais estruturais', vendor: 'FerroCentro', date: '2024-04-05' },
  { proj: 1, type: 'income', catName: 'Medição', amount: 180000, desc: 'Medição #1', date: '2024-05-15' },
  { proj: 1, type: 'expense', catName: 'Subempreiteiros', amount: 38000, desc: 'Instalações elétricas', vendor: 'EletroForte', date: '2024-05-20' },

  // Project 3
  { proj: 2, type: 'income', catName: 'Adiantamento', amount: 500000, desc: 'Adiantamento inicial - 12%', date: '2024-06-20' },
  { proj: 2, type: 'expense', catName: 'Projetos', amount: 85000, desc: 'Projetos executivos completos', vendor: 'Arq. & Eng. Assoc.', date: '2024-07-01' },
  { proj: 2, type: 'expense', catName: 'Mão de Obra', amount: 62000, desc: 'Equipe - Jul/2024', vendor: 'Construção Total', date: '2024-07-31' },
];

const txCount = db.prepare('SELECT COUNT(*) as c FROM transactions').get() as any;
if (txCount.c === 0) {
  for (const tx of transactions) {
    const catId = getCat(tx.catName);
    if (!catId) { console.warn(`Category not found: ${tx.catName}`); continue; }
    db.prepare(`INSERT INTO transactions (id, project_id, category_id, type, amount, description, vendor, date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), projIds[tx.proj], catId, tx.type, tx.amount, tx.desc, tx.vendor || null, tx.date, adminId);
  }
}

// Sample budgets
const budgetData = [
  { proj: 0, catName: 'Mão de Obra', amount: 800000 },
  { proj: 0, catName: 'Materiais', amount: 900000 },
  { proj: 0, catName: 'Equipamentos', amount: 150000 },
  { proj: 0, catName: 'Subempreiteiros', amount: 300000 },
  { proj: 0, catName: 'Administrativo', amount: 100000 },
  { proj: 1, catName: 'Mão de Obra', amount: 300000 },
  { proj: 1, catName: 'Materiais', amount: 250000 },
  { proj: 1, catName: 'Subempreiteiros', amount: 150000 },
];

const budgetCount = db.prepare('SELECT COUNT(*) as c FROM budgets').get() as any;
if (budgetCount.c === 0) {
  for (const b of budgetData) {
    const catId = getCat(b.catName);
    if (!catId) continue;
    db.prepare('INSERT INTO budgets (id, project_id, category_id, amount) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), projIds[b.proj], catId, b.amount);
  }
}

// Additional users
const usersToAdd = [
  { name: 'Gerente Financeiro', email: 'gerente@empresa.com', password: 'gerente123', role: 'manager' },
  { name: 'Operador de Obras', email: 'operador@empresa.com', password: 'operador123', role: 'operator' },
  { name: 'Diretor (Leitura)', email: 'diretor@empresa.com', password: 'diretor123', role: 'viewer' },
];

const bcrypt = require('bcryptjs');
for (const u of usersToAdd) {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
  if (!exists) {
    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), u.name, u.email, bcrypt.hashSync(u.password, 10), u.role);
  }
}

console.log('✅ Sample data seeded successfully!');
console.log('Users:');
console.log('  admin@empresa.com / admin123 (Administrador)');
console.log('  gerente@empresa.com / gerente123 (Gerente)');
console.log('  operador@empresa.com / operador123 (Operador)');
console.log('  diretor@empresa.com / diretor123 (Visualizador)');
process.exit(0);
