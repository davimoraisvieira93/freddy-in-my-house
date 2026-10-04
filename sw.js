/* sw.js — deixa o jogo rodar OFFLINE depois da primeira visita.
 * - Arquivos do jogo (HTML/JS/CSS/imagens/áudio): cache primeiro, atualiza em segundo plano.
 * - Ranking online (Firebase) NÃO passa por aqui: o js/online.js trata offline sozinho.
 * Para forçar todo mundo a baixar de novo depois de uma atualização, mude CACHE_VERSION. */
const CACHE_VERSION = 'vigianoturna-v7';
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/config.js', 'js/progression.js', 'js/online.js', 'js/assetLoader.js', 'js/doors.js',
  'js/power.js', 'js/cameras.js', 'js/enemyAI.js', 'js/ui.js', 'js/game.js',
  'js/main.js', 'js/menuExtras.js', 'js/admin.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ranking online e outros: direto na rede

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // ignoreSearch: "?v=7" não cria uma cópia separada de cada arquivo
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) { network.catch(() => {}); return cached; }
      return (await network) || new Response('', { status: 504 });
    }),
  );
});
