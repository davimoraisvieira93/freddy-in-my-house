/* js/menuExtras.js
 * Custom Night, Modo Infinito e Ranking. Roda por último: refreshMenu()
 * mostra/esconde os botões desbloqueáveis e é chamado pelo main.js/game.js
 * sempre que o menu volta a aparecer ou algo é desbloqueado.
 */
(function () {
  'use strict';

  function refreshMenu() {
    const unlocked = window.Progression.isUnlocked();
    ['btn-custom', 'btn-infinite', 'btn-leaderboard'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', !unlocked);
    });
    renderMenuLeaderboard();
  }
  window.refreshMenu = refreshMenu;

  function renderMenuLeaderboard() {
    UI.renderLeaderboard(document.getElementById('menu-leaderboard-list'), null);
  }

  function buildCustomLevels() {
    const container = document.getElementById('custom-levels');
    if (!container) return;
    container.innerHTML = '';
    window.ENEMIES_CONFIG.forEach((enemy) => {
      const row = document.createElement('label');
      row.className = 'custom-level-row';
      row.innerHTML =
        `<span style="min-width:80px;display:inline-block">${enemy.label}</span>` +
        `<input type="range" min="0" max="20" value="10" data-enemy="${enemy.id}">` +
        `<output>10</output>`;
      const input = row.querySelector('input');
      const output = row.querySelector('output');
      input.addEventListener('input', () => { output.textContent = input.value; });
      container.appendChild(row);
    });
  }

  function readCustomLevels() {
    const levels = {};
    document.querySelectorAll('#custom-levels input[data-enemy]').forEach((input) => {
      levels[input.dataset.enemy] = Number(input.value);
    });
    return levels;
  }

  document.getElementById('btn-custom')?.addEventListener('click', () => {
    buildCustomLevels();
    UI.showScreen('custom-screen');
  });

  document.getElementById('btn-custom-start')?.addEventListener('click', () => {
    if (!window.game) return;
    window.stopMenuMusic();
    window.game.startRun({ mode: 'custom', levels: readCustomLevels() });
  });

  document.getElementById('btn-infinite')?.addEventListener('click', () => {
    if (!window.game) return;
    window.stopMenuMusic();
    window.game.startRun({ mode: 'infinite', nightIndex: 0 });
  });

  document.getElementById('btn-leaderboard')?.addEventListener('click', () => {
    renderMenuLeaderboard();
    UI.showScreen('leaderboard-screen');
  });

  document.getElementById('btn-clear-leaderboard')?.addEventListener('click', () => {
    window.Progression.clearLeaderboard();
    renderMenuLeaderboard();
  });
})();
