import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sources, getSource } from './sources';

// ============================================================
// Supabase 运行时配置
// 生产部署读取普通环境变量（SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY），
// 在返回 index.html 时注入 window.__SUPABASE_CONFIG__ 供前端使用，
// 不依赖构建期 VITE_* 变量（避免 Zeabur 等平台构建失败）。
// 同时兼容旧变量名（VITE_SUPABASE_URL 等）。
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** 注入到 index.html 的运行时 Supabase 配置脚本 */
function supabaseConfigScript(): string {
  const config = JSON.stringify({ url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY });
  return `<script>window.__SUPABASE_CONFIG__ = ${config};</script>`;
}

async function syncAllFavorites() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.warn('[favorites] 未配置 SUPABASE_SERVICE_ROLE_KEY，跳过每日收藏同步。');
    return;
  }
  const admin = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  try {
    // 1. 读取所有开启了收藏功能的源账号（RPC，绕过 RLS）
    const { data: accounts, error: listErr } = await admin.rpc('prn_list_sync_accounts');
    if (listErr) throw listErr;
    if (!Array.isArray(accounts) || accounts.length === 0) {
      console.log('[favorites] 没有开启收藏夹的账号，跳过本次同步。');
      return;
    }
    console.log(`[favorites] 开始同步 ${accounts.length} 个账号的收藏...`);
    let ok = 0, fail = 0;
    for (const acc of accounts) {
      const { user_id: userId, source, username, password } = acc;
      const adapter = getSource(String(source || ''));
      if (!adapter || !adapter.favorites) {
        // 该源不支持收藏：清空该用户该源的历史快照
        try { await admin.rpc('prn_replace_favorites', { p_user: userId, p_source: source, p_items: [] }); } catch { /* ignore */ }
        continue;
      }
      try {
        let cred: Record<string, string> | undefined;
        // 需要登录的源先登录拿凭据
        if (adapter.login) {
          const loginRes = await adapter.login(String(username || ''), String(password || ''));
          if (!loginRes.ok) throw new Error(loginRes.error || '登录失败');
          cred = loginRes.credentials;
        }
        const items = await adapter.favorites(cred);
        await admin.rpc('prn_replace_favorites', {
          p_user: userId,
          p_source: source,
          p_items: (items || []).map((it) => ({ item_id: it.id, title: it.title, cover_url: it.coverUrl, authors: it.authors || [] })),
        });
        ok++;
        console.log(`[favorites] ${source} 同步成功：${(items || []).length} 项`);
      } catch (e: any) {
        fail++;
        console.error(`[favorites] ${source} 同步失败：`, e?.message || e);
      }
    }
    console.log(`[favorites] 同步完成：成功 ${ok}，失败 ${fail}`);
  } catch (e: any) {
    console.error('[favorites] 同步任务异常：', e?.message || e);
  }
}

// 启动时立即跑一次，之后每天跑一次（简单起见用 24h 定时器）
function startFavoritesCron() {
  syncAllFavorites();
  setInterval(syncAllFavorites, 24 * 60 * 60 * 1000);
}

