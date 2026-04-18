import crypto from 'crypto';

async function test() {
    const ts = Math.floor(Date.now() / 1000).toString();
    const token = crypto.createHash('md5').update(ts + '18comicAPPContent').digest('hex');
    try {
        const url = `https://www.jmapiproxy.vip/api/album/456123`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 12; KB2000 Build/SKQ1.211019.001)',
            'token': token,
            'tokenparam': ts,
            'Accept-Encoding': 'gzip',
          }
        });
        console.log(response.status, await response.text());
    } catch (e: any) {
        console.error(e.message);
    }
}
test();
