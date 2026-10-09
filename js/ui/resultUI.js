/* RUN FAILED / RUN CLEAR summary. */
(function () {
  'use strict';

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // 1200x630 result card, saved as PNG (for sharing)
  function makeShareCard(g, cleared) {
    const D = BR.Draw;
    const run = g.run;
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 630;
    const x = c.getContext('2d');
    const bg = x.createLinearGradient(0, 0, 1200, 630);
    bg.addColorStop(0, '#120a1c');
    bg.addColorStop(1, '#05030a');
    x.fillStyle = bg;
    x.fillRect(0, 0, 1200, 630);
    x.strokeStyle = cleared ? '#ffd76a' : '#ff4d6a';
    x.lineWidth = 4;
    x.strokeRect(14, 14, 1172, 602);
    D.text(x, 'BOSS RUSH', 60, 78, { size: 44, align: 'left', font: 'Georgia', weight: '700', color: '#fff' });
    D.text(x, cleared ? 'RUN CLEAR' : 'RUN FAILED', 60, 160, { size: 72, align: 'left', font: 'Georgia', weight: '700', color: cleared ? '#ffd76a' : '#ff4d6a' });
    const tag = `${run.daily ? `DAILY ${run.daily} · ` : ''}${run.difficulty.name} · ${run.character.name}`;
    D.text(x, tag, 62, 220, { size: 22, align: 'left', color: run.difficulty.color, weight: '700' });
    const stats = [
      [`${run.stage} / ${run.totalBosses}`, 'BOSSES'],
      [formatTime(run.time), 'TIME'],
      [`+${run.soulEarned}`, 'SOUL'],
      [`${Math.round(run.damageDealt).toLocaleString()}`, 'DAMAGE'],
    ];
    stats.forEach(([v, k], i) => {
      const bx = 60 + i * 270;
      x.fillStyle = 'rgba(255,255,255,0.05)';
      x.fillRect(bx, 260, 250, 96);
      D.text(x, v, bx + 125, 298, { size: 34, color: '#fff', weight: '800' });
      D.text(x, k, bx + 125, 336, { size: 14, color: '#9890b2', weight: '700' });
    });
    const extra = [
      ...run.modifiers.map((m) => `${m.icon} ${m.name}`),
      ...run.relics.map((r) => `${r.icon} ${r.name}`),
      ...run.synergies.map((id) => `⚡ ${(BR.SYNERGIES.find((s) => s.id === id) || {}).name || id}`),
      ...run.buildSummary().map((u) => `${u.name}${u.stacks > 1 ? ` ×${u.stacks}` : ''}`),
    ];
    let cx = 60, cy = 392;
    x.font = '600 17px Segoe UI, Malgun Gothic, sans-serif';
    for (const label of extra) {
      const w = x.measureText(label).width + 22;
      if (cx + w > 1140) { cx = 60; cy += 40; }
      if (cy > 520) break;
      x.fillStyle = 'rgba(160,120,255,0.16)';
      x.fillRect(cx, cy, w, 30);
      D.text(x, label, cx + w / 2, cy + 16, { size: 17, color: '#e2d8ff', weight: '600' });
      cx += w + 10;
    }
    D.text(x, 'jangwoo0827.github.io/bossfight', 1140, 590, { size: 18, align: 'right', color: '#8d86a6', weight: '600' });
    return c;
  }

  // Text summary for chats, e.g. "🟩🟩🟩💀⬜ 3/5"
  function shareText(g, cleared) {
    const run = g.run;
    const marks = [];
    for (let i = 0; i < run.totalBosses; i++) marks.push(i < run.stage ? '🟩' : (!cleared && i === run.stage ? '💀' : '⬜'));
    const mode = run.rush ? 'BOSS RUSH' : run.daily ? `DAILY ${run.daily}` : run.difficulty.name;
    const mods = run.modifiers.map((m) => `${m.icon} ${m.name}`).join(' ');
    return [
      `BOSS RUSH — ${cleared ? 'RUN CLEAR' : 'RUN FAILED'}`,
      `${mode} · ${run.character.name}${mods ? ' · ' + mods : ''}`,
      `${marks.join('')} ${run.stage}/${run.totalBosses} · ${formatTime(run.time)}`,
      'https://jangwoo0827.github.io/bossfight/',
    ].join('\n');
  }
  BR.shareText = shareText;

  function downloadCard(canvas) {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bossrush-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
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
        ${g.lastRank ? `<div class="rank-badge">NEW RECORD · #${g.lastRank} ${run.rush ? 'BOSS RUSH' : run.difficulty.name}</div>` : ''}
        <div class="subheading" style="margin-bottom:4px;color:${run.difficulty.color}">${run.rush ? 'BOSS RUSH · ' : ''}${run.daily ? `DAILY ${run.daily} · ` : ''}${run.difficulty.name} · ${esc(run.character.name)}${run.modifiers.length ? ' · ' + run.modifiers.map((m) => m.icon + ' ' + esc(m.name)).join(' ') : ''}</div>
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
          <button class="btn" data-action="copy">Copy Result</button>
          <button class="btn" data-action="share">Save Image</button>
          <button class="btn" data-action="shop">Upgrades (${g.saveData.soul} Soul)</button>
          <button class="btn" data-action="menu">Main Menu</button>
        </div>
        <div class="shop-note">R 키로 바로 재시작</div>
      `);
      panel.querySelectorAll('[data-action]').forEach((el) => {
        el.addEventListener('click', () => {
          g.audio.play('button');
          const action = el.dataset.action;
          if (action === 'share') { downloadCard(makeShareCard(g, cleared)); return; }
          if (action === 'copy') {
            const text = shareText(g, cleared);
            const done = () => { el.textContent = 'Copied!'; };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
            else done();
            return;
          }
          this.hide();
          if (action === 'retry') this._retry(run);
          else if (action === 'shop') g.goToMenu('shop');
          else g.goToMenu();
        });
      });
      window.addEventListener('keydown', this.onKey);
    }

    showPractice(cleared) {
      const g = this.game;
      const setup = g.practiceSetup || {};
      const def = BR.BOSS_BY_ID[setup.bossId];
      const boss = g.boss;
      const panel = BR.UIRoot.show('dim', `
        <div class="result-title ${cleared ? 'clear' : 'fail'}" style="font-size:56px">${cleared ? 'PRACTICE CLEAR' : 'PRACTICE OVER'}</div>
        <div class="subheading">${def ? BR.escapeHtml(def.name) : ''} · Phase ${setup.phase || 1}부터 · ${formatTime(g.run.time)}${!cleared && boss ? ` · 남은 HP ${Math.round((boss.hp / boss.maxHp) * 100)}%` : ''}</div>
        <div class="hint-line">${def ? BR.escapeHtml(def.tip) : ''}</div>
        <div class="btn-row">
          <button class="btn primary" data-action="retry">Retry (R)</button>
          <button class="btn" data-action="pick">Choose Boss</button>
          <button class="btn" data-action="menu">Main Menu</button>
        </div>
      `);
      const retry = () => { this.hide(); g.startPractice(setup.bossId, setup.characterId, setup.phase); };
      this._practiceKey = (e) => { if (e.code === 'KeyR') retry(); };
      window.addEventListener('keydown', this._practiceKey);
      panel.querySelectorAll('[data-action]').forEach((el) => el.addEventListener('click', () => {
        g.audio.play('button');
        const a = el.dataset.action;
        if (a === 'retry') return retry();
        this.hide();
        if (a === 'pick') { g.goToMenu(); g.ui.menu.showPractice(setup); } else g.goToMenu();
      }));
    }

    showSecret(cleared, soul) {
      const g = this.game;
      const panel = BR.UIRoot.show('dim', `
        <div class="result-title ${cleared ? 'clear' : 'fail'}" style="font-size:56px">${cleared ? 'DUMMY DESTROYED' : 'THE DUMMY WINS'}</div>
        <div class="subheading">${cleared ? (soul ? `비밀을 파헤친 보상 · <b style="color:#ffd76a">+${soul} SOUL</b>` : '이미 한 번 쓰러뜨린 상대 — 보상은 처음 한 번뿐') : '더미는 아직 멀쩡하다…'}</div>
        <div class="hint-line">${cleared ? '이 일은 비밀로 하자.' : '다시 도전하려면 튜토리얼에서 더미를 또 부수면 된다.'}</div>
        <div class="btn-row">
          <button class="btn primary" data-action="retry">Retry</button>
          <button class="btn" data-action="menu">Main Menu</button>
        </div>
      `);
      panel.querySelectorAll('[data-action]').forEach((el) => el.addEventListener('click', () => {
        g.audio.play('button');
        this.hide();
        if (el.dataset.action === 'retry') g._startSpecial('secret', 'secretDummy', g.secretChar || g.saveData.settings.lastCharacter);
        else g.goToMenu();
      }));
    }

    showTutorialDone() {
      const g = this.game;
      const panel = BR.UIRoot.show('dim', `
        <div class="result-title clear" style="font-size:56px">READY TO HUNT</div>
        <div class="subheading">기본기를 모두 익혔다. 이제 진짜 보스가 기다린다.</div>
        <div class="hint-line">팁: 빨간 영역의 채워지는 속도 = 남은 시간 · 보스가 휘두른 직후가 반격 타이밍 · PARRY는 회복도 된다</div>
        <div class="btn-row">
          <button class="btn primary" data-action="run">Start Run</button>
          <button class="btn" data-action="menu">Main Menu</button>
        </div>
      `);
      panel.querySelectorAll('[data-action]').forEach((el) => el.addEventListener('click', () => {
        g.audio.play('button');
        this.hide();
        g.goToMenu();
        if (el.dataset.action === 'run') g.ui.menu.showRunSetup();
      }));
    }

    _retry(run) {
      if (run.rush) { this.game.startRush(run.character.id); return; }
      this.game.startRun(run.character.id, run.difficulty.id, run.modifiers.map((m) => m.id), { daily: !!run.daily });
    }

    onKey(e) {
      if (e.code === 'KeyR') {
        const run = this.game.run;
        this.hide();
        this._retry(run);
      }
    }

    hide() {
      window.removeEventListener('keydown', this.onKey);
      if (this._practiceKey) window.removeEventListener('keydown', this._practiceKey);
      this._practiceKey = null;
      BR.UIRoot.clear();
    }
  }

  BR.makeShareCard = makeShareCard;
  BR.ResultUI = ResultUI;
})();
