class Game {
  constructor(canvas, assetLoader) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.assetLoader = assetLoader;
    this.constants = window.GAME_CONSTANTS;

    this.buffer = document.createElement('canvas');
    this.buffer.width = this.constants.INTERNAL_WIDTH;
    this.buffer.height = this.constants.INTERNAL_HEIGHT;
    this.bufferCtx = this.buffer.getContext('2d');
    this.bufferCtx.imageSmoothingEnabled = false;

    this.doors = createDoors(window.DOORS_CONFIG);
    this.power = new PowerSystem(this.constants, () => this._onBlackout());
    this.cameras = new CameraSystem(window.ROOMS);
    this.enemies = new EnemyManager(window.ENEMIES_CONFIG);

    this.mode = 'story';
    this.lastRun = { mode: 'story', nightIndex: 0, levels: null };
    this.customLevels = {};
    this.nightIndex = 0;
    this.state = 'menu';
    this.elapsedNightMs = 0;
    this.aiTickAccumulator = 0;
    this.lastFrameTime = 0;
    this._raf = null;

    // Modo Admin (js/admin.js) liga isto via window.game.godMode = true;
    // enquanto ativo, jumpscares são ignorados (o inimigo só reseta).
    this.godMode = false;

    // Loop 360º de visões fixas (ver VIEWS em config.js):
    // 0 = Centro (computador), 1 = Porta, 2 = Janela.
    this.viewIndex = 0;
    this.slide = null; // { from, to, dir, t } enquanto o giro está animando

    // Tablet de reboot das câmeras (só abre na visão com `tablet: true`).
    this.tabletOpen = false;
    // Freddy dentro da sala: { noMaskMs, maskMs } enquanto acontece, senão null.
    this.freddyEncounter = null;
    this.maskOn = false;

