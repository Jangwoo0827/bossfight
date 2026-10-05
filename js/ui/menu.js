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
        <div class="menu-buttons">
          ${this._continueButton()}
          <button class="btn ${BR.SaveSystem.loadRun() ? '' : 'primary'}" data-action="start">${BR.SaveSystem.loadRun() ? 'New Run' : 'Start Run'}</button>
          <div class="btn-split">
            <button class="btn" data-action="daily">Daily</button>
            <button class="btn" data-action="practice">Practice</button>
            <button class="btn" data-action="tutorial">Tutorial</button>
          </div>
          <button class="btn" data-action="shop">Upgrades</button>
          <button class="btn" data-action="records">Records</button>
          <button class="btn" data-action="settings">Settings</button>
          <button class="btn small" data-action="notes">Patch Notes${g.saveData.settings.lastSeenVersion !== BR.GAME_VERSION ? ' <span class="new-badge">NEW</span>' : ''}</button>
        </div>
        <div class="controls">
          <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 이동 &nbsp; <kbd>마우스</kbd> 조준 &nbsp; <kbd>좌클릭</kbd> 공격 (근접 베기 + 검기)<br>
          <kbd>SPACE</kbd> 대시 (무적) &nbsp; <kbd>Q</kbd> 꾹 눌러 충전 스킬 &nbsp; <kbd>E</kbd> 캐릭터 스킬 (타이밍 맞추면 PARRY) &nbsp; <kbd>ESC</kbd> 일시정지
        </div>
        <div class="menu-footer">
          v${BR.GAME_VERSION} · RUNS ${st.runs} · CLEARS ${st.clears} · BEST ${st.bestStage} / ${BR.CONFIG.RUN.totalBosses}<br>
          빨간 영역 = 곧 공격이 들어오는 곳. 차오르는 속도 = 남은 시간.
        </div>
      `);
      this._bind(panel, {
        start: () => {
          const s = g.saveData;
          if (!s.settings.tutorialDone && s.stats.runs === 0) this.showTutorialOffer();
          else this.showRunSetup();
        },
        practice: () => this.showPractice(),
        daily: () => this.showDaily(),
        continue: () => g.resumeRun(),
        tutorial: () => g.startTutorial(),
        shop: () => this.showShop(),
        records: () => g.ui.records.show(() => this.showMain()),
        notes: () => this.showPatchNotes(),
        settings: () => this.showSettings(() => this.showMain()),
      });
    }

    _continueButton() {
      const c = BR.SaveSystem.loadRun();
      if (!c) return '';
      const diff = BR.DIFFICULTY_BY_ID[c.difficulty];
      const ch = BR.CHARACTER_BY_ID[c.character];
      const total = diff ? diff.bosses : 5;
      const where = c.phase === 'fight' && BR.BOSS_BY_ID[c.bossId] ? BR.BOSS_BY_ID[c.bossId].name : c.phase === 'select' ? 'NEXT BOSS' : 'REWARD';
      return `<button class="btn primary continue-btn" data-action="continue">Continue
        <small>${c.daily ? 'DAILY · ' : ''}BOSS ${Math.min((c.stage || 0) + 1, total)}/${total} · ${escapeHtml(where)} · ${diff ? diff.name : ''}${ch ? ' · ' + escapeHtml(ch.name) : ''}</small></button>`;
    }

    // Daily challenge: same seed + modifier for everyone today
    showDaily() {
      const g = this.game;
      const esc = escapeHtml;
      const info = BR.dailyInfo();
      const best = g.saveData.stats.daily[info.date];
      const lastC = BR.CHARACTER_BY_ID[g.saveData.settings.lastCharacter];
      let charId = lastC && BR.isCharacterUnlocked(lastC, g.saveData) ? lastC.id : 'blade';
      const m = info.modifier;
      const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      const bestText = best
        ? (best.cleared ? `CLEAR · ${fmt(best.time)}` : `BOSS ${best.stage} 처치`) + ` · ${esc((BR.CHARACTER_BY_ID[best.character] || {}).name || '')}`
        : '아직 도전 기록 없음';
      const charBtns = BR.CHARACTERS.filter((c) => BR.isCharacterUnlocked(c, g.saveData)).map((c) => `<button class="btn small" data-char="${c.id}">${esc(c.name)}</button>`).join('');
      const panel = UIRoot.show('dim', `
        <div class="heading">DAILY CHALLENGE</div>
        <div class="subheading">${info.date} · 오늘은 모두가 같은 보스 순서 · 같은 보상 · 같은 유물</div>
        <div class="daily-box">
          <div class="daily-mod"><span class="dm-icon">${m.icon}</span><div><b>${esc(m.name)}</b><br><span>${esc(m.desc)}</span></div></div>
          <div class="daily-rows">
            <div class="rec-row"><span>Difficulty</span><b>NORMAL · 보스 5연전</b></div>
            <div class="rec-row"><span>Soul Bonus</span><b>+${Math.round(m.soul * 100)}%</b></div>
            <div class="rec-row"><span>Today's Best</span><b>${bestText}</b></div>
          </div>
        </div>
        <div class="practice-row" style="margin-top:18px"><span>CHARACTER</span><div class="seg">${charBtns}</div></div>
        <div class="btn-row" style="margin-top:20px">
          <button class="btn" data-action="back">Back</button>
          <button class="btn primary" data-action="go" style="min-width:220px">Start Daily</button>
        </div>
      `);
      const refresh = () => panel.querySelectorAll('[data-char]').forEach((el) => el.classList.toggle('active', el.dataset.char === charId));
      panel.querySelectorAll('[data-char]').forEach((el) => el.addEventListener('click', () => { charId = el.dataset.char; g.audio.play('button'); refresh(); }));
      refresh();
      this._bind(panel, {
        back: () => this.showMain(),
        go: () => g.startRun(charId, 'normal', [], { daily: true }),
      });
    }

    showTutorialOffer() {
      const g = this.game;
      const panel = UIRoot.show('dim', `
        <div class="heading">FIRST TIME?</div>
        <div class="subheading">2분짜리 튜토리얼로 이동 · 공격 · 대시 · 충전 · PARRY를 익힐 수 있습니다</div>
        <div class="btn-row">
          <button class="btn primary" data-action="yes">Play Tutorial</button>
          <button class="btn" data-action="skip">Skip</button>
        </div>
      `);
      this._bind(panel, {
        yes: () => g.startTutorial(),
        skip: () => {
          g.saveData.settings.tutorialDone = true;
          BR.SaveSystem.save(g.saveData);
          this.showRunSetup();
        },
      });
    }

    // Practice: fight any boss, any phase, nothing recorded
    showPractice(preset) {
      const g = this.game;
      const esc = escapeHtml;
      const p = preset || g.practiceSetup || {};
      let bossId = p.bossId || BR.BOSS_DATA[0].id;
      let charId = p.characterId || g.saveData.settings.lastCharacter || 'blade';
      if (!BR.CHARACTER_BY_ID[charId] || !BR.isCharacterUnlocked(BR.CHARACTER_BY_ID[charId], g.saveData)) charId = 'blade';
      let phase = p.phase || 1;
      const bossCards = BR.BOSS_DATA.map((b) => `
        <button class="pbtn" style="--accent:${b.color}" data-boss="${b.id}">
          <span class="pname">${esc(b.name)}</span>
          <span class="pstars">${'★'.repeat(b.difficulty)}</span>
        </button>`).join('');
      const charBtns = BR.CHARACTERS.filter((c) => BR.isCharacterUnlocked(c, g.saveData)).map((c) => `<button class="btn small" style="--accent:${c.color}" data-char="${c.id}">${esc(c.name)}</button>`).join('');
      const panel = UIRoot.show('dim', `
        <div class="heading">PRACTICE</div>
        <div class="subheading">원하는 보스를 원하는 페이즈부터 연습 · 기록과 SOUL은 남지 않습니다</div>
        <div class="practice-grid">${bossCards}</div>
        <div class="practice-tip" data-role="tip"></div>
        <div class="practice-row"><span>CHARACTER</span><div class="seg">${charBtns}</div></div>
        <div class="practice-row"><span>START PHASE</span><div class="seg" data-role="phases"></div></div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn" data-action="back">Back</button>
          <button class="btn primary" data-action="go" style="min-width:220px">Fight</button>
        </div>
      `);
      const refresh = () => {
        const def = BR.BOSS_BY_ID[bossId];
        const maxPhase = def.phaseThresholds.length + 1;
        if (phase > maxPhase) phase = 1;
        panel.querySelectorAll('[data-boss]').forEach((el) => el.classList.toggle('selected', el.dataset.boss === bossId));
        panel.querySelectorAll('[data-char]').forEach((el) => el.classList.toggle('active', el.dataset.char === charId));
        panel.querySelector('[data-role="tip"]').textContent = def.tip;
        const ph = panel.querySelector('[data-role="phases"]');
        ph.innerHTML = Array.from({ length: maxPhase }, (_, i) => `<button class="btn small ${phase === i + 1 ? 'active' : ''}" data-phase="${i + 1}">Phase ${i + 1}</button>`).join('');
        ph.querySelectorAll('[data-phase]').forEach((el) => el.addEventListener('click', () => {
          phase = Number(el.dataset.phase); g.audio.play('button'); refresh();
        }));
      };
      panel.querySelectorAll('[data-boss]').forEach((el) => el.addEventListener('click', () => {
        bossId = el.dataset.boss; g.audio.play('button'); refresh();
      }));
      panel.querySelectorAll('[data-char]').forEach((el) => el.addEventListener('click', () => {
        charId = el.dataset.char; g.audio.play('button'); refresh();
      }));
      refresh();
      this._bind(panel, {
        back: () => this.showMain(),
        go: () => g.startPractice(bossId, charId, phase),
      });
    }

    // Character + difficulty selection before a run
    showRunSetup() {
      const g = this.game;
      const s = g.saveData.settings;
      const esc = escapeHtml;
      let charId = BR.CHARACTER_BY_ID[s.lastCharacter] && BR.isCharacterUnlocked(BR.CHARACTER_BY_ID[s.lastCharacter], g.saveData) ? s.lastCharacter : BR.CHARACTERS[0].id;
      let diffId = BR.DIFFICULTY_BY_ID[s.lastDifficulty] ? s.lastDifficulty : 'normal';

      const charCards = BR.CHARACTERS.map((c) => {
        const clears = g.saveData.stats.clearsByCharacter[c.id] || 0;
        const locked = !BR.isCharacterUnlocked(c, g.saveData);
        if (locked) {
          return `
          <div class="card char-card locked" style="--accent:${c.color}">
            <div class="tag">${esc(c.role)}</div>
            <div class="name">${esc(c.name)}</div>
            <div class="lock-icon">🔒</div>
            <div class="desc">${esc(c.unlock.text)}</div>
          </div>`;
        }
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
        <div class="mod-row">
          <span class="mod-label">MODIFIERS <b data-role="modbonus"></b></span>
          ${BR.MODIFIERS.map((m) => `<button class="mod-btn" data-mod="${m.id}" title="${esc(m.desc)}"><span>${m.icon}</span> ${esc(m.name)}<small>${esc(m.desc)} · +${Math.round(m.soul * 100)}%</small></button>`).join('')}
        </div>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn" data-action="back">Back</button>
          <button class="btn primary" data-action="go" style="min-width:240px">Begin Run</button>
        </div>
      `);
      const mods = new Set((s.lastModifiers || []).filter((id) => BR.MODIFIER_BY_ID[id]));
      const refresh = () => {
        panel.querySelectorAll('[data-mod]').forEach((el) => el.classList.toggle('on', mods.has(el.dataset.mod)));
        const bonus = [...mods].reduce((a, id) => a + BR.MODIFIER_BY_ID[id].soul, 0);
        panel.querySelector('[data-role="modbonus"]').textContent = bonus ? `SOUL +${Math.round(bonus * 100)}%` : '';
        panel.querySelectorAll('[data-char]').forEach((el) => el.classList.toggle('selected', el.dataset.char === charId));
        panel.querySelectorAll('[data-diff]').forEach((el) => el.classList.toggle('selected', el.dataset.diff === diffId));
      };
      panel.querySelectorAll('[data-char]').forEach((el) => el.addEventListener('click', () => {
        charId = el.dataset.char; g.audio.play('button'); refresh();
      }));
      panel.querySelectorAll('[data-mod]').forEach((el) => el.addEventListener('click', () => {
        const id = el.dataset.mod;
        if (mods.has(id)) mods.delete(id); else mods.add(id);
        g.audio.play('button');
        refresh();
      }));
      panel.querySelectorAll('[data-diff]').forEach((el) => el.addEventListener('click', () => {
        diffId = el.dataset.diff; g.audio.play('button'); refresh();
      }));
      refresh();
      this._bind(panel, {
        back: () => this.showMain(),
        go: () => g.startRun(charId, diffId, [...mods]),
      });
    }

    showPatchNotes() {
      const g = this.game;
      const esc = escapeHtml;
      g.saveData.settings.lastSeenVersion = BR.GAME_VERSION;
      BR.SaveSystem.save(g.saveData);
      const notes = BR.PATCH_NOTES.map((v, i) => `
        <div class="note ${i === 0 ? 'latest' : ''}">
          <div class="note-head"><span class="note-ver">v${esc(v.version)}</span><span class="note-title">${esc(v.title)}</span>${i === 0 ? '<span class="new-badge">LATEST</span>' : ''}</div>
          ${v.sections.map(([tag, items]) => `
            <div class="note-sec"><span class="note-tag tag-${tag.toLowerCase()}">${esc(tag)}</span>
              <ul>${items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul>
            </div>`).join('')}
        </div>`).join('');
      const panel = UIRoot.show('dim', `
        <div class="heading">PATCH NOTES</div>
        <div class="subheading">현재 버전 v${BR.GAME_VERSION}</div>
        <div class="notes-list">${notes}</div>
        <div class="btn-row" style="margin-top:16px"><button class="btn" data-action="back">Back</button></div>
      `);
      this._bind(panel, { back: () => this.showMain() });
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
          <div class="setting"><span>Sound FX</span><input type="range" min="0" max="100" value="${Math.round(s.volume * 100)}" data-role="volume"></div>
          <div class="setting"><span>Music</span><input type="range" min="0" max="100" value="${Math.round(s.musicVolume * 100)}" data-role="music"></div>
          <div class="setting"><span>Screen Shake</span><div class="seg">${shakeBtn(0, 'Off')}${shakeBtn(0.5, 'Low')}${shakeBtn(1, 'Full')}</div></div>
          <div class="setting"><span>Damage Numbers</span><div class="seg">
            <button class="btn ${!s.damageNumbers ? 'active' : ''}" data-action="dmg" data-v="off">Off</button>
            <button class="btn ${s.damageNumbers && s.dmgSize === 0.8 ? 'active' : ''}" data-action="dmg" data-v="0.8">S</button>
            <button class="btn ${s.damageNumbers && s.dmgSize === 1 ? 'active' : ''}" data-action="dmg" data-v="1">M</button>
            <button class="btn ${s.damageNumbers && s.dmgSize === 1.3 ? 'active' : ''}" data-action="dmg" data-v="1.3">L</button></div></div>
          <div class="setting"><span>Flashes</span><div class="seg">
            <button class="btn ${s.flashes !== 'reduced' ? 'active' : ''}" data-action="flash" data-v="full">Full</button>
            <button class="btn ${s.flashes === 'reduced' ? 'active' : ''}" data-action="flash" data-v="reduced">Reduced</button></div></div>
          <div class="setting"><span>Colorblind Telegraphs</span><div class="seg">
            <button class="btn ${!s.colorblind ? 'active' : ''}" data-action="cb" data-v="0">Off</button>
            <button class="btn ${s.colorblind ? 'active' : ''}" data-action="cb" data-v="1">On</button></div></div>
          <div class="setting"><span>Controls</span><button class="btn small" data-action="controls">Rebind Keys</button></div>
          <div class="setting"><span>Save Code</span><div class="seg"><button class="btn" data-action="export">Export</button><button class="btn" data-action="import">Import</button></div></div>
          <div class="setting"><span>Save Data</span><button class="btn small" data-action="reset">Reset</button></div>
        </div>
        <div class="btn-row" style="margin-top:24px"><button class="btn" data-action="back">Back</button></div>
      `);
      const music = panel.querySelector('[data-role="music"]');
      music.addEventListener('input', () => {
        s.musicVolume = Number(music.value) / 100;
        g.applySettings();
      });
      music.addEventListener('change', () => BR.SaveSystem.save(g.saveData));
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
        dmg: (el) => {
          s.damageNumbers = el.dataset.v !== 'off';
          if (s.damageNumbers) s.dmgSize = Number(el.dataset.v);
          this._commitSettings(onBack);
        },
        flash: (el) => { s.flashes = el.dataset.v; this._commitSettings(onBack); },
        cb: (el) => { s.colorblind = el.dataset.v === '1'; this._commitSettings(onBack); },
        controls: () => this.showControls(() => this.showSettings(onBack)),
        export: () => this.showSaveCode('export', () => this.showSettings(onBack)),
        import: () => this.showSaveCode('import', () => this.showSettings(onBack)),
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

    // Rebind keyboard controls (ESC stays as pause/cancel)
    showControls(onBack) {
      const g = this.game;
      const s = g.saveData.settings;
      const labels = { up: 'Move Up', down: 'Move Down', left: 'Move Left', right: 'Move Right', dash: 'Dash', charge: 'Charge Skill (hold)', skill: 'E Skill / Parry' };
      const current = (a) => (s.keys && s.keys[a]) || BR.INPUT_ACTIONS[a];
      const rows = Object.keys(BR.INPUT_ACTIONS).map((a) => `
        <div class="setting"><span>${labels[a]}</span><button class="btn small keybtn" data-bind="${a}">${BR.keyLabel(current(a))}</button></div>`).join('');
      const panel = UIRoot.show('dim', `
        <div class="heading">CONTROLS</div>
        <div class="subheading">버튼을 누른 뒤 새 키를 누르세요 · ESC = 취소 · 방향키는 항상 이동으로 동작</div>
        <div class="settings-box">${rows}</div>
        <div class="btn-row" style="margin-top:18px">
          <button class="btn" data-action="back">Back</button>
          <button class="btn" data-action="reset">Reset Defaults</button>
        </div>
      `);
      panel.querySelectorAll('[data-bind]').forEach((el) => el.addEventListener('click', () => {
        const action = el.dataset.bind;
        el.textContent = 'PRESS A KEY…';
        el.classList.add('active');
        g.input.capturing = true;
        const onKey = (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.removeEventListener('keydown', onKey, true);
          g.input.capturing = false;
          if (e.code !== 'Escape') {
            s.keys = Object.assign({}, s.keys);
            // a key can only do one thing: give the other action this action's old key
            for (const other of Object.keys(BR.INPUT_ACTIONS)) {
              if (other !== action && current(other) === e.code) s.keys[other] = current(action);
            }
            s.keys[action] = e.code;
            for (const a of Object.keys(s.keys)) if (s.keys[a] === BR.INPUT_ACTIONS[a]) delete s.keys[a];
            BR.SaveSystem.save(g.saveData);
            g.applySettings();
          }
          g.audio.play('button');
          this.showControls(onBack);
        };
        window.addEventListener('keydown', onKey, true);
      }));
      this._bind(panel, {
        back: () => onBack(),
        reset: () => { s.keys = {}; BR.SaveSystem.save(g.saveData); g.applySettings(); this.showControls(onBack); },
      });
    }

    // Move a save between devices/browsers as a copy-paste code
    showSaveCode(mode, onBack) {
      const g = this.game;
      const exporting = mode === 'export';
      let code = '';
      if (exporting) {
        const json = JSON.stringify({ save: g.saveData, run: BR.SaveSystem.loadRun() });
        code = 'BR1:' + btoa(unescape(encodeURIComponent(json)));
      }
      const panel = UIRoot.show('dim', `
        <div class="heading">${exporting ? 'EXPORT SAVE' : 'IMPORT SAVE'}</div>
        <div class="subheading">${exporting ? '이 코드를 복사해서 다른 기기의 IMPORT에 붙여넣으세요' : '다른 기기에서 EXPORT한 코드를 붙여넣으세요 — 현재 저장은 덮어써집니다'}</div>
        <textarea class="save-code" spellcheck="false" ${exporting ? 'readonly' : 'placeholder="BR1:..."'}>${code}</textarea>
        <div class="save-msg" data-role="msg"></div>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn" data-action="back">Back</button>
          <button class="btn primary" data-action="${exporting ? 'copy' : 'load'}">${exporting ? 'Copy' : 'Load'}</button>
        </div>
      `);
      const area = panel.querySelector('textarea');
      const msg = panel.querySelector('[data-role="msg"]');
      area.addEventListener('keydown', (e) => e.stopPropagation());
      this._bind(panel, {
        back: () => onBack(),
        copy: () => {
          area.select();
          const done = () => { msg.textContent = '복사했습니다.'; };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => { document.execCommand('copy'); done(); });
          else { document.execCommand('copy'); done(); }
        },
        load: () => {
          try {
            const raw = area.value.trim();
            if (!raw.startsWith('BR1:')) throw new Error('format');
            const data = JSON.parse(decodeURIComponent(escape(atob(raw.slice(4)))));
            if (!data || typeof data.save !== 'object' || typeof data.save.soul !== 'number') throw new Error('content');
            BR.SaveSystem.save(data.save);
            if (data.run) BR.SaveSystem.saveRun(data.run); else BR.SaveSystem.clearRun();
            g.saveData = BR.SaveSystem.load();
            g.applySettings();
            g.audio.play('reward');
            this.showMain();
          } catch (e) {
            msg.textContent = '올바른 저장 코드가 아닙니다.';
          }
        },
      });
    }

    _commitSettings(onBack) {
      BR.SaveSystem.save(this.game.saveData);
      this.game.applySettings();
      this.showSettings(onBack);
    }

    // Current build for the pause screen: upgrades, synergies, relics, key stats
    _buildSummaryHtml() {
      const g = this.game;
      const run = g.run, p = g.player;
      if (!run || !p) return '';
      const esc = escapeHtml;
      const s = p.stats;
      const ups = run.buildSummary().map((u) => `<span class="chip">${esc(u.name)}${u.stacks > 1 ? ` ×${u.stacks}` : ''}</span>`).join('') || '<span class="chip empty">No upgrades</span>';
      const syns = run.synergies.map((id) => BR.SYNERGIES.find((x) => x.id === id)).filter(Boolean)
        .map((x) => `<span class="chip syn">⚡ ${esc(x.name)}</span>`).join('');
      const relics = run.relics.map((r) => `<span class="chip relic">${r.icon} ${esc(r.name)}</span>`).join('');
      const mods = run.modifiers.map((m) => `<span class="chip mod">${m.icon} ${esc(m.name)}</span>`).join('');
      const stat = (k, v) => `<div class="pstat"><b>${v}</b><span>${k}</span></div>`;
      return `
        <div class="pause-build">
          <div class="pstats">
            ${stat('DAMAGE', Math.round(s.damage * s.damageMult))}
            ${stat('CRIT', `${Math.round(s.critChance * 100)}%`)}
            ${stat('ATK SPD', `${Math.round(s.attackSpeedMult * 100)}%`)}
            ${stat('MAX HP', s.maxHp)}
            ${stat('ARMOR', `${Math.round((1 - (1 - s.damageReduction) * s.damageTakenMult) * 100)}%`)}
            ${stat('DASH CD', `${s.dashCooldown.toFixed(2)}s`)}
          </div>
          <div class="build-chips">${mods}${relics}${syns}${ups}</div>
        </div>`;
    }

    showPause() {
      const g = this.game;
      const panel = UIRoot.show('soft', `
        <div class="heading">PAUSED</div>
        <div class="subheading">${escapeHtml(g.boss ? g.boss.name : '')}</div>
        ${this._buildSummaryHtml()}
        <div class="menu-buttons" style="margin-top:10px">
          <button class="btn primary" data-action="resume">Resume</button>
          <button class="btn" data-action="settings">Settings</button>
          ${g.run && g.run.mode === 'run' ? '<button class="btn" data-action="savequit">Save &amp; Quit</button>' : ''}
          <button class="btn" data-action="abandon">${g.run && g.run.mode === 'run' ? 'Abandon Run' : 'Quit'}</button>
        </div>
      `);
      this._bind(panel, {
        resume: () => g.setPaused(false),
        settings: () => this.showSettings(() => this.showPause()),
        abandon: () => g.abandonRun(),
        savequit: () => g.goToMenu(),
      });
    }
  }

  BR.UIRoot = UIRoot;
  BR.escapeHtml = escapeHtml;
  BR.MenuUI = MenuUI;
})();
