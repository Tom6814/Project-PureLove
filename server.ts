import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to simulate JM API scraper
  app.get('/api/jm/:jmId', async (req, res) => {
    const { jmId } = req.params;
    const cleanId = jmId.replace(/\D/g, '');

    try {
      // Attempt to hit a known JM mirror URL. 
      // Many mirrors exist, we use a common one as an example.
      // E.g., 18comic.vip, jmcomic1.me. We spoof headers to avoid blocks.
      const url = `https://18comic.vip/album/${cleanId}`;
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        }
      });

      const $ = cheerio.load(response.data);
      const title = $('.panel-heading h1').text().trim() || `JM${cleanId} Title`;
      const coverUrl = $('.thumb-overlay img').first().attr('src') || `https://picsum.photos/seed/${cleanId}manga/400/600`;
      
      const tags: string[] = [];
      $('span[data-default="Tags"] ~ a, .tag-block a').each((_, el) => {
        const text = $(el).text().trim();
        if (text) tags.push(text);
      });

      const authors: string[] = [];
      $('span[data-default="Author"] ~ a, span[data-default="作者"] ~ a').each((_, el) => {
        const text = $(el).text().trim();
        if (text) authors.push(text);
      });

      const pagesText = $('span[data-default="Pages"], span[data-default="頁數"]').next().text().trim();
      const pages = parseInt(pagesText) || 0;

      const description = $('#intro-block .p-t-5').text().trim() || 'No description provided.';

      res.json({
        success: true,
        data: {
          jmId: cleanId,
          title,
          description,
          coverUrl,
          authors: authors.length ? authors : ['Unknown'],
          tags: tags.length ? tags : ['纯爱'], // Assume pure love for this site theme
          pages
        }
      });
      return;
    } catch (error) {
      console.error(`Failed to fetch JM data for ${cleanId}, falling back to mock:`, (error as Error).message);
      
      // Fallback due to Cloudflare / Network blocks common on Cloud Run
      setTimeout(() => {
        const mockMangas = [
          {
            jmId: cleanId,
            title: `[Pure Love Project] First Kiss in Spring (JM${cleanId})`,
            description: "A heart-warming story of two childhood friends realizing their true feelings for each other during the spring festival. No drama, just 100% pure vanilla sweetness and wholesome moments.",
            coverUrl: `https://picsum.photos/seed/${cleanId}manga/400/600`, 
            authors: ["Yuzuki Sakura", "Studio Vanilla"],
            tags: ["纯爱", "Vanilla", "Childhood Friend", "Romance", "Wholesome", "Full Color"],
            pages: 32,
          },
          {
            jmId: cleanId,
            title: `[Milky Way] My Cute Senpai's Secret (JM${cleanId})`,
            description: "She is the perfect student council president, but she has a secret only I know. A thoroughly sweet and heartwarming romantic comedy that explores their secret dorm dates.",
            coverUrl: `https://picsum.photos/seed/${cleanId}senpai/400/600`,
            authors: ["Hoshino", "MilkyWay Circle"],
            tags: ["纯爱", "Wholesome", "Senpai", "Sweat", "Romance"],
            pages: 45,
          },
          {
            jmId: cleanId,
            title: `[Lovly Heart] Morning Coffee with My Wife (JM${cleanId})`,
            description: "Newlyweds enjoying their morning routine. Every page is filled to the brim with sugar. For those looking for extreme vanilla and a happy atmosphere.",
            coverUrl: `https://picsum.photos/seed/${cleanId}wife/400/600`,
            authors: ["Kawaii Neko"],
            tags: ["纯爱", "Newlyweds", "Vanilla", "Sole Female", "Sole Male"],
            pages: 28,
          }
        ];

        const manga = mockMangas[parseInt(cleanId || "0") % mockMangas.length] || mockMangas[0];
        
        res.json({
          success: true,
          data: manga,
          isMock: true
        });
      }, 500);
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
