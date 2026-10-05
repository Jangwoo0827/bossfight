/* "NEXT BOSS" route choice between the first and the final boss. */
(function () {
  'use strict';

  class BossSelectUI {
    constructor(game) {
      this.game = game;
      this.options = [];
      this.locked = false;
    }

    show(options) {
      const esc = BR.escapeHtml;
      this.options = options;
      this.locked = false;
      const run = this.game.run;
      const cards = options.map((id, i) => {
        const def = BR.BOSS_BY_ID[id];
        const theme = BR.THEMES[def.arena];
        const stars = '★'.repeat(def.difficulty) + '<span style="opacity:.25">' + '★'.repeat(5 - def.difficulty) + '</span>';
        const hpMult = run.hpMultiplierFor(id);
        return `
          <div class="card" style="--accent:${def.color}" data-index="${i}">
            <div class="tag">${theme ? esc(theme.label) : ''}</div>
            <div class="name">${esc(def.name)}</div>
            <div class="stars">${stars}</div>
            <div class="meta">${esc(def.title)} · HP ${Math.round(def.hp * hpMult)}</div>
            <div class="tip">${esc(def.tip)}</div>
          </div>`;
      }).join('');
      const panel = BR.UIRoot.show('dim', `
        <div class="heading">NEXT BOSS</div>
        <div class="subheading">BOSS ${run.bossNumber} / ${run.totalBosses} · 나중에 고를수록 보스가 조금 더 강해진다</div>
        <div class="card-row">${cards}</div>
      `);
      panel.querySelectorAll('.card').forEach((el) => {
        el.addEventListener('click', () => {
          if (this.locked) return;
          this.locked = true;
          this.game.audio.play('button');
          BR.UIRoot.clear();
          this.game.beginBoss(this.options[Number(el.dataset.index)]);
        });
      });
    }
  }

  BR.BossSelectUI = BossSelectUI;
})();
