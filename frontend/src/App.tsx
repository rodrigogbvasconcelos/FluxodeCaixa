import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Reports from './pages/Reports';
import InvoiceImport from './pages/InvoiceImport';
import Users from './pages/Users';
import Audit from './pages/Audit';
import Categories from './pages/Categories';
import Contacts from './pages/Contacts';
import PayablesReceivables from './pages/PayablesReceivables';
import Backup from './pages/Backup';

function PrivateRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, hasRole } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !hasRole(...roles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="transactions" element={
          <PrivateRoute roles={['admin', 'manager', 'operator']}>
            <Transactions />
          </PrivateRoute>
        } />
        <Route path="budgets" element={
          <PrivateRoute roles={['admin', 'manager']}>
            <Budgets />
          </PrivateRoute>
        } />
        <Route path="reports" element={<Reports />} />
        <Route path="invoice-import" element={
          <PrivateRoute roles={['admin', 'manager', 'operator']}>
            <InvoiceImport />
          </PrivateRoute>
        } />
        <Route path="users" element={
          <PrivateRoute roles={['admin']}>
            <Users />
          </PrivateRoute>
        } />
        <Route path="audit" element={
          <PrivateRoute roles={['admin']}>
            <Audit />
          </PrivateRoute>
        } />
        <Route path="categories" element={
          <PrivateRoute roles={['admin', 'manager']}>
            <Categories />
          </PrivateRoute>
        } />
        <Route path="contacts" element={
          <PrivateRoute roles={['admin', 'manager', 'operator']}>
            <Contacts />
          </PrivateRoute>
        } />
        <Route path="payables" element={
          <PrivateRoute roles={['admin', 'manager', 'operator']}>
            <PayablesReceivables />
          </PrivateRoute>
        } />
        <Route path="backup" element={
          <PrivateRoute roles={['admin']}>
            <Backup />
          </PrivateRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
