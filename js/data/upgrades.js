/*
 * RUN upgrades: strong, varied, lost on death.
 * META (SOUL) upgrades: small, permanent.
 */
(function () {
  'use strict';

  BR.UPGRADES = [
    // ---- Attack ----
    { id: 'dmg15', category: 'attack', rarity: 'common', name: 'Sharpened Edge', short: 'DMG+15%', desc: '피해량 +15%', maxStacks: 5,
      apply: (s) => { s.damageMult += 0.15; } },
    { id: 'dmg25', category: 'attack', rarity: 'rare', name: 'Executioner\'s Steel', short: 'DMG+25%', desc: '피해량 +25%', maxStacks: 3,
      apply: (s) => { s.damageMult += 0.25; } },
    { id: 'crit', category: 'attack', rarity: 'common', name: 'Keen Eye', short: 'CRIT+10%', desc: '치명타 확률 +10%\n치명타는 175% 피해', maxStacks: 4,
      apply: (s) => { s.critChance += 0.10; } },
    { id: 'atkspd', category: 'attack', rarity: 'common', name: 'Flurry', short: 'ATK SPD', desc: '공격 속도 +20%', maxStacks: 4,
      apply: (s) => { s.attackSpeedMult += 0.20; } },
    { id: 'proj', category: 'attack', rarity: 'rare', name: 'Twin Waves', short: '+1 WAVE', desc: '검기 투사체 +1\n(부채꼴로 발사)', maxStacks: 3,
      apply: (s) => { s.projectileCount += 1; } },
    { id: 'projspd', category: 'attack', rarity: 'common', name: 'Wind Cutter', short: 'WAVE SPD', desc: '검기 속도 +30%\n검기 사거리 +20%', maxStacks: 3,
      apply: (s) => { s.projectileSpeedMult += 0.30; s.projectileRangeMult += 0.20; } },

    // ---- Survival ----
    { id: 'hp25', category: 'survival', rarity: 'common', name: 'Iron Heart', short: 'HP+25', desc: '최대 체력 +25\n즉시 25 회복', maxStacks: 5,
      apply: (s, p) => { s.maxHp += 25; if (p) p.heal(25); } },
    { id: 'dr', category: 'survival', rarity: 'rare', name: 'Guardian Plate', short: 'ARMOR', desc: '받는 피해 -15%', maxStacks: 3,
      apply: (s) => { s.damageReduction = 1 - (1 - s.damageReduction) * 0.85; } },
    { id: 'healAfter', category: 'survival', rarity: 'common', name: 'Second Wind', short: 'REGEN', desc: '보스 처치 후 체력 20 회복\n(지금 즉시 20 회복)', maxStacks: 3,
      apply: (s, p) => { s.healAfterBoss += 20; if (p) p.heal(20); } },

    // ---- Movement ----
    { id: 'movespd', category: 'movement', rarity: 'common', name: 'Light Boots', short: 'SPD+15%', desc: '이동 속도 +15%', maxStacks: 3,
      apply: (s) => { s.moveSpeed *= 1.15; } },
    { id: 'dashcd', category: 'movement', rarity: 'common', name: 'Dash Master', short: 'DASH CD', desc: '대시 쿨다운 -20%', maxStacks: 3,
      apply: (s) => { s.dashCooldown *= 0.8; } },
    { id: 'dashdist', category: 'movement', rarity: 'common', name: 'Long Stride', short: 'DASH+', desc: '대시 거리 +35%', maxStacks: 2,
      apply: (s) => { s.dashDistance *= 1.35; } },

    // ---- Skills ----
    { id: 'skillcd', category: 'skill', rarity: 'common', name: 'Arcane Focus', short: 'SKILL CD', desc: 'Q / E 쿨다운 -20%\n에너지 회복 +20%', maxStacks: 3,
      apply: (s) => { s.skillCooldownMult *= 0.8; s.energyRegenMult += 0.2; } },
    { id: 'skilldmg', category: 'skill', rarity: 'common', name: 'Overcharge', short: 'SKILL DMG', desc: '스킬 피해 +25%', maxStacks: 4,
      apply: (s) => { s.skillDamageMult += 0.25; } },
    { id: 'skillcharge', category: 'skill', rarity: 'rare', name: 'Twin Lance', short: '+1 LANCE', desc: 'Q (Arc Lance) 충전 +1', maxStacks: 2,
      apply: (s) => { s.skillCharges += 1; } },

    // ---- Special ----
    { id: 'echo', category: 'special', rarity: 'rare', name: 'Echo Strike', short: 'ECHO', desc: '적중 시 20% 확률로\n50% 추가 피해', maxStacks: 3,
      apply: (s) => { s.echoChance += 0.20; } },
    { id: 'vengeance', category: 'special', rarity: 'rare', name: 'Vengeance', short: 'VENGE', desc: '피격 후 4초간\n공격력 +40%', maxStacks: 2,
      apply: (s) => { s.vengeance += 0.40; } },
    { id: 'executioner', category: 'special', rarity: 'rare', name: 'Finisher', short: 'EXEC', desc: '보스 체력 20% 이하일 때\n피해 +40%', maxStacks: 2,
      apply: (s) => { s.executioner += 0.40; } },
    { id: 'berserker', category: 'special', rarity: 'epic', name: 'Berserker', short: 'BERSERK', desc: '잃은 체력에 비례해\n공격력 최대 +60%', maxStacks: 2,
      apply: (s) => { s.berserker += 0.60; } },
    { id: 'critheal', category: 'special', rarity: 'epic', name: 'Bloodthirst', short: 'LEECH', desc: '치명타 적중 시\n체력 2 회복', maxStacks: 3,
      apply: (s) => { s.critHeal += 2; } },

    // ---- Technique (combo / charge / parry) ----
    { id: 'finisher', category: 'technique', rarity: 'common', name: 'Momentum', short: 'FINISH+', desc: '피니셔 피해 +40%', maxStacks: 3,
      apply: (s) => { s.finisherBonus += 0.40; } },
    { id: 'flow', category: 'technique', rarity: 'rare', name: 'Flowing Form', short: 'FLOW', desc: '피니셔까지 필요한 타수 -1\n(최소 2타)', maxStacks: 2,
      apply: (s) => { s.comboReduce += 1; } },
    { id: 'quickcharge', category: 'technique', rarity: 'common', name: 'Quick Charge', short: 'Q FAST', desc: 'Q 충전 시간 -35%', maxStacks: 2,
      apply: (s) => { s.chargeTimeMult *= 0.65; } },
    { id: 'overload', category: 'technique', rarity: 'rare', name: 'Overload', short: 'Q MAX+', desc: '완전 충전 Q 피해 +50%', maxStacks: 3,
      apply: (s) => { s.fullChargeMult += 0.50; } },
    { id: 'riposte', category: 'technique', rarity: 'common', name: 'Riposte', short: 'PARRY+', desc: 'PARRY 회복량 +8', maxStacks: 3,
      apply: (s) => { s.parryHealBonus += 8; } },
    { id: 'counter', category: 'technique', rarity: 'rare', name: 'Counterstrike', short: 'COUNTER', desc: 'PARRY 후 3초간\n피해량 +50%', maxStacks: 2,
      apply: (s) => { s.counterBuff += 0.50; } },
    { id: 'dashshock', category: 'technique', rarity: 'rare', name: 'Shock Step', short: 'DASH HIT', desc: '대시가 끝날 때 주변에\n충격파 (공격력 80%)', maxStacks: 3,
      apply: (s) => { s.dashShock += 0.80; } },

    // ---- More survival / special ----
    { id: 'lifesteal', category: 'survival', rarity: 'rare', name: 'Vampiric Edge', short: 'DRAIN', desc: '보스에게 준 피해 60마다\n체력 1 회복', maxStacks: 3,
      apply: (s) => { s.lifestealPer = s.lifestealPer ? s.lifestealPer * 0.6 : 60; } },
    { id: 'thorns', category: 'survival', rarity: 'common', name: 'Spiked Armor', short: 'THORNS', desc: '피격 시 보스에게\n공격력 150% 반사 피해', maxStacks: 3,
      apply: (s) => { s.thorns += 1.5; } },
    { id: 'barrier', category: 'survival', rarity: 'rare', name: 'Aegis', short: 'BARRIER', desc: '매 보스전마다 첫 피격을\n1회 무효화', maxStacks: 2,
      apply: (s, p) => { s.barrier += 1; if (p) p.barrier += 1; } },
    { id: 'energy', category: 'skill', rarity: 'common', name: 'Deep Reserves', short: 'ENERGY', desc: '에너지 회복 +40%\n적중 시 에너지 +2', maxStacks: 3,
      apply: (s) => { s.energyRegenMult += 0.4; s.energyOnHitBonus += 2; } },
    { id: 'glass', category: 'special', rarity: 'epic', name: 'Glass Cannon', short: 'GLASS', desc: '피해량 +50%\n최대 체력 -30', maxStacks: 1,
      apply: (s, p) => { s.damageMult += 0.5; s.maxHp = Math.max(30, s.maxHp - 30); if (p) p.hp = Math.min(p.hp, s.maxHp); } },
    { id: 'phoenix', category: 'special', rarity: 'epic', name: 'Phoenix Feather', short: 'REVIVE', desc: '사망 시 1회 부활\n(체력 40%)', maxStacks: 1,
      apply: (s) => { s.phoenix += 1; } },
  ];

  BR.CATEGORY_LABELS = {
    attack: 'ATTACK',
    survival: 'SURVIVAL',
    movement: 'MOVEMENT',
    skill: 'SKILL',
    special: 'SPECIAL',
    technique: 'TECHNIQUE',
  };

  BR.RARITY_WEIGHTS = { common: 10, rare: 5.5, epic: 2.5 };

  BR.META_UPGRADES = [
    { id: 'vitality', name: 'Vitality', desc: '기본 최대 체력 +6', perLevel: 6, maxLevel: 5, baseCost: 40, costGrowth: 1.6 },
    { id: 'might', name: 'Might', desc: '기본 공격력 +4%', perLevel: 0.04, maxLevel: 5, baseCost: 50, costGrowth: 1.6 },
    { id: 'swiftness', name: 'Swiftness', desc: '기본 이동 속도 +3%', perLevel: 0.03, maxLevel: 5, baseCost: 35, costGrowth: 1.6 },
    { id: 'reflex', name: 'Reflex', desc: '기본 대시 쿨다운 -4%', perLevel: 0.04, maxLevel: 5, baseCost: 35, costGrowth: 1.6 },
    { id: 'precision', name: 'Precision', desc: '기본 치명타 확률 +2%', perLevel: 0.02, maxLevel: 5, baseCost: 45, costGrowth: 1.6 },
    { id: 'focus', name: 'Focus', desc: '에너지 회복 +6%', perLevel: 0.06, maxLevel: 5, baseCost: 40, costGrowth: 1.6 },
    { id: 'resilience', name: 'Resilience', desc: '받는 피해 -2%', perLevel: 0.02, maxLevel: 5, baseCost: 60, costGrowth: 1.7 },
    { id: 'fortune', name: 'Fortune', desc: 'SOUL 획득량 +8%', perLevel: 0.08, maxLevel: 5, baseCost: 80, costGrowth: 1.7 },
    { id: 'reroll', name: 'Second Thought', desc: '보상 다시 뽑기 +1회 (RUN마다)', perLevel: 1, maxLevel: 3, baseCost: 120, costGrowth: 2.0 },
    { id: 'headstart', name: 'Head Start', desc: 'RUN 시작 시 무작위 업그레이드 1개', perLevel: 1, maxLevel: 2, baseCost: 200, costGrowth: 2.5 },
  ];
})();
