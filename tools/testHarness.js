/*
 * BOSS RUSH automated tests. Open tests.html through a local server (or GitHub Pages).
 *  - Loads the exact script list from index.html (minus main.js)
 *  - Uses an isolated save key, so real saves are never touched
 *  - Steps the game manually (no requestAnimationFrame), renders periodically to catch draw errors
 * Results: printed on the page and stored in window.TEST_RESULT.
 * ?audit=1 adds the dodge audit: every boss attack is forced repeatedly against a dodging bot
 *          (normal + worst case: Hasted Foes + elite tempo). Attacks the bot can't dodge are flagged.
 */
(async function () {
  'use strict';
  const out = document.getElementById('out');
  const params = new URLSearchParams(location.search);
  const QUICK = params.has('quick');
  const AUDIT = params.has('audit');
  const line = (text, cls) => {
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = text + '\n';
    out.appendChild(span);
  };
  const yieldUI = () => new Promise((r) => setTimeout(r, 0));

  // ---------- load the game ----------
  const html = await (await fetch('index.html', { cache: 'no-store' })).text();
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !s.includes('main.js'));
  // same (versioned) stylesheet as the game, so layout tests measure the real CSS
  const css = html.match(/<link rel="stylesheet" href="([^"]+)"/);
  if (css) {
    await new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = css[1];
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  }
  for (const src of srcs) {
    await new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error('failed to load ' + src));
      document.body.appendChild(el);
    });
  }
  BR.CONFIG.SAVE_KEY = 'bossRushRPG.TEST';
  try { localStorage.removeItem('bossRushRPG.TEST'); localStorage.removeItem('bossRushRPG.TEST.run'); } catch (e) { /* ignore */ }
  const g = new BR.Game(document.getElementById('game'));
  BR.game = g;
  g.saveData.settings.tutorialDone = true;
  g.audio.volume = 0;
  const Geo = BR.Geo;
  const C = BR.CONFIG;
  const TAU = Math.PI * 2;

  // ---------- helpers ----------
  const errors = [];
  function step(frames, bot, renderEvery = 30) {
    for (let i = 0; i < frames; i++) {
      try {
        if (bot) bot();
        g.update(1 / 60);
        if (renderEvery && i % renderEvery === 0) g.render(1 / 60);
        g.input.endFrame();
      } catch (e) {
        errors.push(e.stack || String(e));
        return false;
      }
    }
    return true;
  }
  const inBattle = () => g.state === 'intro' || g.state === 'fight';

  // Aggressive bot: attacks the boss (or its crystals), wiggles, uses skills, never dies
  function fightBot() {
    const inp = g.input;
    if (!g.player || !g.boss) return;
    const t = (g.boss.extraTargets || []).find((x) => !x.dead) || g.boss;
    inp.keys.clear();
    inp.mouse.x = t.x; inp.mouse.y = t.y; inp.mouse.down = true;
    inp.keys.add(['KeyW', 'KeyA', 'KeyS', 'KeyD'][Math.floor(g.time * 2) % 4]);
    const ph = g.time % 3;
    if (ph < 0.02) inp.pressed.add('KeyQ');
    if (ph < 1) inp.keys.add('KeyQ');
    if (Math.random() < 0.02) inp.pressed.add('Space');
    if (Math.random() < 0.012) inp.pressed.add('KeyE');
    g.player.hp = g.player.stats.maxHp; // god mode: these tests check flow, not survival
  }

  function killBoss() {
    if (!g.boss) return;
    g.boss.hp = 1;
    g.combat.damageBoss(50, g.boss.x, g.boss.y, { canCrit: false, dot: true });
  }

  const results = [];
  async function test(name, fn) {
    const before = errors.length;
    let ok = false, detail = '';
    try {
      const r = await fn();
      ok = r === true || (r && r.ok);
      detail = r && r.detail ? r.detail : '';
    } catch (e) {
      detail = e.stack || String(e);
    }
    if (errors.length > before) { ok = false; detail = (detail ? detail + '\n' : '') + errors.slice(before).join('\n'); }
    results.push({ name, ok, detail });
    line(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`, ok ? 'pass' : 'fail');
    await yieldUI();
  }

  // ---------- tests ----------
  const bossIds = BR.BOSS_DATA.map((b) => b.id);
  const chars = QUICK ? ['blade'] : BR.CHARACTERS.map((c) => c.id);

  for (const c of chars) {
    await test(`fight every boss (${c})`, () => {
      const slow = [];
      for (const id of bossIds) {
        BR.UIRoot.clear();
        g.startPractice(id, c, 1);
        let t = 0;
        while (inBattle() && t < 900) { if (!step(60, fightBot)) break; t++; }
        if (g.state !== 'victory' && g.state !== 'result') slow.push(`${id}:${g.state}`);
      }
      return { ok: slow.length === 0, detail: slow.length ? 'not finished: ' + slow.join(', ') : '' };
    });
  }

  await test('full EASY run (relics, rewards, boss select, result)', () => {
    BR.UIRoot.clear();
    g.startRun('blade', 'easy', []);
    const log = [];
    for (let s = 0; s < 1500 && g.state !== 'result'; s++) {
      if (!step(60, fightBot)) break;
      const relic = document.querySelector('.relic-card');
      if (relic) { log.push('relic'); relic.click(); continue; }
      if (g.state === 'reward') { log.push('reward'); document.querySelector('.card-row .card').click(); }
      else if (g.state === 'select') { log.push('select'); document.querySelector('.card-row .card').click(); }
    }
    const ok = g.state === 'result' && g.run.defeated.length === 4 && log.filter((x) => x === 'relic').length === 2;
    return { ok, detail: ok ? '' : `state=${g.state} defeated=${g.run.defeated.length} log=${log.join(',')}` };
  });

  await test('save & continue restores the run exactly', () => {
    BR.UIRoot.clear();
    g.startRun('guardian', 'hard', ['tough']);
    step(150, null);
    killBoss();
    step(60 * 4, null);
    document.querySelector('.relic-card').click();
    document.querySelector('.card-row .card').click();
    if (g.state === 'select') document.querySelector('.card-row .card').click();
    step(20, null);
    const snap = () => JSON.stringify({
      boss: g.boss && g.boss.id, elite: !!(g.boss && g.boss.elite), ups: g.run.upgrades, relics: g.run.relics.map((r) => r.id),
      mods: g.run.modifiers.map((m) => m.id), hp: Math.round(g.player.hp), maxHp: g.player.stats.maxHp,
      dmg: g.player.stats.damageMult, stage: g.run.stage, rerolls: g.run.rerolls, bossHp: g.boss && g.boss.maxHp,
    });
    const before = snap();
    g.goToMenu();
    g.saveData = BR.SaveSystem.load();
    g.resumeRun();
    step(5, null);
    const after = snap();
    return { ok: before === after, detail: before === after ? '' : `\nbefore ${before}\nafter  ${after}` };
  });

  await test('every permanent (SOUL) upgrade survives save → reload', () => {
    g.goToMenu();
    g.saveData = BR.SaveSystem.reset();
    g.saveData.soul = 999999;
    const bought = [];
    for (const def of BR.META_UPGRADES) if (BR.UpgradeSystem.buyMeta(g.saveData, def.id)) bought.push(def.id);
    g.saveData.meta.futureUpgrade = 3; // a key this version doesn't know must survive too
    BR.SaveSystem.save(g.saveData);
    const reloaded = BR.SaveSystem.load();
    const lost = BR.META_UPGRADES.filter((d) => reloaded.meta[d.id] !== 1).map((d) => d.id);
    const ok = bought.length === BR.META_UPGRADES.length && lost.length === 0 && reloaded.meta.futureUpgrade === 3
      && reloaded.soul === g.saveData.soul;
    g.saveData = BR.SaveSystem.reset();
    return { ok, detail: ok ? '' : `bought ${bought.length}/${BR.META_UPGRADES.length}, lost: ${lost.join(',')}, future=${reloaded.meta.futureUpgrade}` };
  });

  await test('every run upgrade + relic survives save → continue (identical stats)', () => {
    g.goToMenu();
    g.saveData = BR.SaveSystem.reset();
    BR.UIRoot.clear();
    g.startRun('blade', 'normal', ['fragile']);
    step(30, null);
    for (const u of BR.UPGRADES) { g.run.addUpgrade(u); BR.UpgradeSystem.apply(g.player.stats, u, g.player); }
    for (const r of BR.RELICS.slice(0, 3)) g.acquireRelic(r);
    g.checkSynergies(true);
    g.player.hp = 37;
    g.checkpoint('fight', { bossId: g.boss.id, elite: false });
    const snap = () => JSON.stringify({ stats: g.player.stats, ups: g.run.upgrades, relics: g.run.relics.map((r) => r.id),
      syn: g.run.synergies.slice().sort(), soulMult: +g.run.soulMult.toFixed(4), rerolls: g.run.rerolls, ets: g.run.enemyTimeScale, hp: Math.round(g.player.hp) });
    const before = snap();
    g.goToMenu();
    g.saveData = BR.SaveSystem.load();
    g.resumeRun();
    const after = snap();
    let diff = '';
    if (before !== after) {
      const a = JSON.parse(before), b = JSON.parse(after);
      for (const k of Object.keys(a.stats)) if (JSON.stringify(a.stats[k]) !== JSON.stringify(b.stats[k])) diff += ` stats.${k}: ${a.stats[k]} → ${b.stats[k]}`;
      for (const k of ['ups', 'relics', 'syn', 'soulMult', 'rerolls', 'ets', 'hp']) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diff += ` ${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`;
    }
    return { ok: before === after, detail: diff };
  });

  await test('boss rush: 12 bosses in order, no rewards, base stats, leaderboard + resume', () => {
    g.goToMenu();
    g.saveData = BR.SaveSystem.reset();
    g.saveData.meta.might = 5; // must NOT apply in rush
    BR.UIRoot.clear();
    g.startRush('blade');
    const baseDmgMult = g.player.stats.damageMult;
    const seen = [g.boss.id];
    let rewardScreens = 0, resumed = false;
    for (let i = 0; i < 400 && g.state !== 'result'; i++) {
      step(30, null);
      if (g.state === 'fight') killBoss();
      if (g.state === 'reward') rewardScreens++;
      if (g.state === 'intro' && g.boss && seen[seen.length - 1] !== g.boss.id) seen.push(g.boss.id);
      if (!resumed && seen.length === 4 && g.state === 'intro') {
        // save & continue mid-rush
        g.goToMenu(); g.saveData = BR.SaveSystem.load(); g.resumeRun(); resumed = g.run.rush && g.boss.id === seen[3];
      }
    }
    const ok = g.state === 'result' && JSON.stringify(seen) === JSON.stringify(BR.RUSH_ORDER) && rewardScreens === 0
      && baseDmgMult === 1 && resumed && g.saveData.stats.leaderboard.rush && g.saveData.stats.leaderboard.rush.length === 1
      && g.saveData.stats.rushBest.time > 0;
    const detail = ok ? '' : JSON.stringify({ state: g.state, seen: seen.length, rewardScreens, baseDmgMult, resumed, lb: g.saveData.stats.leaderboard.rush });
    g.saveData = BR.SaveSystem.reset();
    return { ok, detail };
  });

  await test('daily challenge is deterministic', () => {
    const trace = () => {
      BR.UIRoot.clear();
      g.startRun('blade', 'normal', [], { daily: true });
      step(150, null);
      killBoss();
      step(60 * 3, null);
      const t = [g.run.modifiers.map((m) => m.id).join(), [...document.querySelectorAll('.relic-card .name')].map((e) => e.textContent).join('|')];
      document.querySelector('.relic-card').click();
      t.push([...document.querySelectorAll('.card-row .card .name')].map((e) => e.textContent).join('|'));
      document.querySelector('.card-row .card').click();
      t.push((g.ui.bossSelect.options || []).join('|'));
      return JSON.stringify(t);
    };
    const a = trace(), b = trace();
    return { ok: a === b, detail: a === b ? '' : `${a} vs ${b}` };
  });

  await test('practice from a later phase records nothing', () => {
    const soul = g.saveData.soul;
    const kills = JSON.stringify(g.saveData.stats.bossKills);
    BR.UIRoot.clear();
    g.startPractice('abyssLord', 'gunner', 3);
    step(200, null);
    const phase = g.boss.phase;
    killBoss();
    step(60 * 3, null);
    const ok = phase === 3 && g.saveData.soul === soul && JSON.stringify(g.saveData.stats.bossKills) === kills;
    return { ok, detail: ok ? '' : `phase=${phase}` };
  });

  await test('tutorial can be completed', () => {
    BR.UIRoot.clear();
    g.startTutorial('blade');
    let qHold = 0;
    const bot = () => {
      const p = g.player, b = g.boss, t = g.tutorial, inp = g.input;
      if (!p || !b || !t) return;
      inp.keys.clear(); inp.mouse.down = false; inp.mouse.x = b.x; inp.mouse.y = b.y;
      const s = t.step;
      if (s === 0) inp.keys.add(['KeyW', 'KeyA', 'KeyS', 'KeyD'][Math.floor(g.time * 1.5) % 4]);
      else if (s === 1) { if (Geo.dist(p.x, p.y, b.x, b.y) > 90) inp.keys.add(p.y > b.y ? 'KeyW' : 'KeyS'); inp.mouse.down = true; }
      else if (s === 2) { if (Math.floor(g.time * 60) % 40 === 0) inp.pressed.add('Space'); inp.keys.add('KeyA'); }
      else if (s === 3) { const h = g.hazards.find((x) => x.state === 'warn'); if (h) { const a = Math.atan2(p.y - h.y, p.x - h.x); inp.keys.add(Math.cos(a) > 0 ? 'KeyD' : 'KeyA'); inp.keys.add(Math.sin(a) > 0 ? 'KeyS' : 'KeyW'); } }
      else if (s === 4) { qHold++; if (qHold === 1) inp.pressed.add('KeyQ'); if (qHold < 70) inp.keys.add('KeyQ'); if (qHold > 90) qHold = 0; }
      else if (s === 5) { const h = g.hazards.find((x) => x.state === 'warn' && x.damage > 0); if (h && h.progress > 0.75) inp.pressed.add('KeyE'); }
    };
    for (let i = 0; i < 90 && g.state !== 'result'; i++) if (!step(60, bot)) break;
    return { ok: g.state === 'result', detail: g.state === 'result' ? '' : `stuck at step ${g.tutorial && g.tutorial.step}` };
  });

  await test('save code export → import round trip', () => {
    g.goToMenu();
    g.saveData.soul = 4321;
    BR.SaveSystem.save(g.saveData);
    g.ui.menu.showSaveCode('export', () => {});
    const code = document.querySelector('.save-code').value;
    try { localStorage.removeItem(C.SAVE_KEY); } catch (e) { /* ignore */ }
    g.saveData = BR.SaveSystem.load();
    g.ui.menu.showSaveCode('import', () => {});
    document.querySelector('.save-code').value = code;
    document.querySelector('[data-action="load"]').click();
    return g.saveData.soul === 4321;
  });

  await test('every elite attack runs (forced elite on each pool boss)', () => {
    const bad = [];
    for (const def of BR.BOSS_DATA) {
      if (def.id === C.RUN.firstBoss || def.id === C.RUN.finalBoss) continue;
      BR.UIRoot.clear();
      g.startPractice(def.id, 'blade', 1);
      step(150, null);
      const b = g.boss;
      const atk = b.attacks.find((x) => x.elite);
      if (!atk) { bad.push(def.id + ':missing'); continue; }
      b.elite = true; b.idleTimer = 999; b.startAttack(atk);
      let f = 0;
      while ((b.routine || g.hazards.length) && f < 60 * 12) { if (!b.routine) b.idleTimer = 999; if (!step(1, () => { g.player.hp = g.player.stats.maxHp; }, 20)) break; f++; }
      if (b.routine) bad.push(def.id + ':never ends');
    }
    return { ok: bad.length === 0, detail: bad.join(', ') };
  });

  await test('every signature attack runs to completion (all bosses; apex + abyss: every attack, every phase)', () => {
    const bad = [];
    for (const def of BR.BOSS_DATA) {
      const sig = BR.BOSS_EXTRAS[def.id];
      if (!sig) { if (!def.rgb && def.id !== 'trainingDummy') bad.push(def.id + ':missing'); continue; }
      const full = !!def.rgb || def.id === 'abyssLord';
      const phases = [1, 2].concat(full && def.phaseThresholds.length >= 2 ? [def.phaseThresholds.length + 1] : []);
      for (const phase of phases) {
        BR.UIRoot.clear();
        g.startPractice(def.id, 'blade', phase);
        step(150, null);
        const b = g.boss;
        for (const atk of full ? [...(sig ? [sig] : []), ...b.attacks.filter((x) => (x.phase || 1) <= phase)] : [sig]) {
          b.idleTimer = 999; b.startAttack(atk);
          let f = 0;
          while ((b.routine || g.hazards.length) && f < 60 * 14) { if (!b.routine) b.idleTimer = 999; if (!step(1, () => { g.player.hp = g.player.stats.maxHp; }, 20)) break; f++; }
          if (b.routine) bad.push(def.id + ':' + atk.name + ' never ends');
        }
      }
    }
    return { ok: bad.length === 0, detail: bad.join(', ') };
  });

  await test('every character: attack, charge skill and E skill all run (incl. unlockable ones)', () => {
    const bad = [];
    for (const ch of BR.CHARACTERS) {
      BR.UIRoot.clear();
      g.startPractice('swordKnight', ch.id, 1);
      if (!step(120, fightBot)) { bad.push(ch.id + ':attack'); continue; }
      const pl = g.player;
      g.combat.playerChargeSkill(pl, pl.aim, 1);
      g.combat.playerESkill(pl, ch.e);
      if (!step(90, fightBot)) bad.push(ch.id + ':skills');
      if (g.boss && g.boss.hp >= g.boss.maxHp) bad.push(ch.id + ':dealt no damage');
    }
    return { ok: bad.length === 0, detail: bad.join(', ') };
  });

  await test('apex trophies: exclusive relics, never in the normal pool; new parry stats apply', () => {
    const bad = [];
    BR.UIRoot.clear();
    g.startRun('blade', 'normal', []);
    const pool = g.run.availableRelics();
    if (pool.some((r) => r.apex)) bad.push('apex relic in normal pool');
    for (const id of ['magmaTitan', 'prismSeraph', 'nightEmpress', 'tideLeviathan', 'ruinKing']) {
      if (!BR.RELICS.find((r) => r.apex === id)) bad.push('no trophy for ' + id);
    }
    const st = g.player.stats;
    BR.UPGRADES.filter((u) => /^(sharpriposte|daze|spiritflow|guardreflex|shockparry|giantslayer|ironwill|critflow)$/.test(u.id)).forEach((u) => BR.UpgradeSystem.apply(st, u, g.player));
    if (!(st.parryReflect >= 1 && st.parryStun >= 0.5 && st.parryEnergy >= 30 && st.parryIframes > 0 && st.parryClear && st.giantSlayer > 0 && st.critEnergy > 0)) bad.push('parry stats not applied');
    if (BR.game && g.run.soulMult < 1) bad.push('soulMult');
    return { ok: bad.length === 0, detail: bad.join(', ') };
  });

  await test('key rebinding: new key works, old key stops, arrows still move', () => {
    const inp = g.input;
    const fire = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code }));
    inp.setBindings({ dash: 'KeyF', up: 'KeyI' });
    fire('keydown', 'KeyF'); const dashOk = inp.isDown('Space'); fire('keyup', 'KeyF');
    fire('keydown', 'Space'); const oldBlocked = !inp.isDown('Space'); fire('keyup', 'Space');
    fire('keydown', 'KeyI'); const upOk = inp.isDown('KeyW'); fire('keyup', 'KeyI');
    fire('keydown', 'KeyW'); const oldUpBlocked = !inp.isDown('KeyW'); fire('keyup', 'KeyW');
    fire('keydown', 'ArrowUp'); const arrowOk = inp.moveVector().y < 0; fire('keyup', 'ArrowUp');
    inp.setBindings({});
    fire('keydown', 'Space'); const restored = inp.isDown('Space'); fire('keyup', 'Space');
    const ok = dashOk && oldBlocked && upOk && oldUpBlocked && arrowOk && restored;
    return { ok, detail: ok ? '' : JSON.stringify({ dashOk, oldBlocked, upOk, oldUpBlocked, arrowOk, restored }) };
  });

  await test('arcanist bomb explodes and blink teleports', () => {
    BR.UIRoot.clear();
    g.startPractice('stoneGolem', 'arcanist', 1);
    step(150, null);
    const b = g.boss, p = g.player;
    b.idleTimer = 999; b.routine = null;
    p.x = b.x; p.y = b.y + 200; p.aim = -Math.PI / 2;
    const hp0 = b.hp;
    g.combat.playerChargeSkill(p, -Math.PI / 2, 1);
    step(40, () => { b.idleTimer = 999; }, 0);
    const bombHit = b.hp < hp0;
    const x0 = p.x;
    p.aim = 0; g.combat.playerESkill(p, 'blink');
    const blinked = p.x - x0 > 150;
    return { ok: bombHit && blinked, detail: `bombHit=${bombHit} blinked=${blinked}` };
  });

  // ---------- layout: every screen fits in 1280x720, even with a wide fallback font ----------
  function offscreen() {
    const ov = document.querySelector('#ui-root .overlay');
    if (!ov) return ['no overlay'];
    const box = ov.getBoundingClientRect();
    if (box.height < 100) return ['overlay not measurable'];
    const k = 720 / box.height;
    const bad = [];
    for (const el of ov.querySelectorAll('*')) {
      // elements inside a scrolling list may be off-screen; the list itself must fit
      let scroller = null;
      for (let p = el.parentElement; p && p !== ov; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) { scroller = p; break; }
      }
      if (scroller) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const top = (r.top - box.top) * k, bottom = (r.bottom - box.top) * k;
      const left = (r.left - box.left) * k, right = (r.right - box.left) * k;
      if (top < -1 || bottom > 721 || left < -1 || right > 1281) {
        const label = (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName) + (el.textContent || '').trim().slice(0, 18);
        bad.push(`${label} [${Math.round(top)}..${Math.round(bottom)}]`);
      }
    }
    return [...new Set(bad)].slice(0, 4);
  }

  await test('layout: every screen fits on screen (normal + wide font)', () => {
    // fill the save so lists are as long as they get
    g.goToMenu();
    g.saveData = BR.SaveSystem.reset();
    g.saveData.soul = 99999;
    for (const d of BR.BOSS_DATA) { g.saveData.stats.bossKills[d.id] = 3; g.saveData.stats.bossDeaths[d.id] = 2; }
    BR.UIRoot.clear();
    g.startRun('blade', 'normal', ['fragile', 'tough', 'drought']);
    step(20, null);
    for (const u of BR.UPGRADES) g.run.addUpgrade(u);
    for (const r of BR.RELICS.slice(0, 4)) g.run.relics.push(r);
    g.run.synergies = BR.SYNERGIES.map((x) => x.id);
    BR.SaveSystem.saveRun({ v: 1, phase: 'fight', bossId: 'swordKnight', stage: 0, difficulty: 'nightmare', character: 'guardian', daily: '2026-01-01' });
    const ui = g.ui, m = ui.menu;
    const synUp = BR.UPGRADES.find((u) => u.id === 'projspd');
    const screens = {
      main: () => m.showMain(),
      runSetup: () => m.showRunSetup(),
      daily: () => m.showDaily(),
      practice: () => m.showPractice(),
      shop: () => m.showShop(),
      settings: () => m.showSettings(() => {}),
      controls: () => m.showControls(() => {}),
      saveCode: () => m.showSaveCode('export', () => {}),
      patchNotes: () => m.showPatchNotes(),
      records: () => ui.records.show(() => {}),
      pause: () => m.showPause(),
      reward: () => { g.run.upgrades.proj = 1; ui.reward.show([synUp, BR.UPGRADES[0], BR.UPGRADES.find((u) => u.id === 'laststand')], 999, 'CLOCKWORK WARDEN'); },
      relic: () => ui.relic.show(BR.RELICS.slice(0, 4), () => {}),
      bossSelect: () => ui.bossSelect.show(['clockworkWarden', 'westernShooter', 'stormCaller']),
      result: () => ui.result.show(false),
      tutorialDone: () => ui.result.showTutorialDone(),
      rush: () => m.showRush(),
      leaderboard: () => {
        g.saveData.stats.leaderboard = { normal: Array.from({ length: 10 }, (_, i) => ({ cleared: i < 5, stage: 5 - (i % 5), time: 300 + i * 17, character: 'guardian', mods: ['fragile', 'tough', 'drought'], date: '2026-10-05', id: i })) };
        ui.records.showLeaderboard(() => {}, 'normal');
      },
    };
    const fails = [];
    const wide = document.createElement('style');
    wide.textContent = '#ui-root, #ui-root * { font-family: Verdana, "Malgun Gothic", sans-serif !important; }';
    for (const font of ['normal', 'wide']) {
      if (font === 'wide') document.head.appendChild(wide);
      for (const [name, show] of Object.entries(screens)) {
        BR.UIRoot.clear();
        show();
        const bad = offscreen();
        if (bad.length) fails.push(`${name}(${font}): ${bad.join(' | ')}`);
      }
      if (font === 'wide') wide.remove();
    }
    window.removeEventListener('keydown', ui.reward.onKey);
    window.removeEventListener('keydown', ui.result.onKey);
    BR.SaveSystem.clearRun();
    g.saveData = BR.SaveSystem.reset();
    g.goToMenu();
    return { ok: fails.length === 0, detail: fails.join(' || ') };
  });

  // ---------- dodge audit ----------
  let audit = null;
  if (AUDIT) {
    line('\n--- DODGE AUDIT (every attack vs. a dodging bot; >25% hits = flagged) ---', 'warn');
    audit = await runAudit();
  }

  const failed = results.filter((r) => !r.ok).length;
  line(`\n${results.length - failed} passed, ${failed} failed`, failed ? 'fail' : 'pass');
  window.TEST_RESULT = { passed: results.length - failed, failed, results, audit, done: true };
  window.__T = { g, dodgeBot, dangerAt, step };
  try { localStorage.removeItem('bossRushRPG.TEST'); localStorage.removeItem('bossRushRPG.TEST.run'); } catch (e) { /* ignore */ }

  /* ======================================================================
   * Dodge bot: each frame, score 16 move directions + standing still by
   * predicted danger (telegraphs about to fire, expanding rings, projectiles,
   * charging boss), move to the safest. Dash when the current spot is about to be hit.
   * ==================================================================== */
  // Predicted danger at (x, y) within `look` seconds (plus a longer horizon for slow threats)
  function dangerAt(x, y, look) {
    const p = g.player, b = g.boss;
    const pr = p.radius;
    let d = 0;
    for (const h of g.hazards) {
      if (h.dead) continue;
      if (h.damage <= 0) {
        // Damage-free telegraphs precede a dash, projectile, ring or landing there
        if (h.state === 'warn' && h.warn - h.timer < look + 0.35 && h.contains(x, y, pr + 10)) d += 25;
        continue;
      }
      if (h.state === 'warn') {
        const remaining = h.warn - h.timer;
        if (h.contains(x, y, pr + 6)) d += remaining < look + 0.3 ? 30 : 3;
      } else if (h.state === 'active') {
        if (h.growSpeed) {
          const dist = Geo.dist(h.x, h.y, x, y);
          const inGap = h.gapArc > 0 && Math.abs(Geo.angleDiff(h.gapAngle, Geo.angle(h.x, h.y, x, y))) < h.gapArc / 2 - 0.12;
          if (!inGap && dist >= h.radius - h.width / 2 - pr) {
            const tReach = Math.max(0, (dist - h.radius - h.width / 2 - pr) / h.growSpeed);
            if (tReach < look + 0.12) d += 30;
            else if (tReach < 0.9) d += 8;
          }
        } else {
          let hit;
          if (h.spin) {
            const a = h.angle;
            hit = false;
            for (const tt of [0, look * 0.5, look]) { h.angle = a + h.spin * tt; if (h.contains(x, y, pr + 6)) { hit = true; break; } }
            h.angle = a;
          } else hit = h.contains(x, y, pr + 4);
          if (hit) d += h.persistent ? 14 : 30;
        }
      }
    }
    for (const q of g.projectiles) {
      if (q.owner !== 'boss' || q.dead) continue;
      for (const tt of [0.05, 0.15, 0.25, 0.35, 0.5]) {
        if (Geo.dist(q.x + q.vx * tt, q.y + q.vy * tt, x, y) < q.radius + pr + 8) { d += tt <= look + 0.1 ? 25 : 6; break; }
      }
    }
    if (b && b.contactDamage > 0) {
      for (const tt of [0.05, 0.15, 0.25]) {
        if (Geo.dist(b.x + b.vx * tt, b.y + b.vy * tt, x, y) < b.radius + pr + 12) { d += 30; break; }
      }
    }
    const A = C.ARENA;
    const m = Math.min(x - A.left, A.right - x, y - A.top, A.bottom - y);
    if (m < 50) d += (50 - m) / 25;
    // tie-breaker: keep a sensible distance from the boss, like a player would
    if (b) d += Math.abs(Geo.dist(x, y, b.x, b.y) - 230) * 0.002;
    return d;
  }

  function dodgeBot() {
    const p = g.player, b = g.boss, inp = g.input;
    inp.keys.clear();
    inp.mouse.down = false;
    if (!p || !b) return;
    inp.mouse.x = b.x; inp.mouse.y = b.y;
    p.hp = p.stats.maxHp;
    const sp = p.stats.moveSpeed * (p.slowTimer > 0 ? p.slowFactor : 1);
    let best = [0, 0], bestD = Infinity;
    for (let i = -1; i < 16; i++) {
      const dx = i < 0 ? 0 : Math.cos((i / 16) * TAU), dy = i < 0 ? 0 : Math.sin((i / 16) * TAU);
      const near = Geo.clampToArena(p.x + dx * sp * 0.12, p.y + dy * sp * 0.12, p.radius);
      const far = Geo.clampToArena(p.x + dx * sp * 0.3, p.y + dy * sp * 0.3, p.radius);
      const d = dangerAt(near.x, near.y, 0.12) + dangerAt(far.x, far.y, 0.3) * 0.7;
      if (d < bestD - 0.01) { bestD = d; best = [dx, dy]; }
    }
    inp.stick.x = best[0];
    inp.stick.y = best[1];
    // Dash when staying put gets us hit very soon
    if (p.dashCooldownTimer <= 0 && !p.isDashing && dangerAt(p.x, p.y, 0.1) >= 25) {
      let dashDir = null, dashD = Infinity;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const end = Geo.clampToArena(p.x + Math.cos(a) * p.stats.dashDistance, p.y + Math.sin(a) * p.stats.dashDistance, p.radius);
        const d = dangerAt(end.x, end.y, 0.25) + dangerAt(end.x, end.y, 0.6) * 0.5;
        if (d < dashD) { dashD = d; dashDir = a; }
      }
      if (dashDir !== null) {
        inp.stick.x = Math.cos(dashDir);
        inp.stick.y = Math.sin(dashDir);
        inp.pressed.add('Space');
      }
    }
  }

  async function runAudit() {
    const report = [];
    let currentAttack = null, hits = 0;
    const orig = g.combat.damagePlayer.bind(g.combat);
    g.combat.damagePlayer = (amount, sx, sy) => {
      const r = orig(amount, sx, sy);
      if (r && currentAttack) hits++;
      return r;
    };
    const TRIALS = Number(params.get('trials')) || (QUICK ? 4 : 8);
    for (const def of BR.BOSS_DATA) {
      const phases = def.phaseThresholds.length + 1;
      for (let phase = 1; phase <= phases; phase++) {
        for (const worst of [false, true]) {
          BR.UIRoot.clear();
          g.startPractice(def.id, 'blade', phase);
          step(60 * 4, dodgeBot, 0); // intro + phase transition
          const b = g.boss;
          if (worst) {
            g.run.enemyTimeScale = 1.2;
            b.tempoByPhase = b.tempoByPhase.map((t) => t * 0.9);
            b.tempo = b.tempoByPhase[b.phase - 1];
          }
          for (const atk of b.attacks) {
            if ((atk.phase || 1) > phase || (atk.maxPhase && phase > atk.maxPhase)) continue;
            if (atk.auditSkip) { line(`      ${def.id} P${phase}${worst ? ' worst' : '      '}  ${atk.name.padEnd(14)} skipped (${atk.auditSkip})`); continue; }
            hits = 0;
            currentAttack = atk.name;
            for (let t = 0; t < TRIALS; t++) {
              // reset to a clean, legal starting situation
              for (const h of g.hazards) h.dead = true;
              for (const q of g.projectiles) if (q.owner === 'boss') q.dead = true;
              b.routine = null; b.currentAttack = null; b.stop(); b.invulnerable = false; b.alpha = 1; b.airborne = false;
              if (b.burrowed !== undefined) b.burrowed = false;
              b.x = Geo.rand(C.ARENA.left + 200, C.ARENA.right - 200);
              b.y = Geo.rand(C.ARENA.top + 150, C.ARENA.bottom - 150);
              const minR = Math.max(atk.minRange || 0, b.radius + 40);
              const maxR = Math.min(atk.maxRange || 420, 420);
              const ang = Math.random() * TAU, dist = Geo.rand(minR, Math.max(minR, maxR));
              const pos = Geo.clampToArena(b.x + Math.cos(ang) * dist, b.y + Math.sin(ang) * dist, 20);
              g.player.x = pos.x; g.player.y = pos.y; g.player.vx = g.player.vy = 0;
              g.player.dashCooldownTimer = 0; g.player.iframes = 0; g.player.hurtTimer = 0;
              b.idleTimer = 999;
              b.elite = !!atk.elite;
              b.startAttack(atk);
              let f = 0;
              const busy = () => b.routine || g.hazards.some((h) => h.damage > 0 && !h.dead) || g.projectiles.some((q) => q.owner === 'boss');
              // keep the boss idle after the forced attack so other attacks aren't counted
              while (busy() && f < 60 * 12) { if (!b.routine) b.idleTimer = 999; if (!step(1, dodgeBot, 0)) break; f++; }
              g.player.iframes = 0;
            }
            currentAttack = null;
            const rate = hits / TRIALS;
            const row = { boss: def.id, phase, worst, attack: atk.name, rate: +rate.toFixed(2) };
            report.push(row);
            const cls = rate > 0.25 ? 'fail' : rate > 0 ? 'warn' : 'pass';
            line(`${rate > 0.25 ? 'FLAG' : '    '}  ${def.id} P${phase}${worst ? ' worst' : '      '}  ${atk.name.padEnd(14)} hits ${hits}/${TRIALS}`, cls);
            await yieldUI();
          }
        }
      }
    }
    g.combat.damagePlayer = orig;
    return report;
  }
})();
