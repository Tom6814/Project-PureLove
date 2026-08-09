export interface SensitiveHit {
  /** 命中的敏感词 */
  word: string;
  /** 命中的字段（title/description/review/authors/tags） */
  field: string;
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

/**
 * 对提交的本子信息做敏感词检测。
 * 返回所有命中项（字段 + 词）。
 */
export function detectSubmissionSensitive(
  data: { title?: string; description?: string; review?: string; authors?: string[]; tags?: string[] },
  words: string[]
): SensitiveHit[] {
  if (!words?.length) return [];
  const hits: SensitiveHit[] = [];
  const push = (field: string, text: string | undefined) => {
    for (const w of detectSensitiveInText(text ?? '', words)) {
      hits.push({ word: w, field });
    }
  };
  push('title', data.title);
  push('description', data.description);
  push('review', data.review);
  push('authors', (data.authors ?? []).join(','));
  push('tags', (data.tags ?? []).join(','));
  return hits;
}
