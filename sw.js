// Offline support. Every shipped file is cached on install so the app opens with no signal.
// ASSET_VERSION matches the ?v= stamps in index.html and src/; `npm run bump` raises both.
const ASSET_VERSION = 4;
const CACHE = `strum-studio-v${ASSET_VERSION}`;
const SRC = ['app.js', 'audio.js', 'chart-edit.js', 'music.js', 'parsers.js', 'song.js'];
const ICONS = ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'icon.svg'];
const SAMPLES = ['Bb2', 'Bb3', 'Bb4', 'Bb5', 'Db3', 'Db4', 'Db5', 'Db6', 'E2', 'E3', 'E4', 'E5', 'G2', 'G3', 'G4', 'G5'].map((n) => `${n}.mp3`);
const PRECACHE = [
  './', './index.html', './manifest.webmanifest', `./styles.css?v=${ASSET_VERSION}`,
  ...SRC.map((f) => `./src/${f}?v=${ASSET_VERSION}`),
  ...ICONS.map((f) => `./icons/${f}`),
  ...SAMPLES.map((f) => `./samples/guitar/${f}`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('strum-studio-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function save(req, res) {
  if (res.ok) {
    const c = await caches.open(CACHE);
    await c.put(req, res.clone());
  }
  return res;
}

// Stamped files (?v=N) and recordings never change, so the cached copy is always right.
async function cacheFirst(req) {
  return (await caches.match(req)) || save(req, await fetch(req));
}

// The page, manifest and icons: fetch fresh when online (giving up after a few seconds on a
// weak signal), otherwise use the cached copy. Fresh pages point at fresh stamped files, so a
// new page is never paired with old code.
async function networkFirst(req) {
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => { setTimeout(() => reject(new Error('timeout')), 4000); }),
    ]);
    return await save(req, res);
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const page = await caches.match('./index.html');
      if (page) return page;
    }
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const fixed = url.searchParams.has('v') || url.pathname.includes('/samples/');
  e.respondWith(fixed ? cacheFirst(req) : networkFirst(req));
});
