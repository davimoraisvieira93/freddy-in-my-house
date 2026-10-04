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
    // Botão principal continua de onde o jogador parou.
    const saved = window.Progression.getSavedNight();
    const startBtn = document.getElementById('btn-start');
    if (startBtn) {
      const label = `Night ${saved + 1}`;
      startBtn.dataset.fallbackText = label;          // usado se o PNG falhar
      if (!startBtn.querySelector('img.btn-icon')) startBtn.textContent = label;
      startBtn.title = saved > 0 ? `Continuar: ${label}` : 'Começar';
    }
    const newBtn = document.getElementById('btn-newgame');
    if (newBtn) newBtn.classList.toggle('hidden', saved === 0);

    UI.applyMenuButtonIcons();
    UI.applyMenuBackground();
  }
  window.refreshMenu = refreshMenu;

  function renderMenuLeaderboard() {
    UI.renderGlobalLeaderboard(
      document.getElementById('menu-leaderboard-list'),
      document.getElementById('leaderboard-status'),
      null,
    );
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

  document.getElementById('btn-change-name')?.addEventListener('click', () => {
    if (window.Leaderboard) window.Leaderboard.askName(true);
  });

  document.getElementById('btn-newgame')?.addEventListener('click', () => {
    if (!window.game) return;
    window.Progression.resetProgress();
    window.stopMenuMusic();
    window.game.startNight(0);
  });

  document.getElementById('btn-clear-leaderboard')?.addEventListener('click', () => {
    window.Progression.clearLeaderboard();
    renderMenuLeaderboard();
  });

  // Ctrl + Shift + Y: apaga todos os dados salvos (começa como num computador novo).
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey && e.shiftKey && e.code === 'KeyY')) return;
    e.preventDefault();
    const ok = window.confirm(
      'Apagar TODOS os dados salvos neste navegador?\n\n' +
      '• noite em que você parou\n• Custom Night / Modo Infinito / Ranking desbloqueados\n' +
      '• ranking local e nome\n\nNão dá para desfazer.',
    );
    if (!ok) return;
    window.Progression.resetAll();
    location.reload(); // recarrega limpo, como um jogo novo
  });
})();
