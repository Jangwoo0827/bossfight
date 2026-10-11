/* ONLINE screens: account, cloud save, global leaderboard. Only reachable when BR.Online.enabled. */
(function () {
  'use strict';

  const esc = (s) => BR.escapeHtml(s);

  function fmtTime(sec) {
    sec = Math.round(sec || 0);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}h ${m}m` : `${m}:${String(s).padStart(2, '0')}`;
  }

  function fmtMs(ms) {
    const t = ms / 1000;
    const m = Math.floor(t / 60);
    return `${m}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  }

  function saveSummary(save) {
    const st = save.stats || {};
    return `RUNS ${st.runs || 0} · CLEARS ${st.clears || 0} · BEST ${st.bestStage || 0} · SOUL ${save.soul || 0} · ${fmtTime(st.playTime)}`;
  }

  class OnlineUI {
    constructor(game) {
      this.game = game;
    }

    _bind(panel, handlers) {
      panel.querySelectorAll('[data-action]').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const fn = handlers[el.dataset.action];
          if (fn) { this.game.audio.play('button'); fn(el); }
        });
      });
      // Typing must not reach the game's key handling (R = restart, Space, WASD…)
      panel.querySelectorAll('input').forEach((el) => el.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && handlers.enter) handlers.enter();
      }));
    }

    // Account screen (sign in / sign up, or the signed-in hub)
    async show(onBack) {
      const O = BR.Online;
      await O.init();
      if (O.user) this.showHub(onBack);
      else this.showSignIn(onBack);
    }

    showSignIn(onBack, note) {
      const panel = BR.UIRoot.show('dim', `
        <div class="heading">ONLINE</div>
        <div class="subheading">로그인하면 전 세계 순위에 기록을 올리고 클라우드에 저장할 수 있어요</div>
        <div class="settings-box online-form">
          <label>이메일<input type="email" data-role="email" autocomplete="username" maxlength="120"></label>
          <label>비밀번호<input type="password" data-role="password" autocomplete="current-password" maxlength="200"></label>
          <label>닉네임 <small>(회원가입 시, 최대 16자)</small><input type="text" data-role="name" maxlength="16"></label>
          <div class="save-msg" data-role="msg">${esc(note || '')}</div>
        </div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn" data-action="back">Back</button>
          <button class="btn primary" data-action="signin">Sign In</button>
          <button class="btn" data-action="signup">Sign Up</button>
        </div>
        <div class="shop-note">비밀번호는 서버에 해시로만 저장돼요. 게임 서버와 다른 사이트의 비밀번호는 쓰지 마세요.</div>
      `);
      const q = (r) => panel.querySelector(`[data-role="${r}"]`);
      const msg = q('msg');
      const busy = (on) => panel.querySelectorAll('button').forEach((b) => { b.disabled = on; });
      const run = async (fn) => {
        const email = q('email').value.trim(), password = q('password').value;
        if (!email || !password) { msg.textContent = '이메일과 비밀번호를 입력하세요'; return; }
        busy(true); msg.textContent = '…';
        const res = await fn(email, password);
        if (res.ok) this.showHub(onBack); else { busy(false); msg.textContent = res.error; }
      };
      const signin = () => run((e, p) => BR.Online.signIn(e, p));
      this._bind(panel, {
        back: () => onBack(),
        signin,
        signup: () => run((e, p) => BR.Online.signUp(e, p, q('name').value)),
        enter: signin,
      });
    }

    showHub(onBack, note) {
      const O = BR.Online;
      const panel = BR.UIRoot.show('dim', `
        <div class="heading">ONLINE</div>
        <div class="subheading">${esc(O.displayName())} · ${esc(O.user.email)}</div>
        <div class="menu-buttons">
          <button class="btn primary" data-action="board">Global Leaderboard</button>
          <button class="btn" data-action="cloud">Cloud Save</button>
          <button class="btn" data-action="signout">Sign Out</button>
          <button class="btn" data-action="back">Back</button>
        </div>
        <div class="save-msg" data-role="msg">${esc(note || '')}</div>
      `);
      this._bind(panel, {
        board: () => this.showLeaderboard(() => this.showHub(onBack), 'normal'),
        cloud: () => this.showCloud(() => this.showHub(onBack)),
        signout: async () => { await BR.Online.signOut(); this.showSignIn(onBack, '로그아웃했습니다'); },
        back: () => onBack(),
      });
    }

    // ---- cloud save ---------------------------------------------------------

    async showCloud(onBack, note) {
      const g = this.game;
      let panel = BR.UIRoot.show('dim', '<div class="heading">CLOUD SAVE</div><div class="subheading">불러오는 중…</div>');
      const cloud = await BR.Online.fetchCloudSave();
      if (!document.body.contains(panel)) return; // the player left meanwhile
      const local = saveSummary(g.saveData);
      const remote = cloud.ok && cloud.exists ? saveSummary(cloud.save) : cloud.ok ? '저장된 데이터 없음' : '—';
      const when = cloud.ok && cloud.exists && cloud.updatedAt ? new Date(cloud.updatedAt.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(cloud.updatedAt) ? '' : 'Z')).toLocaleString() : '';
      panel = BR.UIRoot.show('dim', `
        <div class="heading">CLOUD SAVE</div>
        <div class="subheading">진행 상황을 계정에 저장하고 다른 기기에서 불러옵니다 (설정·키 배치는 기기마다 따로 유지)</div>
        <div class="settings-box online-form">
          <div class="cloud-row"><b>이 기기</b><span>${esc(local)}</span></div>
          <div class="cloud-row"><b>클라우드</b><span>${esc(remote)}${when ? `<br><small>${esc(when)}${cloud.version ? ` · v${esc(cloud.version)}` : ''}</small>` : ''}</span></div>
          <div class="save-msg" data-role="msg">${esc(cloud.ok ? (note || '') : cloud.error)}</div>
        </div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn" data-action="back">Back</button>
          <button class="btn primary" data-action="up">Upload</button>
          <button class="btn" data-action="down" ${cloud.ok && cloud.exists ? '' : 'disabled'}>Download</button>
        </div>
        <div class="shop-note">Upload는 클라우드를, Download는 이 기기의 저장을 덮어씁니다 (한 번 더 확인해요)</div>
      `);
      const msg = panel.querySelector('[data-role="msg"]');
      const confirmed = (el, text) => {
        if (el.dataset.confirm) return true;
        el.dataset.confirm = '1';
        el.textContent = 'Confirm?';
        msg.textContent = text;
        return false;
      };
      this._bind(panel, {
        back: () => onBack(),
        up: async (el) => {
          if (cloud.ok && cloud.exists && !confirmed(el, `클라우드의 기존 저장(${remote})이 사라집니다. 다시 누르면 업로드해요.`)) return;
          panel.querySelectorAll('button').forEach((b) => { b.disabled = true; });
          msg.textContent = '업로드 중…';
          const res = await BR.Online.uploadSave(g.saveData);
          this.showCloud(onBack, res.ok ? '업로드했습니다.' : res.error);
        },
        down: (el) => {
          if (!confirmed(el, `이 기기의 저장(${local})을 클라우드 것으로 덮어씁니다. 다시 누르면 진행해요.`)) return;
          const keep = g.saveData.settings; // sound / keybinds / accessibility stay per device
          const incoming = JSON.parse(JSON.stringify(cloud.save));
          incoming.settings = keep;
          BR.SaveSystem.save(incoming);
          g.saveData = BR.SaveSystem.load();
          g.applySettings();
          g.audio.play('reward');
          this.showCloud(onBack, '불러왔습니다.');
        },
      });
    }

    // ---- global leaderboard -------------------------------------------------

    async showLeaderboard(onBack, tab) {
      const g = this.game;
      const daily = BR.dailyInfo();
      const tabs = [
        ...BR.DIFFICULTIES.map((d) => ({ id: d.id, name: d.name, color: d.color })),
        { id: 'rush', name: 'BOSS RUSH', color: '#ffd76a' },
        { id: `daily-${daily.date}`, name: 'TODAY', color: '#7fe3ff' },
      ];
      const total = tab === 'rush' ? BR.RUSH_ORDER.length : (BR.DIFFICULTY_BY_ID[tab] || {}).bosses || BR.CONFIG.RUN.totalBosses;
      const shell = (inner) => BR.UIRoot.show('dim', `
        <div class="heading">GLOBAL LEADERBOARD</div>
        <div class="subheading">전 세계 플레이어 TOP 10 · 한 사람당 최고 기록 1개</div>
        <div class="seg lb-tabs">${tabs.map((t) => `<button class="btn ${t.id === tab ? 'active' : ''}" style="--accent:${t.color}" data-tab="${esc(t.id)}">${t.name}</button>`).join('')}</div>
        <div class="lb-list">${inner}</div>
        <div class="btn-row" style="margin-top:14px"><button class="btn" data-action="back">Back</button></div>
      `);
      const wire = (panel) => {
        panel.querySelectorAll('[data-tab]').forEach((el) => el.addEventListener('click', () => {
          g.audio.play('button');
          this.showLeaderboard(onBack, el.dataset.tab);
        }));
        panel.querySelector('[data-action="back"]').addEventListener('click', () => { g.audio.play('button'); onBack(); });
      };
      let panel = shell('<div class="lb-empty">불러오는 중…</div>');
      wire(panel);
      const res = await BR.Online.fetchBoard(tab, 10);
      if (!document.body.contains(panel)) return;
      const me = BR.Online.user && BR.Online.user.id;
      const rows = !res.ok ? `<div class="lb-empty">${esc(res.error)}</div>`
        : res.rows.length ? res.rows.map((e, i) => `
        <div class="lb-row global ${i === 0 ? 'top' : ''} ${me && e.user_id === me ? 'me' : ''}">
          <span class="lb-rank">#${i + 1}</span>
          <span class="lb-name">${esc(e.name)}</span>
          <span class="lb-res ${e.cleared ? 'clear' : ''}">${e.cleared ? 'CLEAR' : `FIGHT ${e.stage}/${total}`}</span>
          <span class="lb-time">${fmtMs(e.time_ms)}</span>
          <span class="lb-char">${esc((BR.CHARACTER_BY_ID[e.character] || {}).name || e.character || '')}</span>
          <span class="lb-mods">${String(e.mods || '').split(',').filter(Boolean).map((m) => (BR.MODIFIER_BY_ID[m] || {}).icon || '').join(' ')}</span>
        </div>`).join('') : '<div class="lb-empty">아직 기록이 없습니다 — 첫 기록을 세워보세요</div>';
      panel = shell(rows);
      wire(panel);
    }

    // After a run: register it online (if signed in) and show the outcome on the result screen
    async submitFromResult(run, cleared) {
      const O = BR.Online;
      if (!O.enabled) return;
      const line = document.createElement('div');
      line.className = 'online-status';
      const host = document.querySelector('#ui-root .overlay .hint-line');
      if (host && host.parentNode) host.parentNode.insertBefore(line, host.nextSibling);
      await O.init();
      if (!O.user) { line.textContent = 'ONLINE · 로그인하면 이 기록을 전 세계 순위에 올릴 수 있어요'; return; }
      line.textContent = 'ONLINE · 기록 전송 중…';
      const res = await O.submitRun(run, cleared);
      const text = {
        submitted: 'ONLINE · 전 세계 순위에 기록을 올렸어요',
        'not-better': 'ONLINE · 내 온라인 최고 기록보다 낮아 등록하지 않았어요',
        skipped: '',
      }[res.status];
      line.textContent = text === undefined ? `ONLINE · 전송 실패 (${res.error || res.status})` : text;
    }
  }

  BR.OnlineUI = OnlineUI;
})();
