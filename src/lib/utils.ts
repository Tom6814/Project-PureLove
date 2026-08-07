import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getValidImageUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.includes('jmapiproxy.vip') || url.includes('nvs22.com')) {
    return url.replace(/^https?:\/\/[^\/]+/, 'https://www.cdnhjk.net');
  }
  return url;
}

/** 多源名称映射（用于详情页/卡片显示来源） */
export const SOURCE_NAMES: Record<string, string> = {
  jm: '禁漫 (JM)',
  bika: '哔咔 (Bika)',
  ehentai: 'e-hentai',
  nhentai: 'nhentai',
  copymanga: '拷贝漫画',
  noyacg: 'NoyAcg',
  komiic: 'Komiic',
  baozimh: '包子漫画',
  zaimanhua: '再漫画',
  wnacg: '绅士漫画',
};

export function getSourceName(source?: string): string {
  return (source && SOURCE_NAMES[source]) || source || 'JM';
}
