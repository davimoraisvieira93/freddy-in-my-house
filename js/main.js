/* js/main.js — versão corrigida
 *
 * Regra geral: nada aqui pode falhar em silêncio. Se algo quebrar, a tela de
 * carregamento vira uma tela de erro legível em vez de girar para sempre.
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

  function fatal(message, error) {
    console.error('[bootstrap]', message, error || '');
    if (!loadingScreen) return;
    loadingScreen.classList.remove('hidden');
    loadingScreen.innerHTML =
      '<h1>Não foi possível carregar</h1>' +
      `<p style="max-width:44ch;text-align:center;line-height:1.5">${message}</p>` +
      '<p><small>Abra o console (F12 → Console) para ver o erro completo.</small></p>';
  }

  // ------------------------------------------- 1) os scripts existem mesmo?
  // typeof em identificador não declarado é seguro; o try cobre o caso de um
  // arquivo ter quebrado no meio e deixado a const em TDZ.
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
    ENEMIES_CONFIG:  () => typeof window.ENEMIES_CONFIG,
    NIGHTS_CONFIG:   () => typeof window.NIGHTS_CONFIG,
    Progression:     () => typeof window.Progression,
  };

  const missing = Object.keys(deps).filter((name) => {
    try { return deps[name]() === 'undefined'; } catch (e) { return true; }
  });

  if (missing.length) {
    fatal(
      `Estes scripts não definiram nada: <b>${missing.join(', ')}</b>.<br>` +
      'Confira a aba Network por 404 e lembre que o GitHub Pages diferencia ' +
      'maiúsculas de minúsculas nos nomes de arquivo.',
    );
    return;
  }

  if (!canvas) { fatal('O elemento &lt;canvas id="game-canvas"&gt; não foi encontrado.'); return; }

  // --------------------------------------------------------- 2) música do menu
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

  // Autoplay bloqueado: espera o primeiro clique/tecla do usuário.
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

  // Antes isto fazia `src = ''`, o que faz o navegador tentar baixar a própria
  // página como áudio e jogar um erro no console. Pausar já basta.
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
      game.state = 'menu';                 // derruba qualquer loop de render ainda vivo
      if (game.assetLoader.stopAll) game.assetLoader.stopAll();  // corta a ambiência
    }
    hide('hud');
    hide('office-controls');
    hide('camera-monitor');
    if (UI.setEnemyOverlays) UI.setEnemyOverlays([]);
    resumeMenuMusic();
    if (window.refreshMenu) window.refreshMenu();
    UI.showScreen('menu-screen');
  }

  // ------------------------------------------------------------ 3) carregar
  const loader = new AssetLoader();
  window.loader = loader;

  // Rede de segurança: se em 15s nada tiver bootado, mostramos erro em vez de
  // deixar "Carregando…" para sempre.
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
      fatal(`Erro ao iniciar o jogo: ${(err && err.message) || err}`, err);
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

  // -------------------------------------------------------------- 4) botões
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

    // Os botões "Voltar" do Custom Night e do Ranking não estavam ligados a nada.
    // Se menuExtras.js já cuidar disso, apague este bloco.
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
