import type { Manga } from './supabase';

export interface DuplicateMatch {
  manga: Manga;
  /** 相似度 0-1 */
  score: number;
  /** 匹配原因（如 "JM ID 相同"、"标题高度相似"） */
  reason: string;
  level: 'high' | 'medium' | 'low';
}

/** 标题规范化：小写、去除常见干扰词与标点，用于比对 */
export function normalizeTitle(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/(汉化版|中文版|简中|繁中|全彩|高清|无修版|完整版|扫描版|电子版)/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

/** 基于字符二元组的 Dice 相似度（0-1），适合中文/短标题 */
export function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const sa = bigrams(a);
  const sb = bigrams(b);
  if (sa.size === 0 && sb.size === 0) return a === b ? 1 : 0;
  let inter = 0;
  for (const g of sa) if (sb.has(g)) inter++;
  return (2 * inter) / (sa.size + sb.size);
}

const normAuthors = (authors?: string[]) =>
  (authors || []).map((a) => normalizeTitle(a)).filter(Boolean);

/**
 * 查重：将待审核的本子与库内已有本子（approved）逐一比对。
 * 跨源比对（不分 source）：只要 JM ID / 标题 / 作者匹配，无论来源是否相同都判定疑似撞车。
 * 返回按相似度降序的匹配列表。
 */
export function findDuplicates(
  candidate: Pick<Manga, 'id' | 'title' | 'authors' | 'jmId' | 'source'>,
  library: Manga[]
): DuplicateMatch[] {
  const results: DuplicateMatch[] = [];
  const candNorm = normalizeTitle(candidate.title);
  const candAuthors = normAuthors(candidate.authors);

  for (const lib of library) {
    if (lib.id === candidate.id) continue;

    // 1) JM ID 完全一致 → 确定撞车（跨源：不看 source）
    if (
      candidate.jmId &&
      lib.jmId &&
      String(candidate.jmId) === String(lib.jmId)
    ) {
      results.push({ manga: lib, score: 1, reason: 'JM ID 相同', level: 'high' });
      continue;
    }

    const libNorm = normalizeTitle(lib.title);
    if (!candNorm || !libNorm) continue;

    // 2) 规范化标题完全相同 → 高度疑似
    if (candNorm === libNorm) {
      results.push({ manga: lib, score: 1, reason: '标题完全一致', level: 'high' });
      continue;
    }

    const sim = textSimilarity(candNorm, libNorm);
    const libAuthors = normAuthors(lib.authors);
    const authorOverlap = candAuthors.some((a) => libAuthors.includes(a));
    const allAuthorsMatch =
      candAuthors.length > 0 &&
      candAuthors.length === libAuthors.length &&
      candAuthors.every((a) => libAuthors.includes(a));

    // 3) 标题高度相似（≥80%）
    if (sim >= 0.8) {
      results.push({
        manga: lib,
        score: sim,
        reason: `标题高度相似 (${(sim * 100).toFixed(0)}%)`,
        level: 'high',
      });
      continue;
    }

    // 4) 标题相似 + 有共同作者 → 中疑似
    if (sim >= 0.55 && authorOverlap) {
      results.push({
        manga: lib,
        score: sim,
        reason: `作者一致且标题相似 (${(sim * 100).toFixed(0)}%)`,
        level: 'medium',
      });
      continue;
    }

    // 5) 作者完全相同 + 标题相近 → 低疑似
    if (sim >= 0.35 && allAuthorsMatch) {
      results.push({
        manga: lib,
        score: sim,
        reason: '作者完全相同且标题相近',
        level: 'low',
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 8);
}
