import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { preloadCommon } from './preloads';

// 路由级代码分割：每个页面独立 chunk，首屏只加载当前路由所需代码
const LandingPage = lazy(() => import('./pages/LandingPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const MangaPage = lazy(() => import('./pages/MangaPage'));
const SubmitPage = lazy(() => import('./pages/SubmitPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const UserPage = lazy(() => import('./pages/UserPage'));

// 与 index.html 内联加载进度条同风格的 Suspense fallback（路由切换时显示，仅覆盖内容区）
function RouteFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-24 bg-theme-main">
      <div className="relative w-44 h-[3px] bg-[#f0eeeb] overflow-hidden rounded-full">
        <div className="absolute inset-y-0 left-0 w-1/2 bg-theme-accent rounded-full loading-bar" />
      </div>
      <div className="mt-4 font-serif italic text-theme-muted text-[13px] tracking-widest">
        Project RN
      </div>
    </div>
  );
}

const ProtectedRoute = ({ children, adminOrReviewer = false }: { children: React.ReactNode, adminOrReviewer?: boolean }) => {
  const { user, isAdmin, isReviewer, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/" />;
  if (adminOrReviewer && !isAdmin && !isReviewer) return <Navigate to="/" />;

  return <>{children}</>;
};

export default function App() {
  // 首屏渲染完成后，后台预热常用路由 chunk，点击切换时无需等待下载
  useEffect(() => {
    const t = setTimeout(preloadCommon, 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Suspense fallback={<RouteFallback />}>
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
          </Suspense>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
