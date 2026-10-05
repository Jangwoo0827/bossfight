/* RECORDS screen: lifetime stats + bestiary on the left, achievement grid on the right. */
(function () {
  'use strict';

  function fmtTime(sec) {
    sec = Math.round(sec || 0);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}h ${m}m` : `${m}:${String(s).padStart(2, '0')}`;
  }

  class RecordsUI {
    constructor(game) {
      this.game = game;
    }

    show(onBack) {
      const g = this.game;
      const esc = BR.escapeHtml;
      const st = g.saveData.stats;
      const done = g.saveData.achievements;
      const totalKills = Object.values(st.bossKills).reduce((a, b) => a + b, 0);

      const statRows = [
        ['Runs', st.runs],
        ['Clears', st.clears],
        ['Bosses Slain', totalKills],
        ['Deaths', st.deaths],
        ['Parries', st.parries],
        ['Finishers', st.finishers],
        ['Flawless Kills', st.flawlessBosses],
        ['Fastest Kill', st.fastestBoss ? `${st.fastestBoss}s` : '—'],
        ['Damage Dealt', Math.round(st.totalDamage).toLocaleString()],
        ['Play Time', fmtTime(st.playTime)],
        ['Soul Earned', st.totalSoul.toLocaleString()],
      ].map(([k, v]) => `<div class="rec-row"><span>${k}</span><b>${v}</b></div>`).join('');

      const bestRows = BR.DIFFICULTIES.map((d) => `
        <div class="rec-row"><span style="color:${d.color}">${d.name}</span>
        <b>${st.clearsByDifficulty[d.id] ? `${st.clearsByDifficulty[d.id]}× · ${fmtTime(st.bestClearTime[d.id])}` : '—'}</b></div>`).join('');

      const bestiary = BR.BOSS_DATA.map((b) => {
        const kills = st.bossKills[b.id] || 0;
        const deaths = st.bossDeaths[b.id] || 0;
        return `<div class="beast ${kills ? '' : 'unknown'}" style="--accent:${b.color}">
          <span class="bname">${kills ? esc(b.name) : '???'}</span>
          <span class="bkd">${kills}<small>K</small> ${deaths}<small>D</small></span></div>`;
      }).join('');

      const unlockedCount = BR.ACHIEVEMENTS.filter((a) => done[a.id]).length;
      const achCards = BR.ACHIEVEMENTS.map((a) => {
        const [cur, target] = a.progress(st);
        const ok = !!done[a.id];
        const pct = Math.max(0, Math.min(1, cur / target));
        return `<div class="ach ${ok ? 'ok' : ''}">
          <div class="ach-icon">${a.icon}</div>
          <div class="ach-body">
            <div class="ach-name">${esc(a.name)}</div>
            <div class="ach-desc">${esc(a.desc)}</div>
            <div class="ach-bar"><div style="width:${pct * 100}%"></div></div>
          </div>
          <div class="ach-prog">${ok ? '✓' : `${Math.min(cur, target)}/${target}`}</div>
        </div>`;
      }).join('');

      const panel = BR.UIRoot.show('dim records', `
        <div class="rec-wrap">
          <div class="rec-left">
            <div class="rec-title">STATS</div>
            <div class="rec-box">${statRows}</div>
            <div class="rec-title">BEST CLEARS</div>
            <div class="rec-box">${bestRows}</div>
            <div class="rec-title">BESTIARY <small>${Object.keys(st.bossKills).length} / ${BR.BOSS_DATA.length}</small></div>
            <div class="bestiary">${bestiary}</div>
          </div>
          <div class="rec-right">
            <div class="rec-title">ACHIEVEMENTS <small>${unlockedCount} / ${BR.ACHIEVEMENTS.length}</small></div>
            <div class="ach-grid">${achCards}</div>
          </div>
        </div>
        <div class="btn-row" style="margin-top:14px"><button class="btn" data-action="back">Back</button><button class="btn" data-action="board">Leaderboard</button></div>
      `);
      panel.querySelector('[data-action="back"]').addEventListener('click', () => {
        g.audio.play('button');
        onBack();
      });
      panel.querySelector('[data-action="board"]').addEventListener('click', () => {
        g.audio.play('button');
        this.showLeaderboard(() => this.show(onBack), 'normal');
      });
    }

    showLeaderboard(onBack, tab) {
      const g = this.game;
      const esc = BR.escapeHtml;
      const board = g.saveData.stats.leaderboard || {};
      const tabs = [...BR.DIFFICULTIES.map((d) => ({ id: d.id, name: d.name, color: d.color })), { id: 'rush', name: 'BOSS RUSH', color: '#ffd76a' }];
      const list = board[tab] || [];
      const total = tab === 'rush' ? BR.RUSH_ORDER.length : (BR.DIFFICULTY_BY_ID[tab] || {}).bosses;
      const rows = list.length ? list.map((e, i) => `
        <div class="lb-row ${i === 0 ? 'top' : ''}">
          <span class="lb-rank">#${i + 1}</span>
          <span class="lb-res ${e.cleared ? 'clear' : ''}">${e.cleared ? 'CLEAR' : `BOSS ${e.stage}/${total}`}</span>
          <span class="lb-time">${fmtTime(e.time)}</span>
          <span class="lb-char">${esc((BR.CHARACTER_BY_ID[e.character] || {}).name || e.character)}</span>
          <span class="lb-mods">${(e.mods || []).map((m) => (BR.MODIFIER_BY_ID[m] || {}).icon || '').join(' ')}</span>
          <span class="lb-date">${esc(e.date || '')}</span>
        </div>`).join('') : '<div class="lb-empty">아직 기록이 없습니다 — 첫 기록을 세워보세요</div>';
      const panel = BR.UIRoot.show('dim', `
        <div class="heading">LEADERBOARD</div>
        <div class="subheading">이 기기의 최고 기록 TOP 10 · 클리어 시간 순 (미클리어는 도달한 보스 순)</div>
        <div class="seg lb-tabs">${tabs.map((t) => `<button class="btn ${t.id === tab ? 'active' : ''}" style="--accent:${t.color}" data-tab="${t.id}">${t.name}</button>`).join('')}</div>
        <div class="lb-list">${rows}</div>
        <div class="btn-row" style="margin-top:14px"><button class="btn" data-action="back">Back</button></div>
      `);
      panel.querySelectorAll('[data-tab]').forEach((el) => el.addEventListener('click', () => {
        g.audio.play('button');
        this.showLeaderboard(onBack, el.dataset.tab);
      }));
      panel.querySelector('[data-action="back"]').addEventListener('click', () => { g.audio.play('button'); onBack(); });
    }
  }

  BR.RecordsUI = RecordsUI;
})();
