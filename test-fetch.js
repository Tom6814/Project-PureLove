async function run() {
  const res = await fetch("https://www.cdnhjk.net/album?id=123456", {
    headers: { 'User-Agent': 'test' }
  });
  const data = await res.text();
  console.log("FETCH STATUS:", res.status);
  console.log("FETCH DATA:", data.slice(0, 100));
}
run();