    UI.buildCameraTabs(window.ROOMS, (roomId) => this.switchCameraRoom(roomId));
    UI.applyMonitorButtonIcons();
    UI.applyTabletMaskIcons();
    this._resizeCanvas();
    this._setupInputs();
  }

  get viewDef() { return window.VIEWS[this.viewIndex]; }
  get view() { return this.viewDef.id; }

  _resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.imageSmoothingEnabled = false;
  }

  _setupInputs() {
    window.addEventListener('resize', () => this._resizeCanvas());

    // Setas de virar: agem ao passar o mouse (uma vez por entrada).
    // pointerenter não borbulha, por isso o listener é de captura no document.
    document.addEventListener('pointerenter', (e) => {
      const btn = e.target.closest && e.target.closest('[data-action="turn"]');
      if (btn) UI.hoverAct(() => this.turn(Number(btn.dataset.dir)));
    }, true);
  }

  /** Liga/desliga o filtro CSS do monitor (classe .cam-feed, definida em ui.js). */
  _setCameraFeed(on) {
    this.canvas.classList.toggle('cam-feed', !!on);
  }

  /** dir > 0 = virar à direita, dir < 0 = virar à esquerda. Dá a volta (0→1→2→0). */
  turn(dir) {
    if (this.state !== 'playing' || this.cameras.isOpen || this.power.isBlackedOut || this.slide) return;
    if (this.tabletOpen || this.freddyEncounter) return;
    const n = window.VIEWS.length;
    const step = dir > 0 ? 1 : -1;
    const from = this.viewIndex;
    const to = (from + step + n) % n;

    this.viewIndex = to;
    if (this.constants.VIEW_TRANSITION_MS > 0) {
      this.slide = { from, to, dir: step, t: 0 };
    }
    UI.syncControls(this);
  }

  startRun({ mode = 'story', nightIndex = 0, levels = null } = {}) {
    this.mode = mode;
    this.lastRun = { mode, nightIndex, levels };
    this.nightIndex = Math.min(nightIndex, window.NIGHTS_CONFIG.length - 1);
    this.customLevels = levels || {};
    this.elapsedNightMs = 0;
    this.aiTickAccumulator = 0;

    Object.values(this.doors).forEach((d) => d.reset());
    this.power.reset();
    this.cameras.reset();
    this.enemies.reset();

    this.viewIndex = 0;
    this.slide = null;
    this.tabletOpen = false;
    this.freddyEncounter = null;
    this.maskOn = false;
    UI.hideExtraOverlays();
    this._setCameraFeed(false);

    this.state = 'playing';
    this.lastFrameTime = performance.now();

    UI.hideAllScreens();
    UI.setEnemyOverlays([]);
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('office-controls').classList.remove('hidden');
    document.getElementById('camera-monitor').classList.add('hidden');
    UI.setDoorButtonsState(this.doors);
    UI.syncControls(this);

    this.assetLoader.playSfx('ambience', { loop: true, volume: 0.5 });

    // Sempre um único loop: pular de noite pelo Admin com o jogo rodando
    // antes criava um segundo requestAnimationFrame (tudo em dobro).
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame((t) => this.loop(t));
  }

  startNight(nightIndex) { this.startRun({ mode: 'story', nightIndex }); }
  restart() { this.startRun(this.lastRun); }

  _currentNight() {
    const c = this.constants;
    if (this.mode === 'custom') {
      // Rótulo do HUD (só aparece durante a partida, via updateHud); a tela
      // de vitória continua chamando isso de "Custom Night".
      return { label: 'Noite 7', aggression: this.customLevels, powerDrainMultiplier: 1.2 };
    }
    if (this.mode === 'infinite') {
      const level = Math.min(
        c.INFINITE_MAX_LEVEL,
        c.INFINITE_START_LEVEL + Math.floor(this.elapsedNightMs / c.INFINITE_RAMP_MS),
      );
      const aggression = Object.fromEntries(window.ENEMIES_CONFIG.map((e) => [e.id, level]));
      return { label: 'Modo Infinito', aggression, powerDrainMultiplier: c.INFINITE_POWER_MULT };
    }
    // Campanha: nível-base da noite + bônus por hora (como no FNAF 1).
    const base = window.NIGHTS_CONFIG[this.nightIndex];
    const hourMs = c.NIGHT_DURATION_MS / c.HOURS_PER_NIGHT;
    const hour = Math.floor(this.elapsedNightMs / hourMs);
    const aggression = { ...base.aggression };
    for (const [id, hours] of Object.entries(window.HOURLY_BUMPS || {})) {
      aggression[id] = (aggression[id] || 0) + hours.filter((h) => hour >= h).length;
    }
    return { ...base, aggression };
  }

  /** Só dá pra mexer na porta/janela da visão em que o jogador está olhando. */
  _canActOnDoor(doorId) {
    return !!doorId
      && this.state === 'playing'
      && !this.power.isBlackedOut
      && !this.cameras.isOpen
      && this.viewDef.doorId === doorId
      && !!this.doors[doorId];
  }

  toggleDoor(doorId) {
    if (!this._canActOnDoor(doorId)) return;
    this.doors[doorId].toggleClosed();
    this.assetLoader.playSfx('doorToggle');
    UI.setDoorButtonsState(this.doors);
  }

  toggleMonitor() {
    if (this.state !== 'playing' || this.power.isBlackedOut) return;
    if (this.freddyEncounter || this.tabletOpen) return;
    // Abrir só na visão marcada com monitorButton (Computador). Fechar vale em qualquer caso.
    if (!this.cameras.isOpen && !this.viewDef.monitorButton) return;

    // BUG CORRIGIDO: antes era `this.cameras.toggle(true)`, que SEMPRE abre —
    // por isso o "✕ Fechar Monitor" (e o Espaço) nunca fechavam nada.
    const isOpen = this.cameras.toggle();

    this.slide = null;
    document.getElementById('camera-monitor').classList.toggle('hidden', !isOpen);
    document.getElementById('office-controls').classList.toggle('hidden', isOpen);
    this._setCameraFeed(isOpen);

    if (isOpen) {
      UI.triggerCameraFlash();
      this.assetLoader.playSfx('cameraStatic', { volume: 0.4 });
      UI.setActiveCameraTab(this.cameras.currentRoomId);
    }
    UI.syncControls(this);
  }

  /** Abre/fecha o tablet de reboot. Só abre na visão com `tablet: true` (Sistema). */
  toggleTablet() {
    if (this.state !== 'playing' || this.power.isBlackedOut || this.freddyEncounter) return;
    if (this.cameras.isOpen) return;
    if (!this.tabletOpen && !this.viewDef.tablet) return;

    this.tabletOpen = !this.tabletOpen;
    this.slide = null;
    UI.setTabletVisible(this.tabletOpen);
    document.getElementById('office-controls').classList.toggle('hidden', this.tabletOpen);
    if (this.tabletOpen) this.assetLoader.playSfx('cameraStatic', { volume: 0.25 });
    UI.syncControls(this);
  }

  /** Botão "Reiniciar câmeras" do tablet. */
  rebootCameras() {
    if (this.state !== 'playing' || !this.tabletOpen) return;
    if (this.cameras.startReboot()) {
      this.assetLoader.playSfx('cameraStatic', { volume: 0.4 });
    }
  }

  /** Coloca/tira a máscara. Só faz sentido com o Freddy na sala. */
  toggleMask() {
    if (this.state !== 'playing' || !this.freddyEncounter) return;
    if (this.view !== 'porta') return; // a máscara só existe na vista da porta
    this.maskOn = !this.maskOn;
    UI.setMask(this.maskOn);
    UI.syncControls(this);
  }

  /** Freddy entrou: puxa o jogador para a vista da porta e começa a contagem. */
  _startFreddyEncounter(enemyId) {
    this.freddyEncounter = { id: enemyId, noMaskMs: 0, maskMs: 0 };
    this.maskOn = false;
    UI.setMask(false);

    if (this.cameras.isOpen) {
      this.cameras.close();
      this._setCameraFeed(false);
      document.getElementById('camera-monitor').classList.add('hidden');
    }
    if (this.tabletOpen) {
      this.tabletOpen = false;
      UI.setTabletVisible(false);
    }
    if (!this.power.isBlackedOut) {
      document.getElementById('office-controls').classList.remove('hidden');
    }

    // Vai direto para a vista da porta, pelo caminho mais curto.
    const views = window.VIEWS;
    const to = views.findIndex((v) => v.id === 'porta');
    const from = this.viewIndex;
    if (to >= 0 && to !== from) {
      const n = views.length;
      const forward = (to - from + n) % n;
      this.viewIndex = to;
      this.slide = this.constants.VIEW_TRANSITION_MS > 0
        ? { from, to, dir: forward <= n / 2 ? 1 : -1, t: 0 }
        : null;
    }
    this.assetLoader.playSfx('risada', { volume: 0.7 });
    UI.syncControls(this);
  }

  /** Retorna true se o Freddy acabou de fazer o jumpscare. */
  _updateFreddyEncounter(deltaMs) {
    const enc = this.freddyEncounter;
    if (!enc) return false;
    const c = this.constants;

    if (this.maskOn) {
      enc.noMaskMs = 0;
      enc.maskMs += deltaMs;
      if (enc.maskMs >= c.FREDDY_LEAVE_MS) {
        // Freddy desiste e volta ao começo da rota.
        this.freddyEncounter = null;
        this.maskOn = false;
        UI.setMask(false);
        this.enemies.release(enc.id, c.ENEMY_RETREAT_COOLDOWN_MS);
        UI.syncControls(this);
      }
      return false;
    }

    enc.maskMs = 0;
    enc.noMaskMs += deltaMs;
    if (enc.noMaskMs >= c.FREDDY_MASK_GRACE_MS) {
      const id = enc.id;
      this.freddyEncounter = null;
      return this._triggerJumpscare(id);
    }
    return false;
  }

  switchCameraRoom(roomId) {
    if (this.state !== 'playing' || !this.cameras.isOpen) return;
    this.cameras.switchRoom(roomId);
    UI.triggerCameraFlash();
    this.assetLoader.playSfx('cameraStatic', { volume: 0.25 });
    UI.setActiveCameraTab(roomId);
  }

  _onBlackout() {
    Object.values(this.doors).forEach((d) => { d.isClosed = false; });
    this.cameras.close();
    this.tabletOpen = false;
    UI.setTabletVisible(false);
    this._setCameraFeed(false);
    document.getElementById('camera-monitor').classList.add('hidden');
    document.getElementById('office-controls').classList.add('hidden');
    this.assetLoader.playSfx('blackout');
    UI.syncControls(this);
  }

  /** Retorna true se o jumpscare realmente aconteceu (false no god mode). */
  _triggerJumpscare(enemyId) {
    // Modo Admin: god mode ignora o ataque e só reseta os inimigos.
    if (this.godMode) {
      this.enemies.reset();
      this.freddyEncounter = null;
      this.maskOn = false;
      UI.setMask(false);
      UI.syncControls(this);
      return false;
    }

    this.state = 'jumpscare';
    this.freddyEncounter = null;
    this.maskOn = false;
    this.tabletOpen = false;
    UI.hideExtraOverlays();
    this._setCameraFeed(false);
    const overlays = UI.renderJumpscare(this.bufferCtx, this.buffer, this.assetLoader, enemyId);
    this._blitBuffer();
    UI.setEnemyOverlays(overlays);
    this.assetLoader.playSfx('jumpscare', { volume: 1 });
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('office-controls').classList.add('hidden');
    document.getElementById('camera-monitor').classList.add('hidden');

    let result = null;
    if (this.mode === 'infinite') {
      const ms = this.elapsedNightMs;
      result = { ms, rank: window.Progression.addScore(ms) };
    }
    setTimeout(() => this._onGameOver(result), 2200);
    return true;
  }

  _onGameOver(result) {
    this.state = 'gameover';
    UI.setEnemyOverlays([]);

    const box = document.getElementById('gameover-infinite');
    if (box) {
      box.classList.toggle('hidden', !result);
      if (result) {
        document.getElementById('gameover-time').textContent =
          `Você sobreviveu ${window.Progression.formatTime(result.ms)}`;
        document.getElementById('gameover-rank').textContent =
          result.rank ? `Nova marca: #${result.rank} no ranking!` : '';
        UI.renderLeaderboard(document.getElementById('gameover-leaderboard'), result.rank);
      }
    }
    UI.showScreen('gameover-screen');
  }

  _onVictory() {
    this.state = 'victory';
    this.freddyEncounter = null;
    this.maskOn = false;
    this.tabletOpen = false;
    UI.hideExtraOverlays();
    this._setCameraFeed(false);
    UI.setEnemyOverlays([]);
    this.assetLoader.playSfx('victory');

    const isStory = this.mode === 'story';
    const isLast = isStory && this.nightIndex >= window.NIGHTS_CONFIG.length - 1;
    let title;

    if (isStory) {
      title = isLast
        ? 'Você sobreviveu a todas as noites!'
        : `${window.NIGHTS_CONFIG[this.nightIndex].label} concluída — são 6 da manhã!`;
      if (isLast && window.Progression.unlock()) {
        title += ' Custom Night e Modo Infinito liberados!';
      }
      if (isLast && window.refreshMenu) window.refreshMenu();
    } else {
      title = 'Custom Night concluída — são 6 da manhã!';
    }

    document.getElementById('victory-title').textContent = title;
    document.getElementById('btn-next-night').classList.toggle('hidden', !isStory || isLast);
    UI.setVictoryGif((window.ASSETS.images.ui || {}).gifNoiteCompleta);
    UI.showScreen('victory-screen');
  }

  _blitBuffer() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(
      this.buffer, 0, 0, this.buffer.width, this.buffer.height,
      0, 0, this.canvas.width, this.canvas.height,
    );
  }

  loop(now) {
    if (this.state !== 'playing') return;

    const deltaMs = Math.max(0, Math.min(now - this.lastFrameTime, 200));
    this.lastFrameTime = now;
    this.elapsedNightMs += deltaMs;

    // Animação do giro entre visões.
    if (this.slide) {
      this.slide.t += deltaMs / this.constants.VIEW_TRANSITION_MS;
      if (this.slide.t >= 1) this.slide = null;
    }

    const night = this._currentNight();

    // Sistema de câmeras: cai sozinho; o reboot avança aqui.
    this.cameras.update(deltaMs);

    const lock = this.enemies.updateLocks(deltaMs, this.doors);
    if (lock) {
      if (lock.type === 'intrude') this._startFreddyEncounter(lock.id);
      else if (this._triggerJumpscare(lock.id)) return;
    }
    if (this._updateFreddyEncounter(deltaMs)) return;

    const extraDrain = this.tabletOpen ? this.constants.POWER_DRAIN_TABLET_PER_SEC : 0;
    this.power.tick(
      deltaMs / 1000, Object.values(this.doors), this.cameras.isOpen,
      night.powerDrainMultiplier, extraDrain,
    );

    // Cada inimigo tem o próprio intervalo de movimento (ver moveIntervalMs).
    this.enemies.tickAll({
      deltaMs,
      nightAggression: night.aggression,
      assetLoader: this.assetLoader,
      defaultIntervalMs: this.constants.AI_TICK_INTERVAL_MS,
    });

    if (this.mode !== 'infinite' && this.elapsedNightMs >= this.constants.NIGHT_DURATION_MS) {
      this._onVictory(); return;
    }

    this.bufferCtx.clearRect(0, 0, this.buffer.width, this.buffer.height);
    const overlays = this.cameras.isOpen
      ? UI.renderCameraMonitor(this.bufferCtx, this.buffer, this.assetLoader, this)
      : UI.renderOffice(this.bufferCtx, this.buffer, this.assetLoader, this);
    // O monitor já desenha o próprio ruído (mais forte); o escritório usa o leve.
    if (!this.cameras.isOpen) {
      UI.drawStaticNoise(this.bufferCtx, this.buffer.width, this.buffer.height, this.constants.STATIC_NOISE_DENSITY);
    }
    this._blitBuffer();
    UI.setEnemyOverlays(overlays);
    if (this.tabletOpen) UI.updateTablet(this.cameras);

    const clockLabel = this.mode === 'infinite'
      ? window.Progression.formatTime(this.elapsedNightMs)
      : this._formatClock((this.elapsedNightMs / this.constants.NIGHT_DURATION_MS) * this.constants.HOURS_PER_NIGHT);

    UI.updateHud({
      powerPct: this.power.percentage,
      powerLow: this.power.isLow(),
      clockLabel,
      nightLabel: night.label,
    });

    this._raf = requestAnimationFrame((t) => this.loop(t));
  }

  _formatClock(hourFloat) {
    const h = Math.floor(hourFloat);
    return `${h === 0 ? 12 : h}:00 AM`;
  }
}

window.Game = Game;
