import { useState, useEffect } from 'react';
import { supabase, subscribeToTable } from '../lib/supabase';
import { handleSupabaseError, OperationType } from '../lib/supabase-errors';

export interface SiteSettings {
  enableR18Blur: boolean;
}

const defaultSettings: SiteSettings = {
  enableR18Blur: false,
};

export function useSettings() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

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
        setSettings({ ...defaultSettings, ...(data ? { enableR18Blur: data.enable_r18_blur } : {}) });
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
