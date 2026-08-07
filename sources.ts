// ============================================================
// Multi-source manga adapters (aligned with Breeze plugins)
// ============================================================
import crypto from 'crypto';
import { load as cheerioLoad } from 'cheerio';

export interface SourceSearchItem {
  id: string;
  title: string;
  coverUrl: string;
  authors: string[];
}

export interface SourceDetail {
  id: string;
  title: string;
  description: string;
  coverUrl: string; // base64 or raw URL
  authors: string[];
  tags: string[];
  pages: number;
}

export type Credentials = Record<string, string>; // { username, password, cookies?... }

export interface SourceAdapter {
  id: string;
  name: string;
  needsLogin: boolean;
  /** 该源是否支持收藏夹（拉取用户收藏列表） */
  supportsFavorites?: boolean;
  search(q: string, page: number, cred?: Credentials): Promise<SourceSearchItem[]>;
  detail(id: string, cred?: Credentials): Promise<SourceDetail | null>;
  login?(username: string, password: string): Promise<{ ok: boolean; error?: string; credentials?: Credentials }>;
  favorites?(cred?: Credentials): Promise<SourceSearchItem[]>;
}

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 9; V1938CT Build/PQ3A.190705.11211812; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36';
const UA_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const UA_IMAGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex');

async function fetchText(url: string, headers: Record<string, string> = {}, timeout = 12000): Promise<string> {
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: { 'User-Agent': UA_DESKTOP, ...headers },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.text();
}

async function fetchJson(url: string, headers: Record<string, string> = {}, timeout = 12000): Promise<any> {
  const text = await fetchText(url, { Accept: 'application/json', ...headers }, timeout);
  return JSON.parse(text);
}

/** Fetch an image and inline it as base64; falls back to the raw URL. */
async function toBase64Cover(url: string, referer?: string, extraHeaders: Record<string, string> = {}): Promise<string> {
  if (!url || url.startsWith('data:')) return url;
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': UA_IMAGE, ...(referer ? { Referer: referer } : {}), ...extraHeaders },
    });
    if (!resp.ok) return url;
    const buf = Buffer.from(await resp.arrayBuffer());
    const ct = resp.headers.get('content-type') || 'image/jpeg';
    if (buf.length > 12_000_000) return url; // avoid oversized blobs
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch {
    return url;
  }
}

const toArr = (v: any): string[] => {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : x?.name || x?.title || '')).filter(Boolean);
  if (typeof v === 'string') return v.split(/[,/，/、]+/).map((s) => s.trim()).filter(Boolean);
  return [];
};

// ------------------------------------------------------------
// jm (禁漫) — mobile API + AES decryption
// ------------------------------------------------------------
const JM_DOMAIN_SECRET = 'diosfjckwpqpdfjkvnqQjsik';
const JM_TOKEN_SECRET = '185Hcomic3PAPP7R';
const JM_DOMAIN_URLS = [
  'https://rup4a04-c01.tos-ap-southeast-1.bytepluses.com/newsvr-2025.txt',
  'https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt',
  'https://rup4a04-c03.tos-cn-beijing.bytepluses.com.cn/newsvr-2025.txt',
];
const JM_FALLBACK_DOMAINS = ['www.cdnhjk.net', 'www.cdngwc.cc', 'www.cdngwc.net', 'www.cdngwc.club', 'www.cdnutc.me'];
const JM_IMAGE_BASE = 'https://cdn-msp3.jmdanjonproxy.vip';
const JM_COVER_HOSTS = ['https://cdn-msp.jmapiproxy1.cc', 'https://cdn-msp.jmapiproxy2.cc', 'https://cdn-msp.jmapinodeudzn.net', 'https://www.cdnhjk.net'];

let jmDomainsCache: { list: string[]; fetchedAt: number } | null = null;

function jmDecrypt(data: string, ts: string, secret: string): string {
  const key = Buffer.from(md5(ts + secret), 'utf8');
  const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
  decipher.setAutoPadding(false);
  const dec = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]);
  const pad = dec[dec.length - 1];
  return dec.slice(0, dec.length - pad).toString('utf8');
}

async function jmDomains(): Promise<string[]> {
  if (jmDomainsCache && Date.now() - jmDomainsCache.fetchedAt < 6 * 60 * 60 * 1000) return jmDomainsCache.list;
  for (const url of JM_DOMAIN_URLS) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) continue;
      let text = await resp.text();
      while (text && text.charCodeAt(0) < 32) text = text.slice(1);
      const json = JSON.parse(jmDecrypt(text, '', JM_DOMAIN_SECRET));
      if (Array.isArray(json.Server) && json.Server.length > 0) {
        jmDomainsCache = { list: json.Server, fetchedAt: Date.now() };
        return json.Server;
      }
    } catch {
      /* try next */
    }
  }
  jmDomainsCache = { list: JM_FALLBACK_DOMAINS, fetchedAt: Date.now() };
  return JM_FALLBACK_DOMAINS;
}

