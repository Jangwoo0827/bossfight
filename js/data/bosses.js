/* Static boss data. Behaviour lives in js/bosses/*.js, keyed by id. */
(function () {
  'use strict';

  BR.BOSS_DATA = [
    {
      id: 'swordKnight',
      name: 'SWORD KNIGHT',
      title: 'The Fallen Oath',
      hp: 1100,
      radius: 30,
      difficulty: 2,
      arena: 'stone',
      color: '#9fb4d9',
      phaseThresholds: [0.5],
      tip: '공격 범위(빨간 부채꼴)를 보고 옆으로 빠진 뒤, 휘두른 직후 반격하라. 돌진하다 벽에 부딪히면 기절한다.',
    },
    {
      id: 'infernoMage',
      name: 'INFERNO MAGE',
      title: 'Ember of the Pyre',
      hp: 1300,
      radius: 26,
      difficulty: 3,
      arena: 'burning',
      color: '#ff7a33',
      phaseThresholds: [0.6],
      tip: '멀리서 마법을 쏘는 보스. 거리를 좁혀 압박하라. 단, 가까이 붙으면 폭발을 남기고 순간이동한다. 불의 고리는 중앙이 안전지대.',
    },
    {
      id: 'stoneGolem',
      name: 'STONE GOLEM',
      title: 'The Mountain That Walks',
      hp: 1900,
      radius: 54,
      difficulty: 4,
      arena: 'cave',
      color: '#a8a08a',
      phaseThresholds: [0.5],
      tip: '느리지만 한 방이 무겁다. 충격파는 대시 무적으로 뚫고 지나가라. 내려찍기 후의 긴 경직이 최고의 딜 타이밍.',
    },
    {
      id: 'voidHunter',
      name: 'VOID HUNTER',
      title: 'Blade Between Stars',
      hp: 1600,
      radius: 22,
      difficulty: 5,
      arena: 'void',
      color: '#9b6bff',
      phaseThresholds: [0.5],
      tip: '예고가 짧고 빠르다. 대시를 아껴 두고 반응으로 피하라. 돌진 공격 직후 잠시 멈추는 순간이 반격 기회.',
    },
    {
      id: 'frostWitch',
      name: 'FROST WITCH',
      title: 'Queen of the White Silence',
      hp: 1400,
      radius: 26,
      difficulty: 3,
      arena: 'ice',
      color: '#9ad8ff',
      phaseThresholds: [0.5],
      tip: '얼음 결정 보호막이 뜨면 보스는 무적. 눈보라가 완성되기 전에 결정 3개를 모두 부숴라 — 성공하면 보스가 기절한다. 서리 지대는 이동을 느리게 한다.',
    },
    {
      id: 'stormCaller',
      name: 'STORM CALLER',
      title: 'Voice of the Tempest',
      hp: 1550,
      radius: 32,
      difficulty: 4,
      arena: 'storm',
      color: '#ffe27a',
      phaseThresholds: [0.5],
      tip: '피뢰침 사이에 번개가 연결된다. 선이 그려지는 순간 길을 읽어라. 낙뢰 표식은 멈추면 맞는다 — 계속 움직여라.',
    },
    {
      id: 'bloodCount',
      name: 'BLOOD COUNT',
      title: 'The Thirsting Noble',
      hp: 1500,
      radius: 28,
      difficulty: 4,
      arena: 'blood',
      color: '#ff3a4a',
      phaseThresholds: [0.5],
      tip: '멀리 있으면 흡혈로 체력을 회복한다. 흡혈 중에는 원 안으로 붙어서 강하게 몰아쳐라 — 충분한 피해를 주면 경직된다. 박쥐는 스킬로 지워라.',
    },
    {
      id: 'westernShooter',
      name: 'WESTERN SHOOTER',
      title: 'High Noon Outlaw',
      hp: 1600,
      radius: 26,
      difficulty: 4,
      arena: 'western',
      color: '#ffb35e',
      phaseThresholds: [0.5],
      tip: '총으로 정면을 막는 동안에는 정면 공격이 통하지 않는다 — 등 뒤로 돌아가면 1.5배 피해. 거대한 도탄은 맵을 계속 튕기니 경로를 읽어라.',
    },
    {
      id: 'clockworkWarden',
      name: 'CLOCKWORK WARDEN',
      title: 'Keeper of the Last Hour',
      hp: 1750,
      radius: 40,
      difficulty: 4,
      arena: 'clock',
      color: '#ffc85a',
      phaseThresholds: [0.5],
      tip: '시곗바늘 빔은 일정한 속도로 회전한다 — 바늘과 같은 방향으로 따라 돌아라. 되감기는 네가 지나온 길을 다시 때리니 왔던 길로 돌아가지 마라.',
    },
    {
      id: 'duneWyrm',
      name: 'DUNE WYRM',
      title: 'The Hungering Sand',
      hp: 1800,
      radius: 38,
      difficulty: 4,
      arena: 'dune',
      color: '#e8c27a',
      phaseThresholds: [0.5],
      tip: '땅속에 숨으면 무적. 모래 언덕이 너를 쫓다가 멈추면 곧 솟아오른다 — 옆으로 빠진 뒤 솟아오른 직후가 딜 타이밍. 유사(流沙)는 이동을 느리게 한다.',
    },
    {
      id: 'direAlpha',
      name: 'DIRE ALPHA',
      title: 'Hunger of the Moon',
      hp: 1550,
      radius: 30,
      difficulty: 5,
      arena: 'forest',
      color: '#bcd8ff',
      phaseThresholds: [0.5],
      tip: '도약 중에는 맞지 않는다 — 그림자를 보고 착지 지점에서 벗어나라. 벽에 튕기는 광란 돌진이 끝나면 어지러워서 빈틈이 생긴다.',
    },
    {
      id: 'broodMother', name: 'BROOD MOTHER', title: 'Queen of the Hive', hp: 1550, radius: 40, difficulty: 4,
      arena: 'hive', color: '#8cff5a', phaseThresholds: [0.5],
      tip: '새끼가 3마리 이상 살아 있으면 본체가 받는 피해 절반(초록 보호막). 새끼부터 정리하라 — 2페이즈에는 새끼가 죽으면 터진다.',
    },
    {
      id: 'phantomLancer', name: 'PHANTOM LANCER', title: 'The Unbroken Charge', hp: 1500, radius: 24, difficulty: 5,
      arena: 'spire', color: '#dfe8ff', phaseThresholds: [0.5],
      tip: '돌진이 지나간 자리에 잠시 창의 잔상 벽이 남는다. 구석에 몰리지 말고 넓은 공간을 확보하라.',
    },
    {
      id: 'gravitySage', name: 'GRAVITY SAGE', title: 'Keeper of the Fall', hp: 1600, radius: 30, difficulty: 4,
      arena: 'cosmos', color: '#7890ff', phaseThresholds: [0.5],
      tip: '중력 우물은 너를 끌어당긴다 — 달리면 벗어날 수 있다(대시는 끌림 무시). COLLAPSE가 뜨면 즉시 멀어져라.',
    },
    {
      id: 'abyssLord',
      name: 'ABYSS LORD',
      title: 'Sovereign of the Deep',
      hp: 2950,
      radius: 46,
      difficulty: 5,
      arena: 'abyss',
      color: '#ff3d7f',
      phaseThresholds: [0.65, 0.3],
      tip: '최종 보스. 3단계 페이즈. 바둑판 공격은 안전한 칸을 찾아 이동하고, 마지막 30%는 패턴이 빨라지니 침착하게 읽어라.',
    },
  ];

  // One line shown under the name in each boss intro
  const QUOTES = {
    swordKnight: '내 맹세는 부러졌다. 그러나 칼날은 아직 남았다.',
    infernoMage: '재가 되어라. 그것이 가장 아름다운 형태니까.',
    stoneGolem: '…천 년을 잤다. 시끄럽군.',
    voidHunter: '넌 이미 내 사냥감이다. 다만 아직 모를 뿐.',
    frostWitch: '숨을 멈춰. 곧 그렇게 될 테니.',
    stormCaller: '하늘이 내 목소리다.',
    bloodCount: '좋은 냄새가 나는군. 조금만 마셔도 될까?',
    westernShooter: '정오다. 뽑아.',
    clockworkWarden: '네 시간은 이미 계산이 끝났다.',
    duneWyrm: '(모래 아래에서 무언가가 꿈틀거린다)',
    direAlpha: '(달을 향해 길게 울부짖는다)',
    abyssLord: '여기까지 온 것은 칭찬하지. 하지만 심연은 바닥이 없다.',
    broodMother: '내 아이들이 배가 고프단다.',
    phantomLancer: '멈추는 법은 배우지 못했다.',
    gravitySage: '모든 것은 결국 떨어진다. 너도.',
  };
  for (const def of BR.BOSS_DATA) def.quote = QUOTES[def.id] || '';

  BR.BOSS_BY_ID = {};
  for (const def of BR.BOSS_DATA) BR.BOSS_BY_ID[def.id] = def;

  // Boss Rush order: first boss, then every pool boss from easiest to hardest, final boss last
  BR.RUSH_ORDER = (() => {
    const first = 'swordKnight', last = 'abyssLord';
    const middle = BR.BOSS_DATA.filter((b) => b.id !== first && b.id !== last)
      .sort((a, b) => a.difficulty - b.difficulty || a.hp - b.hp).map((b) => b.id);
    return [first, ...middle, last];
  })();

  // Tutorial-only target (not part of the boss pool or bestiary)
  BR.BOSS_BY_ID.trainingDummy = {
    id: 'trainingDummy', name: 'TRAINING DUMMY', title: 'It Hits Back (Gently)', hp: 5000, radius: 34,
    difficulty: 1, arena: 'stone', color: '#c9a35a', phaseThresholds: [], tip: '',
  };
})();
