import { useState, useEffect } from 'react';
import { supabase, subscribeToTable } from '../lib/supabase';
import { handleSupabaseError, OperationType } from '../lib/supabase-errors';

export interface SiteSettings {
  enableR18Blur: boolean;
}

const defaultSettings: SiteSettings = {
  enableR18Blur: false,
};

// 本地同步缓存：进入页面立即使用上次设置，避免异步拉取导致"先清晰后模糊"闪变
const STORAGE_KEY = 'rn_site_settings';
const cachedSettings = (): SiteSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultSettings;
};

export function useSettings() {
  // 初始值直接取自 localStorage（同步），保证首帧渲染即正确的模糊状态
  const [settings, setSettings] = useState<SiteSettings>(cachedSettings);
  const [loading, setLoading] = useState(true);

  const persist = (next: SiteSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setSettings(next);
  };

  useEffect(() => {
    let active = true;

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'general')
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, OperationType.GET, 'settings/general');
        return;
      }
      if (active) {
        persist({ ...defaultSettings, ...(data ? { enableR18Blur: data.enable_r18_blur } : {}) });
        setLoading(false);
      }
    };

    fetchSettings();
    const unsubscribe = subscribeToTable('settings', fetchSettings);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const updateSettings = async (newSettings: Partial<SiteSettings>) => {
    const next = { ...settings, ...newSettings };
    persist(next); // 先同步更新本地（立即生效）
    const { error } = await supabase
      .from('settings')
      .update({ enable_r18_blur: newSettings.enableR18Blur })
      .eq('id', 'general');
    if (error) {
      handleSupabaseError(error, OperationType.UPDATE, 'settings/general');
    }
  };

  return { settings, loading, updateSettings };
}
