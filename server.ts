import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { sources, getSource } from './sources';

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
    res.json({ success: true, data: sources.map((s) => ({ id: s.id, name: s.name, needsLogin: s.needsLogin })) });
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

startServer();
