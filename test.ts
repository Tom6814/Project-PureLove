import axios from 'axios';
import crypto from 'crypto';

async function test() {
    const ts = Math.floor(Date.now() / 1000).toString();
    const token = crypto.createHash('md5').update(ts + '18comicAPPContent').digest('hex');
    try {
        const url = `https://18comic.vip/api/album/456123`;
        const response = await axios.get(url, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 12; KB2000 Build/SKQ1.211019.001)',
            'token': token,
            'tokenparam': ts,
            'Accept-Encoding': 'gzip',
          }
        });
        console.log(response.status, response.data);
    } catch (e: any) {
        console.error(e.response?.status, e.response?.data || e.message);
    }
}
test();
