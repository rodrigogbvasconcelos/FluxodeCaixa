import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';

// Route-based code splitting — each page is its own chunk loaded on demand
const Dashboard           = lazy(() => import('./pages/Dashboard'));
const Projects            = lazy(() => import('./pages/Projects'));
const Transactions        = lazy(() => import('./pages/Transactions'));
const Budgets             = lazy(() => import('./pages/Budgets'));
const Reports             = lazy(() => import('./pages/Reports'));
const InvoiceImport       = lazy(() => import('./pages/InvoiceImport'));
const Users               = lazy(() => import('./pages/Users'));
const Audit               = lazy(() => import('./pages/Audit'));
const Categories          = lazy(() => import('./pages/Categories'));
const Contacts            = lazy(() => import('./pages/Contacts'));
const PayablesReceivables = lazy(() => import('./pages/PayablesReceivables'));
const Backup              = lazy(() => import('./pages/Backup'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function PrivateRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, hasRole } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !hasRole(...roles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}>
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
        <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
      </Routes>
    </Suspense>
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
