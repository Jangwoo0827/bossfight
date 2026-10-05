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
        <div class="btn-row" style="margin-top:14px"><button class="btn" data-action="back">Back</button></div>
      `);
      panel.querySelector('[data-action="back"]').addEventListener('click', () => {
        g.audio.play('button');
        onBack();
      });
    }
  }

  BR.RecordsUI = RecordsUI;
})();
