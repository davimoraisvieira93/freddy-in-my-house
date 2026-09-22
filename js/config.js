const ASSETS = {
  images: {
    // Um fundo por visão/estado. Cada arquivo é uma tela inteira (16:9, ex.: 1920×1080).
    // Enquanto o arquivo não existir, o jogo desenha um placeholder com o nome da chave.
    office: {
      centro:        'assets/images/office/centro.png',         // Visão 0 — computador
      portaAberta:   'assets/images/office/porta_aberta.png',   // Visão 1 — porta aberta
      portaFechada:  'assets/images/office/porta_fechada.png',  // Visão 1 — porta fechada
      janelaAberta:  'assets/images/office/janela_aberta.png',  // Visão 2 — janela aberta
      janelaFechada: 'assets/images/office/janela_fechada.png', // Visão 2 — janela fechada
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
        naJanela: 'assets/images/enemies/chica_na_janela.png', // NOVO — Chica ataca pela janela
        jumpscare: 'assets/images/enemies/chica_jumpscare.png',
      },
    },
    ui: {
      iconPower: 'assets/images/ui/icon_power.png',
      iconCamera: 'assets/images/ui/icon_camera.png',
      iconDoor: 'assets/images/ui/icon_door.png',
      iconLight: 'assets/images/ui/icon_light.png',
      buttonLuzLigada: 'assets/images/ui/button_luz_ligada.png',
      buttonLuzApagada: 'assets/images/ui/button_luz_apagada.png',
      buttonDoorOpen: 'assets/images/ui/button_door_open.png',
      buttonDoorClose: 'assets/images/ui/button_door_close.png',
      // Botão de ABRIR o monitor (fica em #btn-open-monitor, dentro de #office-controls)
      buttonCameraOpen: 'assets/images/ui/button_camera_open.png',
      // Botão de FECHAR o monitor (fica em #btn-close-monitor, dentro de #camera-monitor)
      buttonCameraClose: 'assets/images/ui/button_camera_close.png',
      // GIF mostrado na tela de vitória, quando o jogador passa de noite.
      gifNoiteCompleta: 'assets/images/ui/gif_noite_completa.gif',
    },
    // PNGs dos botões da tela de início (menu principal). Enquanto o arquivo
    // não existir, o botão continua funcionando normalmente com o texto
    // original (ver setButtonImage em ui.js) — só troca pra imagem quando o
    // PNG carregar com sucesso.
    menu: {
      background: 'assets/images/menu/menu_background.png',      // fundo da tela de início (a imagem que você mandou)
      buttonStart: 'assets/images/menu/button_start.png',         // "Começar Noite" / Novo Jogo
      buttonCustom: 'assets/images/menu/button_custom.png',       // Custom Night
      buttonInfinite: 'assets/images/menu/button_infinite.png',   // Modo Infinito
      buttonLeaderboard: 'assets/images/menu/button_leaderboard.png', // Ranking
      buttonExtras: 'assets/images/menu/button_extras.png',       // Extras (precisa de um botão #btn-extras no HTML)
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
// VIEWS — loop 360º com 3 visões fixas (índices 0, 1, 2).
//   virar à direita: 0 → 1 → 2 → 0 …      virar à esquerda: 0 → 2 → 1 → 0 …
//
//   id             identificador (game.view devolve isto)
//   doorId         qual porta de DOORS_CONFIG esta visão controla (null = nenhuma)
//   monitorButton  true = o botão "📺 Câmeras" aparece nesta visão.
//                  Pedido: só na Visão 1 (Porta). Para mudar, mova a flag.
//   backgrounds    chaves de ASSETS.images.* (open/closed seguem o estado da porta)
// -----------------------------------------------------------------------
const VIEWS = [
  {
    id: 'centro', label: 'Computador', doorId: null, monitorButton: true,
    backgrounds: { default: 'office.centro' },
  },
  {
    id: 'porta', label: 'Porta', doorId: 'porta',
    backgrounds: { open: 'office.portaAberta', closed: 'office.portaFechada' },
  },
  {
    id: 'janela', label: 'Janela', doorId: 'janela',
    backgrounds: { open: 'office.janelaAberta', closed: 'office.janelaFechada' },
  },
];
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

// A janela usa a mesma mecânica da porta (fechar/abrir, luz, dreno de energia).
const DOORS_CONFIG = [
  { id: 'porta', label: 'Porta' },
  { id: 'janela', label: 'Janela' },
];

// -----------------------------------------------------------------------
// DOOR_HITBOXES — agora em FRAÇÃO DA TELA (0–1), já que cada visão é uma
// imagem fixa: x/w = fração da largura, y/h = fração da altura.
// Servem para o rótulo "PORTA"/"JANELA", para o contorno de debug
// (H com o Modo Admin) e para posicionar o inimigo placeholder.
// -----------------------------------------------------------------------
const DOOR_HITBOXES = {
  porta:  { x: 0.30, y: 0.12, w: 0.40, h: 0.80 },
  janela: { x: 0.25, y: 0.18, w: 0.50, h: 0.55 },
};

// -----------------------------------------------------------------------
// ENEMIES_CONFIG — cada inimigo anda por um GRAFO de nós.
//   graph[nó] = próximos nós possíveis (escolha aleatória).
//   'entrada:<doorId>' = ponto de ataque (porta ou janela). Ali o inimigo bate
//   e ataca se a entrada continuar aberta (ver enemyAI.js).
//   lockNode (só o Freddy) = trava num cômodo com timer próprio.
//
// REGRA: todo nó precisa levar a uma 'entrada:*' (ou ser o lockNode).
// Nó com lista vazia = beco sem saída = inimigo que nunca ataca.
// main.js avisa no console se algum grafo violar isso.
// -----------------------------------------------------------------------
const ENEMIES_CONFIG = [
  // FREDDY — cam8 → (cam3 | cam5) → cam2 (trava). Ataca se a PORTA ficar aberta 20s.
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
    lockNode: { nodeId: 'cam2', timeoutMs: 20000, doorId: 'porta' },
  },

  // BONNIE — rota pela PORTA (Visão 1):
  //   cam8 → cam3 → (cam2 | cam4 → cam2) → entrada:porta
  {
    id: 'bonnie',
    label: 'Bonnie',
    startNode: 'cam8',
    graph: {
      cam8: ['cam3'],
      cam3: ['cam2', 'cam4'],
      cam4: ['cam2'],            // antes era [] (beco sem saída)
      cam2: ['entrada:porta'],
    },
  },

  // CHICA — rota fixa pela JANELA (Visão 2):
  //   cam8 → cam7 → cam6 → (cam1 | cam5) → entrada:janela
  // Os dois ramos terminam na janela, então ela sempre chega lá; o que muda
  // de uma noite para outra é a velocidade (agressão). Para mandá-la pela
  // porta, troque 'entrada:janela' por 'entrada:porta' nas duas linhas abaixo.
  {
    id: 'chica',
    label: 'Chica',
    startNode: 'cam8',
    graph: {
      cam8: ['cam7'],
      cam7: ['cam6'],
      cam6: ['cam1', 'cam5'],
      cam1: ['entrada:janela'],
      cam5: ['entrada:janela'],
    },
  },
];

// Bateria: o dreno base subiu (0.04 → 0.18/s) e o multiplicador cresce pouco
// entre as noites, então o aperto é grande desde a Noite 1.
const NIGHTS_CONFIG = [
  { label: 'Noite 1', aggression: { freddy: 1, bonnie: 1, chica: 1 }, powerDrainMultiplier: 1.0 },
  { label: 'Noite 2', aggression: { freddy: 2, bonnie: 2, chica: 2 }, powerDrainMultiplier: 1.0 },
  { label: 'Noite 3', aggression: { freddy: 3, bonnie: 4, chica: 3 }, powerDrainMultiplier: 1.05 },
  { label: 'Noite 4', aggression: { freddy: 5, bonnie: 5, chica: 5 }, powerDrainMultiplier: 1.1 },
  { label: 'Noite 5', aggression: { freddy: 6, bonnie: 7, chica: 7 }, powerDrainMultiplier: 1.15 },
];

const GAME_CONSTANTS = {
  HOURS_PER_NIGHT: 6,
  NIGHT_DURATION_MS: 5 * 60 * 1000,

  CAMERA_STATIC_FLASH_MS: 220,

  AI_TICK_INTERVAL_MS: 5000,
  AI_NOT_WATCHED_BONUS: 2,
  AI_NOT_WATCHED_THRESHOLD_MS: 15000,

  // Bateria (% por segundo). Noite de 300s com multiplicador 1.0:
  //   só o dreno base já come 0.18 × 300 = 54% da bateria.
  POWER_MAX: 100,
  POWER_DRAIN_BASE_PER_SEC: 0.18,              // era 0.04
  POWER_DRAIN_PER_DOOR_CLOSED_PER_SEC: 0.10,
  POWER_DRAIN_PER_LIGHT_ON_PER_SEC: 0.12,
  POWER_DRAIN_MONITOR_OPEN_PER_SEC: 0.16,
  POWER_LOW_WARNING_THRESHOLD: 20,

  DOOR_ATTACK_GRACE_MS: 4000,
  DOOR_KNOCK_RETREAT_MS: 3000,
  ENEMY_RETREAT_COOLDOWN_MS: 8000,

  // Motor visual
  INTERNAL_WIDTH: 480,
  INTERNAL_HEIGHT: 270,
  VIEW_TRANSITION_MS: 220,   // duração do giro entre visões (0 = corte seco)
  JITTER_MAX_PX: 1.5,        // tremida do feed das câmeras
  STATIC_NOISE_DENSITY: 45,  // pontinhos de ruído no escritório

  // Modo Infinito. O multiplicador caiu de 1.6 para 0.6: com o dreno base novo,
  // 1.6 esgotaria a bateria em ~5 min mesmo sem usar nada.
  INFINITE_START_LEVEL: 1,
  INFINITE_MAX_LEVEL: 10,
  INFINITE_RAMP_MS: 60 * 1000,
  INFINITE_POWER_MULT: 0.6,
};

window.ASSETS = ASSETS;
window.VIEWS = VIEWS;
window.ROOMS = ROOMS;
window.DOORS_CONFIG = DOORS_CONFIG;
window.DOOR_HITBOXES = DOOR_HITBOXES;
window.ENEMIES_CONFIG = ENEMIES_CONFIG;
window.NIGHTS_CONFIG = NIGHTS_CONFIG;
window.GAME_CONSTANTS = GAME_CONSTANTS;
