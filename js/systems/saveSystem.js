/* localStorage persistence: soul, permanent upgrades, settings, lifetime stats. */
(function () {
  'use strict';

  function defaults() {
    return {
      version: 1,
      soul: 0,
      // Built from the data so newly added permanent upgrades are always kept
      meta: Object.fromEntries((BR.META_UPGRADES || []).map((m) => [m.id, 0])),
      settings: { volume: 0.5, shake: 1, damageNumbers: true, lastCharacter: 'blade', lastDifficulty: 'normal', musicVolume: 0.35, tutorialDone: false, lastSeenVersion: '', lastModifiers: [] },
      stats: {
        runs: 0, clears: 0, bestStage: 0, totalSoul: 0,
        deaths: 0, parries: 0, finishers: 0, totalDamage: 0, damageTaken: 0, playTime: 0,
        flawlessBosses: 0, fastestBoss: 0,
        bossKills: {}, bossDeaths: {}, clearsByDifficulty: {}, clearsByCharacter: {}, bestClearTime: {}, special: {}, daily: {},
      },
      achievements: {},
    };
  }

  function merge(base, data, keepExtra) {
    if (!data || typeof data !== 'object') return base;
    // Nested objects keep keys the defaults don't know yet (forward compatible saves)
    if (keepExtra) {
      for (const key of Object.keys(data)) {
        if (!(key in base) && data[key] !== null && typeof data[key] !== 'object') base[key] = data[key];
      }
    }
    for (const key of Object.keys(base)) {
      const value = data[key];
      if (value === undefined || value === null) continue;
      const isMap = typeof base[key] === 'object' && !Array.isArray(base[key]) && Object.keys(base[key]).length === 0;
      if (isMap) { if (typeof value === 'object' && !Array.isArray(value)) base[key] = value; }
      else if (typeof base[key] === 'object' && !Array.isArray(base[key])) base[key] = merge(base[key], value, true);
      else if (typeof value === typeof base[key]) base[key] = value;
    }
    return base;
  }

  BR.SaveSystem = {
    load() {
      try {
        const raw = window.localStorage.getItem(BR.CONFIG.SAVE_KEY);
        if (!raw) return defaults();
        return merge(defaults(), JSON.parse(raw));
      } catch (e) {
        return defaults();
      }
    },
    save(data) {
      try {
        window.localStorage.setItem(BR.CONFIG.SAVE_KEY, JSON.stringify(data));
      } catch (e) {
        /* storage unavailable (private mode / quota) — game still works */
      }
    },
    reset() {
      const data = defaults();
      this.save(data);
      this.clearRun();
      return data;
    },

    /* ----- RUN checkpoint (continue after closing the game) ----- */
    saveRun(snapshot) {
      try {
        window.localStorage.setItem(BR.CONFIG.SAVE_KEY + '.run', JSON.stringify(snapshot));
      } catch (e) { /* ignore */ }
    },
    loadRun() {
      try {
        const raw = window.localStorage.getItem(BR.CONFIG.SAVE_KEY + '.run');
        const data = raw ? JSON.parse(raw) : null;
        return data && data.v === 1 ? data : null;
      } catch (e) {
        return null;
      }
    },
    clearRun() {
      try {
        window.localStorage.removeItem(BR.CONFIG.SAVE_KEY + '.run');
      } catch (e) { /* ignore */ }
    },
  };
})();