async function jmRequest(pathWithQuery: string, opts: { method?: string; body?: string; cookie?: string } = {}): Promise<any | null> {
  const { method = 'GET', body, cookie } = opts;
  const domains = await jmDomains();
  for (const domain of domains) {
    try {
      const ts = Math.floor(Date.now() / 1000).toString();
      const token = md5(ts + JM_TOKEN_SECRET);
      const headers: Record<string, string> = {
        'User-Agent': UA_ANDROID,
        'Accept-Encoding': 'gzip, deflate',
        token,
        tokenparam: `${ts},2.0.30`,
      };
      if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
      if (cookie) headers['Cookie'] = cookie;
      const resp = await fetch(`https://${domain}${pathWithQuery}`, {
        method,
        signal: AbortSignal.timeout(8000),
        headers,
        ...(body ? { body } : {}),
      });
      const result = await resp.json();
      if (result?.code === 200 && typeof result.data === 'string') {
        return JSON.parse(jmDecrypt(result.data, ts, JM_TOKEN_SECRET));
      }
    } catch {
      /* try next domain */
    }
  }
  return null;
}

function jmCoverUrl(item: any): string {
  const img = item?.image;
  if (!img) return `${JM_IMAGE_BASE}/media/albums/${item.id}_3x4.jpg`;
  if (/^https?:\/\//i.test(img)) return img;
  if (img.startsWith('/')) return `${JM_IMAGE_BASE}${img}`;
  if (img.startsWith('media/')) return `${JM_IMAGE_BASE}/${img}`;
  return `${JM_IMAGE_BASE}/media/albums/${item.id}_3x4.jpg`;
}

const jmAdapter: SourceAdapter = {
  id: 'jm',
  name: '禁漫 (JM)',
  needsLogin: false,
  supportsFavorites: true,

  async search(q, page) {
    const data = await jmRequest(`/search?search_query=${encodeURIComponent(q)}&page=${page}&o=`);
    const list = Array.isArray(data?.content) ? data.content : [];
    return Promise.all(
      list.map(async (it: any) => ({
        id: String(it.id),
        title: it.name || '',
        coverUrl: await toBase64Cover(jmCoverUrl(it)),
        authors: toArr(it.author),
      }))
    );
  },

  async detail(id) {
    const data = await jmRequest(`/album?id=${encodeURIComponent(id)}`);
    if (!data || !data.name) return null;
    const coverUrl = await toBase64Cover(`${JM_COVER_HOSTS[0]}/media/albums/${id}.jpg`);
    return {
      id: String(data.id ?? id),
      title: data.name || '',
      description: data.description || '',
      coverUrl,
      authors: toArr(data.author),
      tags: toArr(data.tags),
      pages: parseInt(data.total_photos || '0', 10) || 0,
    };
  },

  // 登录后获取收藏夹。cred.avs 为登录接口返回的 s 值，作为 cookie AVS 使用。
  async login(username, password) {
    const data = await jmRequest('/login', {
      method: 'POST',
      body: new URLSearchParams({ username, password }).toString(),
    });
    if (data && data.s) return { ok: true, credentials: { avs: String(data.s) } };
    return { ok: false, error: '登录失败，请检查账号密码' };
  },

  async favorites(cred) {
    if (!cred?.avs) return [];
    // 逐页拉取收藏，最多取前 5 页
    const items: SourceSearchItem[] = [];
    for (let page = 1; page <= 5; page++) {
      const data = await jmRequest(
        `/favorite?page=${page}&folder_id=0&o=la`,
        { cookie: `AVS=${cred.avs}` }
      );
      const list = Array.isArray(data?.list) ? data.list : [];
      for (const it of list) {
        items.push({
          id: String(it.id),
          title: it.name || '',
          coverUrl: await toBase64Cover(jmCoverUrl(it)),
          authors: toArr(it.author),
        });
      }
      const total = parseInt(data?.total || '0', 10) || 0;
      if (items.length >= total || items.length === 0 || list.length === 0) break;
    }
    return items;
  },
};

// ------------------------------------------------------------
// bika (哔咔) — HMAC-signed JSON API
// ------------------------------------------------------------
const BIKA_API_KEY = 'C69BAF41DA5ABD1FFEDC6D2FEA56B';
const BIKA_SECRET = '~d}$Q7$eIni=V)9\\RK/P.RM4;9[7|@/CA}b~OW!3?EV`:<>M7pddUBL5n|0/*Cn';
const BIKA_BASE = 'https://picaapi.picacomic.com/';

function bikaHeaders(method: string, pathWithQuery: string, token?: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const message = `${pathWithQuery}${timestamp}${nonce}${method}${BIKA_API_KEY}`.toLowerCase();
  const signature = crypto.createHmac('sha256', BIKA_SECRET).update(message).digest('hex');
  return {
    'api-key': BIKA_API_KEY,
    accept: 'application/vnd.picacomic.com.v1+json',
    'app-channel': '3',
    time: timestamp,
    nonce,
    signature,
    'app-version': '2.2.1.3.3.4',
    'app-uuid': 'defaultUuid',
    'app-platform': 'android',
    'app-build-version': '45',
    'accept-encoding': 'gzip',
    'user-agent': 'okhttp/3.8.1',
    'content-type': 'application/json; charset=UTF-8',
    ...(token ? { authorization: token } : {}),
  };
}

async function bikaFetch(path: string, init?: RequestInit & { token?: string }): Promise<any> {
  const url = `${BIKA_BASE}${path}`;
  const method = (init?.method || 'GET').toUpperCase();
  const headers = bikaHeaders(method, path, init?.token);
  const resp = await fetch(url, { ...init, signal: AbortSignal.timeout(12000), headers: { ...headers, ...(init?.headers || {}) } });
  const json = await resp.json();
  if (json.code !== 200) throw new Error(json.message || `bika HTTP ${resp.status}`);
  return json.data;
}

function bikaCover(thumb: any): string {
  const fileServer = thumb?.fileServer || '';
  const rawPath = thumb?.path || '';
  let p = rawPath;
  if (p.startsWith('tobeimg/')) p = p.slice('tobeimg/'.length);
  else if (p.startsWith('tobs/')) p = `static/${p.slice('tobs/'.length)}`;
  else if (!p.includes('/') && !rawPath.includes('static')) p = `static/${p}`;
  const host = fileServer.includes('storage-b') ? 'https://img.picacomic.com' : 'https://img.picacomic.com';
  return `${host}/${p}`;
}

const bikaAdapter: SourceAdapter = {
  id: 'bika',
  name: '哔咔 (Bika)',
  needsLogin: true,
  supportsFavorites: true,

  async search(q, page, cred) {
    if (!cred?.token) throw new Error('NEED_LOGIN');
    const data = await bikaFetch(`comics/advanced-search?page=${page}`, {
      method: 'POST',
      token: cred.token,
      body: JSON.stringify({ sort: 'dd', keyword: q, categories: [] }),
    });
    const docs = data.comics?.docs || data.comics || [];
    return Promise.all(
      docs.map(async (c: any) => ({
        id: c._id,
        title: c.title || '',
        coverUrl: await toBase64Cover(bikaCover(c.thumb)),
        authors: toArr(c.author),
      }))
    );
  },

  async detail(id, cred) {
    if (!cred?.token) throw new Error('NEED_LOGIN');
    const data = await bikaFetch(`comics/${encodeURIComponent(id)}`, { token: cred.token });
    const c = data.comic || {};
    const coverUrl = await toBase64Cover(bikaCover(c.thumb));
    return {
      id: c._id || id,
      title: c.title || '',
      description: c.description || '',
      coverUrl,
      authors: toArr(c.author),
      tags: [...toArr(c.categories), ...toArr(c.tags)],
      pages: c.pagesCount || 0,
    };
  },

  async login(username, password) {
    const data = await bikaFetch('auth/sign-in', {
      method: 'POST',
      body: JSON.stringify({ email: username, password }),
    });
    if (data?.token) return { ok: true, credentials: { token: data.token } };
    return { ok: false, error: '登录失败' };
  },

  // 我的收藏（需要登录 token）
  async favorites(cred) {
    if (!cred?.token) return [];
    const data = await bikaFetch('favorites?page=1', { token: cred.token });
    const docs = data.favorites?.docs || [];
    return Promise.all(
      docs.map(async (c: any) => ({
        id: c._id,
        title: c.title || '',
        coverUrl: await toBase64Cover(bikaCover(c.thumb)),
        authors: toArr(c.author),
      }))
    );
  },
};

// ------------------------------------------------------------
// ehentai — HTML scraping
// ------------------------------------------------------------
const EH_BASE = 'https://e-hentai.org';

async function ehParseSearch(html: string): Promise<SourceSearchItem[]> {
  const $ = cheerioLoad(html);
  const raw: Array<{ id: string; title: string; cover: string }> = [];
  $('.itg tr').each((_i, tr) => {
    const $tr = $(tr);
    const a = $tr.find('.glname a').first(); // href 在 a 上，标题在其内部 .glink
    const href = a.attr('href') || '';
    const m = href.match(/\/g\/(\d+)\/([a-zA-Z0-9-]+)\/?/);
    if (!m) return;
    const img = $tr.find('.glthumb img').first();
    let cover =
      img.attr('data-src') ||
      img.attr('data-lazy-src') ||
      img.attr('data-original') ||
      img.attr('src') ||
      '';
    const style = img.attr('style') || '';
    if (!cover && style) {
      const um = style.match(/url\(['"]?([^'")]+)['"]?\)/);
      if (um) cover = um[1];
    }
    if (cover.startsWith('//')) cover = `https:${cover}`;
    if (/data:|base64,|blank\.gif|spacer|\/img\/blank/i.test(cover)) cover = '';
    raw.push({ id: `${m[1]}-${m[2]}`, title: a.find('.glink').text().trim() || a.text().trim(), cover });
  });
  return Promise.all(
    raw.map(async (r) => ({ id: r.id, title: r.title, coverUrl: await toBase64Cover(r.cover), authors: [] }))
  );
}

const ehentaiAdapter: SourceAdapter = {
  id: 'ehentai',
  name: 'e-hentai',
  needsLogin: false,

  async search(q) {
    const html = await fetchText(`${EH_BASE}/?f_search=${encodeURIComponent(q)}`, {
      Accept: 'text/html,application/xhtml+xml',
    });
    return ehParseSearch(html);
  },

  async detail(id) {
    const [gid, token] = String(id).split('-');
    if (!gid) return null;
    const html = await fetchText(`${EH_BASE}/g/${gid}/${token}/`, {
      Accept: 'text/html,application/xhtml+xml',
    });
    const $ = cheerioLoad(html);
    const title = $('#gn').text().trim() || $('#gj').text().trim() || '';
    let cover = '';
    const style = $('#gd1 > div').attr('style') || '';
    const sm = style.match(/url\(['"]?([^'")]+)['"]?\)/);
    if (sm) cover = sm[1];
    if (!cover) cover = $('#gd1 img').attr('src') || '';
    if (cover.startsWith('//')) cover = `https:${cover}`;

    let pages = 0;
    $('#gdd table tr').each((_i, tr) => {
      const key = $(tr).find('td').first().text().trim().toLowerCase().replace(':', '');
      const val = $(tr).find('td').last().text().trim();
      if (key.includes('length')) {
        const pm = val.match(/(\d+)\s+pages?/i);
        if (pm) pages = parseInt(pm[1], 10);
      }
    });

    const tags: string[] = [];
    $('#taglist tr').each((_i, tr) => {
      $(tr).find('td').last().find('a').each((_j, a) => {
        const t = $(a).text().trim();
        if (t) tags.push(t);
      });
    });

    const coverUrl = await toBase64Cover(cover);
    return { id, title, description: '', coverUrl, authors: [], tags: [...new Set(tags)], pages };
  },
};

// ------------------------------------------------------------
// nhentai — JSON API
// ------------------------------------------------------------
const NH_BASE = 'https://nhentai.net';
const NH_IMAGE_BASE = 'https://t3.nhentai.net';

function nhPickTitle(g: any): string {
  return (
    g.pretty_title ||
    g.title?.pretty ||
    g.title?.english ||
    g.title?.japanese ||
    g.english_title ||
    g.japanese_title ||
    'Untitled'
  );
}

const nhentaiAdapter: SourceAdapter = {
  id: 'nhentai',
  name: 'nhentai',
  needsLogin: false,

  async search(q, page) {
    const data = await fetchJson(
      `${NH_BASE}/api/v2/search?query=${encodeURIComponent(q)}&page=${page}&sort=date`,
      { Referer: `${NH_BASE}/`, 'User-Agent': 'Breeze-plugin-nhentai/0.1.0' }
    );
    const result = Array.isArray(data?.result) ? data.result : [];
    return Promise.all(
      result.map(async (g: any) => {
        const coverPath = g.thumbnail || g.cover?.thumbnail || g.cover?.path || '';
        return {
          id: String(g.id),
          title: nhPickTitle(g),
          coverUrl: await toBase64Cover(`${NH_IMAGE_BASE}/${coverPath}`, `${NH_BASE}/`),
          authors: (g.tags || []).filter((t: any) => t.type === 'artist').map((t: any) => t.name),
        };
      })
    );
  },

  async detail(id) {
    const g = await fetchJson(`${NH_BASE}/api/v2/galleries/${encodeURIComponent(id)}?include=related,favorite`, {
      Referer: `${NH_BASE}/`,
      'User-Agent': 'Breeze-plugin-nhentai/0.1.0',
    });
    if (!g || g.error || !g.id) return null;
    const coverPath =
      g.cover?.thumbnail || g.cover?.path || g.thumbnail || `galleries/${g.media_id || id}/cover.jpg`;
    const coverUrl = await toBase64Cover(`${NH_IMAGE_BASE}/${coverPath}`, `${NH_BASE}/`);
    return {
      id: String(g.id),
      title: nhPickTitle(g),
      description: g.japanese_title || g.english_title || '',
      coverUrl,
      authors: (g.tags || []).filter((t: any) => t.type === 'artist').map((t: any) => t.name),
      tags: (g.tags || []).map((t: any) => t.name).filter(Boolean),
      pages: Array.isArray(g.pages) ? g.pages.length : g.num_pages || 0,
    };
  },
};

// ------------------------------------------------------------
// copymanga (拷贝漫画) — JSON API
// ------------------------------------------------------------
const COPY_API = 'https://api.copy3000.com/api/v3';

async function copyFetch(pathWithQuery: string): Promise<any> {
  const text = await fetchText(`${COPY_API}${pathWithQuery}`, {
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9,zh-TW;q=0.8,zh;q=0.7',
    version: '2025.05.09',
    Origin: 'https://2025copy.com',
    region: '0',
    webp: '0',
    platform: '1',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
  });
  const json = JSON.parse(text);
  if (json.code !== 200) throw new Error(json.message || 'copymanga error');
  return json.results;
}

const copymangaAdapter: SourceAdapter = {
  id: 'copymanga',
  name: '拷贝漫画 (CopyManga)',
  needsLogin: false,

  async search(q, page) {
    const offset = (page - 1) * 20;
    const results = await copyFetch(`/search/comic?limit=20&offset=${offset}&q=${encodeURIComponent(q)}&q_type=&platform=1`);
    const list = results?.list || [];
    return Promise.all(
      list.map(async (c: any) => ({
        id: c.path_word,
        title: c.name || '',
        coverUrl: await toBase64Cover(c.cover || ''),
        authors: toArr(c.author?.map?.((a: any) => a.name)),
      }))
    );
  },

  async detail(id) {
    const results = await copyFetch(`/comic2/${encodeURIComponent(id)}?platform=1`);
    const c = results?.comic || {};
    const coverUrl = await toBase64Cover(c.cover || '');
    return {
      id: c.path_word || id,
      title: c.name || '',
      description: c.brief || '',
      coverUrl,
      authors: toArr(c.author?.map?.((a: any) => a.name)),
      tags: toArr(c.theme?.map?.((t: any) => t.name)),
      pages: 0,
    };
  },
};

// ------------------------------------------------------------
// noyacg — form POST JSON API
// ------------------------------------------------------------
const NOY_API = 'https://api.noy.asia';
const NOY_IMG = 'https://img.noy.asia';

const noyacgAdapter: SourceAdapter = {
  id: 'noyacg',
  name: 'NoyAcg',
  needsLogin: true,

  async search(q, page, cred) {
    const form = new URLSearchParams({ value: q, mode: 'default', sort: 'time', type: 'all', finished: '', page: String(page) });
    const resp = await fetch(`${NOY_API}/api/v4/search/fetch`, {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
      headers: {
        'User-Agent': 'NoyAcg/3.0',
        'allow-adult': 'both',
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        ...(cred?.cookies ? { Cookie: cred.cookies } : {}),
      },
      body: form.toString(),
    });
    const json = await resp.json();
    if (json.status === 'login') throw new Error('NEED_LOGIN');
    if (json.status !== 'ok') throw new Error(json.message || 'noyacg error');
    const list = Array.isArray(json.data) ? json.data : [];
    return Promise.all(
      list.map(async (c: any) => ({
        id: String(c.id),
        title: c.name || '',
        coverUrl: await toBase64Cover(`${NOY_IMG}/${c.id}/m1.webp`, `${NOY_API}/`, {
          Origin: NOY_API,
          'User-Agent': 'NoyAcg/3.0',
        }),
        authors: toArr(c.author),
      }))
    );
  },

  async detail(id, cred) {
    const resp = await fetch(`${NOY_API}/api/v4/book/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(12000),
      headers: {
        'User-Agent': 'NoyAcg/3.0',
        'allow-adult': 'both',
        Accept: 'application/json, text/plain, */*',
        ...(cred?.cookies ? { Cookie: cred.cookies } : {}),
      },
    });
    const json = await resp.json();
    if (json.status === 'login') throw new Error('NEED_LOGIN');
    if (json.status !== 'ok') throw new Error(json.message || 'noyacg error');
    const info = json.book?.info || {};
    const tags = String(info.Ptag || '')
      .split(/\s+/)
      .filter(Boolean);
    const coverUrl = await toBase64Cover(`${NOY_IMG}/${id}/m1.webp`, `${NOY_API}/`, {
      Origin: NOY_API,
      'User-Agent': 'NoyAcg/3.0',
    });
    return {
      id: String(info.Bid ?? id),
      title: info.Bookname || '',
      description: info.Description || '',
      coverUrl,
      authors: toArr(info.Author),
      tags,
      pages: parseInt(info.Len || '0', 10) || 0,
    };
  },

  async login(username, password) {
    const form = new URLSearchParams({ user: username, pass: password });
    const resp = await fetch(`${NOY_API}/api/login`, {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
      headers: {
        'User-Agent': 'NoyAcg/3.0',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: form.toString(),
      redirect: 'manual',
    });
    const setCookies = resp.headers.getSetCookie ? resp.headers.getSetCookie() : [];
    const cookies = setCookies.map((c) => c.split(';')[0]).join('; ');
    const json = await resp.json().catch(() => null);
    if (json?.status === 'ok' && cookies) return { ok: true, credentials: { cookies } };
    return { ok: false, error: json?.message || '登录失败' };
  },
};

// ------------------------------------------------------------
// komiic — GraphQL API
// ------------------------------------------------------------
const KOMIIC_ENDPOINT = 'https://komiic.com/api/query';
const KOMIIC_HEADERS = {
  Referer: 'https://komiic.com/',
  'User-Agent': UA_DESKTOP,
  'Content-Type': 'application/json',
};

async function komiicGraphql(query: string, variables: Record<string, any>): Promise<any> {
  const resp = await fetch(KOMIIC_ENDPOINT, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: KOMIIC_HEADERS,
    body: JSON.stringify({ operationName: '', query, variables }),
  });
  const json = await resp.json();
  if (json.errors?.[0]?.message) throw new Error(json.errors[0].message);
  return json.data;
}

const KOMIIC_SEARCH_Q = `query searchComicAndAuthorQuery($keyword: String!) {
  searchComicsAndAuthors(keyword: $keyword) { comics { id title status imageUrl authors { name } categories { name } } }
}`;
const KOMIIC_DETAIL_Q = `query comicByIds($comicIds: [ID]!) {
  comicByIds(comicIds: $comicIds) { id title status imageUrl authors { name } categories { name } }
}`;

const komiicAdapter: SourceAdapter = {
  id: 'komiic',
  name: 'Komiic',
  needsLogin: false,

  async search(q) {
    const data = await komiicGraphql(KOMIIC_SEARCH_Q, { keyword: q });
    const list = data?.searchComicsAndAuthors?.comics || [];
    return Promise.all(
      list.map(async (c: any) => ({
        id: String(c.id),
        title: c.title || '',
        coverUrl: await toBase64Cover(c.imageUrl || '', 'https://komiic.com/'),
        authors: toArr(c.authors?.map?.((a: any) => a.name)),
      }))
    );
  },

  async detail(id) {
    const data = await komiicGraphql(KOMIIC_DETAIL_Q, { comicIds: [String(id)] });
    const c = (data?.comicByIds || []).find((x: any) => String(x.id) === String(id)) || data?.comicByIds?.[0];
    if (!c) return null;
    const coverUrl = await toBase64Cover(c.imageUrl || '', 'https://komiic.com/');
    return {
      id: String(c.id),
      title: c.title || '',
      description: '',
      coverUrl,
      authors: toArr(c.authors?.map?.((a: any) => a.name)),
      tags: toArr(c.categories?.map?.((x: any) => x.name)),
      pages: 0,
    };
  },
};

// ------------------------------------------------------------
// baozimh (包子漫画) — HTML scraping
// ------------------------------------------------------------
const BAO_BASE = 'https://www.baozimh.com';
const BAO_HEADERS = { 'user-agent': 'baozimh_android/1.0.31/gb/adset', referer: BAO_BASE + '/' };

function baoAbs(u: string): string {
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('/')) return `${BAO_BASE}${u}`;
  return u;
}

const baozimhAdapter: SourceAdapter = {
  id: 'baozimh',
  name: '包子漫画 (Baozimh)',
  needsLogin: false,

  async search(q) {
    const html = await fetchText(`${BAO_BASE}/search?q=${encodeURIComponent(q)}`, BAO_HEADERS);
    const $ = cheerioLoad(html);
    const raw: Array<{ id: string; title: string; cover: string }> = [];
    const seen = new Set<string>();
    $('a.comics-card__poster, div.classify-items a').each((_i, el) => {
      const href = $(el).attr('href') || '';
      if (!href.startsWith('/comic/')) return;
      const id = href.replace(/^\/comic\//, '');
      if (seen.has(id)) return;
      seen.add(id);
      const title = $(el).attr('title') || $(el).find('img').attr('alt') || '';
      const cover = $(el).find('amp-img').attr('src') || $(el).find('img').attr('src') || '';
      raw.push({ id, title, cover: baoAbs(cover) });
    });
    return Promise.all(
      raw.map(async (r) => ({ id: r.id, title: r.title, coverUrl: await toBase64Cover(r.cover, BAO_BASE + '/'), authors: [] }))
    );
  },

  async detail(id) {
    const html = await fetchText(`${BAO_BASE}/comic/${encodeURIComponent(id)}`, BAO_HEADERS);
    const $ = cheerioLoad(html);
    const title =
      $('h1.comics-detail__title').text().trim() ||
      $('meta[property="og:novel:book_name"]').attr('content') ||
      $('title').text().replace(/\s*-\s*包子漫畫$/, '').trim();
    const author =
      $('h2.comics-detail__author').text().trim() ||
      $('meta[property="og:novel:author"]').attr('content') ||
      '';
    const desc = $('p.comics-detail__desc').text().trim() || $('meta[property="og:description"]').attr('content') || '';
    const tags = $('div.tag-list span.tag').map((_i, el) => $(el).text().trim()).get();
    const cover =
      $('div.pure-g div > amp-img').attr('src') ||
      $('div.pure-g div > img').attr('src') ||
      $('meta[property="og:image"]').attr('content') ||
      '';
    const coverUrl = await toBase64Cover(baoAbs(cover), BAO_BASE + '/');
    return { id, title, description: desc, coverUrl, authors: toArr(author), tags, pages: 0 };
  },
};

// ------------------------------------------------------------
// zaimanhua (再漫画) — JSON API, login required for adult content
// ------------------------------------------------------------
const ZAI_API = 'https://v4api.zaimanhua.com/app/v1';
const ZAI_ACCOUNT_API = 'https://account-api.zaimanhua.com/v1';
const ZAI_UA =
  'Mozilla/5.0 (Linux; Android 13; Xiaomi 23043RP34C Build/TKQ1.221114.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36';

function zaiParams(extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({
    platform: 'android',
    timestamp: String(Math.floor(Date.now() / 1000)),
    _v: '2.3.4',
    _c: '101_01_01_000',
    ...extra,
  });
  return p.toString();
}

async function zaiFetch(pathWithQuery: string, cred?: Credentials): Promise<any> {
  const headers: Record<string, string> = { 'User-Agent': ZAI_UA, Accept: 'application/json' };
  if (cred?.token) headers.Authorization = `Bearer ${cred.token}`;
  const text = await fetchText(`${ZAI_API}${pathWithQuery}`, headers);
  const json = JSON.parse(text);
  if (json.errno !== 0) throw new Error(json.errmsg || 'zaimanhua error');
  return json.data;
}

const zaimanhuaAdapter: SourceAdapter = {
  id: 'zaimanhua',
  name: '再漫画 (ZaiManHua)',
  needsLogin: true,

  async search(q, page, cred) {
    const data = await zaiFetch(
      `/search/index?keyword=${encodeURIComponent(q)}&page=${page}&sort=0&size=20&${zaiParams()}`,
      cred
    );
    const list = data?.list || [];
    return Promise.all(
      list.map(async (c: any) => ({
        id: String(c.comic_id > 0 ? c.comic_id : c.id),
        title: c.title || '',
        coverUrl: await toBase64Cover(c.cover || '', 'https://www.zaimanhua.com/', { 'User-Agent': ZAI_UA }),
        authors: toArr(c.authors),
      }))
    );
  },

  async detail(id, cred) {
    const data = await zaiFetch(`/comic/detail/${encodeURIComponent(id)}?${zaiParams()}`, cred);
    const c = data?.data || {};
    const authors = Array.isArray(c.authors) ? c.authors.map((a: any) => a.tag_name || a.name || '').filter(Boolean) : [];
    const tags = Array.isArray(c.types) ? c.types.map((t: any) => t.tag_name || t.name || '').filter(Boolean) : [];
    const coverUrl = await toBase64Cover(c.cover || '', 'https://www.zaimanhua.com/', { 'User-Agent': ZAI_UA });
    return {
      id: String(c.id ?? id),
      title: c.title || '',
      description: c.description || '',
      coverUrl,
      authors,
      tags,
      pages: 0,
    };
  },

  async login(username, password) {
    const form = new URLSearchParams({ username, passwd: md5(password) });
    const resp = await fetch(`${ZAI_ACCOUNT_API}/login/passwd`, {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': ZAI_UA, 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: form.toString(),
    });
    const json = await resp.json().catch(() => null);
    if (json?.errno === 0 && json?.data?.user?.token) {
      return { ok: true, credentials: { token: json.data.user.token } };
    }
    return { ok: false, error: json?.errmsg || '登录失败' };
  },
};

// ------------------------------------------------------------
// wnacg (绅士漫画) — dynamic domain + HTML scraping
// ------------------------------------------------------------
const WNACG_FALLBACK = 'https://wnacg.com';
const WNACG_RELEASE_PAGES = ['https://wnacg01.link/', 'https://wnacg02.link/'];
const WNACG_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let wnacgBase: string | null = null;

async function wnacgBaseUrl(): Promise<string> {
  if (wnacgBase) return wnacgBase;
  for (const page of WNACG_RELEASE_PAGES) {
    try {
      const html = await fetchText(page, { Accept: 'text/html' }, 8000);
      const $ = cheerioLoad(html);
      const hosts: string[] = [];
      $('li').each((_i, el) => {
        if ($(el).text().includes('紳士漫畫') || $(el).text().includes('紳士漫畫最新地址') || $(el).text().includes('绅士漫画')) {
          $(el).find('a[href]').each((_j, a) => {
            const h = $(a).attr('href') || '';
            if (/^https?:\/\//.test(h)) hosts.push(h.replace(/\/+$/, ''));
          });
        }
      });
      if (hosts.length) {
        wnacgBase = hosts[0];
        return wnacgBase;
      }
    } catch {
      /* next */
    }
  }
  wnacgBase = WNACG_FALLBACK;
  return wnacgBase;
}

const wnacgAdapter: SourceAdapter = {
  id: 'wnacg',
  name: '绅士漫画 (Wnacg)',
  needsLogin: false,

  async search(q) {
    const base = await wnacgBaseUrl();
    const html = await fetchText(
      `${base}/search/?q=${encodeURIComponent(q)}&f=_all&s=create_time_DESC&syn=yes`,
      { 'User-Agent': WNACG_UA, Accept: 'text/html,application/xhtml+xml' }
    );
    const $ = cheerioLoad(html);
    const raw: Array<{ id: string; title: string; cover: string }> = [];
    $('li.gallary_item').each((_i, el) => {
      const a = $(el).find('.title a').first();
      const href = a.attr('href') || '';
      const m = href.match(/aid-(\d+)\.html/);
      if (!m) return;
      const img = $(el).find('.pic_box img');
      const cover =
        img.attr('data-src') || img.attr('data-original') || img.attr('data-lazyload') || img.attr('src') || '';
      raw.push({
        id: m[1],
        title: a.text().trim(),
        cover: cover.startsWith('//') ? `https:${cover}` : cover,
      });
    });
    return Promise.all(
      raw.map(async (r) => ({ id: r.id, title: r.title, coverUrl: await toBase64Cover(r.cover), authors: [] }))
    );
  },

  async detail(id) {
    const base = await wnacgBaseUrl();
    const html = await fetchText(`${base}/photos-index-aid-${encodeURIComponent(id)}.html`, {
      'User-Agent': WNACG_UA,
      Accept: 'text/html,application/xhtml+xml',
    });
    const $ = cheerioLoad(html);
    const title = $('h2').first().text().trim();
    const desc = $('.uwconn p').first().text().trim().replace(/^簡介[:：]?\s*/u, '');
    let pages = 0;
    const labelText = $('.uwconn label').map((_i, el) => $(el).text()).get().join(' ');
    const pm = labelText.match(/頁數[:：]\s*(\d+)\s*P?/i);
    if (pm) pages = parseInt(pm[1], 10);
    const tags = $('.addtags a.tagshow').map((_i, el) => $(el).text().trim()).get();
    const img = $('.uwthumb img');
    const cover = img.attr('data-src') || img.attr('data-original') || img.attr('src') || '';
    const coverUrl = await toBase64Cover(cover.startsWith('//') ? `https:${cover}` : cover);
    return { id, title, description: desc, coverUrl, authors: [], tags: [...new Set(tags)], pages };
  },
};

// ------------------------------------------------------------
// registry
// ------------------------------------------------------------
export const sources: SourceAdapter[] = [
  jmAdapter,
  bikaAdapter,
  ehentaiAdapter,
  nhentaiAdapter,
  copymangaAdapter,
  noyacgAdapter,
  komiicAdapter,
  baozimhAdapter,
  zaimanhuaAdapter,
  wnacgAdapter,
];

export function getSource(id: string): SourceAdapter | undefined {
  return sources.find((s) => s.id === id);
}

export { jmRequest, jmDecrypt, jmDomains, JM_COVER_HOSTS };
