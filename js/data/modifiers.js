/*
 * MODIFIERS: optional handicaps chosen before a run; each adds a SOUL bonus.
 * apply(stats, player, run) is called at run start (and again when a saved run is resumed).
 * Daily challenge: same seed (boss order, rewards, relics, elites) for everyone on the same day.
 */
(function () {
  'use strict';

  BR.MODIFIERS = [
    { id: 'swift', icon: '»', name: 'Hasted Foes', desc: '보스의 시간이 20% 빠르게 흐른다', soul: 0.3,
      apply: (s, p, run) => { run.enemyTimeScale *= 1.2; } },
    { id: 'tough', icon: '▲', name: 'Thick Hide', desc: '보스 체력 +35%', soul: 0.3,
      apply: (s, p, run) => { run.bossHpMod *= 1.35; } },
    { id: 'fragile', icon: '♡', name: 'Fragile', desc: '최대 체력 -40%', soul: 0.4,
      apply: (s, p) => { s.maxHp = Math.max(20, Math.round(s.maxHp * 0.6)); if (p) p.hp = Math.min(p.hp, s.maxHp); } },
    { id: 'paper', icon: '◇', name: 'Paper Armor', desc: '받는 피해 +50%', soul: 0.4,
      apply: (s) => { s.damageTakenMult *= 1.5; } },
    { id: 'heavy', icon: '▼', name: 'Heavy Legs', desc: '대시 쿨다운 2배', soul: 0.25,
      apply: (s) => { s.dashCooldown *= 2; } },
    { id: 'drought', icon: '✕', name: 'Drought', desc: '보스 사이 기본 체력 회복 없음', soul: 0.35,
      apply: (s, p, run) => { run.noHeal = true; } },
    { id: 'elite', icon: '★', name: 'Elite Hunt', desc: '엘리트 보스 등장 확률 50%', soul: 0.3,
      apply: (s, p, run) => { run.eliteChance = 0.5; } },
  ];

  BR.MODIFIER_BY_ID = {};
  for (const m of BR.MODIFIERS) BR.MODIFIER_BY_ID[m.id] = m;

  function hash(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // Today's daily challenge (local date)
  BR.dailyInfo = function (date) {
    const d = date || new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const seed = hash('bossrush:' + key);
    const pick = BR.Geo.makeRng(seed ^ 0x9e3779b9);
    const modifier = BR.MODIFIERS[Math.floor(pick() * BR.MODIFIERS.length)];
    return { date: key, seed, modifier };
  };
})();
