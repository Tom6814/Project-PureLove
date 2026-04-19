import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../lib/firebase';
import { LogOut, ShieldCheck } from 'lucide-react';
import { AuthModal } from './AuthModal';
import { AnimatePresence } from 'framer-motion';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthModalOpen, authMode, closeAuthModal } = useAuth();
  return (
    <div className="min-h-screen bg-theme-bg font-sans text-theme-ink selection:bg-theme-accent/20">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 py-10 bg-theme-main min-h-[calc(100vh-80px)] border-x border-[#eee]/50">
        {children}
      </main>

      <AnimatePresence>
        {isAuthModalOpen && (
          <AuthModal 
            isOpen={isAuthModalOpen} 
            onClose={closeAuthModal} 
            defaultMode={authMode} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const Header = () => {
  const { user, profile, isAdmin, isReviewer, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleSubmitClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      openAuthModal('login');
    }
  };

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/explore', label: 'Explore' },
    { path: '/submit', label: 'Submit Manga' },
  ];

  if (isAdmin || isReviewer) {
    navItems.push({ path: '/admin', label: isAdmin ? 'Admin' : 'Reviewer' });
  }

  return (
    <header className="sticky top-0 z-50 bg-theme-bg/90 backdrop-blur-lg border-b border-[#eee] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2 group">
          <span className="font-serif italic font-bold text-2xl tracking-tighter text-theme-accent group-hover:opacity-80 transition-opacity">
            JM PureLove
          </span>
        </Link>

        <div className="flex items-center space-x-8">
          <nav className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={item.path === '/submit' ? handleSubmitClick : undefined}
                  className={`relative px-4 py-2 text-[14px] font-medium transition-colors group ${
                    isActive ? 'text-theme-ink' : 'text-theme-muted hover:text-theme-ink'
                  }`}
                >
                  <span className="relative z-10 flex items-center">
                    {item.label === 'Admin' || item.label === 'Reviewer' ? (
                      <><ShieldCheck className="w-4 h-4 mr-1.5" />{item.label}</>
                    ) : item.label}
                  </span>
                  
                  {/* Steady Underline Indicator */}
                  <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] bg-theme-accent transition-all duration-300 ${
                    isActive ? 'w-full' : 'w-0 group-hover:w-full opacity-50'
                  }`} />
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4 text-[13px]">
                <Link to="/settings" className="flex items-center space-x-2 hover:opacity-80 transition-opacity" title="个人设置">
                  <img 
                    src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`} 
                    alt="User Avatar" 
                    className="w-7 h-7 rounded-full border border-[#eee]"
                    referrerPolicy="no-referrer"
                  />
                  <span className="font-semibold text-theme-ink hidden sm:block">{profile?.displayName?.split(' ')[0] || '设置'}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-theme-muted hover:text-theme-accent transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="text-[13px] flex items-center gap-4">
                <button
                  onClick={() => openAuthModal('register')}
                  className="text-theme-muted hover:text-theme-ink transition-colors"
                >Register</button>
                <button
                  onClick={() => openAuthModal('login')}
                  className="font-semibold text-theme-accent hover:opacity-80 transition-opacity"
                >
                  Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
