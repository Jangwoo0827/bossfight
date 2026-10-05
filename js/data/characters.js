/*
 * Playable characters. Each has its own basic attack, charge skill (hold Q) and E skill.
 * attack: 'slash' | 'gun' | 'hammer'   charge: 'lance' | 'rail' | 'quake'   e: 'nova' | 'roll' | 'bulwark'
 */
(function () {
  'use strict';

  BR.CHARACTERS = [
    {
      id: 'blade',
      name: 'BLADEMASTER',
      role: '근접 + 검기',
      color: '#5ee7ff',
      rgb: '94,231,255',
      hpBonus: 0,
      speedMult: 1,
      damage: 15,
      attack: 'slash',
      attackCooldown: 0.35,
      comboLength: 3,
      charge: 'lance',
      e: 'nova',
      qName: 'LANCE',
      eName: 'NOVA',
      desc: '근접 베기와 검기를 함께 쓴다. 3타째는 강화 베기.',
      skills: [
        '좌클릭: 베기 + 검기 · 3타 피니셔',
        'Q (꾹 눌러 충전): Arc Lance — 관통, 탄 제거',
        'E: Nova — 공격 직전에 쓰면 PARRY (회복)',
      ],
    },
    {
      id: 'gunner',
      name: 'GUNSLINGER',
      role: '원거리 연사',
      color: '#ffc35e',
      rgb: '255,195,94',
      hpBonus: -10,
      speedMult: 1.08,
      damage: 6,
      attack: 'gun',
      attackCooldown: 0.16,
      comboLength: 6,
      charge: 'rail',
      e: 'roll',
      qName: 'RAIL',
      eName: 'ROLL',
      desc: '멀리서 빠르게 쏜다. 6발째는 관통 강화탄. 체력이 낮다.',
      skills: [
        '좌클릭: 연사 · 6발째 관통탄',
        'Q (꾹 눌러 충전): Rail Shot — 초고속 관통',
        'E: Smoke Roll — 뒤로 구르며 산탄, 아슬아슬하게 피하면 PARRY',
      ],
    },
    {
      id: 'guardian',
      name: 'IRON GUARDIAN',
      role: '중장갑 근접',
      color: '#9dff8a',
      rgb: '157,255,138',
      hpBonus: 40,
      speedMult: 0.88,
      damage: 30,
      attack: 'hammer',
      attackCooldown: 0.62,
      comboLength: 3,
      charge: 'quake',
      e: 'bulwark',
      qName: 'QUAKE',
      eName: 'GUARD',
      desc: '느리지만 묵직하다. 3타째는 지진 내려찍기. 체력이 높다.',
      skills: [
        '좌클릭: 망치 휘두르기 + 충격파 · 3타 지진',
        'Q (꾹 눌러 충전): Earthsplitter — 거대한 관통 파동',
        'E: Bulwark — 1초간 모든 피해 차단, 막을 때마다 PARRY',
      ],
    },
    {
      id: 'arcanist',
      name: 'ARCANIST',
      role: '유도 마법',
      color: '#c39bff',
      rgb: '195,155,255',
      hpBonus: -5,
      speedMult: 1,
      damage: 12,
      attack: 'orb',
      attackCooldown: 0.3,
      comboLength: 4,
      charge: 'bomb',
      e: 'blink',
      qName: 'BOMB',
      eName: 'BLINK',
      unlock: { stat: 'clears', count: 1, text: '아무 난이도 1회 클리어로 해금' },
      desc: '보스를 따라가는 마법탄. 4타째는 3발. 순간이동으로 위기를 넘긴다.',
      skills: [
        '좌클릭: 유도 마법탄 · 4타째 3연발',
        'Q (꾹 눌러 충전): Arcane Bomb — 적중 시 폭발, 탄 제거',
        'E: Blink — 조준 방향으로 순간이동, 직전 회피 시 PARRY',
      ],
    },
  ];

  BR.isCharacterUnlocked = (c, save) => !c.unlock || ((save && save.stats && save.stats[c.unlock.stat]) || 0) >= c.unlock.count;

  BR.CHARACTER_BY_ID = {};
  for (const c of BR.CHARACTERS) BR.CHARACTER_BY_ID[c.id] = c;

  BR.DIFFICULTIES = [
    { id: 'easy', name: 'EASY', bosses: 4, hp: 0.8, dmg: 0.75, soul: 0.7, color: '#8fe388', desc: '보스 4연전 · 보스 체력 -20% · 피해 -25%' },
    { id: 'normal', name: 'NORMAL', bosses: 5, hp: 1, dmg: 1, soul: 1, color: '#8fb7ff', desc: '보스 5연전 · 기본 밸런스' },
    { id: 'hard', name: 'HARD', bosses: 7, hp: 1.2, dmg: 1.2, soul: 1.7, color: '#ff9a4a', desc: '보스 7연전 · 체력 +20% · 피해 +20%' },
    { id: 'nightmare', name: 'NIGHTMARE', bosses: 10, hp: 1.4, dmg: 1.4, soul: 2.8, color: '#ff3d5a', desc: '보스 10연전 · 체력 +40% · 피해 +40%' },
  ];

  BR.DIFFICULTY_BY_ID = {};
  for (const d of BR.DIFFICULTIES) BR.DIFFICULTY_BY_ID[d.id] = d;
})();
