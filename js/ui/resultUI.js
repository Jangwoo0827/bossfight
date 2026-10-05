/* RUN FAILED / RUN CLEAR summary. */
(function () {
  'use strict';

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  class ResultUI {
    constructor(game) {
      this.game = game;
      this.onKey = this.onKey.bind(this);
    }

    show(cleared) {
      const g = this.game;
      const run = g.run;
      const esc = BR.escapeHtml;
      const summary = run.buildSummary();
      const chips = summary.length
        ? summary.map((u) => `<span class="chip">${esc(u.name)}${u.stacks > 1 ? ` ×${u.stacks}` : ''}</span>`).join('')
        : '<span class="chip empty">No upgrades</span>';
      const killer = !cleared && g.boss ? g.boss : null;
      const hint = killer
        ? `${esc(killer.name)} — ${esc(killer.def.tip)}`
        : '모든 보스를 쓰러뜨렸다. 다른 빌드로 다시 도전해 보자.';
      const reached = cleared ? run.totalBosses : Math.min(run.bossNumber, run.totalBosses);
      const panel = BR.UIRoot.show('dim', `
        <div class="result-title ${cleared ? 'clear' : 'fail'}">${cleared ? 'RUN CLEAR' : 'RUN FAILED'}</div>
        <div class="subheading" style="margin-bottom:4px;color:${run.difficulty.color}">${run.difficulty.name} · ${esc(run.character.name)}</div>
        <div class="subheading">${cleared ? 'The Abyss falls silent.' : (killer ? `Slain by ${esc(killer.name)}${killer.hp > 0 ? ` · 남은 HP ${Math.round((killer.hp / killer.maxHp) * 100)}%` : ''}` : '')}</div>
        <div class="result-stats">
          <div class="result-stat"><div class="v">${reached} / ${run.totalBosses}</div><div class="k">Boss Reached</div></div>
          <div class="result-stat"><div class="v">${run.stage}</div><div class="k">Bosses Defeated</div></div>
          <div class="result-stat"><div class="v">${formatTime(run.time)}</div><div class="k">Run Time</div></div>
          <div class="result-stat"><div class="v" style="color:#c9b6ff">+${run.soulEarned}</div><div class="k">Soul Earned</div></div>
        </div>
        <div class="subheading" style="margin-bottom:10px">BUILD SUMMARY</div>
        <div class="build-chips">${chips}</div>
        <div class="hint-line">${hint}</div>
        <div class="btn-row">
          <button class="btn primary" data-action="retry">Try Again</button>
          <button class="btn" data-action="shop">Upgrades (${g.saveData.soul} Soul)</button>
          <button class="btn" data-action="menu">Main Menu</button>
        </div>
        <div class="shop-note">R 키로 바로 재시작</div>
      `);
      panel.querySelectorAll('[data-action]').forEach((el) => {
        el.addEventListener('click', () => {
          g.audio.play('button');
          this.hide();
          const action = el.dataset.action;
          if (action === 'retry') g.startRun(run.character.id, run.difficulty.id);
          else if (action === 'shop') g.goToMenu('shop');
          else g.goToMenu();
        });
      });
      window.addEventListener('keydown', this.onKey);
    }

    onKey(e) {
      if (e.code === 'KeyR') {
        this.hide();
        this.game.startRun(this.game.run.character.id, this.game.run.difficulty.id);
      }
    }

    hide() {
      window.removeEventListener('keydown', this.onKey);
      BR.UIRoot.clear();
    }
  }

  BR.ResultUI = ResultUI;
})();