async function startServer() {
  const app = express();
  const PORT = Number.parseInt(process.env.PORT || '', 10) || 3000;

  app.use(express.json());

  // ============================================================
  // Multi-source API
  // 禁漫 / 哔咔 / e-hentai / nhentai / 拷贝漫画 / NoyAcg / Komiic / 包子漫画 / 再漫画 / 绅士漫画
  // ============================================================

  // 兼容旧接口：按 JM 号解析（新增漫画页的"或输入 JM 号"入口）
  app.get('/api/jm/:jmId', async (req, res) => {
    const cleanId = (req.params.jmId || '').replace(/\D/g, '');
    if (!cleanId) return res.status(400).json({ success: false, error: '无效的 JM 号。' });
    try {
      const detail = await getSource('jm')!.detail(cleanId);
      if (!detail) {
        return res.status(400).json({ success: false, error: '解析失败，无法连接到 JM API 或该漫画不存在。' });
      }
      res.json({
        success: true,
        data: {
          jmId: detail.id,
          title: detail.title,
          description: detail.description,
          coverUrl: detail.coverUrl,
          authors: detail.authors.length ? detail.authors : ['Unknown'],
          tags: detail.tags,
          pages: detail.pages,
        },
      });
    } catch (e: any) {
      res.status(400).json({ success: false, error: e.message || '解析失败' });
    }
  });

  // 可用源列表
  app.get('/api/sources', (_req, res) => {
    res.json({
      success: true,
      data: sources.map((s) => ({
        id: s.id,
        name: s.name,
        needsLogin: s.needsLogin,
        supportsFavorites: !!s.favorites && !!s.supportsFavorites,
      })),
    });
  });

  // 按漫画名搜索（多源，封面一律转 base64）
  app.post('/api/sources/search', async (req, res) => {
    const { source, q, page, cred } = req.body || {};
    const adapter = getSource(String(source || ''));
    if (!adapter) return res.status(400).json({ success: false, error: '未知的源' });
    if (!q) return res.status(400).json({ success: false, error: '缺少搜索关键词' });
    try {
      const data = await adapter.search(String(q), parseInt(page || '1', 10) || 1, cred);
      res.json({ success: true, data });
    } catch (e: any) {
      const needsLogin = e.message === 'NEED_LOGIN';
      res.json({ success: false, error: needsLogin ? '该源需要登录后使用' : e.message, needsLogin });
    }
  });

  // 详情解析（多源，封面转 base64）
  app.post('/api/sources/detail', async (req, res) => {
    const { source, id, cred } = req.body || {};
    const adapter = getSource(String(source || ''));
    if (!adapter) return res.status(400).json({ success: false, error: '未知的源' });
    if (!id) return res.status(400).json({ success: false, error: '缺少漫画 id' });
    try {
      const data = await adapter.detail(String(id), cred);
      if (!data) return res.json({ success: false, error: '未找到该漫画' });
      res.json({ success: true, data });
    } catch (e: any) {
      const needsLogin = e.message === 'NEED_LOGIN';
      res.json({ success: false, error: needsLogin ? '该源需要登录后使用' : e.message, needsLogin });
    }
  });

  // 源账号登录（凭证由前端保存到 Supabase，之后搜索/解析时带回）
  app.post('/api/sources/login', async (req, res) => {
    const { source, username, password } = req.body || {};
    const adapter = getSource(String(source || ''));
    if (!adapter?.login) return res.status(400).json({ success: false, error: '该源不支持账号登录' });
    try {
      const result = await adapter.login(String(username || ''), String(password || ''));
      if (!result.ok) return res.json({ success: false, error: result.error || '登录失败' });
      res.json({ success: true, data: result.credentials });
    } catch (e: any) {
      res.json({ success: false, error: e.message || '登录失败' });
    }
  });

  // 手动触发一次收藏同步（便于管理员/站长在配置后立即刷新）
  app.post('/api/favorites/sync', async (_req, res) => {
    await syncAllFavorites();
    res.json({ success: true });
  });

  // ============================================================
  // SEO：动态 sitemap + 动态路由 SSR 注入（title/description/OG），提升搜索引擎收录
  // ============================================================
  const SITE_URL = process.env.SITE_URL || 'https://purelove.party';

  app.get('/sitemap.xml', async (_req, res) => {
    try {
      const pages: string[] = [
        `${SITE_URL}/`,
        `${SITE_URL}/explore`,
      ];
      // 收录全部已审核 manga 详情页
      if (SUPABASE_URL && SERVICE_ROLE_KEY) {
        const admin = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data, error } = await admin
          .from('mangas')
          .select('id')
          .eq('status', 'approved');
        if (!error && data) {
          for (const row of data) pages.push(`${SITE_URL}/manga/${row.id}`);
        }
      }
      const lastmod = new Date().toISOString().slice(0, 10);
      const urls = pages
        .map((loc) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
        .join('\n');
      res.type('application/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
    } catch {
      res.status(500).send('Error generating sitemap');
    }
  });

  // 动态路由 SSR 注入：SPA 的 index.html 默认 meta 无法反映每个页面，
  // 这里对 /manga/:id 注入匹配的 title / description / OG 标签。
  async function injectSeoMeta(html: string, title: string, description: string) {
    return html
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(
        /<meta name="description" content="[^"]*" \/>/,
        `<meta name="description" content="${description}" />`
      )
      .replace(
        /<meta property="og:title" content="[^"]*" \/>/,
        `<meta property="og:title" content="${title}" />`
      )
      .replace(
        /<meta property="og:description" content="[^"]*" \/>/,
        `<meta property="og:description" content="${description}" />`
      )
      .replace(
        /<meta property="og:url" content="[^"]*" \/>/,
        `<meta property="og:url" content="${SITE_URL}/" />`
      );
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // index: false —— 首页也交给下方中间件处理，确保注入运行时 Supabase 配置
    app.use(express.static(distPath, { index: false }));

    // SSR 注入中间件（生产模式）：读 index.html，对动态路由注入匹配的 meta 后返回
    app.get('*', async (req, res) => {
      try {
        const fs = await import('fs');
        let html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        // 注入运行时 Supabase 配置（部署时无需构建期 VITE_* 变量）
        html = html.replace('</head>', `${supabaseConfigScript()}</head>`);
        const m = req.path.match(/^\/manga\/([^/]+)/);
        if (m && SUPABASE_URL && SERVICE_ROLE_KEY) {
          const admin = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const { data } = await admin.from('mangas').select('id,title,description').eq('id', m[1]).maybeSingle();
          if (data) {
            const title = `${data.title} - Project RN`;
            const desc = (data.description || `${data.title} 的详情页`).slice(0, 150);
            html = await injectSeoMeta(html, escapeHtml(title), escapeHtml(desc));
          }
        }
        res.type('html').send(html);
      } catch {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startFavoritesCron();
startServer();
