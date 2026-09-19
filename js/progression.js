/* js/progression.js
 * Desbloqueio de Custom Night / Modo Infinito e ranking do Modo Infinito,
 * persistidos em localStorage.
 */
const Progression = {
  _UNLOCK_KEY: 'vigianoturna:unlocked',
  _SCORES_KEY: 'vigianoturna:scores',

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
