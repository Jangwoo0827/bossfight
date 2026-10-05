/*
 * Achievements. progress(stats) returns [current, target]; unlocked when current >= target.
 * `stats` is saveData.stats (lifetime records).
 */
(function () {
  'use strict';

  const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const count = (obj) => Object.keys(obj || {}).filter((k) => obj[k] > 0).length;
  const special = (s, key) => (s.special && s.special[key]) || 0;

  BR.ACHIEVEMENTS = [
    { id: 'first_blood', icon: '⚔', name: 'First Blood', desc: '보스 1마리 처치', progress: (s) => [sum(s.bossKills), 1] },
    { id: 'slayer', icon: '☠', name: 'Slayer', desc: '보스 25마리 처치', progress: (s) => [sum(s.bossKills), 25] },
    { id: 'legend', icon: '♛', name: 'Living Legend', desc: '보스 100마리 처치', progress: (s) => [sum(s.bossKills), 100] },
    { id: 'collector', icon: '◈', name: 'Bestiary', desc: '12종류의 보스를 모두 처치', progress: (s) => [count(s.bossKills), 12] },

    { id: 'clear_easy', icon: 'Ⅰ', name: 'Warm Up', desc: 'EASY 클리어', progress: (s) => [s.clearsByDifficulty.easy || 0, 1] },
    { id: 'clear_normal', icon: 'Ⅱ', name: 'Boss Rusher', desc: 'NORMAL 클리어', progress: (s) => [s.clearsByDifficulty.normal || 0, 1] },
    { id: 'clear_hard', icon: 'Ⅲ', name: 'Hardened', desc: 'HARD 클리어', progress: (s) => [s.clearsByDifficulty.hard || 0, 1] },
    { id: 'clear_nightmare', icon: 'Ⅳ', name: 'Nightmare Walker', desc: 'NIGHTMARE 클리어', progress: (s) => [s.clearsByDifficulty.nightmare || 0, 1] },

    { id: 'char_blade', icon: '/', name: 'Blade Saint', desc: 'BLADEMASTER로 클리어', progress: (s) => [s.clearsByCharacter.blade || 0, 1] },
    { id: 'char_gunner', icon: '•', name: 'Fastest Draw', desc: 'GUNSLINGER로 클리어', progress: (s) => [s.clearsByCharacter.gunner || 0, 1] },
    { id: 'char_arcanist', icon: '✶', name: 'Archmage', desc: 'ARCANIST로 클리어', progress: (s) => [s.clearsByCharacter.arcanist || 0, 1] },
    { id: 'char_guardian', icon: '■', name: 'Unbreakable', desc: 'IRON GUARDIAN으로 클리어', progress: (s) => [s.clearsByCharacter.guardian || 0, 1] },

    { id: 'parry_10', icon: '✦', name: 'Riposte', desc: 'PARRY 10회', progress: (s) => [s.parries, 10] },
    { id: 'parry_100', icon: '✧', name: 'Perfect Guard', desc: 'PARRY 100회', progress: (s) => [s.parries, 100] },
    { id: 'combo', icon: '≡', name: 'Combo Artist', desc: '피니셔 200회 적중', progress: (s) => [s.finishers, 200] },
    { id: 'flawless', icon: '◇', name: 'Untouchable', desc: '피해 없이 보스 처치', progress: (s) => [s.flawlessBosses, 1] },
    { id: 'speed', icon: '⌛', name: 'Speed Kill', desc: '보스를 30초 안에 처치', progress: (s) => [s.fastestBoss > 0 && s.fastestBoss <= 30 ? 1 : 0, 1] },
    { id: 'clutch', icon: '♥', name: 'Clutch', desc: '체력 10 이하로 보스 처치', progress: (s) => [special(s, 'clutch'), 1] },
    { id: 'rich', icon: '◎', name: 'Soul Hoarder', desc: 'SOUL 누적 2000 획득', progress: (s) => [s.totalSoul, 2000] },

    { id: 'shatter', icon: '❄', name: 'Icebreaker', desc: 'Frost Witch의 결정 보호막 파괴', progress: (s) => [special(s, 'shatter'), 1] },
    { id: 'stagger', icon: '✚', name: 'Bloodletter', desc: 'Blood Count의 흡혈 차단', progress: (s) => [special(s, 'stagger'), 1] },
    { id: 'backstab', icon: '↺', name: 'Flanker', desc: 'Western Shooter의 방어 중 등 뒤 공격 10회', progress: (s) => [special(s, 'backstab'), 10] },
    { id: 'wallstun', icon: '▣', name: 'Matador', desc: '돌진하는 보스를 벽에 5회 부딪히게 하기', progress: (s) => [special(s, 'wallstun'), 5] },
  ];
})();
