import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CasesPage from './pages/CasesPage';
import CaseDetailPage from './pages/CaseDetailPage';
import DirectorsPage from './pages/DirectorsPage';
import UsersPage from './pages/UsersPage';
import ServiceTypesPage from './pages/ServiceTypesPage';
import SaleTypesPage from './pages/SaleTypesPage';
import ReportsPage from './pages/ReportsPage';
import ImportPage from './pages/ImportPage';
import DataTablePage from './pages/DataTablePage';
import Layout from './components/Layout';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/cases" 
        element={
          <ProtectedRoute>
            <CasesPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/cases/:id" 
        element={
          <ProtectedRoute>
            <CaseDetailPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/cases/new" 
        element={
          <ProtectedRoute>
            <CaseDetailPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/directors" 
        element={
          <ProtectedRoute adminOnly>
            <DirectorsPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/users" 
        element={
          <ProtectedRoute adminOnly>
            <UsersPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/service-types" 
        element={
          <ProtectedRoute adminOnly>
            <ServiceTypesPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/sale-types" 
        element={
          <ProtectedRoute adminOnly>
            <SaleTypesPage />
          </ProtectedRoute>
        } 
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/data-table"
        element={
          <ProtectedRoute>
            <DataTablePage />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/import" 
        element={
          <ProtectedRoute adminOnly>
            <ImportPage />
          </ProtectedRoute>
        } 
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
