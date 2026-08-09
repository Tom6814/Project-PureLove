import { useState, useEffect } from 'react';
import { supabase, subscribeToTable } from '../lib/supabase';
import { handleSupabaseError, OperationType } from '../lib/supabase-errors';

export interface SiteSettings {
  enableR18Blur: boolean;
  /** R18 封面模糊强度（像素），管理员可调，默认 12（≈blur-md） */
  r18BlurAmount: number;
  /** 通用敏感词：检测标题/简介/标签 */
  sensitiveWords: string[];
  /** 推荐语敏感词：单独检测推荐语字段 */
  sensitiveWordsReview: string[];
  /** 作者敏感词：单独检测作者字段 */
  sensitiveWordsAuthors: string[];
}

const defaultSettings: SiteSettings = {
  enableR18Blur: false,
  r18BlurAmount: 12,
  sensitiveWords: [],
  sensitiveWordsReview: [],
  sensitiveWordsAuthors: [],
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
        persist({
          ...defaultSettings,
          ...(data
            ? {
                enableR18Blur: data.enable_r18_blur,
                r18BlurAmount:
                  typeof data.r18_blur_amount === 'number' ? data.r18_blur_amount : 12,
                sensitiveWords: Array.isArray(data.sensitive_words) ? data.sensitive_words : [],
                sensitiveWordsReview: Array.isArray(data.sensitive_words_review)
                  ? data.sensitive_words_review
                  : [],
                sensitiveWordsAuthors: Array.isArray(data.sensitive_words_authors)
                  ? data.sensitive_words_authors
                  : [],
              }
            : {}),
        });
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
    const patch: Record<string, unknown> = {};
    if (newSettings.enableR18Blur !== undefined) patch.enable_r18_blur = newSettings.enableR18Blur;
    if (newSettings.r18BlurAmount !== undefined) patch.r18_blur_amount = newSettings.r18BlurAmount;
    if (newSettings.sensitiveWords !== undefined) patch.sensitive_words = newSettings.sensitiveWords;
    if (newSettings.sensitiveWordsReview !== undefined) patch.sensitive_words_review = newSettings.sensitiveWordsReview;
    if (newSettings.sensitiveWordsAuthors !== undefined) patch.sensitive_words_authors = newSettings.sensitiveWordsAuthors;
    const { error } = await supabase
      .from('settings')
      .update(patch)
      .eq('id', 'general');
    if (error) {
      handleSupabaseError(error, OperationType.UPDATE, 'settings/general');
    }
  };

  return { settings, loading, updateSettings };
}
