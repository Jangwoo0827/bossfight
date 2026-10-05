/* DOM overlays: main menu, SOUL shop, settings, pause. Plus a tiny shared UI root helper. */
(function () {
  'use strict';

  const UIRoot = {
    get el() { return document.getElementById('ui-root'); },
    show(className, html) {
      const root = this.el;
      root.innerHTML = '';
      const panel = document.createElement('div');
      panel.className = `overlay ${className || ''}`;
      panel.innerHTML = html;
      root.appendChild(panel);
      return panel;
    },
    clear() {
      const root = this.el;
      if (root) root.innerHTML = '';
    },
  };

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  class MenuUI {
    constructor(game) {
      this.game = game;
    }

    _bind(panel, handlers) {
      panel.querySelectorAll('[data-action]').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const fn = handlers[el.dataset.action];
          if (fn) {
            this.game.audio.play('button');
            fn(el);
          }
        });
      });
    }

    showMain() {
      const g = this.game;
      const st = g.saveData.stats;
      const panel = UIRoot.show('dim', `
        <div class="soul-badge">SOUL <b>${g.saveData.soul}</b></div>
        <div class="title">BOSS RUSH</div>
        <div class="subtitle">Five Bosses</div>
        <div class="menu-buttons">
          <button class="btn primary" data-action="start">Start Run</button>
          <button class="btn" data-action="shop">Upgrades</button>
          <button class="btn" data-action="records">Records</button>
          <button class="btn" data-action="settings">Settings</button>
        </div>
        <div class="controls">
          <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 이동 &nbsp; <kbd>마우스</kbd> 조준 &nbsp; <kbd>좌클릭</kbd> 공격 (근접 베기 + 검기)<br>
          <kbd>SPACE</kbd> 대시 (무적) &nbsp; <kbd>Q</kbd> 꾹 눌러 충전 스킬 &nbsp; <kbd>E</kbd> 캐릭터 스킬 (타이밍 맞추면 PARRY) &nbsp; <kbd>ESC</kbd> 일시정지
        </div>
        <div class="menu-footer">
          RUNS ${st.runs} · CLEARS ${st.clears} · BEST ${st.bestStage} / ${BR.CONFIG.RUN.totalBosses}<br>
          빨간 영역 = 곧 공격이 들어오는 곳. 차오르는 속도 = 남은 시간.
        </div>
      `);
      this._bind(panel, {
        start: () => this.showRunSetup(),
        shop: () => this.showShop(),
        records: () => g.ui.records.show(() => this.showMain()),
        settings: () => this.showSettings(() => this.showMain()),
      });
    }

    // Character + difficulty selection before a run
    showRunSetup() {
      const g = this.game;
      const s = g.saveData.settings;
      const esc = escapeHtml;
      let charId = BR.CHARACTER_BY_ID[s.lastCharacter] ? s.lastCharacter : BR.CHARACTERS[0].id;
      let diffId = BR.DIFFICULTY_BY_ID[s.lastDifficulty] ? s.lastDifficulty : 'normal';

      const charCards = BR.CHARACTERS.map((c) => {
        const clears = g.saveData.stats.clearsByCharacter[c.id] || 0;
        return `
          <div class="card char-card" style="--accent:${c.color}" data-char="${c.id}">
            <div class="tag">${esc(c.role)}</div>
            <div class="name">${esc(c.name)}</div>
            <div class="char-stats">
              <span>HP <b>${BR.CONFIG.PLAYER.maxHp + c.hpBonus}</b></span>
              <span>SPD <b>${Math.round(c.speedMult * 100)}%</b></span>
              <span>CLEARS <b>${clears}</b></span>
            </div>
            <div class="desc">${esc(c.desc)}</div>
            <ul class="skill-list">${c.skills.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
          </div>`;
      }).join('');
      const diffButtons = BR.DIFFICULTIES.map((d) => {
        const clears = g.saveData.stats.clearsByDifficulty[d.id] || 0;
        return `<button class="diff-btn" style="--accent:${d.color}" data-diff="${d.id}">
          <span class="dname">${d.name}</span><span class="ddesc">${esc(d.desc)}</span>
          <span class="dmeta">SOUL ×${d.soul}${clears ? ` · CLEAR ${clears}` : ''}</span></button>`;
      }).join('');

      const panel = UIRoot.show('dim', `
        <div class="soul-badge">SOUL <b>${g.saveData.soul}</b></div>
        <div class="heading">CHOOSE YOUR HUNTER</div>
        <div class="subheading">캐릭터와 난이도를 고르세요</div>
        <div class="card-row">${charCards}</div>
        <div class="diff-row">${diffButtons}</div>
        <div class="btn-row" style="margin-top:18px">
          <button class="btn" data-action="back">Back</button>
          <button class="btn primary" data-action="go" style="min-width:240px">Begin Run</button>
        </div>
      `);
      const refresh = () => {
        panel.querySelectorAll('[data-char]').forEach((el) => el.classList.toggle('selected', el.dataset.char === charId));
        panel.querySelectorAll('[data-diff]').forEach((el) => el.classList.toggle('selected', el.dataset.diff === diffId));
      };
      panel.querySelectorAll('[data-char]').forEach((el) => el.addEventListener('click', () => {
        charId = el.dataset.char; g.audio.play('button'); refresh();
      }));
      panel.querySelectorAll('[data-diff]').forEach((el) => el.addEventListener('click', () => {
        diffId = el.dataset.diff; g.audio.play('button'); refresh();
      }));
      refresh();
      this._bind(panel, {
        back: () => this.showMain(),
        go: () => g.startRun(charId, diffId),
      });
    }

    showShop() {
      const g = this.game;
      const items = BR.META_UPGRADES.map((def) => {
        const level = g.saveData.meta[def.id] || 0;
        const maxed = level >= def.maxLevel;
        const cost = BR.UpgradeSystem.metaCost(def, level);
        const pips = Array.from({ length: def.maxLevel }, (_, i) => `<div class="pip ${i < level ? 'on' : ''}"></div>`).join('');
        return `
          <div class="shop-item">
            <div class="name">${escapeHtml(def.name)}</div>
            <div class="desc">${escapeHtml(def.desc)} / 레벨</div>
            <div class="pips">${pips}</div>
            <div class="row">
              <span class="cost">${maxed ? 'MAX' : `${cost} SOUL`}</span>
              <button class="btn small" data-action="buy" data-id="${def.id}" ${maxed || g.saveData.soul < cost ? 'disabled' : ''}>Buy</button>
            </div>
          </div>`;
      }).join('');
      const panel = UIRoot.show('dim', `
        <div class="soul-badge">SOUL <b>${g.saveData.soul}</b></div>
        <div class="heading">SOUL UPGRADES</div>
        <div class="subheading">영구 강화 — 작지만 죽어도 유지된다</div>
        <div class="shop-grid">${items}</div>
        <div class="shop-note">SOUL은 보스를 처치할 때마다 획득하며, RUN이 실패해도 사라지지 않는다.</div>
        <div class="btn-row" style="margin-top:22px"><button class="btn" data-action="back">Back</button></div>
      `);
      this._bind(panel, {
        buy: (el) => {
          if (BR.UpgradeSystem.buyMeta(g.saveData, el.dataset.id)) {
            BR.SaveSystem.save(g.saveData);
            g.audio.play('reward');
          }
          this.showShop();
        },
        back: () => this.showMain(),
      });
    }

    showSettings(onBack) {
      const g = this.game;
      const s = g.saveData.settings;
      const shakeBtn = (v, label) => `<button class="btn ${s.shake === v ? 'active' : ''}" data-action="shake" data-v="${v}">${label}</button>`;
      const panel = UIRoot.show('dim', `
        <div class="heading">SETTINGS</div>
        <div class="subheading">&nbsp;</div>
        <div class="settings-box">
          <div class="setting"><span>Volume</span><input type="range" min="0" max="100" value="${Math.round(s.volume * 100)}" data-role="volume"></div>
          <div class="setting"><span>Screen Shake</span><div class="seg">${shakeBtn(0, 'Off')}${shakeBtn(0.5, 'Low')}${shakeBtn(1, 'Full')}</div></div>
          <div class="setting"><span>Damage Numbers</span><div class="seg">
            <button class="btn ${s.damageNumbers ? 'active' : ''}" data-action="dmg" data-v="1">On</button>
            <button class="btn ${!s.damageNumbers ? 'active' : ''}" data-action="dmg" data-v="0">Off</button></div></div>
          <div class="setting"><span>Save Data</span><button class="btn small" data-action="reset">Reset</button></div>
        </div>
        <div class="btn-row" style="margin-top:24px"><button class="btn" data-action="back">Back</button></div>
      `);
      const slider = panel.querySelector('[data-role="volume"]');
      slider.addEventListener('input', () => {
        s.volume = Number(slider.value) / 100;
        g.applySettings();
      });
      slider.addEventListener('change', () => {
        BR.SaveSystem.save(g.saveData);
        g.audio.play('button');
      });
      this._bind(panel, {
        shake: (el) => { s.shake = Number(el.dataset.v); this._commitSettings(onBack); },
        dmg: (el) => { s.damageNumbers = el.dataset.v === '1'; this._commitSettings(onBack); },
        reset: (el) => {
          if (el.dataset.confirm) {
            g.saveData = BR.SaveSystem.reset();
            g.applySettings();
            this.showSettings(onBack);
          } else {
            el.dataset.confirm = '1';
            el.textContent = 'Confirm?';
          }
        },
        back: () => onBack(),
      });
    }

    _commitSettings(onBack) {
      BR.SaveSystem.save(this.game.saveData);
      this.game.applySettings();
      this.showSettings(onBack);
    }

    showPause() {
      const g = this.game;
      const panel = UIRoot.show('soft', `
        <div class="heading">PAUSED</div>
        <div class="subheading">${escapeHtml(g.boss ? g.boss.name : '')}</div>
        <div class="menu-buttons" style="margin-top:10px">
          <button class="btn primary" data-action="resume">Resume</button>
          <button class="btn" data-action="settings">Settings</button>
          <button class="btn" data-action="abandon">Abandon Run</button>
        </div>
      `);
      this._bind(panel, {
        resume: () => g.setPaused(false),
        settings: () => this.showSettings(() => this.showPause()),
        abandon: () => g.abandonRun(),
      });
    }
  }

  BR.UIRoot = UIRoot;
  BR.escapeHtml = escapeHtml;
  BR.MenuUI = MenuUI;
})();
