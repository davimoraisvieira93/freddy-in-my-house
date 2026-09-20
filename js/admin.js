/* js/admin.js — Modo Admin
 * Ativa com Ctrl+Shift+D (ou ?admin=1 na URL). Não depende da ordem de boot:
 * cada comando só age se window.game já existir.
 *
 *  1-5     pula direto para a noite N (campanha)
 *  N       pula a noite atual (vitória instantânea)
 *  E       energia para 100%
 *  G       liga/desliga god mode (imune a jumpscare — precisa do godMode
 *          checado em game.js, veja o comentário em _triggerJumpscare)
 *  H       mostra/esconde as hitboxes das portas (debug visual)
 *  J       força um jumpscare (testar a tela de game over)
 *  C       despeja o estado no console
 *
 * Console: window.AdminMode.{goToNight,refillPower,skipNight,toggleGod,dump}
 */
(function () {
  'use strict';

  let enabled = false;
  let godMode = false;
  let hud = null;

  function ensureHud() {
    if (hud) return hud;
    hud = document.createElement('div');
    hud.className = 'dev-hud';
    hud.hidden = true;
    document.body.appendChild(hud);
    return hud;
  }

  function withGame(fn) {
    if (!window.game) { console.warn('[admin] o jogo ainda não terminou de carregar'); return; }
    fn(window.game);
  }

  function toggle(on) {
    enabled = on === undefined ? !enabled : on;
    ensureHud().hidden = !enabled;
    if (enabled) render();
  }

  function goToNight(n) {
    withGame((game) => {
      window.stopMenuMusic && window.stopMenuMusic();
      game.startNight(Math.max(0, Math.min(window.NIGHTS_CONFIG.length - 1, n - 1)));
    });
  }

  function refillPower() {
    withGame((game) => {
      game.power.value = game.power.constants.POWER_MAX;
      game.power.isBlackedOut = false;
    });
  }

  function skipNight() {
    withGame((game) => { game.elapsedNightMs = game.constants.NIGHT_DURATION_MS; });
  }

  function forceJumpscare() {
    withGame((game) => game._triggerJumpscare(window.ENEMIES_CONFIG[0].id));
  }

  function toggleGod() {
    godMode = !godMode;
    withGame((game) => { game.godMode = godMode; });
  }

  function toggleHitboxes() {
    window.__FNAF_DEBUG_HITBOXES__ = !window.__FNAF_DEBUG_HITBOXES__;
  }

  function dump() {
    withGame((game) => console.table({
      estado: game.state,
      modo: game.mode,
      noite: game.nightIndex + 1,
      energia: game.power.percentage.toFixed(1),
    }));
  }

  function render() {
    if (!enabled) return;
    withGame((game) => {
      hud.innerHTML =
        `<b>ADMIN</b> · ${game.mode} · noite ${game.nightIndex + 1}<br>` +
        `energia <b>${game.power.percentage.toFixed(0)}%</b> ${godMode ? '· <b>GOD</b>' : ''}<br>` +
        `<span class="k">1-5</span> noite · <span class="k">N</span> pular · ` +
        `<span class="k">E</span> energia · <span class="k">G</span> god<br>` +
        `<span class="k">H</span> hitboxes · <span class="k">J</span> jumpscare · <span class="k">C</span> log`;
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') { e.preventDefault(); toggle(); return; }
    if (!enabled) return;
    if (e.target && e.target.matches && e.target.matches('input,textarea')) return;

    if (/^Digit[1-5]$/.test(e.code)) goToNight(Number(e.code.slice(5)));
    else if (e.code === 'KeyN') skipNight();
    else if (e.code === 'KeyE') refillPower();
    else if (e.code === 'KeyG') toggleGod();
    else if (e.code === 'KeyH') toggleHitboxes();
    else if (e.code === 'KeyJ') forceJumpscare();
    else if (e.code === 'KeyC') dump();
    else return;
    render();
  });

  setInterval(() => { if (enabled) render(); }, 400);

  if (new URLSearchParams(location.search).get('admin') === '1') toggle(true);

  window.AdminMode = { toggle, goToNight, refillPower, skipNight, toggleGod, toggleHitboxes, dump };
})();
