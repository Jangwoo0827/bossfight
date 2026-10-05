/* Global namespace + every tunable number in one place. */
window.BR = window.BR || {};

BR.CONFIG = {
  WIDTH: 1280,
  HEIGHT: 720,
  MAX_DT: 1 / 20,

  // Playable arena rectangle (HUD lives above / below it)
  ARENA: { left: 48, top: 96, right: 1232, bottom: 640 },

  PLAYER: {
    radius: 12,
    maxHp: 100,
    damage: 15,
    attackCooldown: 0.35,
    moveSpeed: 240,
    acceleration: 18,          // exponential smoothing rate for velocity
    dashCooldown: 1.2,
    dashDistance: 150,
    dashDuration: 0.14,
    dashIframes: 0.24,
    dashBuffer: 0.14,          // pressing dash slightly early still triggers it
    hitIframes: 0.8,
    hitKnockback: 260,
    slashRange: 96,
    slashArc: 2.3,
    waveSpeed: 660,
    waveRange: 340,
    waveDamageRatio: 0.55,
    waveSpread: 0.16,
    critChance: 0.05,
    critMultiplier: 1.75,
    maxEnergy: 100,
    energyRegen: 9,
    energyOnHit: 3,
  },

  SKILLS: {
    // Q: hold to charge, release to fire. power 0..1 scales damage/size.
    charge: { cooldown: 4.5, energyCost: 30, chargeTime: 0.9, moveSlow: 0.55 },
    lance: { speed: 860, radius: [14, 26], damageMult: [2.4, 5.0], range: 950 },
    rail: { speed: 1700, radius: [6, 12], damageMult: [2.0, 5.5], range: 1200 },
    quake: { speed: 520, radius: [26, 48], damageMult: [2.5, 5.5], range: 520 },
    // E skills
    nova: { cooldown: 9, energyCost: 40, radius: 150, damageMult: 2.2, clearRadius: 230, iframes: 0.35 },
    roll: { cooldown: 5, energyCost: 25, distance: 170, duration: 0.2, iframes: 0.45, shots: 7, spread: 0.9, damageMult: 1.4 },
    bulwark: { cooldown: 8, energyCost: 35, duration: 1.0 },
  },

  PARRY: {
    heal: 8,
    energy: 25,
    cooldownRefund: 0.5,     // E cooldown cut on a successful parry
    hazardProgress: 0.55,    // a telegraph at least this far along counts as "about to hit"
    projectileRadius: 70,    // enemy bullets this close count as a parry
  },

  ATTACKS: {
    comboWindow: 0.8,
    finisherMult: 1.8,
    gun: { speed: 950, range: 620, radius: 5, jitter: 0.035, spread: 0.1 },
    hammer: { range: 125, arc: 2.0, shockRange: 180, shockRatio: 0.4, quakeRadius: 170 },
  },

  COMBAT: {
    hitstop: 0.03,
    critHitstop: 0.06,
    minTelegraph: 0.3,         // no damaging hazard may fire faster than this
    forgiveness: 0.35,         // fraction of player radius ignored for hazard hits
    damageVariance: 0.08,
  },

  SHAKE: {
    small: [3, 0.12],
    hit: [5, 0.18],
    medium: [7, 0.22],
    big: [10, 0.28],
  },

  PARTICLE_LIMIT: 700,

  RUN: {
    totalBosses: 5,
    firstBoss: 'swordKnight',
    finalBoss: 'abyssLord',
    bossChoices: 3,
    eliteChance: 0.12,
    elite: { hp: 1.3, dmg: 1.1, tempo: 0.9, soul: 1.5 },
    healBetweenBossesRatio: 0.35,
    stageHpScale: 0.06,
    introTime: 2.3,
    victoryDelay: 2.6,
    deathDelay: 1.9,
    slowmoTime: 1.1,
    slowmoScale: 0.25,
  },

  SOUL: { perBossBase: 15, perStage: 10, clearBonus: 120 },

  SAVE_KEY: 'bossRushRPG.save.v1',

  COLORS: {
    player: '#5ee7ff',
    playerCore: '#effdff',
    danger: '255,52,72',
    hp: '#ff4d6a',
    energy: '#7c8cff',
    gold: '#ffd166',
    soul: '#c9b6ff',
  },
};
