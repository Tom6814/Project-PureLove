import urllib.request
from Crypto.Cipher import AES
import base64
import hashlib

def md5(text):
    return hashlib.md5(text.encode('utf-8')).hexdigest()

def decrypt(text, key_str):
    key = md5(key_str).encode('utf-8')
    cipher = AES.new(key, AES.MODE_ECB)
    decoded = base64.b64decode(text)
    decrypted = cipher.decrypt(decoded)
    pad = decrypted[-1]
    return decrypted[:-pad].decode('utf-8')

url = "https://rup4a04-c01.tos-ap-southeast-1.bytepluses.com/newsvr-2025.txt"
req = urllib.request.Request(url)
response = urllib.request.urlopen(req)
text = response.read().decode('utf-8').strip().lstrip('\ufeff')

print(decrypt(text, 'diosfjckwpqpdfjkvnqQjsik'))
