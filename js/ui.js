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
  const css = `
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
