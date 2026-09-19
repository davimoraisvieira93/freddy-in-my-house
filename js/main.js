/* js/main.js — v2
 *
 * Novidades desta versão:
 *  - faz a "ponte" automática de globais declarados com const para window
 *  - checa também DOOR_HITBOXES (usado por ui.js) e as chaves de GAME_CONSTANTS
 *  - avisa se OFFICE_WORLD_WIDTH não bate com VIEWS.length × INTERNAL_WIDTH
 */
(function bootstrap() {
  'use strict';

  const canvas        = document.getElementById('game-canvas');
  const loadingScreen = document.getElementById('loading-screen');
  const menuScreen    = document.getElementById('menu-screen');

  let game = null;
  let booted = false;

  // ---------------------------------------------------------------- helpers
  function on(id, event, handler) {
    const el = document.getElementById(id);
    if (!el) { console.warn(`[bootstrap] #${id} não existe no HTML`); return; }
    el.addEventListener(event, handler);
  }

  function hide(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  function fatal(html) {
    console.error('[bootstrap]', html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (!loadingScreen) return;
    loadingScreen.classList.remove('hidden');
    loadingScreen.innerHTML =
      '<h1>Não foi possível carregar</h1>' +
      `<p style="max-width:46ch;text-align:center;line-height:1.5">${html}</p>` +
      '<p><small>Abra o console (F12 → Console) para ver o erro completo.</small></p>';
  }

  // ---------------------------------------- 1) ponte const → window
  // Em <script> clássico, `const X = ...` NÃO cria window.X. Como game.js e
  // ui.js leem window.VIEWS, window.Progression etc., se o arquivo de origem
  // esqueceu o `window.X = X`, o global "some". Aqui a gente conserta e avisa.
  const bridged = [];
  function bridge(name, readLexical) {
    if (typeof window[name] !== 'undefined') return;
    let value;
    try { value = readLexical(); } catch (e) { return; } // nem existe: segue o baile
    if (value === undefined) return;
    window[name] = value;
    bridged.push(name);
  }

  bridge('ASSETS',         () => ASSETS);
  bridge('GAME_CONSTANTS', () => GAME_CONSTANTS);
  bridge('VIEWS',          () => VIEWS);
  bridge('ROOMS',          () => ROOMS);
  bridge('DOORS_CONFIG',   () => DOORS_CONFIG);
  bridge('DOOR_HITBOXES',  () => DOOR_HITBOXES);
  bridge('ENEMIES_CONFIG', () => ENEMIES_CONFIG);
  bridge('NIGHTS_CONFIG',  () => NIGHTS_CONFIG);
  bridge('Progression',    () => Progression);

  if (bridged.length) {
    console.warn(
      '[bootstrap] Estes globais existiam como const mas não estavam em window. ' +
      'Exportei por você, mas o certo é adicionar `window.X = X;` no arquivo de origem:',
      bridged,
    );
  }

  // ------------------------------------------- 2) os scripts existem mesmo?
  const deps = {
    UI:              () => typeof UI,
    Game:            () => typeof Game,
    AssetLoader:     () => typeof AssetLoader,
    createDoors:     () => typeof createDoors,
    PowerSystem:     () => typeof PowerSystem,
    CameraSystem:    () => typeof CameraSystem,
    EnemyManager:    () => typeof EnemyManager,
    ASSETS:          () => typeof window.ASSETS,
    GAME_CONSTANTS:  () => typeof window.GAME_CONSTANTS,
    VIEWS:           () => typeof window.VIEWS,
    ROOMS:           () => typeof window.ROOMS,
    DOORS_CONFIG:    () => typeof window.DOORS_CONFIG,
    DOOR_HITBOXES:   () => typeof window.DOOR_HITBOXES,
    ENEMIES_CONFIG:  () => typeof window.ENEMIES_CONFIG,
    NIGHTS_CONFIG:   () => typeof window.NIGHTS_CONFIG,
    Progression:     () => typeof window.Progression,
  };

  const missing = Object.keys(deps).filter((name) => {
    try { return deps[name]() === 'undefined'; } catch (e) { return true; }
  });

  if (missing.length) {
    fatal(
      `Faltando: <b>${missing.join(', ')}</b>.<br>` +
      'Veja a aba Network por 404 e confira se o arquivo de origem faz ' +
      '<code>window.X = X;</code> no final.',
    );
    return;
  }

  if (!canvas) { fatal('O elemento &lt;canvas id="game-canvas"&gt; não foi encontrado.'); return; }

  // ------------------------------- 3) constantes faltando viram NaN silencioso
  const CONST_KEYS = [
    'INTERNAL_WIDTH', 'INTERNAL_HEIGHT', 'OFFICE_WORLD_WIDTH', 'VIEW_SMOOTHING',
    'AI_TICK_INTERVAL_MS', 'NIGHT_DURATION_MS', 'HOURS_PER_NIGHT',
    'STATIC_NOISE_DENSITY', 'JITTER_MAX_PX', 'CAMERA_STATIC_FLASH_MS',
    'INFINITE_START_LEVEL', 'INFINITE_MAX_LEVEL', 'INFINITE_RAMP_MS', 'INFINITE_POWER_MULT',
  ];
  const missingConsts = CONST_KEYS.filter((k) => window.GAME_CONSTANTS[k] === undefined);
  if (missingConsts.length) {
    console.warn('[bootstrap] GAME_CONSTANTS sem estas chaves (viram NaN em silêncio):', missingConsts);
  }

  const expectedWorld = window.VIEWS.length * window.GAME_CONSTANTS.INTERNAL_WIDTH;
  if (window.GAME_CONSTANTS.OFFICE_WORLD_WIDTH !== expectedWorld) {
    console.warn(
      `[bootstrap] OFFICE_WORLD_WIDTH = ${window.GAME_CONSTANTS.OFFICE_WORLD_WIDTH}, ` +
      `mas VIEWS.length × INTERNAL_WIDTH = ${expectedWorld}. ` +
      'O escritório vai desalinhar ao virar para os lados.',
    );
  }

  // --------------------------------------------------------- 4) música do menu
  const BEATBOX_SRC = 'assets/audio/sfx/beatbox.mp3';
  const beatboxMusic = new Audio(BEATBOX_SRC);
  beatboxMusic.loop = true;
  beatboxMusic.volume = 0.6;
  beatboxMusic.preload = 'auto';

  let musicStopped = false;
  let gestureBound = false;

  function menuIsVisible() {
    return !!menuScreen && !menuScreen.classList.contains('hidden');
  }

  function playMenuMusic() {
    if (musicStopped) return;
    const p = beatboxMusic.play();
    if (p && p.catch) p.catch(() => bindFirstGesture());
  }

  function bindFirstGesture() {
    if (gestureBound) return;
    gestureBound = true;
    const unlock = () => {
      gestureBound = false;
      if (!musicStopped && beatboxMusic.paused && menuIsVisible()) playMenuMusic();
    };
    document.body.addEventListener('pointerdown', unlock, { once: true });
    document.body.addEventListener('keydown', unlock, { once: true });
  }

  function stopMenuMusic() {
    musicStopped = true;
    try { beatboxMusic.pause(); beatboxMusic.currentTime = 0; } catch (e) { console.warn(e); }
  }
  window.stopMenuMusic = stopMenuMusic;

  function resumeMenuMusic() {
    musicStopped = false;
    beatboxMusic.muted = false;
    beatboxMusic.volume = 0.6;
    playMenuMusic();
  }

  function goToMenu() {
    if (game) {
      game.state = 'menu';
      if (game.assetLoader.stopAll) game.assetLoader.stopAll();
    }
    hide('hud');
    hide('office-controls');
    hide('camera-monitor');
    if (UI.setEnemyOverlays) UI.setEnemyOverlays([]);
    resumeMenuMusic();
    if (window.refreshMenu) window.refreshMenu();
    UI.showScreen('menu-screen');
  }

  // ------------------------------------------------------------ 5) carregar
  const loader = new AssetLoader();
  window.loader = loader;

  const failsafe = setTimeout(() => {
    if (!booted) fatal('O carregamento demorou demais e foi interrompido.');
  }, 15000);

  loader
    .loadAll(window.ASSETS, (done, total) => {
      const h1 = loadingScreen && loadingScreen.querySelector('h1');
      if (h1) h1.textContent = `Carregando… ${done}/${total}`;
    })
    .then(start)
    .catch((err) => {
      clearTimeout(failsafe);
      fatal(`Erro ao iniciar o jogo: ${(err && err.message) || err}`);
      console.error(err);
    });

  function start() {
    clearTimeout(failsafe);

    game = new Game(canvas, loader);
    window.game = game;
    booted = true;

    UI.hideAllScreens();
    loadingScreen.classList.add('hidden');
    UI.showScreen('menu-screen');
    if (window.refreshMenu) window.refreshMenu();

    wireMenuButtons();
    wireOfficeControls();
    wireCameraMonitor();
    wireEndScreens();
    wireKeyboardShortcuts();

    setTimeout(playMenuMusic, 200);
  }

  // -------------------------------------------------------------- 6) botões
  function wireMenuButtons() {
    on('btn-start', 'click', () => {
      if (!game) return;
      stopMenuMusic();
      game.startNight(0);
    });
  }

  function wireOfficeControls() {
    document.querySelectorAll('[data-action="toggle-door"]').forEach((btn) => {
      btn.addEventListener('click', () => game && game.toggleDoor(btn.dataset.door));
    });
    document.querySelectorAll('[data-action="toggle-light"]').forEach((btn) => {
      btn.addEventListener('click', () => game && game.toggleLight(btn.dataset.door));
    });
    on('btn-open-monitor', 'click', () => game && game.toggleMonitor());
  }

  function wireCameraMonitor() {
    on('btn-close-monitor', 'click', () => game && game.toggleMonitor());
  }

  function wireEndScreens() {
    on('btn-retry', 'click', () => { if (game) { stopMenuMusic(); game.restart(); } });
    on('btn-menu-gameover', 'click', goToMenu);
    on('btn-next-night', 'click', () => {
      if (!game) return;
      stopMenuMusic();
      game.startNight(game.nightIndex + 1);
    });
    on('btn-menu-victory', 'click', goToMenu);

    // Se menuExtras.js já cuidar dos "Voltar", apague este bloco.
    document.querySelectorAll('[data-action="back-to-menu"]').forEach((btn) => {
      btn.addEventListener('click', goToMenu);
    });
  }

  function wireKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (!game || game.state !== 'playing' || e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft')  { e.preventDefault(); game.turn(-1); }
      if (k === 'arrowright') { e.preventDefault(); game.turn(1); }
      if (k === 'a') game.toggleDoor('esquerda');
      if (k === 'd') game.toggleDoor('direita');
      if (k === 'q') game.toggleLight('esquerda');
      if (k === 'e') game.toggleLight('direita');
      if (k === ' ') { e.preventDefault(); game.toggleMonitor(); }
    });
  }
})();
