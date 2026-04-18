const axios = require('axios');
async function run() {
  try {
    const res = await axios.get('http://localhost:3000/api/jm/456123');
    console.log('SUCCESS BLOCK', res.data);
  } catch (err) {
    console.log('CATCH BLOCK', err.message);
    if (err.response) {
      console.log('STATUS:', err.response.status);
    }
  }
}
run();
