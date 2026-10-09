/* Builds player stats from permanent (SOUL) upgrades and applies RUN upgrades on top. */
(function () {
  'use strict';

  function metaValue(meta, id) {
    const def = BR.META_UPGRADES.find((m) => m.id === id);
    const level = Math.min((meta && meta[id]) || 0, def ? def.maxLevel : 0);
    return def ? def.perLevel * level : 0;
  }

  BR.UpgradeSystem = {
    createBaseStats(meta, character) {
      const P = BR.CONFIG.PLAYER;
      const ch = character || BR.CHARACTERS[0];
      return {
        maxHp: P.maxHp + ch.hpBonus + metaValue(meta, 'vitality'),
        damage: ch.damage,
        damageMult: 1 + metaValue(meta, 'might'),
        attackSpeedMult: 1,
        critChance: P.critChance + metaValue(meta, 'precision'),
        critMultiplier: P.critMultiplier + metaValue(meta, 'lethality'),
        moveSpeed: P.moveSpeed * ch.speedMult * (1 + metaValue(meta, 'swiftness')),
        dashCooldown: P.dashCooldown * (1 - metaValue(meta, 'reflex')),
        dashDistance: P.dashDistance,
        projectileCount: 1,
        projectileSpeedMult: 1,
        projectileRangeMult: 1,
        damageReduction: metaValue(meta, 'resilience'),
        healAfterBoss: 0,
        skillCooldownMult: 1,
        skillDamageMult: 1,
        skillCharges: 1,
        energyRegenMult: 1 + metaValue(meta, 'focus'),
        energyOnHitBonus: 0,
        finisherBonus: metaValue(meta, 'memory'),
        comboReduce: 0,
        chargeTimeMult: 1 - metaValue(meta, 'quickcast'),
        fullChargeMult: 1,
        parryHealBonus: metaValue(meta, 'instinct'),
        counterBuff: 0,
        dashShock: 0,
        lifestealPer: 0,
        thorns: 0,
        barrier: metaValue(meta, 'guardian'),
        phoenix: 0,
        betweenHealBonus: metaValue(meta, 'breath'),
        meleeRangeMult: 1,
        dashHaste: 0,
        phaseHeal: 0,
        chargeRefund: 0,
        eSkillScale: 1,
        lastStand: 0,
        damageTakenMult: 1,
        burn: 0,
        reflectChance: 0,
        wavePierce: false,
        perfectCounter: false,
        dashShockRadius: 1,
        bloodFrenzy: false,
        relicFang: false,
        relicBattery: false,
        echoChance: 0,
        vengeance: 0,
        executioner: 0,
        berserker: 0,
        critHeal: 0,
        parryReflect: metaValue(meta, 'counterforce'),
        parryStun: metaValue(meta, 'daze'),
        parryEnergy: 0,
        parryClear: false,
        parryIframes: 0,
        parryReset: false,
        giantSlayer: 0,
        critEnergy: 0,
      };
    },

    apply(stats, upgrade, player) {
      if (!upgrade || typeof upgrade.apply !== 'function') return;
      upgrade.apply(stats, player);
      if (player) player.onStatsChanged();
    },

    metaLevel(meta, id) {
      return (meta && meta[id]) || 0;
    },

    metaValue,

    metaCost(def, level) {
      return Math.round(def.baseCost * Math.pow(def.costGrowth, level));
    },

    buyMeta(saveData, id) {
      const def = BR.META_UPGRADES.find((m) => m.id === id);
      if (!def) return false;
      const level = saveData.meta[id] || 0;
      if (level >= def.maxLevel) return false;
      const cost = this.metaCost(def, level);
      if (saveData.soul < cost) return false;
      saveData.soul -= cost;
      saveData.meta[id] = level + 1;
      return true;
    },
  };
})();
