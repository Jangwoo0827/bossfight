/* Optional online features (global leaderboard, cloud save) on top of Firebase (Auth + Firestore).
   Disabled unless a Firebase web config is set, so builds without one behave exactly as before.
   Configure BR.CONFIG.ONLINE = { firebase: { apiKey, authDomain, projectId, appId } },
   or (testing) localStorage 'bossRush.online' = {"firebase":{…}} — {"firebase":null} forces it off.
   The Firebase SDK is loaded lazily from Google's CDN the first time online is needed, so the game
   itself never waits for (or breaks without) the network.
   Every method resolves — never rejects — with { ok, … } so callers never need try/catch.
   Data model + security rules: firebase/firestore.rules. */
(function () {
  'use strict';

  const STORE_KEY = 'bossRush.online';
  const SDK_VERSION = '10.14.1';
  const SDK_FILES = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'];
  const MAX_NAME = 16;
  const MAX_SAVE_CHARS = 380000;
  const TIMEOUT_MS = 15000;

  function readConfig() {
    let fb = (BR.CONFIG.ONLINE || {}).firebase || null;
    try {
      const o = JSON.parse(window.localStorage.getItem(STORE_KEY));
      if (o && 'firebase' in o) fb = o.firebase;
    } catch (e) { /* no override */ }
    return fb && fb.apiKey && fb.projectId ? fb : null;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error('sdk'));
      document.head.appendChild(el);
    });
  }

  const withTimeout = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({ code: 'timeout' }), TIMEOUT_MS))]);

  function friendly(e) {
    const code = (e && e.code) || '';
    const map = {
      'auth/email-already-in-use': '이미 가입된 이메일입니다',
      'auth/invalid-email': '이메일 형식이 올바르지 않습니다',
      'auth/weak-password': '비밀번호는 6자 이상이어야 합니다',
      'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다',
      'auth/wrong-password': '이메일 또는 비밀번호가 올바르지 않습니다',
      'auth/user-not-found': '이메일 또는 비밀번호가 올바르지 않습니다',
      'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 해주세요',
      'auth/network-request-failed': '서버에 연결할 수 없습니다',
      'auth/operation-not-allowed': '이메일 로그인이 꺼져 있습니다 (Firebase 설정 확인)',
      'permission-denied': '권한이 없습니다',
      unavailable: '서버에 연결할 수 없습니다',
      timeout: '서버 응답이 없습니다',
    };
    return map[code] || '요청이 실패했습니다';
  }

  const Online = {
    fb: null,
    auth: null,
    db: null,
    user: null, // { id, email, name } — same shape the UI used with the previous backend
    ready: false,
    _starting: null,
    cfg: readConfig(),

    get enabled() {
      return !!this.cfg;
    },

    // Loads the SDK, waits for the stored session to be restored. Safe to call repeatedly.
    init() {
      if (!this.enabled) return Promise.resolve();
      if (!this._starting) this._starting = this._start();
      return this._starting;
    },

    async _start() {
      try {
        if (!window.firebase) {
          for (const f of SDK_FILES) await loadScript(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/${f}`);
        }
        const fb = window.firebase;
        this.fb = fb.apps.length ? fb.app() : fb.initializeApp(this.cfg);
        this.auth = fb.auth();
        this.db = fb.firestore();
        await new Promise((resolve) => {
          let first = true;
          this.auth.onAuthStateChanged((u) => {
            this._setUser(u);
            if (first) { first = false; resolve(); }
          });
        });
      } catch (e) {
        this.auth = null;
        this.db = null;
        this._starting = null; // allow a retry later
      }
      this.ready = true;
    },

    _setUser(u) {
      this.user = u ? { id: u.uid, email: u.email || '', name: u.displayName || '' } : null;
    },

    get available() {
      return !!(this.auth && this.db);
    },

    displayName() {
      const u = this.user;
      if (!u) return '';
      return String(u.name || (u.email || '').split('@')[0] || 'player').slice(0, MAX_NAME);
    },

    async signUp(email, password, name) {
      await this.init();
      if (!this.available) return { ok: false, error: '온라인 기능을 사용할 수 없습니다' };
      const nick = String(name || '').trim().slice(0, MAX_NAME);
      if (!nick) return { ok: false, error: '닉네임을 입력하세요' };
      try {
        const cred = await withTimeout(this.auth.createUserWithEmailAndPassword(email, password));
        await cred.user.updateProfile({ displayName: nick });
        this._setUser(this.auth.currentUser);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: friendly(e) };
      }
    },

    async signIn(email, password) {
      await this.init();
      if (!this.available) return { ok: false, error: '온라인 기능을 사용할 수 없습니다' };
      try {
        await withTimeout(this.auth.signInWithEmailAndPassword(email, password));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: friendly(e) };
      }
    },

    async signOut() {
      try { if (this.auth) await this.auth.signOut(); } catch (e) { /* local state is cleared below anyway */ }
      this.user = null;
      return { ok: true };
    },

    // ---- leaderboard ----------------------------------------------------

    boardKeyFor(run) {
      if (run.daily) return `daily-${String(run.daily).replace(/[^0-9-]/g, '').slice(0, 10)}`;
      return run.rush ? 'rush' : run.difficulty.id;
    },

    // Higher = better. Mirrors the formula enforced in firebase/firestore.rules.
    sortValue(cleared, stage, timeMs) {
      return (cleared ? 1e12 : stage * 1e9) + 1e9 - timeMs;
    },

    // Registers the finished run if it beats the player's own best on that board.
    async submitRun(run, cleared) {
      await this.init();
      if (!this.available) return { ok: false, status: 'off' };
      if (!this.user) return { ok: false, status: 'signed-out' };
      if (!run || run.mode !== 'run') return { ok: false, status: 'skipped' };
      const board = this.boardKeyFor(run);
      const timeMs = Math.round(run.time * 1000);
      const stage = Math.max(0, Math.min(12, run.stage | 0));
      if (timeMs < 1000 || timeMs > 86400000) return { ok: false, status: 'skipped' };
      const sort = this.sortValue(!!cleared, stage, timeMs);
      const ref = this.db.doc(`boards/${board}/scores/${this.user.id}`);
      try {
        const prev = await withTimeout(ref.get());
        if (prev.exists && !(sort > prev.data().sort)) return { ok: true, status: 'not-better' };
        await withTimeout(ref.set({
          uid: this.user.id,
          name: this.displayName(),
          character: String(run.character.id).slice(0, 24),
          time_ms: timeMs,
          stage,
          cleared: !!cleared,
          mods: run.modifiers.map((m) => m.id).join(',').slice(0, 80),
          sort,
          at: window.firebase.firestore.FieldValue.serverTimestamp(),
        }));
        return { ok: true, status: 'submitted' };
      } catch (e) {
        return { ok: false, status: 'error', error: friendly(e) };
      }
    },

    // Top rows of a board: [{ user_id, name, character, cleared, stage, time_ms, mods }]
    async fetchBoard(board, limit) {
      await this.init();
      if (!this.available) return { ok: false, error: '온라인 기능을 사용할 수 없습니다', rows: [] };
      try {
        const snap = await withTimeout(this.db.collection(`boards/${board}/scores`).orderBy('sort', 'desc').limit(limit || 10).get());
        const rows = [];
        snap.forEach((doc) => {
          const d = doc.data();
          rows.push({ user_id: doc.id, name: String(d.name || ''), character: d.character, cleared: !!d.cleared, stage: d.stage, time_ms: d.time_ms, mods: d.mods || '' });
        });
        return { ok: true, rows };
      } catch (e) {
        return { ok: false, error: friendly(e), rows: [] };
      }
    },

    // ---- cloud save -----------------------------------------------------

    async uploadSave(saveData) {
      await this.init();
      if (!this.available || !this.user) return { ok: false, error: '로그인이 필요합니다' };
      const json = JSON.stringify({ v: 1, save: saveData });
      if (json.length > MAX_SAVE_CHARS) return { ok: false, error: '저장 데이터가 너무 큽니다' };
      try {
        await withTimeout(this.db.doc(`saves/${this.user.id}`).set({
          json,
          updated: window.firebase.firestore.FieldValue.serverTimestamp(),
          version: String(BR.GAME_VERSION || '').slice(0, 20),
        }));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: friendly(e) };
      }
    },

    // Returns { ok, exists, save, updatedAt (ISO string), version }
    async fetchCloudSave() {
      await this.init();
      if (!this.available || !this.user) return { ok: false, error: '로그인이 필요합니다' };
      try {
        const doc = await withTimeout(this.db.doc(`saves/${this.user.id}`).get());
        if (!doc.exists) return { ok: true, exists: false };
        const d = doc.data();
        const save = JSON.parse(d.json).save;
        if (!save || typeof save !== 'object' || typeof save.soul !== 'number') return { ok: false, error: '클라우드 저장 데이터가 올바르지 않습니다' };
        return { ok: true, exists: true, save, updatedAt: d.updated && d.updated.toDate ? d.updated.toDate().toISOString() : '', version: d.version };
      } catch (e) {
        return { ok: false, error: e instanceof SyntaxError ? '클라우드 저장 데이터가 올바르지 않습니다' : friendly(e) };
      }
    },
  };

  BR.Online = Online;
  if (Online.enabled) Online.init();
})();
