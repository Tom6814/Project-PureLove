import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';

async function startServer() {
  const app = express();
  const PORT = Number.parseInt(process.env.PORT || '', 10) || 3000;

  app.use(express.json());

  // ============================================================
  // JM API（对齐 JMComic-Crawler-Python 的移动端接口实现）
  // ============================================================
  const APP_VERSION = '2.0.30';
  const APP_TOKEN_SECRET = '185Hcomic3PAPP7R'; // token 与数据解密共用密钥
  const API_DOMAIN_SERVER_SECRET = 'diosfjckwpqpdfjkvnqQjsik';
  const FALLBACK_API_DOMAINS = [
    'www.cdnhjk.net',
    'www.cdngwc.cc',
    'www.cdngwc.net',
    'www.cdngwc.club',
    'www.cdnutc.me',
  ];
  // 最新移动端 API 域名发布源（与 jmcomic 相同）
  const DOMAIN_SERVER_URLS = [
    'https://rup4a04-c01.tos-ap-southeast-1.bytepluses.com/newsvr-2025.txt',
    'https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt',
    'https://rup4a04-c03.tos-cn-beijing.bytepluses.com.cn/newsvr-2025.txt',
  ];
  // 封面图 CDN（/media/albums/{id}.jpg 已验证可用）
  const COVER_HOSTS = [
    'https://cdn-msp.jmapiproxy1.cc',
    'https://cdn-msp.jmapiproxy2.cc',
    'https://cdn-msp.jmapinodeudzn.net',
    'https://www.cdnhjk.net',
  ];

  const API_DOMAIN_TTL = 6 * 60 * 60 * 1000; // 6 小时
  let apiDomainsCache: { list: string[]; fetchedAt: number } | null = null;

  /** AES-256-ECB 解密，key = md5(ts + secret)，对齐 JmCryptoTool.decode_resp_data */
  function decryptData(data: string, ts: string, secret: string): string {
    const key = Buffer.from(crypto.createHash('md5').update(ts + secret).digest('hex'), 'utf8');
    const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
    decipher.setAutoPadding(false);
    const dec = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]);
    const pad = dec[dec.length - 1];
    return dec.slice(0, dec.length - pad).toString('utf8');
  }

  /** 获取最新移动端 API 域名列表（带缓存），失败时回退到内置域名 */
  async function fetchApiDomains(): Promise<string[]> {
    if (apiDomainsCache && Date.now() - apiDomainsCache.fetchedAt < API_DOMAIN_TTL) {
      return apiDomainsCache.list;
    }
    for (const url of DOMAIN_SERVER_URLS) {
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) continue;
        let text = await resp.text();
        while (text && text.charCodeAt(0) < 32) text = text.slice(1);
        const json = JSON.parse(decryptData(text, '', API_DOMAIN_SERVER_SECRET));
        if (Array.isArray(json.Server) && json.Server.length > 0) {
          apiDomainsCache = { list: json.Server, fetchedAt: Date.now() };
          console.log(`JM API domains updated: ${json.Server.join(', ')}`);
          return json.Server;
        }
      } catch (e: any) {
        console.log(`JM domain update failed from ${url}: ${e.message}`);
      }
    }
    apiDomainsCache = { list: FALLBACK_API_DOMAINS, fetchedAt: Date.now() };
    return FALLBACK_API_DOMAINS;
  }

  /** 拉取单个 album 详情，失败或不存在（data=[]）时返回 null */
  async function fetchAlbum(domain: string, aid: string): Promise<any | null> {
    const ts = Math.floor(Date.now() / 1000).toString();
    const token = crypto.createHash('md5').update(ts + APP_TOKEN_SECRET).digest('hex');
    const resp = await fetch(`https://${domain}/album?id=${aid}`, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 9; V1938CT Build/PQ3A.190705.11211812; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36',
        'Accept-Encoding': 'gzip, deflate',
        'token': token,
        'tokenparam': `${ts},${APP_VERSION}`,
      },
    });
    const result = await resp.json();
    if (result?.code !== 200 || typeof result.data !== 'string') return null;
    const decrypted = decryptData(result.data, ts, APP_TOKEN_SECRET);
    const parsed = JSON.parse(decrypted);
    return parsed?.album || parsed;
  }

  /** 抓取封面并转为 base64（防防盗链），全部失败时返回可用的原始 URL */
  async function fetchCoverBase64(coverPath: string): Promise<string> {
    for (const host of COVER_HOSTS) {
      try {
        const resp = await fetch(`${host}${coverPath}`, {
          signal: AbortSignal.timeout(8000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Referer': 'https://18comic.vip/',
          },
        });
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          const contentType = resp.headers.get('content-type') || 'image/jpeg';
          return `data:${contentType};base64,${buf.toString('base64')}`;
        }
      } catch (e: any) {
        console.log(`Failed to fetch cover from ${host}: ${e.message}`);
      }
    }
    return `${COVER_HOSTS[0]}${coverPath}`;
  }

  // API Route: 解析 JM 漫画信息
  app.get('/api/jm/:jmId', async (req, res) => {
    const { jmId } = req.params;
    const cleanId = jmId.replace(/\D/g, '');
    if (!cleanId) {
      return res.status(400).json({ success: false, error: '无效的 JM 号。' });
    }

    const domains = await fetchApiDomains();
    let albumData: any = null;

    for (const domain of domains) {
      try {
        const album = await fetchAlbum(domain, cleanId);
        if (album && (album.id || album.name)) {
          albumData = album;
          break;
        }
      } catch (e: any) {
        console.log(`Failed to fetch album from ${domain}: ${e.message}`);
      }
    }

    if (!albumData) {
      return res.status(400).json({
        success: false,
        error: '解析失败，无法连接到 JM API 或该漫画不存在。',
      });
    }

    const title = albumData.name || albumData.title || `JM${cleanId} Title`;
    const description = albumData.description || '';

    let tags: string[] = [];
    if (Array.isArray(albumData.tags)) {
      tags = albumData.tags
        .map((t: any) => (typeof t === 'string' ? t : t.name || t.title || ''))
        .filter(Boolean);
    } else if (typeof albumData.tags === 'string') {
      tags = [albumData.tags];
    }

    let authors: string[] = [];
    if (Array.isArray(albumData.author)) {
      authors = albumData.author
        .map((a: any) => (typeof a === 'string' ? a : a.name || a.title || ''))
        .filter(Boolean);
    } else if (typeof albumData.author === 'string') {
      authors = [albumData.author];
    }

    const coverUrl = await fetchCoverBase64(`/media/albums/${cleanId}.jpg`);

    res.json({
      success: true,
      data: {
        jmId: cleanId,
        title,
        description,
        coverUrl,
        authors: authors.length ? authors : ['Unknown'],
        tags,
        pages: parseInt(albumData.total_photos || albumData.page_count || albumData.pages || '0', 10) || 0,
      },
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
