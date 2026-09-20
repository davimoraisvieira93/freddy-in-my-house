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

    // Modo Admin (js/admin.js) liga isto via window.game.godMode = true;
    // enquanto ativo, jumpscares são ignorados (o inimigo só reseta).
    this.godMode = false;

    this.viewIndex = 1;
    this.cameraOffsetX = this._viewOffset(1);
    this.targetOffsetX = this._viewOffset(1);

    UI.buildCameraTabs(window.ROOMS, (roomId) => this.switchCameraRoom(roomId));
    this._resizeCanvas();
    this._setupInputs();
  }

  get view() { return window.VIEWS[this.viewIndex]; }
  _viewOffset(i) { return i * this.constants.INTERNAL_WIDTH; }

  _resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.imageSmoothingEnabled = false;
  }

  _setupInputs() {
    window.addEventListener('resize', () => this._resizeCanvas());

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="turn"]');
      if (btn) this.turn(Number(btn.dataset.dir));
    });
  }

  turn(dir) {
    if (this.state !== 'playing' || this.cameras.isOpen || this.power.isBlackedOut) return;
    const next = Math.min(window.VIEWS.length - 1, Math.max(0, this.viewIndex + dir));
    if (next === this.viewIndex) return;
    this.viewIndex = next;
    this.targetOffsetX = this._viewOffset(next);
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

    this.viewIndex = 1;
    this.cameraOffsetX = this.targetOffsetX = this._viewOffset(1);

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
    requestAnimationFrame((t) => this.loop(t));
  }

  startNight(nightIndex) { this.startRun({ mode: 'story', nightIndex }); }
  restart() { this.startRun(this.lastRun); }

  _currentNight() {
    const c = this.constants;
    if (this.mode === 'custom') {
      return { label: 'Custom Night', aggression: this.customLevels, powerDrainMultiplier: 1.2 };
    }
    if (this.mode === 'infinite') {
      const level = Math.min(
        c.INFINITE_MAX_LEVEL,
        c.INFINITE_START_LEVEL + Math.floor(this.elapsedNightMs / c.INFINITE_RAMP_MS),
      );
      const aggression = Object.fromEntries(window.ENEMIES_CONFIG.map((e) => [e.id, level]));
      return { label: 'Modo Infinito', aggression, powerDrainMultiplier: c.INFINITE_POWER_MULT };
    }
    return window.NIGHTS_CONFIG[this.nightIndex];
  }

  _canActOnDoor(doorId) {
    return this.state === 'playing'
      && !this.power.isBlackedOut
      && !this.cameras.isOpen
      && this.view === doorId;
  }

  toggleDoor(doorId) {
    if (!this._canActOnDoor(doorId)) return;
    this.doors[doorId].toggleClosed();
    this.assetLoader.playSfx('doorToggle');
    UI.setDoorButtonsState(this.doors);
  }

  toggleLight(doorId) {
    if (!this._canActOnDoor(doorId)) return;
    this.doors[doorId].toggleLight();
    this.assetLoader.playSfx('lightToggle');
    UI.setDoorButtonsState(this.doors);
  }

  toggleMonitor() {
    if (this.state !== 'playing' || this.power.isBlackedOut) return;
    if (!this.cameras.isOpen && this.view !== 'centro') return;

    const isOpen = this.cameras.toggle(true);
    document.getElementById('camera-monitor').classList.toggle('hidden', !isOpen);
    document.getElementById('office-controls').classList.toggle('hidden', isOpen);
    if (isOpen) {
      this.assetLoader.playSfx('cameraStatic', { volume: 0.4 });
      UI.setActiveCameraTab(this.cameras.currentRoomId);
    }
    UI.syncControls(this);
  }

  switchCameraRoom(roomId) {
    if (this.state !== 'playing' || !this.cameras.isOpen) return;
    this.cameras.switchRoom(roomId);
    this.assetLoader.playSfx('cameraStatic', { volume: 0.25 });
    UI.setActiveCameraTab(roomId);
  }

  _onBlackout() {
    Object.values(this.doors).forEach((d) => { d.isClosed = false; d.lightOn = false; });
    this.cameras.close();
    document.getElementById('camera-monitor').classList.add('hidden');
    document.getElementById('office-controls').classList.add('hidden');
    this.assetLoader.playSfx('blackout');
    UI.syncControls(this);
  }

  _triggerJumpscare(enemyId) {
    // Modo Admin: god mode ignora o ataque e só reseta os inimigos.
    if (this.godMode) {
      this.enemies.reset();
      return;
    }

    this.state = 'jumpscare';
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

    const deltaMs = Math.min(now - this.lastFrameTime, 200);
    this.lastFrameTime = now;
    this.elapsedNightMs += deltaMs;

    this.cameraOffsetX += (this.targetOffsetX - this.cameraOffsetX) * this.constants.VIEW_SMOOTHING;

    const night = this._currentNight();

    const lockedJumpscare = this.enemies.updateLocks(deltaMs, this.doors, this.cameras);
    if (lockedJumpscare) { this._triggerJumpscare(lockedJumpscare); return; }

    this.power.tick(deltaMs / 1000, Object.values(this.doors), this.cameras.isOpen, night.powerDrainMultiplier);

    this.aiTickAccumulator += deltaMs;
    while (this.aiTickAccumulator >= this.constants.AI_TICK_INTERVAL_MS) {
      this.aiTickAccumulator -= this.constants.AI_TICK_INTERVAL_MS;
      const jumpscaredBy = this.enemies.tickAll({
        doors: this.doors,
        cameraSystem: this.cameras,
        nightAggression: night.aggression,
        constants: this.constants,
        tickIntervalMs: this.constants.AI_TICK_INTERVAL_MS,
        assetLoader: this.assetLoader,
      });
      if (jumpscaredBy) { this._triggerJumpscare(jumpscaredBy); return; }
    }

    if (this.mode !== 'infinite' && this.elapsedNightMs >= this.constants.NIGHT_DURATION_MS) {
      this._onVictory(); return;
    }

    this.bufferCtx.clearRect(0, 0, this.buffer.width, this.buffer.height);
    const overlays = this.cameras.isOpen
      ? UI.renderCameraMonitor(this.bufferCtx, this.buffer, this.assetLoader, this)
      : UI.renderOffice(this.bufferCtx, this.buffer, this.assetLoader, this);
    UI.drawStaticNoise(this.bufferCtx, this.buffer.width, this.buffer.height, this.constants.STATIC_NOISE_DENSITY);
    this._blitBuffer();
    UI.setEnemyOverlays(overlays);

    const clockLabel = this.mode === 'infinite'
      ? window.Progression.formatTime(this.elapsedNightMs)
      : this._formatClock((this.elapsedNightMs / this.constants.NIGHT_DURATION_MS) * this.constants.HOURS_PER_NIGHT);

    UI.updateHud({
      powerPct: this.power.percentage,
      powerLow: this.power.isLow(),
      clockLabel,
      nightLabel: night.label,
    });

    requestAnimationFrame((t) => this.loop(t));
  }

  _formatClock(hourFloat) {
    const h = Math.floor(hourFloat);
    return `${h === 0 ? 12 : h}:00 AM`;
  }
}

window.Game = Game;
