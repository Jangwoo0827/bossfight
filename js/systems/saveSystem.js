/* localStorage persistence: soul, permanent upgrades, settings, lifetime stats. */
(function () {
  'use strict';

  function defaults() {
    return {
      version: 1,
      soul: 0,
      meta: { vitality: 0, might: 0, swiftness: 0, reflex: 0 },
      settings: { volume: 0.5, shake: 1, damageNumbers: true, lastCharacter: 'blade', lastDifficulty: 'normal', musicVolume: 0.35, tutorialDone: false },
      stats: {
        runs: 0, clears: 0, bestStage: 0, totalSoul: 0,
        deaths: 0, parries: 0, finishers: 0, totalDamage: 0, damageTaken: 0, playTime: 0,
        flawlessBosses: 0, fastestBoss: 0,
        bossKills: {}, bossDeaths: {}, clearsByDifficulty: {}, clearsByCharacter: {}, bestClearTime: {}, special: {},
      },
      achievements: {},
    };
  }

  function merge(base, data) {
    if (!data || typeof data !== 'object') return base;
    for (const key of Object.keys(base)) {
      const value = data[key];
      if (value === undefined || value === null) continue;
      const isMap = typeof base[key] === 'object' && !Array.isArray(base[key]) && Object.keys(base[key]).length === 0;
      if (isMap) { if (typeof value === 'object' && !Array.isArray(value)) base[key] = value; }
      else if (typeof base[key] === 'object' && !Array.isArray(base[key])) base[key] = merge(base[key], value);
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
      return data;
    },
  };
})();
