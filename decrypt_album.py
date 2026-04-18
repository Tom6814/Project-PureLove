import urllib.request
import urllib.parse
from Crypto.Cipher import AES
import base64
import hashlib
import json
import gzip
import time

def md5(text):
    return hashlib.md5(text.encode('utf-8')).hexdigest()

def decrypt(text, ts, secret):
    key_str = f"{ts}{secret}"
    key = md5(key_str).encode('utf-8')
    cipher = AES.new(key, AES.MODE_ECB)
    decoded = base64.b64decode(text)
    decrypted = cipher.decrypt(decoded)
    pad = decrypted[-1]
    return decrypted[:-pad].decode('utf-8')

ts = str(int(time.time()))
ver = '2.0.19'
tokenparam = f"{ts},{ver}"
token = md5(f"{ts}18comicAPP")

url = "https://www.cdnhjk.net/album?id=123456"
req = urllib.request.Request(url, headers={
    'Accept-Encoding': 'gzip, deflate',
    'user-agent': 'Mozilla/5.0 (Linux; Android 9; V1938CT Build/PQ3A.190705.11211812; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36',
    'token': token,
    'tokenparam': tokenparam
})

response = urllib.request.urlopen(req)
if response.info().get('Content-Encoding') == 'gzip':
    data = gzip.decompress(response.read())
else:
    data = response.read()

text = data.decode('utf-8').strip()
json_data = json.loads(text)
print(decrypt(json_data['data'], ts, '185Hcomic3PAPP7R')[:200])
