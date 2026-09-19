const ASSETS = {
  images: {
    office: {
      background: 'assets/images/office/background.png', // panorama largo (180°)
    },
    cameras: {
      cam1: 'assets/images/cameras/cam1.png',
      cam2: 'assets/images/cameras/cam2.png',
      cam3: 'assets/images/cameras/cam3.png',
      cam4: 'assets/images/cameras/cam4.png',
      cam5: 'assets/images/cameras/cam5.png',
      cam6: 'assets/images/cameras/cam6.png',
      cam7: 'assets/images/cameras/cam7.png',
      cam8: 'assets/images/cameras/cam8.png',
      static: 'assets/images/cameras/static.png',
    },
    enemies: {
      freddy: {
        cam8: 'assets/images/enemies/freddy_cam8.png',
        cam3: 'assets/images/enemies/freddy_cam3.png',
        cam5: 'assets/images/enemies/freddy_cam5.png',
        cam2: 'assets/images/enemies/freddy_cam2.png',
        jumpscare: 'assets/images/enemies/freddy_jumpscare.png',
      },
      bonnie: {
        cam8: 'assets/images/enemies/bonnie_cam8.png',
        cam3: 'assets/images/enemies/bonnie_cam3.png',
        cam2: 'assets/images/enemies/bonnie_cam2.png',
        cam4: 'assets/images/enemies/bonnie_cam4.png',
        naPorta: 'assets/images/enemies/bonnie_na_porta.png',
        jumpscare: 'assets/images/enemies/bonnie_jumpscare.png',
      },
      chica: {
        cam8: 'assets/images/enemies/chica_cam8.png',
        cam7: 'assets/images/enemies/chica_cam7.png',
        cam6: 'assets/images/enemies/chica_cam6.png',
        cam1: 'assets/images/enemies/chica_cam1.png',
        cam5: 'assets/images/enemies/chica_cam5.png',
        jumpscare: 'assets/images/enemies/chica_jumpscare.png',
      },
    },
    ui: {
      iconPower: 'assets/images/ui/icon_power.png',
      iconCamera: 'assets/images/ui/icon_camera.png',
      iconDoor: 'assets/images/ui/icon_door.png',
      iconLight: 'assets/images/ui/icon_light.png',
    },
  },

  audio: {
    ambience: 'assets/audio/ambience/ambience_loop.mp3',
    doorToggle: 'assets/audio/sfx/door_toggle.mp3',
    lightToggle: 'assets/audio/sfx/light_toggle.mp3',
    cameraStatic: 'assets/audio/sfx/camera_static.mp3',
    powerLow: 'assets/audio/sfx/power_low.mp3',
    blackout: 'assets/audio/sfx/blackout.mp3',
    knock: 'assets/audio/sfx/knock.mp3',
    jumpscare: 'assets/audio/sfx/jumpscare.mp3',
    victory: 'assets/audio/sfx/victory_6am.mp3',
    risada: 'assets/audio/sfx/risada.mp3',
    menuBeatbox: 'assets/audio/sfx/beatbox.mp3'
  },
};

// -----------------------------------------------------------------------
// VIEWS — NOVO. game.js lê window.VIEWS[this.viewIndex] e ui.js lê
// window.VIEWS.length; sem isso o "VIEWS is not defined" derruba o boot
// inteiro. A ordem tem que bater com viewIndex=1 sendo o centro (é onde
// startRun() sempre começa) e com os data-door="esquerda"/"direita" do HTML.
// -----------------------------------------------------------------------
const VIEWS = ['esquerda', 'centro', 'direita'];

const ROOMS = [
  { id: 'cam1', label: 'Câm. 1' },
  { id: 'cam2', label: 'Câm. 2' },
  { id: 'cam3', label: 'Câm. 3' },
  { id: 'cam4', label: 'Câm. 4' },
  { id: 'cam5', label: 'Câm. 5' },
  { id: 'cam6', label: 'Câm. 6' },
  { id: 'cam7', label: 'Câm. 7' },
  { id: 'cam8', label: 'Câm. 8' },
];

const DOORS_CONFIG = [
  { id: 'esquerda', label: 'Porta Esquerda' },
  { id: 'direita', label: 'Porta Direita' },
];

// -----------------------------------------------------------------------
// DOOR_HITBOXES — NOVO. ui.js (renderOffice) lê window.DOOR_HITBOXES[door.id]
// e espera { x, y, w, h } como FRAÇÕES (0–1): x/w são fração de
// GAME_CONSTANTS.OFFICE_WORLD_WIDTH (o panorama de 1440px inteiro, não a
// tela), y/h são fração de INTERNAL_HEIGHT (270px).
//
// Os valores abaixo são um ponto de partida funcional — cada porta cai
// dentro do terço do mundo que corresponde à sua VIEW (esquerda: 0–480px,
// direita: 960–1440px) — mas o alinhamento fino com o seu background.png
// é visual: ajuste x/y/w/h olhando o jogo rodando até a hitbox (e o texto
// da porta, desenhado por cima dela) encaixar no sprite.
// -----------------------------------------------------------------------
const DOOR_HITBOXES = {
  esquerda: { x: 0.08, y: 0.30, w: 0.14, h: 0.55 },
  direita:  { x: 0.78, y: 0.30, w: 0.14, h: 0.55 },
};

