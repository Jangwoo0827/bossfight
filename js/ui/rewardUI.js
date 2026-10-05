/* "Choose your upgrade" screen after each boss. Keys 1/2/3 also select. */
(function () {
  'use strict';

  class RewardUI {
    constructor(game) {
      this.game = game;
      this.choices = [];
      this.onKey = this.onKey.bind(this);
      this.locked = false;
    }

    show(choices, soulGained, bossName) {
      const g = this.game;
      this.choices = choices;
      this.locked = false;
      const esc = BR.escapeHtml;
      const cards = choices.map((u, i) => {
        const stacks = g.run.upgrades[u.id] || 0;
        return `
          <div class="card rarity-${u.rarity}" data-index="${i}">
            <div class="hotkey">${i + 1}</div>
            <div class="tag">${BR.CATEGORY_LABELS[u.category] || ''} · ${u.rarity}</div>
            <div class="name">${esc(u.name)}</div>
            <div class="desc">${esc(u.desc).replace(/\n/g, '<br>')}</div>
            <div class="stack">${stacks > 0 ? `보유 ${stacks} / ${u.maxStacks}` : 'NEW'}</div>
          </div>`;
      }).join('');
      const panel = BR.UIRoot.show('dim', `
        <div class="heading" style="color:#ffd76a">BOSS DEFEATED!</div>
        <div class="subheading">${esc(bossName)} · <span style="color:#c9b6ff">+${soulGained} SOUL</span> · 다음 전투 전 체력 일부 회복</div>
        <div class="subheading" style="margin-bottom:18px;color:#fff;letter-spacing:5px">CHOOSE YOUR UPGRADE</div>
        <div class="card-row">${cards}</div>
        ${g.run.rerolls > 0 ? `<div class="btn-row" style="margin-top:22px"><button class="btn small" data-role="reroll">Reroll (${g.run.rerolls})</button></div>` : ''}
      `);
      const rerollBtn = panel.querySelector('[data-role="reroll"]');
      if (rerollBtn) {
        rerollBtn.addEventListener('click', () => {
          if (this.locked || g.run.rerolls <= 0) return;
          g.run.rerolls--;
          window.removeEventListener('keydown', this.onKey);
          g.audio.play('button');
          this.show(BR.RewardSystem.roll(3, g.run.upgrades), soulGained, bossName);
        });
      }
      panel.querySelectorAll('.card').forEach((el) => {
        el.addEventListener('click', () => this.pick(Number(el.dataset.index)));
      });
      window.addEventListener('keydown', this.onKey);
      g.audio.play('reward');
    }

    onKey(e) {
      const map = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 };
      if (e.code in map) this.pick(map[e.code]);
    }

    pick(index) {
      if (this.locked) return;
      const choice = this.choices[index];
      if (!choice) return;
      this.locked = true;
      this.hide();
      this.game.audio.play('button');
      this.game.onRewardChosen(choice);
    }

    hide() {
      window.removeEventListener('keydown', this.onKey);
      BR.UIRoot.clear();
    }
  }

  BR.RewardUI = RewardUI;
})();
