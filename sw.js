// sw.js: HTML/JSONはネットワーク優先、CSS/JS/画像はキャッシュ優先
// データやコードを更新したらCACHE_NAMEの番号を必ず上げる(上げ忘れると古い版が端末に残る)
const CACHE_NAME = 'library-app-cache-v13';
const CORE_ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/data.js',
  'js/render.js',
  'js/scan.js',
  'js/app.js',
  'js/vendor/html5-qrcode.min.js',
  'manifest.json',
];

self.addEventListener('install', (event) => {
  // 新しいSWをすぐ有効化する(古いSWが端末に残り続けて更新が反映されない問題への対策)
  self.skipWaiting();
  // ブラウザの通常HTTPキャッシュ(cache-control: max-age)から古いファイルを拾ってしまい、
  // 新しいCACHE_NAMEの中に古い内容が保存される事故を防ぐため、fetchはHTTPキャッシュを無視する
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        CORE_ASSETS.map((url) =>
          fetch(url, { cache: 'reload' }).then((response) => cache.put(url, response))
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
      ),
      // 開いたままのタブもすぐ新しいSWの制御下に置く(アプリを完全終了しなくても更新が効くようにする)
      self.clients.claim(),
    ])
  );
});

function isNetworkFirst(url) {
  return url.pathname.endsWith('.html') || url.pathname.endsWith('.json') || url.pathname === '/';
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw e;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return; // APIは常にネットワークへ素通し
  if (isNetworkFirst(url)) {
    event.respondWith(networkFirst(event.request));
  } else {
    event.respondWith(cacheFirst(event.request));
  }
});
