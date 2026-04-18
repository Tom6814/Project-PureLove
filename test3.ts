import axios from 'axios';
import crypto from 'crypto';

async function test() {
    const ts = Math.floor(Date.now() / 1000).toString();
    const token = crypto.createHash('md5').update(ts + '18comicAPPContent').digest('hex');
    
    const domains = [
        'jmcomic.me',
        'jmcomic1.me',
        'jmcomic.mobi',
        'jmcomic1.mobi',
        '18comic.org',
        '18comic.vip'
    ];
    
    for (const domain of domains) {
        try {
            const url = `https://${domain}/api/album/456123`;
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 12; KB2000 Build/SKQ1.211019.001)',
                'token': token,
                'tokenparam': ts,
                'Accept-Encoding': 'gzip',
              }
            });
            console.log(`[${domain}] Status:`, response.status);
            if (response.status === 200) {
                console.log(await response.text());
                break;
            }
        } catch (e: any) {
            console.error(`[${domain}] Error:`, e.message);
        }
    }
}
test();
