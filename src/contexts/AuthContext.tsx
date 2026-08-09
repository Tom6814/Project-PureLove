import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  supabase,
  toAppUser,
  mapProfileRow,
  type AppUser,
  type UserProfile,
} from '../lib/supabase';
import { handleSupabaseError, OperationType } from '../lib/supabase-errors';

export type { SocialLink, UserProfile } from '../lib/supabase';

interface AuthContextType {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isReviewer: boolean;
  isRoot: boolean;
  isAuthModalOpen: boolean;
  authMode: 'login' | 'register';
  openAuthModal: (mode: 'login' | 'register') => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isReviewer: false,
  isRoot: false,
  isAuthModalOpen: false,
  authMode: 'login',
  openAuthModal: () => {},
  closeAuthModal: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const openAuthModal = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  useEffect(() => {
    let active = true;

    const syncProfile = async (sbUser: SupabaseUser) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, OperationType.GET, `profiles/${sbUser.id}`);
        return;
      }
      if (data) {
        if (active) setProfile(mapProfileRow(data));
        return;
      }

      // Safety net: the auth trigger normally creates the profile row.
      const meta = sbUser.user_metadata ?? {};
      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: sbUser.id,
          email: sbUser.email,
          display_name:
            (meta.full_name as string) ||
            (meta.name as string) ||
            (meta.user_name as string) ||
            sbUser.email?.split('@')[0] ||
            '',
          photo_url:
            (meta.avatar_url as string) || (meta.picture as string) || (meta.avatar as string) || '',
          role: 'user',
        })
        .select()
        .maybeSingle();

      if (insertError) {
        handleSupabaseError(insertError, OperationType.CREATE, `profiles/${sbUser.id}`);
        return;
      }
      if (inserted && active) setProfile(mapProfileRow(inserted));
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sbUser = session?.user ?? null;
      if (active) {
        setUser(sbUser ? toAppUser(sbUser) : null);
        setProfile(null);
      }
      if (sbUser) {
        await syncProfile(sbUser);
      }
      if (active) setLoading(false);
    });

    // 移动端浏览器切后台/息屏后，回到前台时页面可能被冻结甚至整页重载。
    // 恢复可见时主动刷新 session，避免因 token 过期触发登出而被重定向回首页。
    const refreshOnVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        // 静默刷新；失败（过期）时 onAuthStateChange 会自行处理 SIGNED_OUT
        await supabase.auth.refreshSession().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', refreshOnVisible);

    return () => {
      active = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, []);

  const isRoot = profile?.email === 'sliverwhale000@gmail.com';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin: profile?.role === 'admin' || isRoot,
        isReviewer: profile?.role === 'reviewer',
        isRoot,
        isAuthModalOpen,
        authMode,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
