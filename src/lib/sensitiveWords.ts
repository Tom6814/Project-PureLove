export interface SensitiveHit {
  /** 命中的敏感词 */
  word: string;
  /** 命中的字段（title/description/review/authors/tags） */
  field: string;
  /** 所属词表分类（general/review/authors） */
  category: 'general' | 'review' | 'authors';
}

const FIELD_LABELS: Record<string, string> = {
  title: '标题',
  description: '简介',
  review: '推荐语',
  authors: '作者',
  tags: '标签',
};

export const fieldLabel = (field: string) => FIELD_LABELS[field] ?? field;

/** 在单个文本中检测命中哪些敏感词（忽略大小写） */
export function detectSensitiveInText(text: string, words: string[]): string[] {
  if (!text || words.length === 0) return [];
  const lower = String(text).toLowerCase();
  const hits = new Set<string>();
  for (const w of words) {
    const word = String(w).trim();
    if (word && lower.includes(word.toLowerCase())) hits.add(word);
  }
  return Array.from(hits);
}

export interface SensitiveWordSets {
  /** 通用：检测标题/简介/标签 */
  general: string[];
  /** 推荐语专用 */
  review: string[];
  /** 作者专用 */
  authors: string[];
}

/**
 * 对提交的本子信息做敏感词检测（分类词表）：
 * - 通用词表 → 标题 / 简介 / 标签
 * - 推荐语词表 → 推荐语
 * - 作者词表 → 作者
 */
export function detectSubmissionSensitive(
  data: { title?: string; description?: string; review?: string; authors?: string[]; tags?: string[] },
  words: SensitiveWordSets
): SensitiveHit[] {
  const hits: SensitiveHit[] = [];
  const push = (field: string, text: string | undefined, category: SensitiveHit['category'], wordList: string[]) => {
    for (const w of detectSensitiveInText(text ?? '', wordList)) {
      hits.push({ word: w, field, category });
    }
  };
  push('title', data.title, 'general', words.general);
  push('description', data.description, 'general', words.general);
  push('tags', (data.tags ?? []).join(','), 'general', words.general);
  push('review', data.review, 'review', words.review);
  push('authors', (data.authors ?? []).join(','), 'authors', words.authors);
  return hits;
}
