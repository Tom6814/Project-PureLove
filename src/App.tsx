import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import MangaPage from './pages/MangaPage';
import SubmitPage from './pages/SubmitPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import UserPage from './pages/UserPage';

const ProtectedRoute = ({ children, adminOrReviewer = false }: { children: React.ReactNode, adminOrReviewer?: boolean }) => {
  const { user, isAdmin, isReviewer, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/" />;
  if (adminOrReviewer && !isAdmin && !isReviewer) return <Navigate to="/" />;

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/explore" element={<HomePage />} />
            <Route path="/manga/:id" element={<MangaPage />} />
            <Route path="/user/:id" element={<UserPage />} />
            <Route 
              path="/submit" 
              element={
                <ProtectedRoute>
                  <SubmitPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute adminOrReviewer>
                  <AdminPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
