/* sw.js — deixa o jogo rodar OFFLINE depois da primeira visita.
 *
 * - Na instalação baixa TUDO que o jogo usa (arquivos + todas as imagens e sons
 *   listados em ASSETS no js/config.js), então uma única visita online basta.
 * - Depois responde do cache primeiro e atualiza em segundo plano.
 * - Áudio: o navegador pede o som em pedaços (cabeçalho Range). Respostas parciais
 *   não podem ser guardadas, então o arquivo inteiro é guardado e os pedaços são
 *   montados a partir dele.
 * - O ranking online (Firebase) NÃO passa por aqui: o js/online.js trata offline.
 *
 * Para forçar todo mundo a baixar de novo depois de uma atualização, mude CACHE_VERSION. */
const CACHE_VERSION = 'vigianoturna-v8';

// Lê as listas de imagens/sons direto do config.js (assim não precisa repetir aqui).
self.window = self;
try { importScripts('js/config.js'); } catch (e) { /* segue só com a lista básica */ }

const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/config.js', 'js/progression.js', 'js/online.js', 'js/assetLoader.js', 'js/doors.js',
  'js/power.js', 'js/cameras.js', 'js/enemyAI.js', 'js/ui.js', 'js/game.js',
  'js/main.js', 'js/menuExtras.js', 'js/admin.js',
];

function assetUrls() {
  const out = [];
  const walk = (o) => {
    for (const v of Object.values(o || {})) {
      if (typeof v === 'string') out.push(v);
      else if (v && typeof v === 'object') walk(v);
    }
  };
  if (self.ASSETS) { walk(self.ASSETS.images); walk(self.ASSETS.audio); }
  return out;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => Promise.all(
        [...CORE, ...assetUrls()].map((u) => c.add(u).catch(() => {})), // arquivo que não existe é ignorado
      ))
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

/** Monta uma resposta 206 (pedaço) a partir do arquivo inteiro guardado. */
async function rangeFromCache(cached, rangeHeader) {
  const buf = await cached.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader || '');
  const size = buf.byteLength;
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; } // "últimos N bytes"
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
    },
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ranking online e outros: direto na rede

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // ignoreSearch: "?v=7" não cria uma cópia separada de cada arquivo
      const cached = await cache.match(url.href, { ignoreSearch: true });

      // Pedido por pedaços (áudio/vídeo)
      if (req.headers.has('range')) {
        if (cached) return rangeFromCache(cached, req.headers.get('range'));
        fetch(url.href).then((r) => { if (r.status === 200) cache.put(url.href, r); }).catch(() => {});
        return fetch(req).catch(() => new Response('', { status: 504 }));
      }

      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone()); // só respostas completas
          return res;
        })
        .catch(() => null);
      if (cached) { network.catch(() => {}); return cached; }
      return (await network) || new Response('', { status: 504 });
    }),
  );
});
