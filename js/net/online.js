/* Optional online features (global leaderboard, cloud save) on top of a supabasebutno backend.
   Disabled unless a server URL + anon key are configured, so builds without one behave exactly as before.
   Configure BR.CONFIG.ONLINE (shipped), or localStorage 'bossRush.online' = {"url":"…","anonKey":"…"} (testing; empty url forces it off).
   On localhost the local-dev server from BR.CONFIG.ONLINE_DEV is used instead of the public one.
   Every method resolves — never rejects — with { ok, … } so callers never need try/catch. */
(function () {
  'use strict';

  const STORE_KEY = 'bossRush.online';
  const MAX_NAME = 16;
  const MAX_SAVE_BYTES = 400 * 1024;

  function readConfig() {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
    const base = (local ? BR.CONFIG.ONLINE_DEV : BR.CONFIG.ONLINE) || {};
    let cfg = { url: base.url || '', anonKey: base.anonKey || '' };
    try {
      const o = JSON.parse(window.localStorage.getItem(STORE_KEY));
      if (o && typeof o.url === 'string' && typeof o.anonKey === 'string') cfg = { url: o.url, anonKey: o.anonKey };
    } catch (e) { /* no override */ }
    return cfg;
  }

  function friendly(error) {
    if (!error) return '알 수 없는 오류';
    if (error.status === 0 || /network|fetch|failed to/i.test(error.message || '')) return '서버에 연결할 수 없습니다';
    return error.message || '요청이 실패했습니다';
  }

  // Better result first: clears beat non-clears, then faster clear / deeper stage / faster time
  function better(a, b) {
    if (a.cleared !== b.cleared) return a.cleared;
    if (a.cleared) return a.time_ms < b.time_ms;
    if (a.stage !== b.stage) return a.stage > b.stage;
    return a.time_ms < b.time_ms;
  }

  const Online = {
    client: null,
    user: null,
    ready: false,
    cfg: readConfig(),

    get enabled() {
      return !!(this.cfg.url && this.cfg.anonKey && window.supabasebutno);
    },

    async init() {
      if (!this.enabled || this.client) return;
      try {
        const opts = { auth: { storageKey: 'bossRush.online.auth' } };
        if (/\.ngrok(-free)?\.(dev|app|io)$/i.test(new URL(this.cfg.url).hostname)) {
          // ngrok's free plan answers browser requests with a warning page unless this header is present
          opts.fetch = (input, init) => window.fetch(input, { ...init, headers: { ...Object.fromEntries(new Headers((init && init.headers) || {})), 'ngrok-skip-browser-warning': '1' } });
        }
        this.client = window.supabasebutno.createClient(this.cfg.url, this.cfg.anonKey, opts);
        this.client.auth.onAuthStateChange((event, session) => { this.user = session ? session.user : null; });
        const { data } = await this.client.auth.getSession();
        this.user = data && data.session ? data.session.user : null;
      } catch (e) {
        this.client = null;
      }
      this.ready = true;
    },

    displayName() {
      const u = this.user;
      if (!u) return '';
      const n = u.user_metadata && u.user_metadata.name;
      return String(n || (u.email || '').split('@')[0] || 'player').slice(0, MAX_NAME);
    },

    async signUp(email, password, name) {
      await this.init();
      if (!this.client) return { ok: false, error: '온라인 기능을 사용할 수 없습니다' };
      const nick = String(name || '').trim().slice(0, MAX_NAME);
      if (!nick) return { ok: false, error: '닉네임을 입력하세요' };
      const { error } = await this.client.auth.signUp({ email, password, data: { name: nick } });
      return error ? { ok: false, error: friendly(error) } : { ok: true };
    },

    async signIn(email, password) {
      await this.init();
      if (!this.client) return { ok: false, error: '온라인 기능을 사용할 수 없습니다' };
      const { error } = await this.client.auth.signInWithPassword({ email, password });
      return error ? { ok: false, error: friendly(error) } : { ok: true };
    },

    async signOut() {
      if (this.client) await this.client.auth.signOut();
      this.user = null;
      return { ok: true };
    },

    // ---- leaderboard ----------------------------------------------------

    boardKeyFor(run) {
      if (run.daily) return `daily-${String(run.daily).slice(0, 16)}`;
      return run.rush ? 'rush' : run.difficulty.id;
    },

    // Registers the finished run if it beats the player's own best on that board.
    async submitRun(run, cleared) {
      await this.init();
      if (!this.client) return { ok: false, status: 'off' };
      if (!this.user) return { ok: false, status: 'signed-out' };
      if (!run || run.mode !== 'run') return { ok: false, status: 'skipped' };
      const entry = {
        board: this.boardKeyFor(run),
        name: this.displayName(),
        character: run.character.id,
        time_ms: Math.round(run.time * 1000),
        stage: run.stage,
        cleared: !!cleared,
        mods: run.modifiers.map((m) => m.id).join(','),
      };
      if (entry.time_ms < 1000) return { ok: false, status: 'skipped' };
      try {
        const q = this.client.from('scores').select('id,cleared,stage,time_ms').eq('user_id', this.user.id).eq('board', entry.board);
        const { data: mine, error: readErr } = await q;
        if (readErr) return { ok: false, status: 'error', error: friendly(readErr) };
        const prev = (mine || []).map((r) => ({ id: r.id, cleared: !!r.cleared, stage: r.stage, time_ms: r.time_ms }));
        if (prev.some((p) => !better(entry, p))) return { ok: true, status: 'not-better' };
        const { data: rows, error } = await this.client.from('scores').insert({ ...entry, user_id: this.user.id }).select('id');
        if (error) return { ok: false, status: 'error', error: friendly(error) };
        const newId = rows && rows[0] && rows[0].id;
        if (newId !== undefined && prev.length) {
          // Keep a single (best) row per player per board
          await this.client.from('scores').delete().eq('user_id', this.user.id).eq('board', entry.board).neq('id', newId);
        }
        return { ok: true, status: 'submitted' };
      } catch (e) {
        return { ok: false, status: 'error', error: '서버에 연결할 수 없습니다' };
      }
    },

    // Top rows of a board: [{ name, character, cleared, stage, time_ms, mods, user_id }]
    async fetchBoard(board, limit) {
      await this.init();
      if (!this.client) return { ok: false, error: '온라인 기능을 사용할 수 없습니다', rows: [] };
      const cols = 'user_id,name,character,cleared,stage,time_ms,mods';
      try {
        const [clears, fails] = await Promise.all([
          this.client.from('scores').select(cols).eq('board', board).eq('cleared', true).order('time_ms', { ascending: true }).limit(50),
          this.client.from('scores').select(cols).eq('board', board).eq('cleared', false).order('stage', { ascending: false }).order('time_ms', { ascending: true }).limit(50),
        ]);
        const err = clears.error || fails.error;
        if (err) return { ok: false, error: friendly(err), rows: [] };
        const seen = new Set();
        const rows = [];
        for (const r of [...(clears.data || []), ...(fails.data || [])]) {
          if (seen.has(r.user_id)) continue; // one row per player
          seen.add(r.user_id);
          rows.push({ ...r, cleared: !!r.cleared });
        }
        rows.sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0));
        return { ok: true, rows: rows.slice(0, limit || 10) };
      } catch (e) {
        return { ok: false, error: '서버에 연결할 수 없습니다', rows: [] };
      }
    },

    // ---- cloud save -----------------------------------------------------

    // Stored on the server: { v, save } (settings stay per-device on download, see downloadSave)
    async uploadSave(saveData) {
      await this.init();
      if (!this.client || !this.user) return { ok: false, error: '로그인이 필요합니다' };
      const data = { v: 1, save: saveData };
      if (JSON.stringify(data).length > MAX_SAVE_BYTES) return { ok: false, error: '저장 데이터가 너무 큽니다' };
      try {
        const { error } = await this.client.from('cloud_saves').upsert(
          { user_id: this.user.id, data, updated_at: new Date().toISOString(), app_version: String(BR.GAME_VERSION || '') },
        );
        return error ? { ok: false, error: friendly(error) } : { ok: true };
      } catch (e) {
        return { ok: false, error: '서버에 연결할 수 없습니다' };
      }
    },

    // Returns { ok, exists, save, updatedAt, version }
    async fetchCloudSave() {
      await this.init();
      if (!this.client || !this.user) return { ok: false, error: '로그인이 필요합니다' };
      try {
        const { data, error } = await this.client.from('cloud_saves').select('data,updated_at,app_version').eq('user_id', this.user.id).maybeSingle();
        if (error) return { ok: false, error: friendly(error) };
        if (!data) return { ok: true, exists: false };
        const save = data.data && data.data.save;
        if (!save || typeof save !== 'object' || typeof save.soul !== 'number') return { ok: false, error: '클라우드 저장 데이터가 올바르지 않습니다' };
        return { ok: true, exists: true, save, updatedAt: data.updated_at, version: data.app_version };
      } catch (e) {
        return { ok: false, error: '서버에 연결할 수 없습니다' };
      }
    },
  };

  BR.Online = Online;
  if (Online.enabled) Online.init();
})();
