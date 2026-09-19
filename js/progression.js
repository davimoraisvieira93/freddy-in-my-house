/* js/progression.js
 *
 * Use este arquivo SÓ se o seu progression.js estiver dando 404 / não existir.
 * Se ele já existe, não substitua: basta garantir a última linha (window.Progression).
 *
 * A API abaixo é exatamente a que game.js e ui.js chamam hoje:
 *   Progression.addScore(ms)      → posição no ranking (1-based) ou null
 *   Progression.formatTime(ms)    → "MM:SS" ou "H:MM:SS"
 *   Progression.getLeaderboard()  → [{ ms, date }]
 *   Progression.unlock()          → true se destravou AGORA, false se já estava
 * Mais: isUnlocked() e clearLeaderboard(), que o menu costuma precisar.
 * Se o seu menuExtras.js chamar algum outro método, me diga qual.
 */
const Progression = {
  STORAGE_KEY: 'vigia-noturna:progress',
  MAX_SCORES: 10,

  // Modo anônimo / cookies bloqueados fazem localStorage lançar. Nesses casos
  // o progresso vive só na memória da aba, mas o jogo não quebra.
  _memory: null,

  _default() {
    return { unlocked: false, scores: [] };
  },

  _read() {
    if (this._memory) return this._memory;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return this._default();
      const parsed = JSON.parse(raw);
      return {
        unlocked: parsed.unlocked === true,
        scores: Array.isArray(parsed.scores) ? parsed.scores : [],
      };
    } catch (e) {
      console.warn('[Progression] não consegui ler o progresso salvo:', e);
      return this._default();
    }
  },

  _write(state) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
      this._memory = null;
    } catch (e) {
      console.warn('[Progression] salvando só em memória:', e);
      this._memory = state;
    }
  },

  // ----------------------------------------------------------- desbloqueio
  isUnlocked() {
    return this._read().unlocked === true;
  },

  /** Retorna true apenas na primeira vez — game.js usa isso pra mudar o texto da vitória. */
  unlock() {
    const state = this._read();
    if (state.unlocked) return false;
    state.unlocked = true;
    this._write(state);
    return true;
  },

  // -------------------------------------------------------------- ranking
  getLeaderboard() {
    return this._read().scores.slice();
  },

  /** No Modo Infinito, sobreviver MAIS tempo é melhor → ordem decrescente. */
  addScore(ms) {
    const state = this._read();
    const entry = { ms: Math.round(ms || 0), date: Date.now() };

    state.scores.push(entry);
    state.scores.sort((a, b) => b.ms - a.ms);
    const rank = state.scores.indexOf(entry) + 1;
    state.scores = state.scores.slice(0, this.MAX_SCORES);

    this._write(state);
    return rank >= 1 && rank <= this.MAX_SCORES ? rank : null;
  },

  clearLeaderboard() {
    const state = this._read();
    state.scores = [];
    this._write(state);
  },

  // ---------------------------------------------------------------- utils
  formatTime(ms) {
    const totalSec = Math.max(0, Math.floor((ms || 0) / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  },
};

// Esta linha é obrigatória: game.js e ui.js leem window.Progression.
window.Progression = Progression;
