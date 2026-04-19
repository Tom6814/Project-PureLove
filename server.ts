import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // API Route to simulate JM API scraper
  app.get('/api/jm/:jmId', async (req, res) => {
    const { jmId } = req.params;
    const cleanId = jmId.replace(/\D/g, '');

    const baseUrls = [
      'https://www.cdnhjk.net',
      'https://www.cdngwc.cc',
      'https://www.cdngwc.net',
      'https://www.cdngwc.club',
      'https://www.cdnhjk.cc'
    ];

    let success = false;
    let albumData: any = null;
    let successfulBaseUrl = '';

    // Generate basic JMComic token for native API requests
    const ts = Math.floor(Date.now() / 1000).toString();
    const ver = '2.0.19';
    const tokenparam = `${ts},${ver}`;
    const token = crypto.createHash('md5').update(ts + '18comicAPP').digest('hex');
    const secret = '185Hcomic3PAPP7R'; // APP_DATA_SECRET

    for (const baseUrl of baseUrls) {
      try {
        const url = `${baseUrl}/album?id=${cleanId}`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(8000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 9; V1938CT Build/PQ3A.190705.11211812; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36',
            'token': token,
            'tokenparam': tokenparam,
            'Accept-Encoding': 'identity'
          }
        });

        const result = await response.json();
        if (result && result.code === 200 && typeof result.data === 'string') {
          // Decrypt the data
          const keyStr = ts + secret;
           const keyHex = crypto.createHash('md5').update(keyStr).digest('hex');
           const key = Buffer.from(keyHex, 'utf8');
           const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
           decipher.setAutoPadding(false); // Manually handle padding
          
          const encryptedBuf = Buffer.from(result.data, 'base64');
          const decryptedBuf = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]);
          
          // PKCS7 unpadding
          const pad = decryptedBuf[decryptedBuf.length - 1];
          const unpaddedBuf = decryptedBuf.slice(0, decryptedBuf.length - pad);
          const jsonStr = unpaddedBuf.toString('utf8');
          
          const parsedData = JSON.parse(jsonStr);
          
          const album = parsedData?.album || parsedData;
          if (album && (album.id || album.name || album.title)) {
            albumData = album;
            success = true;
            successfulBaseUrl = baseUrl;
            break;
          }
        } else if (result && result.code === 200 && Array.isArray(result.data) && result.data.length === 0) {
           // 404 conceptually (empty data)
           continue;
        }
      } catch (error: any) {
        console.log(`Failed to fetch from ${baseUrl}: ${error.message}`);
        if (error.response) {
          console.log(error.response.data);
        }
      }
    }

    if (success && albumData) {
      const title = albumData.name || albumData.title || `JM${cleanId} Title`;
      const description = albumData.description || albumData.intro || '';
      const coverUrl = albumData.photo_url || albumData.cover || `https://cdn-us.jmapiproxy.vip/media/albums/${cleanId}.jpg`;
      
      let tags: string[] = [];
      if (Array.isArray(albumData.tags)) {
        tags = albumData.tags.map((t: any) => typeof t === 'string' ? t : (t.name || t.title || ''));
      } else if (typeof albumData.tags === 'string') {
        tags = [albumData.tags];
      }

      let authors: string[] = [];
      if (Array.isArray(albumData.author)) {
        authors = albumData.author.map((a: any) => typeof a === 'string' ? a : (a.name || a.title || ''));
      } else if (typeof albumData.author === 'string') {
        authors = [albumData.author];
      }

      let finalCoverUrl = coverUrl;
      try {
        const coverObj = new URL(coverUrl);
        const apiObj = new URL(successfulBaseUrl);
        coverObj.host = apiObj.host;
        const fetchCoverUrl = coverObj.toString();

        const coverResponse = await fetch(fetchCoverUrl, {
          signal: AbortSignal.timeout(10000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Referer': 'https://jmcomic.ltd/',
          }
        });
        if (coverResponse.ok) {
          const arrayBuffer = await coverResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString('base64');
          const contentType = coverResponse.headers.get('content-type') || 'image/jpeg';
          finalCoverUrl = `data:${contentType};base64,${base64}`;
        } else {
          finalCoverUrl = fetchCoverUrl;
        }
      } catch (err) {
        console.log(`Failed to fetch cover image: ${(err as Error).message}`);
        try {
          const coverObj = new URL(coverUrl);
          const apiObj = new URL(successfulBaseUrl);
          coverObj.host = apiObj.host;
          finalCoverUrl = coverObj.toString();
        } catch(e) {}
      }

      res.json({
        success: true,
        data: {
          jmId: cleanId,
          title,
          description,
          coverUrl: finalCoverUrl,
          authors: authors.length ? authors : ['Unknown'],
          tags: tags.length ? tags : [],
          pages: parseInt(albumData.page_count || albumData.pages || "0") || 0
        }
      });
      return;
    }

    // Fallback if all URLs fail or not found
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
