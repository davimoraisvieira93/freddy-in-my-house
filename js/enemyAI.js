/* js/enemyAI.js
 * Cada inimigo anda por um GRAFO (ENEMIES_CONFIG[i].graph). A cada tick de
 * IA (tickAll, chamado a cada AI_TICK_INTERVAL_MS) ele tem uma chance de
 * mover para um dos próximos nós, proporcional à agressão da noite (escala
 * 0-20, teto clássico do FNAF).
 *
 * Dois nós são especiais e são resolvidos a cada FRAME (updateLocks), não a
 * cada tick de IA, porque dependem de o jogador reagir a tempo:
 *
 *  - 'entrada:<doorId>' -> o inimigo está encostado na porta OU na janela
 *    (ambas são "doors" em DOORS_CONFIG). Se a entrada continuar aberta por
 *    DOOR_ATTACK_GRACE_MS, ele ataca (retorna o id do inimigo, que o game.js
 *    usa pra disparar o jumpscare). Se for fechada a tempo, ele bate (SFX
 *    'knock') e desiste depois de DOOR_KNOCK_RETREAT_MS, voltando ao início
 *    da rota com um cooldown (ENEMY_RETREAT_COOLDOWN_MS) antes de tentar de novo.
 *
 *  - lockNode (só o Freddy usa, via ENEMIES_CONFIG) -> ele trava num cômodo
 *    específico. Enquanto a porta associada (lockNode.doorId) estiver aberta,
 *    o timer sobe; se chegar em lockNode.timeoutMs, ataca. Fechar a porta
 *    zera o timer (mecânica clássica do Freddy).
 */
const ENTRY_PREFIX = 'entrada:';

class Enemy {
  constructor(cfg) {
    this.id = cfg.id;
    this.cfg = cfg;
    this.reset();
  }

  reset() {
    this.node = this.cfg.startNode;
    this.doorTimer = null;
    this.lockTimer = 0;
    this.cooldownMs = 0;
    this.tickAcc = 0;
  }
}

// Nó especial: o inimigo está DENTRO da sala (só o Freddy, ver game.js).
const INSIDE_NODE = 'sala';

class EnemyManager {
  constructor(config) {
    this.config = config;
    this.list = config.map((cfg) => new Enemy(cfg));
  }

  /** 'porta' -> 'entrada:porta' */
  static entryNode(doorId) { return ENTRY_PREFIX + doorId; }

  /** 'entrada:janela' -> 'janela'; qualquer outro nó -> null */
  static entryDoorId(node) {
    return typeof node === 'string' && node.startsWith(ENTRY_PREFIX)
      ? node.slice(ENTRY_PREFIX.length)
      : null;
  }

  reset() {
    this.list.forEach((e) => e.reset());
  }

  /** Estado público de um inimigo (usado pela UI pra saber o que desenhar). */
  getPublicState(id) {
    const e = this.list.find((x) => x.id === id);
    return e ? { node: e.node, entryDoorId: EnemyManager.entryDoorId(e.node) } : null;
  }

  /** O inimigo entra na sala (Freddy). Fica parado até game.js liberá-lo. */
  intrude(id) {
    const e = this.list.find((x) => x.id === id);
    if (!e) return;
    e.node = INSIDE_NODE;
    e.doorTimer = null;
    e.lockTimer = 0;
  }

  /** O inimigo vai embora: volta ao início da rota e espera um cooldown. */
  release(id, cooldownMs) {
    const e = this.list.find((x) => x.id === id);
    if (!e) return;
    e.reset();
    e.cooldownMs = cooldownMs || 0;
  }

  /**
   * Resolve, a cada frame, as mecânicas de entrada (porta/janela) e de trava.
   * Retorna null, { type: 'jumpscare', id } ou { type: 'intrude', id }.
   * Nenhum som é tocado aqui: os inimigos chegam e saem em silêncio.
   */
  updateLocks(deltaMs, doors) {
    const c = window.GAME_CONSTANTS;
    for (const e of this.list) {
      if (e.cooldownMs > 0) e.cooldownMs = Math.max(0, e.cooldownMs - deltaMs);

      if (e.node === INSIDE_NODE) continue; // dentro da sala: game.js decide

      if (e.cfg.lockNode && e.node === e.cfg.lockNode.nodeId) {
        const door = doors[e.cfg.lockNode.doorId];
        if (door && door.isClosed) {
          e.lockTimer = 0;
        } else {
          e.lockTimer += deltaMs;
          if (e.lockTimer >= e.cfg.lockNode.timeoutMs) {
            this.intrude(e.id);
            return { type: 'intrude', id: e.id };
          }
        }
        continue;
      }

      const entryDoorId = EnemyManager.entryDoorId(e.node);
      if (entryDoorId !== null) {
        const door = doors[entryDoorId];

        // openMs = tempo com a entrada ABERTA (conta para o ataque);
        // closedMs = tempo com ela FECHADA (conta para ele desistir).
        if (!e.doorTimer) e.doorTimer = { openMs: 0, closedMs: 0 };

        if (door && door.isClosed) {
          e.doorTimer.openMs = 0;
          e.doorTimer.closedMs += deltaMs;
          if (e.doorTimer.closedMs >= c.DOOR_KNOCK_RETREAT_MS) {
            e.reset();
            e.cooldownMs = c.ENEMY_RETREAT_COOLDOWN_MS;
          }
        } else {
          e.doorTimer.closedMs = 0;
          e.doorTimer.openMs += deltaMs;
          if (e.doorTimer.openMs >= c.DOOR_ATTACK_GRACE_MS) {
            const id = e.id;
            e.reset();
            return { type: 'jumpscare', id };
          }
        }
      }
    }
    return null;
  }

  /**
   * Chamado a cada frame. Cada inimigo tem o próprio intervalo de movimento
   * (cfg.moveIntervalMs, como no FNAF 1; senão defaultIntervalMs) e, a cada
   * intervalo, rola um dado: se tirar menos que o nível de agressão (0-20),
   * avança pelo grafo.
   */
  tickAll({ deltaMs, nightAggression, assetLoader, defaultIntervalMs }) {
    for (const e of this.list) {
      const interval = e.cfg.moveIntervalMs || defaultIntervalMs || 5000;
      e.tickAcc += deltaMs;
      while (e.tickAcc >= interval) {
        e.tickAcc -= interval;
        this._tryMove(e, nightAggression, assetLoader);
      }
    }
    return null; // ataques passam por updateLocks no frame seguinte
  }

  _tryMove(e, nightAggression, assetLoader) {
    if (e.cooldownMs > 0) return;
    if (e.node === INSIDE_NODE) return;
    if (e.cfg.lockNode && e.node === e.cfg.lockNode.nodeId) return;
    if (EnemyManager.entryDoorId(e.node) !== null) return;

    const level = nightAggression?.[e.id] ?? 0;
    if (level <= 0) return;
    if (Math.random() >= level / 20) return; // escala 0-20 (teto do FNAF)

    const options = e.cfg.graph[e.node] || [];
    if (!options.length) return;

    e.node = options[(Math.random() * options.length) | 0];
    e.doorTimer = null;

    if (e.cfg.onMoveSfx && assetLoader) assetLoader.playSfx(e.cfg.onMoveSfx, { volume: 0.5 });
  }
}

window.EnemyManager = EnemyManager;
