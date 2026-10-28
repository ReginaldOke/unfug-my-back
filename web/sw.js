// Service worker: makes the app installable and usable offline, without ever serving stale code
// when there's a connection.
//  - App files: network first (so every new deploy shows up on the next open), cached copy when offline.
//  - Google Fonts: cached copy first, refreshed in the background.
//  - api/*: never cached (it needs the live server).
const CACHE = 'unfug-my-back-v10';

// Everything the app needs to start offline. test/sw.test.js checks this list against web/.
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'assets/body.obj',
  'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'lib/ai.js', 'lib/analysis.js', 'lib/dates.js', 'lib/export.js', 'lib/health.js', 'lib/labels.js', 'lib/markdown.js',
  'lib/motion.js', 'lib/notify.js', 'lib/regions.js', 'lib/regions3d.js', 'lib/reminders-core.js',
  'lib/reminders.js', 'lib/repos.js', 'lib/seed.js', 'lib/store.js', 'lib/ui.js', 'lib/voice.js',
  'views/body3d.js', 'views/calendar.js', 'views/chart.js', 'views/checkin.js', 'views/controls.js',
  'views/factor.js', 'views/figure.js', 'views/health.js', 'views/help.js', 'views/home.js', 'views/pad.js', 'views/reminder-sheet.js', 'views/routines.js', 'views/settings.js',
  'views/setup.js', 'views/sortable.js',
  'vendor/three/build/three.module.js', 'vendor/three/build/three.core.js',
  'vendor/three/examples/jsm/controls/OrbitControls.js', 'vendor/three/examples/jsm/loaders/OBJLoader.js',
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', event => {
  // One missing file shouldn't block installing the rest, so cache them individually
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(ASSETS.map(a => cache.add(a)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) return event.respondWith(cacheFirst(req));
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req, { cache: 'no-cache' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
    ]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const refresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return cached || (await refresh) || Response.error();
}
