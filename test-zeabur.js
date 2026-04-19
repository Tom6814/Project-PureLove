const axios = require('axios');
async function run() {
  const res = await axios.get('https://purelove.zeabur.app/api/jm/1220749', { validateStatus: () => true });
  console.log(res.status);
  console.log(res.data.substring ? res.data.substring(0, 100) : res.data);
}
run();
