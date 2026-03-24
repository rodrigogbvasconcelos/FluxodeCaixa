export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  active: number;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  client?: string;
  address?: string;
  start_date?: string;
  end_date?: string;
  status: 'active' | 'completed' | 'suspended' | 'archived';
  total_budget: number;
  total_income?: number;
  total_expenses?: number;
  created_by: string;
  created_by_name?: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  is_default: number;
}

export interface Transaction {
  id: string;
  project_id: string;
  project_name?: string;
  category_id: string;
  category_name?: string;
  category_color?: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  vendor?: string;
  document_number?: string;
  date: string;
  payment_method?: string;
  notes?: string;
  invoice_id?: string;
  invoice_name?: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
}

export interface Budget {
  id: string;
  project_id: string;
  category_id: string;
  category_name?: string;
  category_color?: string;
  category_type?: string;
  amount: number;
  month?: number;
  year?: number;
  notes?: string;
}

export interface Invoice {
  id: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

export interface ExtractedData {
  amount?: number;
  date?: string;
  vendor?: string;
  documentNumber?: string;
  description?: string;
  rawText?: string;
}

export interface DashboardData {
  totalProjects: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  monthlyFlow: Array<{ month: string; income: number; expense: number }>;
  topProjects: Array<Project & { income: number; expenses: number }>;
  recentTransactions: Transaction[];
  expensesByCategory: Array<{ name: string; color: string; total: number }>;
  incomeByCategory: Array<{ name: string; color: string; total: number }>;
}

export interface Contact {
  id: string;
  name: string;
  type: 'client' | 'supplier' | 'both';
  document_type?: 'cpf' | 'cnpj';
  document_number?: string;
  phone?: string;
  email?: string;
  cep?: string;
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
  created_at: string;
}

export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer';
