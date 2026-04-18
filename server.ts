import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to simulate JM API scraper
  app.get('/api/jm/:jmId', async (req, res) => {
    const { jmId } = req.params;
    const cleanId = jmId.replace(/\D/g, '');

    const baseUrls = [
      'https://www.jmapiproxy.vip',
      'https://www.jmapiproxy.net',
      'https://18comic.vip',
      'https://jmcomic1.me'
    ];

    let success = false;
    let albumData: any = null;

    // Generate basic JMComic token for native API requests
    const ts = Math.floor(Date.now() / 1000).toString();
    const token = crypto.createHash('md5').update(ts + '18comicAPPContent').digest('hex');

    for (const baseUrl of baseUrls) {
      try {
        const url = `${baseUrl}/api/album/${cleanId}`;
        const response = await axios.get(url, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 12; KB2000 Build/SKQ1.211019.001)',
            'token': token,
            'tokenparam': ts,
            'Accept-Encoding': 'gzip',
          }
        });

        const result = response.data;
        if (result && (result.data || result.album || result.title || result.name)) {
          const album = result.data?.album || result.album || result.data || result;
          if (album && (album.id || album.name || album.title)) {
            albumData = album;
            success = true;
            break;
          }
        }
      } catch (error) {
        console.log(`Failed to fetch from ${baseUrl}: ${(error as Error).message}`);
      }
    }

    if (success && albumData) {
      const title = albumData.name || albumData.title || `JM${cleanId} Title`;
      const description = albumData.description || albumData.intro || '';
      const coverUrl = albumData.photo_url || albumData.cover || `https://cdn-us.jmapiproxy.vip/media/albums/${cleanId}.jpg`;
      
      let tags: string[] = [];
      if (Array.isArray(albumData.tags)) {
        tags = albumData.tags;
      } else if (typeof albumData.tags === 'string') {
        tags = [albumData.tags];
      }

      let authors: string[] = [];
      if (Array.isArray(albumData.author)) {
        authors = albumData.author;
      } else if (typeof albumData.author === 'string') {
        authors = [albumData.author];
      }

      res.json({
        success: true,
        data: {
          jmId: cleanId,
          title,
          description,
          coverUrl,
          authors: authors.length ? authors : ['Unknown'],
          tags: tags.length ? tags : [],
          pages: parseInt(albumData.page_count || albumData.pages || "0") || 0
        }
      });
      return;
    }

    // Fallback if all URLs fail to avoid breaking the frontend mock completely,
    // but the prompt explicitly requires:
    // "遇到 404 或解析异常，请向前端抛出 400状态码 及明文错误说明。"
    res.status(400).json({
      success: false,
      error: '解析失败，无法连接到 JM API 或该漫画不存在。'
    });
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
