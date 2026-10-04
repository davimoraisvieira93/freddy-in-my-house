/* js/online.js — Ranking geral do Modo Infinito (online) com fallback offline.
 *
 * Usa a API REST do Firebase Realtime Database (sem SDK, só fetch). A URL fica
 * em ONLINE_CONFIG.databaseUrl (config.js). Sem URL, tudo continua offline.
 *
 *  - submit(ms, nome): envia a marca. Sem internet, vai para uma FILA salva no
 *    navegador e é reenviada sozinha quando a conexão volta.
 *  - fetchTop(): baixa o top do ranking geral e guarda uma cópia para mostrar
 *    offline depois.
 */
const Leaderboard = (() => {
  const NAME_KEY = 'vigianoturna:name';
  const PENDING_KEY = 'vigianoturna:pending';
  const CACHE_KEY = 'vigianoturna:globalCache';

  const cfg = () => window.ONLINE_CONFIG || {};
  const enabled = () => !!cfg().databaseUrl;
  const base = () =>
    `${cfg().databaseUrl.replace(/\/+$/, '')}/${cfg().path || 'vigianoturna/scores'}.json`;

  function readJson(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* noop */ }
  }

  function fetchWithTimeout(url, opts, ms = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
  }

  // ------------------------------------------------------------------ nome
  function getName() { return localStorage.getItem(NAME_KEY) || ''; }

  function setName(n) {
    const clean = String(n || '').replace(/[<>]/g, '').trim().slice(0, 20);
    if (clean) { try { localStorage.setItem(NAME_KEY, clean); } catch (e) { /* noop */ } }
    return clean;
  }

  /** Pergunta o nome (só na primeira vez, ou sempre com force = true). */
  function askName(force) {
    let name = getName();
    if (!name || force) {
      const typed = window.prompt('Seu nome para o ranking geral (até 20 letras):', name || '');
      if (typed !== null) name = setName(typed) || name;
    }
    return name || 'Anônimo';
  }

  // ----------------------------------------------------------------- envio
  async function post(entry) {
    const r = await fetchWithTimeout(base(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  }

  function pendingCount() { return readJson(PENDING_KEY, []).length; }

  /** Reenvia marcas que ficaram na fila por falta de internet. */
  async function flushPending() {
    if (!enabled() || !navigator.onLine) return;
    const list = readJson(PENDING_KEY, []);
    if (!list.length) return;
    const rest = [];
    for (const e of list) {
      try { await post(e); } catch (err) { rest.push(e); }
    }
    writeJson(PENDING_KEY, rest);
  }

  /** Retorna { status: 'sent' | 'queued' | 'disabled' }. */
  async function submit(ms, name) {
    if (!enabled()) return { status: 'disabled' };
    const entry = { name: String(name || 'Anônimo').slice(0, 20), ms: Math.floor(ms), t: Date.now() };
    try {
      await flushPending();
      await post(entry);
      return { status: 'sent', entry };
    } catch (e) {
      const list = readJson(PENDING_KEY, []);
      list.push(entry);
      writeJson(PENDING_KEY, list.slice(-20));
      return { status: 'queued', entry };
    }
  }

  // --------------------------------------------------------------- leitura
  async function fetchTop() {
    const limit = cfg().maxEntries || 10;
    const url = `${base()}?orderBy=%22ms%22&limitToLast=${limit}`;
    const r = await fetchWithTimeout(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = (await r.json()) || {};
    const list = Object.values(data)
      .filter((e) => e && typeof e.ms === 'number')
      .map((e) => ({ name: String(e.name || 'Anônimo').slice(0, 20), ms: e.ms }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, limit);
    writeJson(CACHE_KEY, list);
    return list;
  }

  function getCached() { return readJson(CACHE_KEY, []); }

  window.addEventListener('online', flushPending);
  setTimeout(flushPending, 1500);

  return { enabled, getName, setName, askName, submit, fetchTop, getCached, flushPending, pendingCount };
})();

window.Leaderboard = Leaderboard;
