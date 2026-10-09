/*
 * RELICS: rule-changing items. Offered after the 1st boss and before the final boss.
 * SYNERGIES: owning both required upgrades unlocks an evolved bonus automatically.
 * apply(stats, player, run)
 */
(function () {
  'use strict';

  BR.RELICS = [
    { id: 'hourglass', icon: '⌛', name: 'Cracked Hourglass', desc: '보스의 시간이 12% 느리게 흐른다\n(이동·공격·투사체 모두)',
      apply: (s, p, run) => { run.enemyTimeScale *= 0.88; } },
    { id: 'fang', icon: '🦷', name: 'Vampire Fang', desc: '보스 처치 시 최대 체력의 30% 회복',
      apply: (s) => { s.relicFang = true; } },
    { id: 'coin', icon: '◉', name: 'Lucky Coin', desc: '보상 다시 뽑기 +2\nSOUL 획득량 +25%',
      apply: (s, p, run) => { run.rerolls += 2; run.soulMult += 0.25; } },
    { id: 'battery', icon: '⚡', name: 'Storm Battery', desc: 'PARRY 성공 시 {charge} 충전 1회 회복',
      apply: (s) => { s.relicBattery = true; } },
    { id: 'mask', icon: '☗', name: 'Berserk Mask', desc: '피해량 +35%\n받는 피해 +20%',
      apply: (s) => { s.damageMult += 0.35; s.damageTakenMult *= 1.2; } },
    { id: 'boots', icon: '➶', name: 'Feather Boots', desc: '대시 쿨다운 -35%\n대시 거리 +15%',
      apply: (s) => { s.dashCooldown *= 0.65; s.dashDistance *= 1.15; } },
    { id: 'ember', icon: '✹', name: 'Ember Core', desc: '공격이 보스를 3초간 불태운다\n(초당 공격력 40%)',
      apply: (s) => { s.burn += 0.4; } },
    { id: 'mirror', icon: '◐', name: 'Mirror Shield', desc: '보스 투사체에 맞을 때 30% 확률로\n무효화하고 되돌려 보낸다',
      apply: (s) => { s.reflectChance += 0.3; } },
    // APEX trophies: dropped by the five APEX bosses, never offered in the normal relic choice
    { id: 'moltenheart', apex: 'magmaTitan', icon: '❖', name: 'Molten Heart', desc: '[APEX] 피해량 +20%\n공격이 보스를 불태운다 (초당 30%)',
      apply: (s) => { s.damageMult += 0.2; s.burn += 0.3; } },
    { id: 'prismshard', apex: 'prismSeraph', icon: '◇', name: 'Prism Shard', desc: '[APEX] 투사체 +1\n기본 투사체가 관통한다',
      apply: (s) => { s.projectileCount += 1; s.wavePierce = true; } },
    { id: 'nightbloom', apex: 'nightEmpress', icon: '✿', name: 'Night Bloom', desc: '[APEX] 보스전마다 첫 피격 무효 +1\nPARRY 회복 +10',
      apply: (s, p) => { s.barrier += 1; if (p) p.barrier += 1; s.parryHealBonus += 10; } },
    { id: 'tidalcharm', apex: 'tideLeviathan', icon: '≈', name: 'Tidal Charm', desc: '[APEX] 스킬 쿨다운 -25%\n에너지 회복 +30%',
      apply: (s) => { s.skillCooldownMult *= 0.75; s.energyRegenMult += 0.3; } },
    { id: 'brokencrown', apex: 'ruinKing', icon: '♛', name: 'Broken Crown', desc: '[APEX] 치명타 확률 +20%\n치명타 피해 +50%',
      apply: (s) => { s.critChance += 0.2; s.critMultiplier += 0.5; } },
  ];

  BR.RELIC_BY_ID = {};
  for (const r of BR.RELICS) BR.RELIC_BY_ID[r.id] = r;

  BR.SYNERGIES = [
    { id: 'bladestorm', name: 'Blade Storm', requires: ['proj', 'projspd'], desc: '기본 투사체가 관통한다',
      apply: (s) => { s.wavePierce = true; } },
    { id: 'crimson', name: 'Crimson Edge', requires: ['crit', 'critheal'], desc: '치명타 피해 +50%',
      apply: (s) => { s.critMultiplier += 0.5; } },
    { id: 'perfectcounter', name: 'Perfect Counter', requires: ['riposte', 'counter'], desc: 'PARRY 시 완전 충전 {charge}를 공짜로 발사',
      apply: (s) => { s.perfectCounter = true; } },
    { id: 'thunderstep', name: 'Thunder Step', requires: ['dashshock', 'dashcd'], desc: '대시 충격파 범위 +60%, 피해 +60%',
      apply: (s) => { s.dashShock += 0.6; s.dashShockRadius *= 1.6; } },
    { id: 'railmind', name: 'Railgun Mind', requires: ['quickcharge', 'overload'], desc: '{charge} 충전 +1, 충전 시간 -30%',
      apply: (s, p) => { s.skillCharges += 1; s.chargeTimeMult *= 0.7; if (p) p.lanceCharges += 1; } },
    { id: 'retribution', name: 'Retribution', requires: ['barrier', 'thorns'], desc: '반사 피해 2배, 보스마다 보호막 +1',
      apply: (s, p) => { s.thorns *= 2; s.barrier += 1; if (p) p.barrier += 1; } },
    { id: 'bloodfrenzy', name: 'Blood Frenzy', requires: ['berserker', 'vengeance'], desc: '체력 50% 이하일 때 공격 속도 +35%',
      apply: (s) => { s.bloodFrenzy = true; } },
    { id: 'flowstate', name: 'Flow State', requires: ['spiritflow', 'guardreflex'], desc: 'PARRY 성공 시 E 스킬 쿨다운 완전 초기화',
      apply: (s) => { s.parryReset = true; } },
    { id: 'titanbane', name: 'Titanbane', requires: ['giantslayer', 'dmg25'], desc: '거대 보스 피해 보너스 +30%p',
      apply: (s) => { s.giantSlayer += 0.3; } },
    { id: 'afterimage', name: 'Afterimage', requires: ['echo', 'atkspd'], desc: '추가 피해(Echo) 확률 +20%',
      apply: (s) => { s.echoChance += 0.2; } },
  ];
})();
