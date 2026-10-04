/* js/progression.js
 * Desbloqueio de Custom Night / Modo Infinito e ranking do Modo Infinito,
 * persistidos em localStorage.
 */
const Progression = {
  _UNLOCK_KEY: 'vigianoturna:unlocked',
  _SCORES_KEY: 'vigianoturna:scores',
  _NIGHT_KEY: 'vigianoturna:night',

  /** Noite (índice 0-based) em que o jogador parou. 0 = começo. */
  getSavedNight() {
    const n = parseInt(localStorage.getItem(this._NIGHT_KEY), 10);
    const max = (window.NIGHTS_CONFIG ? window.NIGHTS_CONFIG.length : 1) - 1;
    return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
  },

  saveNight(index) {
    try { localStorage.setItem(this._NIGHT_KEY, String(Math.max(0, index | 0))); } catch (e) { /* noop */ }
  },

  /**
   * Apaga TODOS os dados salvos neste navegador (noite, extras desbloqueados,
   * ranking local, nome e fila de envio): o jogo volta ao estado de um
   * computador novo. Não mexe no ranking geral online.
   */
  resetAll() {
    const prefix = 'vigianoturna:';
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    return keys.length;
  },

  resetProgress() {
    localStorage.removeItem(this._NIGHT_KEY);
  },

  isUnlocked() {
    return localStorage.getItem(this._UNLOCK_KEY) === '1';
  },

  /** Retorna true só na primeira vez que desbloqueia. */
  unlock() {
    if (this.isUnlocked()) return false;
    localStorage.setItem(this._UNLOCK_KEY, '1');
    return true;
  },

  formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  },

  getLeaderboard() {
    try {
      return JSON.parse(localStorage.getItem(this._SCORES_KEY)) || [];
    } catch (e) {
      return [];
    }
  },

  /** Adiciona um tempo sobrevivido (ms) e retorna a posição (1-based) ou null. */
  addScore(ms) {
    const list = this.getLeaderboard();
    list.push(ms);
    list.sort((a, b) => b - a);
    const trimmed = list.slice(0, 10);
    localStorage.setItem(this._SCORES_KEY, JSON.stringify(trimmed));
    const rank = trimmed.indexOf(ms);
    return rank === -1 ? null : rank + 1;
  },

  clearLeaderboard() {
    localStorage.removeItem(this._SCORES_KEY);
  },
};

window.Progression = Progression;
