/* js/ui.js
 * Tudo que toca DOM/canvas passa por aqui: telas, HUD, abas de câmera,
 * botões de porta/luz, e o desenho do escritório panorâmico + monitor.
 *
 * PAN DO ESCRITÓRIO: o background é UM ÚNICO arquivo (assets.images.office.
 * background) que representa o panorama inteiro (OFFICE_WORLD_WIDTH, 180°).
 * Em vez de assumir que a imagem tem exatamente 1440px, calculamos a escala
 * real da imagem (img.naturalWidth / OFFICE_WORLD_WIDTH) e recortamos a fatia
 * visível a partir de cameraOffsetX nessa mesma escala — assim funciona
 *독립 da resolução do PNG que você usar.
 *
 * HITBOXES DAS PORTAS: DOOR_HITBOXES (config.js) já vem em FRAÇÃO do mundo
 * (x/w) e da altura (y/h). Usamos a mesma escala do background pra desenhar
 * o rótulo "PORTA ESQUERDA/DIREITA" exatamente em cima do vão da porta.
 * Ligue window.__FNAF_DEBUG_HITBOXES__ = true (ou aperte H com o Modo Admin
 * ativo) para ver o contorno da hitbox e calibrar.
 */
(function injectBaseStyles() {
 const css = `/* js/ui.js — v3 (visões fixas)
 * Tudo que toca DOM/canvas passa por aqui: telas, HUD, abas de câmera,
 * botões de porta/luz e o desenho do escritório + monitor.
 *
 * ESCRITÓRIO: cada visão de VIEWS (config.js) tem seu próprio fundo, uma
 * imagem de tela inteira (16:9):
 *   - visão sem porta (doorId null)  -> backgrounds.default
 *   - visão com porta/janela         -> backgrounds.open  ou  backgrounds.closed
 *     (segue door.isClosed da porta que a visão controla)
 * As chaves ('office.centro', 'office.portaAberta'...) apontam para
 * ASSETS.images.* e são resolvidas pelo assetLoader. Se o arquivo não existir,
 * desenhamos um placeholder com o NOME DA CHAVE (ajuda a achar erro de nome).
 *
 * TRANSIÇÃO: game.slide = { from, to, dir, t } (calculado em game.js) — aqui
 * só desenhamos as duas imagens deslizando.
 *
 * HITBOXES: DOOR_HITBOXES agora é FRAÇÃO DA TELA (0–1). Servem para o rótulo
 * "PORTA"/"JANELA", para o contorno de debug (tecla H no Modo Admin) e para o
 * placeholder do inimigo quando a arte dele ainda não existe.
 *
 * ANIMATRONICS: sprites (PNG ou GIF) ficam numa camada DOM (#enemy-layer) em
 * tela cheia. ctx.drawImage só desenha o 1º frame de um GIF; <img> anima.
 * A camada só é recriada quando a lista muda, senão o GIF reiniciaria a cada frame.
 */
(function injectBaseStyles() {
  const css = `
    #btn-close-monitor { position: relative; z-index: 50; }
    #camera-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
    .cam-tab { background: #1a1a1a; color: #ccc; border: 1px solid #444;
      padding: 6px 10px; cursor: pointer; font: 12px monospace; }
    .cam-tab.active { background: #4caf50; color: #000; border-color: #4caf50; }
    #hud-power.low, #hud-power-value.low { color: #ff4d4d; }
    .custom-level-row { display: flex; align-items: center; gap: 10px; margin: 6px 0; color: #ddd; font: 13px monospace; }
    .leaderboard li.highlight { color: #4caf50; font-weight: bold; }
    .leaderboard li.empty { color: #888; }
    .dev-hud { position: fixed; left: 10px; bottom: 10px; z-index: 9999;
      font: 12px/1.5 monospace; color: #b9f5c8; background: rgba(6,10,8,.88);
      border: 1px solid #2d5c3c; border-radius: 6px; padding: 8px 10px; }
    .dev-hud b { color: #eafff0; }
    .dev-hud .k { color: #6fbf87; }

    /* Filtro "câmera de segurança" (game.js liga a classe .cam-feed no canvas) */
    #game-canvas.cam-feed {
      filter: grayscale(.85) contrast(1.15) brightness(.92) sepia(.2) hue-rotate(70deg);
    }
    body:has(#game-canvas.cam-feed) #enemy-layer {
      filter: grayscale(.85) contrast(1.15) brightness(.92) sepia(.2) hue-rotate(70deg);
    }

    /* "● REC Câm. N" em DOM: fica acima dos sprites em tela cheia */
    #cam-rec-label { position: absolute; top: 16px; left: 20px; z-index: 12;
      color: #3fae5c; font: bold 16px monospace; text-shadow: 0 1px 3px #000;
      pointer-events: none; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

const UI = (() => {
  const SCREENS = [
    'loading-screen', 'menu-screen', 'custom-screen',
    'leaderboard-screen', 'gameover-screen', 'victory-screen',
  ];

  let flashUntil = 0;   // até quando o monitor mostra o "chiado" de troca de câmera
  let overlaySig = '';  // assinatura dos sprites atuais (evita recriar <img> todo frame)

  // ------------------------------------------------------------------ helpers
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const ease = (t) => t * t * (3 - 2 * t);

  /** Desenha a imagem cobrindo o retângulo (sem esticar; corta o excesso). */
  function drawCover(ctx, img, dx, dy, dw, dh) {
    const s = Math.max(dw / img.naturalWidth, dh / img.naturalHeight);
    const sw = dw / s;
    const sh = dh / s;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = (img.naturalHeight - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  /** Caixa com texto: usada quando a imagem da chave ainda não existe. */
  function drawPlaceholder(ctx, x, y, w, h, label, fill) {
    ctx.save();
    ctx.fillStyle = fill || '#2b2f3a';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.restore();
  }

  // ------------------------------------------------------------------- telas
  function hideAllScreens() {
    SCREENS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }

  function showScreen(id) {
    hideAllScreens();
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  // ---------------------------------------------------------- câmeras (abas)
  let onTabSelect = null;

  function ensureRecLabel() {
    let el = document.getElementById('cam-rec-label');
    if (!el) {
      const host = document.getElementById('camera-monitor');
      if (!host) return null;
      el = document.createElement('div');
      el.id = 'cam-rec-label';
      host.appendChild(el);
    }
    return el;
  }

  function buildCameraTabs(rooms, onSelect) {
    onTabSelect = onSelect;
    const tabsEl = document.getElementById('camera-tabs');
    if (!tabsEl) return;
    tabsEl.innerHTML = '';
    rooms.forEach((room) => {
      const btn = document.createElement('button');
      btn.className = 'cam-tab';
      btn.dataset.room = room.id;
      btn.textContent = room.label;
      btn.addEventListener('click', () => onTabSelect && onTabSelect(room.id));
      tabsEl.appendChild(btn);
    });
    ensureRecLabel();
  }

  function setActiveCameraTab(roomId) {
    document.querySelectorAll('#camera-tabs .cam-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.room === roomId);
    });
    const rec = ensureRecLabel();
    if (rec) {
      const room = (window.ROOMS || []).find((r) => r.id === roomId);
      rec.textContent = `● REC   ${room ? room.label : roomId}`;
    }
  }

  /** Abre o "chiado" de troca de câmera (renderCameraMonitor consome isto). */
  function triggerCameraFlash() {
    flashUntil = performance.now() + (window.GAME_CONSTANTS.CAMERA_STATIC_FLASH_MS || 220);
  }

  // ---------------------------------------------------- controles do escritório
  function syncControls(game) {
    const blocked = game.cameras.isOpen || game.power.isBlackedOut;
    const view = game.viewDef;

    // botão do monitor: só nas visões marcadas com monitorButton em VIEWS
    const monitorBtn = document.getElementById('btn-open-monitor');
    if (monitorBtn) monitorBtn.classList.toggle('hidden', blocked || !view.monitorButton);

    // painel de porta/janela: só na visão que controla aquela porta
    document.querySelectorAll('.door-panel').forEach((panel) => {
      panel.classList.toggle('hidden', blocked || panel.dataset.door !== view.doorId);
    });

    // setas de virar
    ['nav-left', 'nav-right'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', blocked);
    });
  }

  function setDoorButtonsState(doors) {
    Object.values(doors).forEach((door) => {
      const panel = document.querySelector(`.door-panel[data-door="${door.id}"]`);
      if (!panel) return;
      const icon = door.id === 'janela' ? '🪟' : '🚪';
      const closeBtn = panel.querySelector('[data-action="toggle-door"]');
      const lightBtn = panel.querySelector('[data-action="toggle-light"]');
      if (closeBtn) {
        closeBtn.textContent = `${icon} ${door.isClosed ? 'Abrir' : 'Fechar'}`;
        closeBtn.classList.toggle('active', door.isClosed);
      }
      if (lightBtn) {
        lightBtn.textContent = door.lightOn ? '💡 Apagar' : '💡 Luz';
        lightBtn.disabled = door.isClosed;
        lightBtn.classList.toggle('active', door.lightOn);
      }
    });
  }

  // -------------------------------------------------------- overlays de DOM
  /** overlays: [{ src }]. Só recria as <img> quando a lista muda. */
  function setEnemyOverlays(overlays) {
    const layer = document.getElementById('enemy-layer');
    if (!layer) return;
    const list = (overlays || []).filter((o) => o && o.src);
    const sig = list.map((o) => o.src).join('|');
    if (sig === overlaySig) return;
    overlaySig = sig;
    layer.innerHTML = '';
    list.forEach((o) => {
      const img = document.createElement('img');
      img.className = 'enemy-sprite';
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;';
      img.onerror = () => img.remove();
      img.src = o.src;
      layer.appendChild(img);
    });
  }

  // ---------------------------------------------------------- escritório
  /** Chave do fundo da visão `viewIdx`, conforme o estado da porta que ela controla. */
  function backgroundKeyFor(game, viewIdx) {
    const v = window.VIEWS[viewIdx];
    const b = v.backgrounds || {};
    if (v.doorId) {
      const door = game.doors[v.doorId];
      return door && door.isClosed ? (b.closed || b.open || b.default) : (b.open || b.default);
    }
    return b.default || b.open;
  }

  function drawViewBackground(ctx, buffer, assetLoader, game, viewIdx, dx) {
    const key = backgroundKeyFor(game, viewIdx);
    const img = key ? assetLoader.getImage(key) : null;
    if (img) drawCover(ctx, img, dx, 0, buffer.width, buffer.height);
    else drawPlaceholder(ctx, dx, 0, buffer.width, buffer.height, key || '(VIEWS sem "backgrounds")');
  }

  /** Rótulo, luz, inimigo na entrada e debug da porta/janela da visão atual. */
  function drawDoorLayer(ctx, buffer, assetLoader, game, overlays) {
    const W = buffer.width;
    const H = buffer.height;
    const doorId = game.viewDef.doorId;
    if (!doorId) return;

    const door = game.doors[doorId];
    const box = (window.DOOR_HITBOXES || {})[doorId];
    if (!door || !box) return;

    const x = box.x * W;
    const y = box.y * H;
    const w = box.w * W;
    const h = box.h * H;

    if (door.lightOn) {
      ctx.fillStyle = 'rgba(255,214,140,0.16)';
      ctx.fillRect(x, y, w, h);
    }

    // Inimigo encostado nesta entrada (só aparece com ela aberta)
    if (!door.isClosed) {
      (window.ENEMIES_CONFIG || []).forEach((cfg) => {
        const st = game.enemies.getPublicState(cfg.id);
        if (!st || st.entryDoorId !== doorId) return;
        const img = assetLoader.getImage(`enemies.${cfg.id}.na${cap(doorId)}`); // naPorta / naJanela
        if (img) overlays.push({ src: img.src });
        else drawPlaceholder(ctx, x, y, w, h, `${cfg.label} na ${doorId}`, 'rgba(127,29,29,0.75)');
      });
    }

    if (window.__FNAF_DEBUG_HITBOXES__) {
      ctx.save();
      ctx.strokeStyle = '#35ff9a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    // Texto flutuante "PORTA" / "JANELA"
    const bob = Math.sin(Date.now() / 500) * 2;
    ctx.save();
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 3;
    ctx.fillText((door.label || doorId).toUpperCase(), x + w / 2, Math.max(14, y - 6 + bob));
    ctx.restore();
  }

  function drawBlackout(ctx, W, H) {
    ctx.fillStyle = 'rgba(0,0,0,0.86)';
    ctx.fillRect(0, 0, W, H);
    const flicker = 0.5 + 0.5 * Math.sin(Date.now() / 180);
    ctx.save();
    ctx.fillStyle = `rgba(194,59,59,${(0.4 + flicker * 0.6).toFixed(2)})`;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SEM ENERGIA', W / 2, H / 2);
    ctx.restore();
  }

  function renderOffice(ctx, buffer, assetLoader, game) {
    const W = buffer.width;
    const H = buffer.height;
    const overlays = [];

    if (game.slide) {
      // giro entre visões: a antiga sai e a nova entra pelo lado oposto
      const s = game.slide;
      const t = ease(Math.min(1, Math.max(0, s.t)));
      const fromX = -s.dir * t * W;
      drawViewBackground(ctx, buffer, assetLoader, game, s.from, fromX);
      drawViewBackground(ctx, buffer, assetLoader, game, s.to, fromX + s.dir * W);
    } else {
      drawViewBackground(ctx, buffer, assetLoader, game, game.viewIndex, 0);
      drawDoorLayer(ctx, buffer, assetLoader, game, overlays);
    }

    if (game.power.isBlackedOut) drawBlackout(ctx, W, H);
    return overlays;
  }

  // ------------------------------------------------------------- monitor
  function renderCameraMonitor(ctx, buffer, assetLoader, game) {
    const W = buffer.width;
    const H = buffer.height;
    const c = window.GAME_CONSTANTS;
    const roomId = game.cameras.currentRoomId;
    const overlays = [];

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // troca de câmera / abertura do monitor: um instante de chiado
    if (performance.now() < flashUntil) {
      const st = assetLoader.getImage('cameras.static');
      if (st) drawCover(ctx, st, 0, 0, W, H);
      drawStaticNoise(ctx, W, H, (c.STATIC_NOISE_DENSITY || 45) * 8);
      return overlays;
    }

    // fundo da câmera com a tremida leve (JITTER_MAX_PX); sobra de borda evita faixas pretas
    const j = c.JITTER_MAX_PX || 0;
    const jx = (Math.random() * 2 - 1) * j;
    const jy = (Math.random() * 2 - 1) * j;
    const key = `cameras.${roomId}`;
    const bg = assetLoader.getImage(key);
    if (bg) drawCover(ctx, bg, jx - j, jy - j, W + 2 * j, H + 2 * j);
    else drawPlaceholder(ctx, 0, 0, W, H, key, '#1f2937');

    (window.ENEMIES_CONFIG || []).forEach((cfg) => {
      const st = game.enemies.getPublicState(cfg.id);
      if (!st || st.node !== roomId) return;
      const img = assetLoader.getImage(`enemies.${cfg.id}.${roomId}`);
      if (img) overlays.push({ src: img.src });
      else drawPlaceholder(ctx, W * 0.3, H * 0.25, W * 0.4, H * 0.6, cfg.label, 'rgba(127,29,29,0.75)');
    });

    // moldura, linha de varredura e chiado forte (o "● REC" é DOM, ver setActiveCameraTab)
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, W - 8, H - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, (Date.now() / 14) % H, W, 2);
    drawStaticNoise(ctx, W, H, (c.STATIC_NOISE_DENSITY || 45) * 3);

    return overlays;
  }

  function renderJumpscare(ctx, buffer, assetLoader, enemyId) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, buffer.width, buffer.height);
    const img = assetLoader.getImage(`enemies.${enemyId}.jumpscare`);
    if (img) return [{ src: img.src }];

    // sem arte ainda: texto vermelho pra você ver que o jumpscare disparou
    const cfg = (window.ENEMIES_CONFIG || []).find((e) => e.id === enemyId);
    ctx.save();
    ctx.fillStyle = '#c23b3b';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${cfg ? cfg.label.toUpperCase() : enemyId}!`, buffer.width / 2, buffer.height / 2);
    ctx.restore();
    return [];
  }

  // ------------------------------------------------------------ ruído / HUD
  function drawStaticNoise(ctx, w, h, density) {
    const count = Math.max(0, Math.floor(density));
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const s = Math.random() < 0.5 ? 1 : 2;
      ctx.fillRect(x, y, s, s);
    }
    ctx.restore();
  }

  function updateHud({ powerPct, powerLow, clockLabel, nightLabel }) {
    const powerVal = document.getElementById('hud-power-value');
    const powerWrap = document.getElementById('hud-power');
    const clock = document.getElementById('hud-clock-value');
    const night = document.getElementById('hud-night-value');
    if (powerVal) powerVal.textContent = `${Math.round(powerPct)}%`;
    if (powerWrap) powerWrap.classList.toggle('low', !!powerLow);
    if (clock) clock.textContent = clockLabel;
    if (night) night.textContent = nightLabel;
  }

  function renderLeaderboard(el, highlightRank) {
    if (!el) return;
    const scores = window.Progression.getLeaderboard();
    el.innerHTML = scores.length
      ? scores
          .map((ms, i) => `<li class="${i + 1 === highlightRank ? 'highlight' : ''}">${window.Progression.formatTime(ms)}</li>`)
          .join('')
      : '<li class="empty">Nenhum registro ainda</li>';
  }

  return {
    hideAllScreens,
    showScreen,
    buildCameraTabs,
    setActiveCameraTab,
    triggerCameraFlash,
    syncControls,
    setDoorButtonsState,
    setEnemyOverlays,
    renderOffice,
    renderCameraMonitor,
    renderJumpscare,
    drawStaticNoise,
    updateHud,
    renderLeaderboard,
  };
})();

window.UI = UI;

    #btn-close-monitor { position: relative; z-index: 50; }
    #camera-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
    .cam-tab { background: #1a1a1a; color: #ccc; border: 1px solid #444;
      padding: 6px 10px; cursor: pointer; font: 12px monospace; }
    .cam-tab.active { background: #4caf50; color: #000; border-color: #4caf50; }
    #hud-power.low, #hud-power-value.low { color: #ff4d4d; }
    .custom-level-row { display: flex; align-items: center; gap: 10px; margin: 6px 0; color: #ddd; font: 13px monospace; }
    .leaderboard li.highlight { color: #4caf50; font-weight: bold; }
    .leaderboard li.empty { color: #888; }
    .dev-hud { position: fixed; left: 10px; bottom: 10px; z-index: 9999;
      font: 12px/1.5 monospace; color: #b9f5c8; background: rgba(6,10,8,.88);
      border: 1px solid #2d5c3c; border-radius: 6px; padding: 8px 10px; }
    .dev-hud b { color: #eafff0; }
    .dev-hud .k { color: #6fbf87; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

const UI = (() => {
  const SCREENS = [
    'loading-screen', 'menu-screen', 'custom-screen',
    'leaderboard-screen', 'gameover-screen', 'victory-screen',
  ];

  function hideAllScreens() {
    SCREENS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }

  function showScreen(id) {
    hideAllScreens();
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  // ---------------------------------------------------------- câmeras (abas)
  let onTabSelect = null;

  function buildCameraTabs(rooms, onSelect) {
    onTabSelect = onSelect;
    const tabsEl = document.getElementById('camera-tabs');
    if (!tabsEl) return;
    tabsEl.innerHTML = '';
    rooms.forEach((room) => {
      const btn = document.createElement('button');
      btn.className = 'cam-tab';
      btn.dataset.room = room.id;
      btn.textContent = room.label;
      btn.addEventListener('click', () => onTabSelect && onTabSelect(room.id));
      tabsEl.appendChild(btn);
    });
  }

  function setActiveCameraTab(roomId) {
    document.querySelectorAll('#camera-tabs .cam-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.room === roomId);
    });
  }

  // ---------------------------------------------------- controles do escritório
  function syncControls(game) {
    const view = game.view;
    const monitorBtn = document.getElementById('btn-open-monitor');
    if (monitorBtn) monitorBtn.classList.toggle('hidden', view !== 'centro' || game.cameras.isOpen);

    document.querySelectorAll('.door-panel').forEach((panel) => {
      const doorId = panel.dataset.door;
      panel.classList.toggle('hidden', view !== doorId || game.cameras.isOpen);
    });
  }

  function setDoorButtonsState(doors) {
    Object.values(doors).forEach((door) => {
      const panel = document.querySelector(`.door-panel[data-door="${door.id}"]`);
      if (!panel) return;
      const closeBtn = panel.querySelector('[data-action="toggle-door"]');
      const lightBtn = panel.querySelector('[data-action="toggle-light"]');
      if (closeBtn) closeBtn.textContent = door.isClosed ? '🚪 Abrir' : '🚪 Fechar';
      if (lightBtn) {
        lightBtn.textContent = door.lightOn ? '💡 Apagar' : '💡 Luz';
        lightBtn.disabled = door.isClosed;
      }
    });
  }

  // -------------------------------------------------------- overlays de DOM
  function setEnemyOverlays(overlays) {
    const layer = document.getElementById('enemy-layer');
    if (!layer) return;
    layer.innerHTML = '';
    (overlays || []).forEach((o) => {
      const img = document.createElement('img');
      img.src = o.src;
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;';
      layer.appendChild(img);
    });
  }

  // ------------------------------------------------------------ desenho
  function drawPanned(ctx, img, offsetX, worldWidth, viewW, viewH) {
    if (!img) return;
    const scale = img.naturalWidth / worldWidth;
    const sw = viewW * scale;
    ctx.drawImage(img, offsetX * scale, 0, sw, img.naturalHeight, 0, 0, viewW, viewH);
  }

  function renderOffice(ctx, buffer, assetLoader, game) {
    const bg = assetLoader.getImage('office.background');
    drawPanned(ctx, bg, game.cameraOffsetX, game.constants.OFFICE_WORLD_WIDTH, buffer.width, buffer.height);

    const scale = bg ? bg.naturalWidth / game.constants.OFFICE_WORLD_WIDTH : 1;

    Object.entries(window.DOOR_HITBOXES || {}).forEach(([doorId, box]) => {
      const worldX = box.x * game.constants.OFFICE_WORLD_WIDTH * scale;
      const screenX = worldX - game.cameraOffsetX * scale;
      const w = box.w * game.constants.OFFICE_WORLD_WIDTH * scale;
      if (screenX + w < 0 || screenX > buffer.width) return;

      const y = box.y * buffer.height;
      const h = box.h * buffer.height;

      if (window.__FNAF_DEBUG_HITBOXES__) {
        ctx.save();
        ctx.strokeStyle = '#35ff9a';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, y, w, h);
        ctx.restore();
      }

      ctx.save();
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillText(doorId === 'esquerda' ? 'PORTA ESQUERDA' : 'PORTA DIREITA', screenX, Math.max(10, y - 4));
      ctx.restore();
    });

    // Inimigo parado bem na porta que você está olhando agora.
    for (const cfg of window.ENEMIES_CONFIG) {
      const state = game.enemies.getPublicState(cfg.id);
      if (state && state.node === `porta:${game.view}`) {
        const door = game.doors[game.view];
        if (door && !door.isClosed) {
          const img = assetLoader.getImage(`enemies.${cfg.id}.naPorta`);
          if (img) ctx.drawImage(img, 0, 0, buffer.width, buffer.height);
        }
      }
    }

    return [];
  }

  function renderCameraMonitor(ctx, buffer, assetLoader, game) {
    const roomId = game.cameras.currentRoomId;
    const bg = assetLoader.getImage(`cameras.${roomId}`);
    if (bg) {
      ctx.drawImage(bg, 0, 0, buffer.width, buffer.height);
    } else {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, buffer.width, buffer.height);
    }

    window.ENEMIES_CONFIG.forEach((cfg) => {
      const state = game.enemies.getPublicState(cfg.id);
      if (state && state.node === roomId) {
        const img = assetLoader.getImage(`enemies.${cfg.id}.${roomId}`);
        if (img) ctx.drawImage(img, 0, 0, buffer.width, buffer.height);
      }
    });

    return [];
  }

  function renderJumpscare(ctx, buffer, assetLoader, enemyId) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, buffer.width, buffer.height);
    const img = assetLoader.getImage(`enemies.${enemyId}.jumpscare`);
    if (img) ctx.drawImage(img, 0, 0, buffer.width, buffer.height);
    return [];
  }

  function drawStaticNoise(ctx, w, h, density) {
    const count = Math.max(0, Math.floor(density));
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const s = Math.random() < 0.5 ? 1 : 2;
      ctx.fillRect(x, y, s, s);
    }
    ctx.restore();
  }

  function updateHud({ powerPct, powerLow, clockLabel, nightLabel }) {
    const powerVal = document.getElementById('hud-power-value');
    const powerWrap = document.getElementById('hud-power');
    const clock = document.getElementById('hud-clock-value');
    const night = document.getElementById('hud-night-value');
    if (powerVal) powerVal.textContent = `${Math.round(powerPct)}%`;
    if (powerWrap) powerWrap.classList.toggle('low', !!powerLow);
    if (clock) clock.textContent = clockLabel;
    if (night) night.textContent = nightLabel;
  }

  function renderLeaderboard(el, highlightRank) {
    if (!el) return;
    const scores = window.Progression.getLeaderboard();
    el.innerHTML = scores.length
      ? scores
          .map((ms, i) => `<li class="${i + 1 === highlightRank ? 'highlight' : ''}">${window.Progression.formatTime(ms)}</li>`)
          .join('')
      : '<li class="empty">Nenhum registro ainda</li>';
  }

  return {
    hideAllScreens,
    showScreen,
    buildCameraTabs,
    setActiveCameraTab,
    syncControls,
    setDoorButtonsState,
    setEnemyOverlays,
    renderOffice,
    renderCameraMonitor,
    renderJumpscare,
    drawStaticNoise,
    updateHud,
    renderLeaderboard,
  };
})();

window.UI = UI;