// Cada inimigo agora usa um GRAFO de nós (não mais uma lista linear).
// graph[nó] = lista de próximos nós possíveis (escolha aleatória entre eles).
// Um nó 'porta:<id>' é uma porta de verdade (ataque clássico).
// lockNode (só o Freddy usa) trava o inimigo num cômodo com uma mecânica
// própria, resolvida por Enemy.updateLock() a cada frame (não por tick de IA).
const ENEMIES_CONFIG = [
  {
    id: 'freddy',
    label: 'Freddy',
    startNode: 'cam8',
    graph: {
      cam8: ['cam3', 'cam5'],
      cam3: ['cam2'],
      cam5: ['cam2'],
      cam2: [],
    },
    onMoveSfx: 'risada',
    lockNode: { nodeId: 'cam2', timeoutMs: 20000, doorId: 'esquerda' },
  },
  {
    id: 'bonnie',
    label: 'Bonnie',
    startNode: 'cam8',
    graph: {
      cam8: ['cam3'],
      cam3: ['cam2', 'cam4'],
      cam2: ['porta:esquerda'],
      cam4: [],
    },
  },
  {
    id: 'chica',
    label: 'Chica',
    startNode: 'cam8',
    graph: {
      cam8: ['cam7'],
      cam7: ['cam6'],
      cam6: ['cam1', 'cam5'],
      cam1: [],
      cam5: [],
    },
  },
];

const NIGHTS_CONFIG = [
  { label: 'Noite 1', aggression: { freddy: 1, bonnie: 1, chica: 1 }, powerDrainMultiplier: 1.0 },
  { label: 'Noite 2', aggression: { freddy: 2, bonnie: 2, chica: 2 }, powerDrainMultiplier: 1.1 },
  { label: 'Noite 3', aggression: { freddy: 3, bonnie: 4, chica: 3 }, powerDrainMultiplier: 1.2 },
  { label: 'Noite 4', aggression: { freddy: 5, bonnie: 5, chica: 5 }, powerDrainMultiplier: 1.35 },
  { label: 'Noite 5', aggression: { freddy: 6, bonnie: 7, chica: 7 }, powerDrainMultiplier: 1.5 },
];

const GAME_CONSTANTS = {
  HOURS_PER_NIGHT: 6,
  NIGHT_DURATION_MS: 5 * 60 * 1000,

  CAMERA_STATIC_FLASH_MS: 220,

  AI_TICK_INTERVAL_MS: 5000,
  AI_NOT_WATCHED_BONUS: 2,
  AI_NOT_WATCHED_THRESHOLD_MS: 15000,

  POWER_MAX: 100,
  POWER_DRAIN_BASE_PER_SEC: 0.04,
  POWER_DRAIN_PER_DOOR_CLOSED_PER_SEC: 0.10,
  POWER_DRAIN_PER_LIGHT_ON_PER_SEC: 0.12,
  POWER_DRAIN_MONITOR_OPEN_PER_SEC: 0.16,
  POWER_LOW_WARNING_THRESHOLD: 20,

  DOOR_ATTACK_GRACE_MS: 4000,
  DOOR_KNOCK_RETREAT_MS: 3000,
  ENEMY_RETREAT_COOLDOWN_MS: 8000,

  // Motor visual (tela cheia, pan 180°, estética VHS)
  INTERNAL_WIDTH: 480,
  INTERNAL_HEIGHT: 270,
  OFFICE_WORLD_WIDTH: 1440, // panorama 3x mais largo que a tela = visão de 180°
  MONITOR_CENTER_MARGIN: 160, // faixa central (em px do mundo) onde dá pra abrir o monitor
  MOUSE_PAN_SMOOTHING: 0.12,
  JITTER_MAX_PX: 1.5,
  STATIC_NOISE_DENSITY: 45,

  // NOVO — game.js faz cameraOffsetX += (target - offset) * VIEW_SMOOTHING
  // a cada frame. Sem essa chave o resultado é NaN e o escritório some da
  // tela ao virar (mas o boot em si não trava, por isso passava despercebido).
  VIEW_SMOOTHING: 0.15,

  // NOVO — game.js._currentNight() usa estas 4 chaves só quando mode==='infinite'
  // (botão "Modo Infinito", liberado após terminar a Noite 5). Sem elas, o
  // nível vira NaN assim que alguém entra nesse modo. Ajuste a progressão
  // como quiser; estes são valores de partida razoáveis.
  INFINITE_START_LEVEL: 1,
  INFINITE_MAX_LEVEL: 10,
  INFINITE_RAMP_MS: 60 * 1000,   // sobe 1 nível de agressão a cada 60s
  INFINITE_POWER_MULT: 1.6,
};

window.ASSETS = ASSETS;
window.VIEWS = VIEWS;
window.ROOMS = ROOMS;
window.DOORS_CONFIG = DOORS_CONFIG;
window.DOOR_HITBOXES = DOOR_HITBOXES;
window.ENEMIES_CONFIG = ENEMIES_CONFIG;
window.NIGHTS_CONFIG = NIGHTS_CONFIG;
window.GAME_CONSTANTS = GAME_CONSTANTS;
