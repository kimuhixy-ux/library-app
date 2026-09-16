// sw.js: HTML/JSONはネットワーク優先、CSS/JS/画像はキャッシュ優先
// データやコードを更新したらCACHE_NAMEの番号を必ず上げる(上げ忘れると古い版が端末に残る)
const CACHE_NAME = 'library-app-cache-v9';
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
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
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
