import { createClient, type User as SupabaseUser } from '@supabase/supabase-js';

// ============================================================
// Supabase client
// ============================================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ============================================================
// Domain types (camelCase, matches the app's UI shapes)
// ============================================================
export interface SocialLink {
  id: string;
  icon: string; // Emoji, like 🐦, 🌐, 📺
  label: string; // e.g. Twitter, Website, YouTube
  url: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'user' | 'admin' | 'reviewer';
  jmUsername?: string;
  contactEmail?: string;
  bio?: string;
  socialLinks?: SocialLink[];
  backgroundUrl?: string;
  customCss?: string;
  createdAt: string;
}

export interface Manga {
  id: string;
  source: string;
  jmId: string;
  title: string;
  description: string;
  review: string;
  coverUrl: string;
  authors: string[];
  tags: string[];
  pages: number;
  category: string;
  isR18: boolean;
  status: 'pending' | 'approved' | 'rejected';
  submittedBy: string | null;
  submittedByName: string;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
}

export interface Review {
  id: string;
  mangaId: string;
  userId: string;
  rating: number;
  comment: string;
  customUsername: string;
  contactEmail: string;
  jmUsername: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Auth helpers (normalized AppUser keeps pages unchanged)
// ============================================================
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string;
}

export function toAppUser(user: SupabaseUser): AppUser {
  const meta = user.user_metadata ?? {};
  return {
    uid: user.id,
    email: user.email,
    displayName:
      (meta.full_name as string) ||
      (meta.name as string) ||
      (meta.user_name as string) ||
      user.email?.split('@')[0] ||
      '',
    photoURL:
      (meta.avatar_url as string) || (meta.picture as string) || (meta.avatar as string) || '',
  };
}

export const loginWithEmail = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
};

export const registerWithEmail = async (email: string, password: string) => {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
};

export const loginWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
};

export const loginWithGithub = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// ============================================================
// Row mappers (snake_case DB rows → camelCase domain objects)
// ============================================================
export function mapProfileRow(row: Record<string, any>): UserProfile {
  return {
    uid: row.id,
    email: row.email ?? '',
    displayName: row.display_name ?? '',
    photoURL: row.photo_url ?? '',
    role: row.role ?? 'user',
    jmUsername: row.jm_username ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    bio: row.bio ?? undefined,
    socialLinks: row.social_links ?? undefined,
    backgroundUrl: row.background_url ?? undefined,
    customCss: row.custom_css ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export function mapMangaRow(row: Record<string, any>): Manga {
  return {
    id: row.id,
    source: row.source ?? 'jm',
    jmId: row.jm_id,
    title: row.title,
    description: row.description ?? '',
    review: row.review ?? '',
    coverUrl: row.cover_url ?? '',
    authors: row.authors ?? [],
    tags: row.tags ?? [],
    pages: row.pages ?? 0,
    category: row.category ?? '',
    isR18: row.is_r18 ?? false,
    status: row.status,
    submittedBy: row.submitted_by ?? null,
    submittedByName: row.submitted_by_name ?? '',
    averageRating: row.average_rating ?? 0,
    reviewCount: row.review_count ?? 0,
    createdAt: row.created_at,
  };
}

export function mapReviewRow(row: Record<string, any>): Review {
  return {
    id: row.id,
    mangaId: row.manga_id,
    userId: row.user_id,
    rating: row.rating ?? 0,
    comment: row.comment ?? '',
    customUsername: row.custom_username ?? '',
    contactEmail: row.contact_email ?? '',
    jmUsername: row.jm_username ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// Realtime helper: subscribe to all changes on a table
// ============================================================
export function subscribeToTable(table: string, onEvent: () => void): () => void {
  const channel = supabase
    .channel(`realtime:${table}:${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => onEvent())
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** PostgREST unique-violation detection (SQLSTATE 23505) */
export function isUniqueViolation(error: unknown): boolean {
  return (
    (error as { code?: string })?.code === '23505' ||
    (error instanceof Error && /duplicate key value violates unique constraint/i.test(error.message))
  );
}

// ============================================================
// Source credentials & cache (multi-source submit flow)
// ============================================================
export async function getSourceCredentials(source: string): Promise<Record<string, string> | null> {
  const { data, error } = await supabase
    .from('source_credentials')
    .select('payload')
    .eq('source', source)
    .maybeSingle();
  if (error || !data) return null;
  return (data.payload as Record<string, string>) ?? null;
}

export async function saveSourceCredentials(source: string, payload: Record<string, string>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const { error } = await supabase
    .from('source_credentials')
    .upsert({ user_id: user.id, source, payload }, { onConflict: 'user_id,source' });
  if (error) throw error;
}

export async function deleteSourceCredentials(source: string) {
  const { error } = await supabase.from('source_credentials').delete().eq('source', source);
  if (error) throw error;
}

export async function getSourceCache<T>(cacheKey: string): Promise<T | null> {
  const { data, error } = await supabase
    .from('source_cache')
    .select('payload')
    .eq('cache_key', cacheKey)
    .maybeSingle();
  if (error || !data) return null;
  return data.payload as T;
}

export async function saveSourceCache<T>(cacheKey: string, payload: T) {
  const { error } = await supabase
    .from('source_cache')
    .upsert({ cache_key: cacheKey, payload }, { onConflict: 'cache_key' });
  if (error) console.error('source_cache save failed:', error.message);
}
