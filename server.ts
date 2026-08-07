import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sources, getSource } from './sources';

// ============================================================
// 收藏夹每日同步任务
// 使用服务器存储的源账号（source_accounts），逐个拉取用户在各源的收藏，
// 覆盖写入 user_favorites 快照（覆盖前一天的），供个人主页公开展示。
// 需要 SUPABASE_SERVICE_ROLE_KEY 才能跨用户读写；未配置则跳过并打印提示。
// ============================================================
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startFavoritesCron();
startServer();
