/*
 * Game: owns the loop, world lists and the flow
 * menu -> intro -> fight -> victory -> reward -> (select) -> intro ... -> result
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;
  const C = BR.CONFIG;
  const R = C.RUN;


  // Tutorial steps: event = what counts as progress, mode = what the dummy does
  const TUTORIAL = [
    { text: '{move} (또는 왼쪽 스틱)로 이동하세요', event: 'move', goal: 3 },
    { text: '좌클릭을 꾹 눌러 허수아비를 공격하세요 — 마지막 타격은 강한 피니셔', event: 'finisher', goal: 2 },
    { text: '{dash}(으)로 대시하세요 — 대시 중에는 무적입니다', event: 'dash', goal: 3 },
    { text: '빨간 영역이 꽉 차기 전에 빠져나가세요', event: 'dodge', goal: 3, mode: 'dodge' },
    { text: '{charge}을(를) 꾹 눌러 끝까지 충전한 뒤 떼세요', event: 'charge', goal: 1 },
    { text: '공격이 닿기 직전(영역이 거의 찼을 때) {skill} → PARRY!', event: 'parry', goal: 2, mode: 'parry' },
  ];

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.input = new BR.Input(canvas);
      this.camera = new BR.Camera();
      this.particles = new BR.ParticleSystem(C.PARTICLE_LIMIT);
      this.audio = new BR.AudioManager();
      this.music = new BR.MusicManager(this.audio);
      this.renderer = new BR.Renderer();
      this.combat = new BR.CombatSystem(this);
      this.hud = new BR.HUD(this);
      this.saveData = BR.SaveSystem.load();

      this.ui = {
        records: new BR.RecordsUI(this),
        menu: new BR.MenuUI(this),
        reward: new BR.RewardUI(this),
        bossSelect: new BR.BossSelectUI(this),
        result: new BR.ResultUI(this),
        relic: new BR.RelicUI(this),
      };
      this.touch = new BR.TouchUI(this);
      this.tutorial = null;

      this.state = 'menu';
      this.paused = false;
      this.time = 0;
      this.stateTimer = 0;
      this.slowmoTimer = 0;
      this.hitstop = 0;
      this.flash = 0;
      this.flashColor = '255,255,255';
      this.hurtVignette = 0;
      this.banner = null;
      this.fightStartTime = 0;
      this.theme = 'abyss';
      this.ambientAcc = 0;
      this.toasts = [];

      this.player = null;
      this.boss = null;
      this.run = null;
      this.projectiles = [];
      this.hazards = [];
      this.effects = [];

      this.applySettings();
      this._loop = this._loop.bind(this);
      window.addEventListener('blur', () => {
        if (this.state === 'fight' || this.state === 'intro') this.setPaused(true);
      });
    }

    start() {
      this.ui.menu.showMain();
      this.music.play('menu');
      this.lastTime = performance.now();
      requestAnimationFrame(this._loop);
    }

    applySettings() {
      const s = this.saveData.settings;
      this.audio.setVolume(s.volume);
      this.music.setVolume(s.musicVolume);
      this.input.setBindings(s.keys);
      BR.ACCESS.colorblind = !!s.colorblind;
      BR.ACCESS.reducedFlashes = s.flashes === 'reduced';
      this.camera.intensity = s.shake;
    }

    /* ---------------- loop ---------------- */
    _loop(now) {
      let dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      if (!(dt > 0)) dt = 0;
      dt = Math.min(dt, C.MAX_DT);
      this.update(dt);
      this.render(dt);
      this.input.endFrame();
      requestAnimationFrame(this._loop);
    }

    update(realDt) {
      this.input.pollGamepad();
      this.music.update();
      if (this.touch) this.touch.update();
      if (this.boss && this.state === 'fight') this.music.intensity = this.boss.phase;
      if (this.input.wasPressed('Escape') && (this.state === 'fight' || this.state === 'intro')) {
        this.setPaused(!this.paused);
      }
      if (this.paused) return;
      this.time += realDt;
      this.stateTimer += realDt;

      // Time scaling: slow motion on boss death, micro hit-stop on impacts
      let timeScale = 1;
      if (this.slowmoTimer > 0) {
        this.slowmoTimer -= realDt;
        timeScale = R.slowmoScale;
      }
      if (this.hitstop > 0) {
        this.hitstop -= realDt;
        timeScale *= 0.08;
      }
      const dt = realDt * timeScale;

      const inBattle = this.state === 'intro' || this.state === 'fight' || this.state === 'victory' || this.state === 'dying';
      if (inBattle) this.updateWorld(dt);
      else {
        this.particles.update(realDt);
        Geo.compact(this.effects);
        for (const e of this.effects) e.update(realDt, this);
      }
      this._spawnAmbient(realDt);
      this.camera.update(realDt);
      this.flash = Math.max(0, this.flash - realDt * 2.5);
      this.hurtVignette = Math.max(0, this.hurtVignette - realDt * 2);
      if (this.banner) {
        this.banner.time += realDt;
        if (this.banner.time >= this.banner.duration) this.banner = null;
      }
      if (this.killCam) {
        this.killCam.t += realDt;
        if (this.killCam.t > R.victoryDelay) this.killCam = null;
      }
      if (this.toasts.length) {
        this.toasts[0].time += realDt;
        if (this.toasts[0].time >= this.toasts[0].duration) this.toasts.shift();
      }
      this.updateState(realDt);
    }

    updateWorld(dt) {
      const controlled = this.state === 'intro' || this.state === 'fight' || this.state === 'victory';
      if (this.player) this.player.update(dt, this.input, controlled);
      // Boss-side time can be slowed (Cracked Hourglass relic)
      const edt = dt * (this.run ? this.run.enemyTimeScale : 1);
      if (this.boss) this.boss.update(edt);
      for (const p of this.projectiles) p.update(p.owner === 'boss' ? edt : dt, this);
      for (const h of this.hazards) h.update(edt, this);
      this.combat.update(dt);
      for (const e of this.effects) e.update(dt, this);
      Geo.compact(this.projectiles);
      Geo.compact(this.hazards);
      Geo.compact(this.effects);
      this.particles.update(dt);
      if (this.run && this.state === 'fight') {
        this.run.time += dt;
        if (this.run.mode === 'run') this.saveData.stats.playTime += dt;
      }
      if (this.tutorial && this.state === 'fight') this._updateTutorial(dt);
    }

    updateState() {
      switch (this.state) {
        case 'intro':
          if (this.stateTimer >= R.introTime) {
            this.state = 'fight';
            this.stateTimer = 0;
            this.fightStartTime = this.time;
            if (this.boss) this.boss.active = true;
          }
          break;
        case 'victory':
          if (this.stateTimer >= R.victoryDelay) {
            if (this.run.mode === 'practice') this.showPracticeResult(true);
            else if (this.run.isComplete) this.showResult(true);
            else if (this.run.rush) this._rushNext();
            else this.showReward();
          }
          break;
        case 'dying':
          if (this.stateTimer >= R.deathDelay) {
            if (this.run.mode === 'practice') this.showPracticeResult(false);
            else this.showResult(false);
          }
          break;
        default:
          break;
      }
    }

    _spawnAmbient(dt) {
      const theme = this.renderer.getTheme(this.theme);
      this.ambientAcc += dt * theme.ambientRate;
      const A = C.ARENA;
      while (this.ambientAcc >= 1) {
        this.ambientAcc -= 1;
        this.particles.emit(theme.ambient, Geo.rand(A.left, A.right), Geo.rand(A.top, A.bottom), 1, { speedMult: 0.6 });
      }
    }

    /* ---------------- flow ---------------- */
    setPaused(value) {
      if (value === this.paused) return;
      this.paused = value;
      this.input.releaseMouse();
      if (value) this.ui.menu.showPause();
      else BR.UIRoot.clear();
    }

    // opts.daily: today's daily challenge (fixed seed + daily modifier, NORMAL)
    startRun(characterId, difficultyId, modifierIds, opts = {}) {
      BR.UIRoot.clear();
      this.paused = false;
      const settings = this.saveData.settings;
      const daily = opts.daily ? BR.dailyInfo() : null;
      let character = BR.CHARACTER_BY_ID[characterId || settings.lastCharacter] || BR.CHARACTERS[0];
      if (!BR.isCharacterUnlocked(character, this.saveData)) character = BR.CHARACTERS[0];
      const difficulty = daily ? BR.DIFFICULTY_BY_ID.normal
        : BR.DIFFICULTY_BY_ID[difficultyId || settings.lastDifficulty] || BR.DIFFICULTY_BY_ID.normal;
      const mods = daily ? [daily.modifier.id] : (modifierIds || settings.lastModifiers || []);
      settings.lastCharacter = character.id;
      if (!daily) {
        settings.lastDifficulty = difficulty.id;
        settings.lastModifiers = mods.slice();
      }
      this.run = new BR.RunSystem(difficulty, character, this.saveData.meta);
      if (daily) {
        this.run.daily = daily.date;
        this.run.seed = daily.seed;
        this.run.rng = Geo.makeRng(daily.seed);
      }
      const stats = BR.UpgradeSystem.createBaseStats(this.saveData.meta, character);
      this.player = new BR.Player(this, stats, character);
      this._applyModifiers(mods);
      this.player.hp = this.player.stats.maxHp;
      // Head Start: random upgrades before the first boss
      const head = BR.UpgradeSystem.metaValue(this.saveData.meta, 'headstart');
      for (const up of BR.RewardSystem.roll(head, this.run.upgrades, this.run.rng, this.run.rarityBoost)) {
        this.run.addUpgrade(up);
        BR.UpgradeSystem.apply(this.player.stats, up, this.player);
      }
      this.checkSynergies(true);
      this.saveData.stats.runs++;
      BR.SaveSystem.save(this.saveData);
      BR.SaveSystem.clearRun();
      this.beginBoss(this.run.firstBossId());
    }

    // Boss Rush: all 12 bosses in a fixed order, no upgrades, base stats only (fair times)
    startRush(characterId) {
      BR.UIRoot.clear();
      this.paused = false;
      this.tutorial = null;
      let character = BR.CHARACTER_BY_ID[characterId] || BR.CHARACTERS[0];
      if (!BR.isCharacterUnlocked(character, this.saveData)) character = BR.CHARACTERS[0];
      this.saveData.settings.lastCharacter = character.id;
      this.run = new BR.RunSystem(BR.DIFFICULTY_BY_ID.normal, character, {});
      this.run.rush = true;
      this.run.rushOrder = BR.RUSH_ORDER.slice();
      this.run.eliteChance = 0;
      this.run.rerolls = 0;
      this.player = new BR.Player(this, BR.UpgradeSystem.createBaseStats({}, character), character);
      this.saveData.stats.runs++;
      BR.SaveSystem.save(this.saveData);
      BR.SaveSystem.clearRun();
      this.beginBoss(this.run.rushOrder[0]);
    }

    _rushNext() {
      const s = this.player.stats;
      this.player.heal(s.maxHp * R.rushHealRatio);
      this.beginBoss(this.run.nextBossOptions()[0]);
    }

    // Local top-10 per difficulty (+ Boss Rush). Returns the rank (1..10) or 0.
    recordLeaderboard(cleared) {
      const r = this.run;
      if (!r || r.mode !== 'run' || r.daily) return 0;
      const key = r.rush ? 'rush' : r.difficulty.id;
      const board = this.saveData.stats.leaderboard;
      const list = board[key] || [];
      const d = new Date();
      const entry = {
        cleared, stage: r.stage, time: Math.round(r.time), character: r.character.id,
        mods: r.modifiers.map((m) => m.id), date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        id: Date.now(),
      };
      list.push(entry);
      list.sort((a, b) => (b.cleared - a.cleared) || (a.cleared ? a.time - b.time : (b.stage - a.stage) || (a.time - b.time)));
      board[key] = list.slice(0, 10);
      const rank = board[key].findIndex((e) => e.id === entry.id) + 1;
      return rank;
    }

    _applyModifiers(ids) {
      for (const id of ids || []) {
        const m = BR.MODIFIER_BY_ID[id];
        if (!m || this.run.modifiers.includes(m)) continue;
        this.run.modifiers.push(m);
        m.apply(this.player.stats, this.player, this.run);
        this.run.soulMult += m.soul;
      }
    }

    beginBoss(id, forceElite) {
      BR.UIRoot.clear();
      this.killCam = null;
      const def = BR.BOSS_BY_ID[id];
      this.run.currentBossId = id;
      this.theme = def.arena;
      this.projectiles.length = 0;
      this.hazards.length = 0;
      this.effects.length = 0;
      this.particles.clear();
      this.camera.reset();
      this.banner = null;
      this.slowmoTimer = 0;
      this.hitstop = 0;
      this.input.releaseMouse();

      const A = C.ARENA;
      this.player.resetForFight((A.left + A.right) / 2, A.bottom - 110);
      this.boss = BR.BossSystem.create(id, this, this.run, forceElite);
      this.run.bossDamageTaken = 0;
      this.run.bossStartTime = this.run.time;
      this.state = 'intro';
      this.stateTimer = 0;
      this.audio.play('bossIntro');
      this.music.play(def.arena);
      this.checkpoint('fight', { bossId: id, elite: !!this.boss.elite });
    }

    /* ---------------- RUN save / continue ---------------- */
    checkpoint(phase, extra) {
      const r = this.run, p = this.player;
      if (!r || !p || r.mode !== 'run') return;
      BR.SaveSystem.saveRun(Object.assign({
        v: 1, phase,
        difficulty: r.difficulty.id, character: r.character.id,
        stage: r.stage, defeated: r.defeated.slice(),
        upgrades: Object.assign({}, r.upgrades), upgradeOrder: r.upgradeOrder.slice(),
        relics: r.relics.map((x) => x.id), relicOffered: Object.assign({}, r.relicOffered),
        rerolls: r.rerolls, soulEarned: r.soulEarned, time: r.time,
        modifiers: r.modifiers.map((m) => m.id), daily: r.daily, seed: r.seed, rush: r.rush,
        rngState: r.rng.getState ? r.rng.getState() : null,
        damageDealt: r.damageDealt, damageTaken: r.damageTaken, phoenixUsed: r.phoenixUsed || 0,
        hp: Math.round(p.hp), theme: this.theme,
        lastSoulGain: this.lastSoulGain || 0, bossName: this.boss ? this.boss.name : (this.lastBossName || ''),
        savedAt: Date.now(),
      }, extra));
    }

    resumeRun() {
      const c = BR.SaveSystem.loadRun();
      if (!c) { this.ui.menu.showMain(); return; }
      BR.UIRoot.clear();
      this.paused = false;
      this.tutorial = null;
      const character = BR.CHARACTER_BY_ID[c.character] || BR.CHARACTERS[0];
      const difficulty = BR.DIFFICULTY_BY_ID[c.difficulty] || BR.DIFFICULTY_BY_ID.normal;
      const meta = c.rush ? {} : this.saveData.meta; // Boss Rush ignores permanent upgrades
      const run = new BR.RunSystem(difficulty, character, meta);
      this.run = run;
      this.player = new BR.Player(this, BR.UpgradeSystem.createBaseStats(meta, character), character);
      if (c.rush) {
        run.rush = true;
        run.rushOrder = BR.RUSH_ORDER.slice();
        run.eliteChance = 0;
      }
      if (c.daily && c.seed !== null && c.seed !== undefined) {
        run.daily = c.daily;
        run.seed = c.seed;
        run.rng = Geo.makeRng(c.seed);
      }
      // Rebuild the build exactly: modifiers -> upgrades -> relics -> synergies
      this._applyModifiers(c.modifiers);
      for (const id of c.upgradeOrder || []) {
        const up = BR.UPGRADES.find((u) => u.id === id);
        if (!up) continue;
        for (let i = 0; i < (c.upgrades[id] || 0); i++) {
          run.addUpgrade(up);
          BR.UpgradeSystem.apply(this.player.stats, up, this.player);
        }
      }
      for (const id of c.relics || []) {
        const relic = BR.RELIC_BY_ID[id];
        if (!relic) continue;
        run.relics.push(relic);
        relic.apply(this.player.stats, this.player, run);
      }
      this.checkSynergies(true);
      run.stage = c.stage || 0;
      run.defeated = c.defeated || [];
      run.relicOffered = c.relicOffered || {};
      run.rerolls = c.rerolls !== undefined ? c.rerolls : run.rerolls;
      run.soulEarned = c.soulEarned || 0;
      run.time = c.time || 0;
      run.damageDealt = c.damageDealt || 0;
      run.damageTaken = c.damageTaken || 0;
      run.phoenixUsed = c.phoenixUsed || 0;
      if (run.rng.setState && c.rngState !== null && c.rngState !== undefined) run.rng.setState(c.rngState);
      this.player.stats.phoenix = Math.max(0, this.player.stats.phoenix - run.phoenixUsed);
      this.player.hp = Math.max(1, Math.min(this.player.stats.maxHp, c.hp || this.player.stats.maxHp));
      this.lastSoulGain = c.lastSoulGain || 0;
      this.lastBossName = c.bossName || '';
      if (c.theme) this.theme = c.theme;

      if (c.phase === 'fight' && BR.BOSS_BY_ID[c.bossId]) {
        this.beginBoss(c.bossId, c.elite);
      } else if (c.phase === 'select' && c.options && c.options.length) {
        this.boss = null;
        this.state = 'select';
        this.music.play('menu');
        this.ui.bossSelect.show(c.options);
      } else {
        this.boss = null;
        this.showReward();
      }
    }

    /* ---------------- practice / tutorial ---------------- */
    _startSpecial(mode, bossId, characterId) {
      BR.UIRoot.clear();
      this.paused = false;
      const character = BR.CHARACTER_BY_ID[characterId] || BR.CHARACTER_BY_ID[this.saveData.settings.lastCharacter] || BR.CHARACTERS[0];
      this.run = new BR.RunSystem(BR.DIFFICULTY_BY_ID.normal, character, this.saveData.meta);
      this.run.mode = mode;
      this.run.rerolls = 0;
      this.run.eliteChance = 0;
      this.player = new BR.Player(this, BR.UpgradeSystem.createBaseStats(this.saveData.meta, character), character);
      this.beginBoss(bossId);
    }

    startPractice(bossId, characterId, phase) {
      this.tutorial = null;
      this.practiceSetup = { bossId, characterId, phase };
      this._startSpecial('practice', bossId, characterId);
      // Start at a later phase: drop HP to the threshold, the transition plays on activation
      if (phase > 1 && this.boss.phaseThresholds[phase - 2] !== undefined) {
        this.boss.hp = Math.floor(this.boss.maxHp * this.boss.phaseThresholds[phase - 2]);
        this.boss.displayHp = this.boss.hp;
      }
    }

    startTutorial(characterId) {
      this.tutorial = { step: 0, count: 0, moved: 0, lastX: 0, lastY: 0, done: false, doneTimer: 0 };
      this._startSpecial('tutorial', 'trainingDummy', characterId);
      this.tutorial.lastX = this.player.x;
      this.tutorial.lastY = this.player.y;
    }

    tutorialMode() {
      if (!this.tutorial || this.tutorial.done) return null;
      const step = TUTORIAL[this.tutorial.step];
      return step ? step.mode || null : null;
    }

    onTutorialEvent(type) {
      const t = this.tutorial;
      if (!t || t.done || !this.run || this.run.mode !== 'tutorial') return;
      const step = TUTORIAL[t.step];
      if (step && step.event === type) t.count++;
    }

    _updateTutorial(dt) {
      const t = this.tutorial;
      const p = this.player;
      p.energy = C.PLAYER.maxEnergy;
      p.lanceCharges = p.stats.skillCharges;
      if (t.done) {
        t.doneTimer += dt;
        if (t.doneTimer > 2.2) {
          this.tutorial = null;
          this.state = 'result';
          this.music.play('menu');
          this.ui.result.showTutorialDone();
        }
        return;
      }
      const step = TUTORIAL[t.step];
      if (step.event === 'move') {
        t.moved += BR.Geo.dist(t.lastX, t.lastY, p.x, p.y);
        t.count = Math.floor(t.moved / 160);
      }
      t.lastX = p.x;
      t.lastY = p.y;
      if (t.count >= step.goal) {
        t.step++;
        t.count = 0;
        this.audio.play('reward');
        this.spawnText(p.x, p.y - 34, 'GOOD!', { color: '#7dffa0', size: 20 });
        for (const h of this.hazards) h.dead = true;
        if (t.step >= TUTORIAL.length) {
          t.done = true;
          this.saveData.settings.tutorialDone = true;
          BR.SaveSystem.save(this.saveData);
          this.showBanner('TUTORIAL COMPLETE', '이제 진짜 보스를 상대할 차례', '#7dffa0', 2.2);
        }
      }
    }

    _drawTutorial(ctx) {
      const t = this.tutorial;
      if (!t || t.done) return;
      const step = TUTORIAL[t.step];
      const w = 620, h = 64, x = (C.WIDTH - w) / 2, y = 104;
      ctx.save();
      ctx.fillStyle = 'rgba(8,6,14,0.85)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(125,255,160,0.5)';
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      Draw.text(ctx, `STEP ${t.step + 1} / ${TUTORIAL.length}`, x + 14, y + 16, { size: 11, align: 'left', color: '#7dffa0', weight: '800' });
      Draw.text(ctx, `${Math.min(t.count, step.goal)} / ${step.goal}`, x + w - 14, y + 16, { size: 12, align: 'right', color: '#fff', weight: '800' });
      Draw.text(ctx, BR.fillKeys(step.text), C.WIDTH / 2, y + 42, { size: 17, color: '#ffffff', weight: '700' });
      ctx.fillStyle = '#7dffa0';
      ctx.fillRect(x, y + h - 3, w * Math.min(1, t.count / step.goal), 3);
      ctx.restore();
    }

    showPracticeResult(cleared) {
      this.state = 'result';
      this.stateTimer = 0;
      this.input.releaseMouse();
      this.music.play('menu');
      this.ui.result.showPractice(cleared);
    }

    /* ---------------- relics / synergies ---------------- */
    acquireRelic(relic) {
      this.run.relics.push(relic);
      relic.apply(this.player.stats, this.player, this.run);
      this.player.onStatsChanged();
      this.audio.play('clear');
    }

    checkSynergies(silent) {
      const run = this.run;
      for (const syn of BR.SYNERGIES) {
        if (run.synergies.includes(syn.id)) continue;
        if (!syn.requires.every((id) => run.upgrades[id])) continue;
        run.synergies.push(syn.id);
        syn.apply(this.player.stats, this.player);
        this.player.onStatsChanged();
        if (!silent) {
          this.toasts.push({ title: syn.name, desc: BR.fillKeys(syn.desc), icon: '⚡', time: 0, duration: 3.2, label: 'SYNERGY UNLOCKED' });
          this.audio.play('clear');
        }
      }
    }

    onBossPhase(boss, phase) {
      if (this.player && this.player.stats.phaseHeal) {
        const healed = this.player.heal(this.player.stats.phaseHeal);
        if (healed > 0) this.spawnText(this.player.x, this.player.y - 30, `+${Math.round(healed)}`, { color: '#7dffa0', size: 16 });
      }
      const final = phase === boss.phaseThresholds.length + 1;
      const text = boss.id === 'abyssLord'
        ? (phase === 2 ? 'THE ABYSS AWAKENS' : 'FINAL DESPAIR')
        : `${boss.name} ${final ? 'IS ENRAGED' : 'GROWS STRONGER'}`;
      this.showBanner(`PHASE ${phase}`, text, '#ff4d6a', 2.2);
      this.flash = 0.5;
      this.flashColor = '255,60,80';
      this.audio.play('bossPhase');
    }

    onBossDefeated() {
      if (this.state !== 'fight' || !this.boss || this.boss.dead) return;
      const boss = this.boss;
      boss.die();
      this.state = 'victory';
      this.stateTimer = 0;
      this.slowmoTimer = R.slowmoTime;
      this.flash = 1;
      this.flashColor = '255,255,255';
      this.camera.shakePreset('big');
      // Final-blow camera + boss-colored death burst
      this.killCam = { x: boss.x, y: boss.y, t: 0 };
      const rgb = BR.hexToRgb(boss.def.color || '#ffffff');
      this.particles.emit('death', boss.x, boss.y, 60, { radius: boss.radius * 0.6 });
      this.particles.emit('death', boss.x, boss.y, 50, { radius: boss.radius * 0.5, color: rgb });
      this.particles.emit('explosion', boss.x, boss.y, 40, { radius: boss.radius });
      this.effects.push(new BR.RingFx({ x: boss.x, y: boss.y, r0: boss.radius, r1: 420, color: '255,240,200', width: 16, life: 0.9 }));
      this.effects.push(new BR.RingFx({ x: boss.x, y: boss.y, r0: boss.radius * 0.5, r1: 260, color: rgb, width: 10, life: 0.7 }));
      this.effects.push(new BR.RingFx({ x: boss.x, y: boss.y, r0: 10, r1: 140, color: rgb, width: 6, life: 0.5 }));
      for (const h of this.hazards) h.dead = true;
      for (const p of this.projectiles) if (p.owner === 'boss') p.dead = true;
      this.audio.play('bossDeath');
      if (this.run.mode !== 'run') {
        this.showBanner('PRACTICE CLEAR', `${(this.run.time).toFixed(1)}s`, '#7dffa0', R.victoryDelay);
        return;
      }
      if (this.player.stats.relicFang) this.player.heal(this.player.stats.maxHp * 0.3);

      const soul = this.run.recordBossDefeat(boss.id, boss.elite);
      this.lastSoulGain = soul;
      this.saveData.soul += soul;
      const st = this.saveData.stats;
      st.totalSoul += soul;
      st.bestStage = Math.max(st.bestStage, this.run.stage);
      st.bossKills[boss.id] = (st.bossKills[boss.id] || 0) + 1;
      const fightTime = this.run.time - this.run.bossStartTime;
      if (fightTime > 0 && (!st.fastestBoss || fightTime < st.fastestBoss)) st.fastestBoss = Math.round(fightTime * 10) / 10;
      if (this.run.bossDamageTaken === 0) st.flawlessBosses++;
      if (this.player && this.player.hp <= 10) this.recordSpecial('clutch');
      if (this.run.isComplete) {
        const d = this.run.difficulty.id, c = this.run.character.id;
        st.clears++;
        st.clearsByDifficulty[d] = (st.clearsByDifficulty[d] || 0) + 1;
        st.clearsByCharacter[c] = (st.clearsByCharacter[c] || 0) + 1;
        const t = Math.round(this.run.time);
        if (!st.bestClearTime[d] || t < st.bestClearTime[d]) st.bestClearTime[d] = t;
      }
      this.checkAchievements();
      BR.SaveSystem.save(this.saveData);
      this.showBanner(boss.elite ? 'ELITE DEFEATED' : 'BOSS DEFEATED', `+${soul} SOUL`, '#ffd76a', R.victoryDelay);
    }

    onPlayerDeath() {
      if (this.state !== 'fight' || !this.player || this.player.dead) return;
      const p = this.player;
      p.dead = true;
      this.state = 'dying';
      this.stateTimer = 0;
      this.slowmoTimer = 0.6;
      this.flash = 0.8;
      this.flashColor = '255,40,60';
      this.camera.shakePreset('big');
      this.particles.emit('death', p.x, p.y, 50, { color: '94,231,255' });
      this.particles.emit('blood', p.x, p.y, 30);
      this.audio.play('death');
      if (this.run.mode !== 'run') {
        this.showBanner('YOU DIED', '', '#ff4d6a', R.deathDelay);
        return;
      }
      BR.SaveSystem.clearRun();
      const st = this.saveData.stats;
      st.deaths++;
      if (this.boss) st.bossDeaths[this.boss.id] = (st.bossDeaths[this.boss.id] || 0) + 1;
      this.checkAchievements();
      BR.SaveSystem.save(this.saveData);
      this.showBanner('YOU DIED', '', '#ff4d6a', R.deathDelay);
    }

    showReward() {
      this.state = 'reward';
      this.stateTimer = 0;
      this.music.play('menu');
      if (this.boss) this.lastBossName = this.boss.name;
      this.checkpoint('reward');
      if (this.run.shouldOfferRelic()) {
        this.ui.relic.show(this.run.rollRelics(this.run.relicChoices), (relic) => {
          this.acquireRelic(relic);
          this.checkpoint('reward');
          this._showUpgradeChoice();
        });
        return;
      }
      this._showUpgradeChoice();
    }

    _showUpgradeChoice() {
      const choices = BR.RewardSystem.roll(3, this.run.upgrades, this.run.rng, this.run.rarityBoost);
      this.ui.reward.show(choices, this.lastSoulGain || 0, this.boss ? this.boss.name : (this.lastBossName || ''));
    }

    onRewardChosen(upgrade) {
      this.run.addUpgrade(upgrade);
      BR.UpgradeSystem.apply(this.player.stats, upgrade, this.player);
      this.checkSynergies(false);
      // Recover between bosses
      const s = this.player.stats;
      this.player.heal((this.run.noHeal ? 0 : s.maxHp * (R.healBetweenBossesRatio + (s.betweenHealBonus || 0))) + s.healAfterBoss);
      const options = this.run.nextBossOptions();
      if (options.length > 1) {
        this.state = 'select';
        this.checkpoint('select', { options });
        this.ui.bossSelect.show(options);
      } else {
        this.beginBoss(options[0]);
      }
    }

    showResult(cleared) {
      BR.SaveSystem.clearRun();
      const st = this.saveData.stats;
      st.totalDamage += this.run.damageDealt;
      st.damageTaken += this.run.damageTaken;
      if (this.run.rush) {
        st.rushBestStage = Math.max(st.rushBestStage || 0, this.run.stage);
        if (cleared && (!st.rushBest.time || this.run.time < st.rushBest.time)) {
          st.rushBest = { time: Math.round(this.run.time), character: this.run.character.id };
        }
      }
      this.lastRank = this.recordLeaderboard(cleared);
      this.checkAchievements();
      if (this.run.daily) {
        // Best daily result: clears beat non-clears, then faster clear / deeper stage
        const prev = st.daily[this.run.daily];
        const better = !prev || (cleared ? (!prev.cleared || this.run.time < prev.time) : (!prev.cleared && this.run.stage > prev.stage));
        if (better) st.daily[this.run.daily] = { stage: this.run.stage, cleared, time: Math.round(this.run.time), character: this.run.character.id };
      }
      BR.SaveSystem.save(this.saveData);
      this.state = 'result';
      this.stateTimer = 0;
      this.input.releaseMouse();
      this.music.play('menu');
      if (cleared) this.audio.play('clear');
      this.ui.result.show(cleared);
    }

    abandonRun() {
      BR.SaveSystem.clearRun();
      this.paused = false;
      this.goToMenu();
    }

    goToMenu(sub) {
      this.state = 'menu';
      this.tutorial = null;
      this.killCam = null;
      this.music.play('menu');
      this.paused = false;
      this.boss = null;
      this.player = null;
      this.run = null;
      this.projectiles.length = 0;
      this.hazards.length = 0;
      this.effects.length = 0;
      this.banner = null;
      this.theme = 'abyss';
      if (sub === 'shop') this.ui.menu.showShop();
      else this.ui.menu.showMain();
    }

    /* ---------------- records / achievements ---------------- */
    recordStat(key, amount) {
      if (this.run && this.run.mode !== 'run') return;
      const st = this.saveData.stats;
      st[key] = (st[key] || 0) + amount;
      if (key === 'parries') this.checkAchievements();
    }

    recordSpecial(key) {
      if (this.run && this.run.mode !== 'run') return;
      const sp = this.saveData.stats.special;
      sp[key] = (sp[key] || 0) + 1;
      this.checkAchievements();
    }

    checkAchievements() {
      const st = this.saveData.stats;
      const done = this.saveData.achievements;
      let changed = false;
      for (const a of BR.ACHIEVEMENTS) {
        if (done[a.id]) continue;
        const [cur, target] = a.progress(st);
        if (cur >= target) {
          done[a.id] = Date.now();
          changed = true;
          this.toasts.push({ title: a.name, desc: a.desc, icon: a.icon, time: 0, duration: 3.2 });
          this.audio.play('clear');
        }
      }
      if (changed) BR.SaveSystem.save(this.saveData);
    }

    /* ---------------- feedback helpers ---------------- */
    showBanner(title, sub, color, duration) {
      this.banner = { title, sub, color, duration, time: 0 };
    }

    spawnText(x, y, text, opts) {
      this.effects.push(new BR.FloatingText(x, y, text, opts));
    }

    spawnDamageNumber(x, y, amount, color, size) {
      if (!this.saveData.settings.damageNumbers) return;
      this.effects.push(new BR.FloatingText(x, y, amount, { color, size: Math.round(size * (this.saveData.settings.dmgSize || 1)) }));
    }

    /* ---------------- rendering ---------------- */
    render(dt) {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#07060b';
      ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);

      ctx.save();
      ctx.translate(this.camera.offsetX, this.camera.offsetY);
      // Kill cam: zoom toward the boss on the final blow, then ease back
      let kz = 0;
      if (this.killCam) {
        const t = this.killCam.t;
        kz = Geo.easeOut(Math.min(1, t / 0.35)) * (1 - Geo.clamp((t - 1.4) / 0.8, 0, 1));
        const z = 1 + 0.22 * kz;
        const fx = Geo.lerp(C.WIDTH / 2, this.killCam.x, kz * 0.85);
        const fy = Geo.lerp(C.HEIGHT / 2, this.killCam.y, kz * 0.85);
        ctx.translate(C.WIDTH / 2, C.HEIGHT / 2);
        ctx.scale(z, z);
        ctx.translate(-fx, -fy);
      }
      this.renderer.drawArena(ctx, this.theme, this.time);

      for (const h of this.hazards) h.draw(ctx, this.time);

      const boss = this.boss, player = this.player;
      if (boss && player && boss.y > player.y) {
        player.draw(ctx, this.time);
        boss.draw(ctx, this.time);
      } else {
        if (boss) boss.draw(ctx, this.time);
        if (player) player.draw(ctx, this.time);
      }
      for (const p of this.projectiles) p.draw(ctx, this.time);
      this.particles.draw(ctx);
      for (const e of this.effects) e.draw(ctx, this.time);
      ctx.restore();

      this._drawScreenEffects(ctx);
      if (kz > 0) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, C.WIDTH, 56 * kz);
        ctx.fillRect(0, C.HEIGHT - 56 * kz, C.WIDTH, 56 * kz);
      }
      if (this.player && this.run && this.state !== 'menu') this.hud.draw(ctx, dt);
      if (this.tutorial && this.state === 'fight') this._drawTutorial(ctx);
      if (this.state === 'intro') this._drawIntro(ctx);
      if (this.banner && this.state !== 'intro') this._drawBanner(ctx);
      if (this.state === 'menu') {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);
      }
      if (this.toasts.length) this._drawToast(ctx, this.toasts[0]);
    }

    _drawToast(ctx, t) {
      const inT = Geo.clamp(t.time / 0.25, 0, 1);
      const outT = Geo.clamp((t.duration - t.time) / 0.3, 0, 1);
      const slide = (1 - Geo.easeOut(Math.min(inT, outT))) * 360;
      const w = 330, h = 62, x = C.WIDTH - w - 24 + slide, y = 86;
      ctx.save();
      ctx.fillStyle = 'rgba(16,10,26,0.94)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(x, y, 4, h);
      ctx.strokeStyle = 'rgba(255,215,106,0.5)';
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      Draw.text(ctx, t.icon, x + 34, y + h / 2, { size: 26, color: '#ffd76a' });
      Draw.text(ctx, t.label || 'ACHIEVEMENT UNLOCKED', x + 64, y + 17, { size: 10, align: 'left', color: '#ffd76a', spacing: 2, weight: '800' });
      Draw.text(ctx, t.title, x + 64, y + 35, { size: 16, align: 'left', color: '#fff', font: 'Georgia', weight: '700' });
      Draw.text(ctx, t.desc, x + 64, y + 52, { size: 11, align: 'left', color: '#b8b0cc' });
      ctx.restore();
    }

    _drawScreenEffects(ctx) {
      if (this.hurtVignette > 0) {
        const g = ctx.createRadialGradient(C.WIDTH / 2, C.HEIGHT / 2, 260, C.WIDTH / 2, C.HEIGHT / 2, 760);
        g.addColorStop(0, 'rgba(255,0,30,0)');
        g.addColorStop(1, `rgba(255,0,30,${(BR.ACCESS.reducedFlashes ? 0.18 : 0.38) * this.hurtVignette})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);
      }
      if (this.player && !this.player.dead && this.player.hp / this.player.stats.maxHp < 0.25 && this.state === 'fight') {
        const pulse = 0.12 + 0.08 * Math.sin(this.time * 6);
        const g = ctx.createRadialGradient(C.WIDTH / 2, C.HEIGHT / 2, 300, C.WIDTH / 2, C.HEIGHT / 2, 780);
        g.addColorStop(0, 'rgba(120,0,20,0)');
        g.addColorStop(1, `rgba(120,0,20,${pulse})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);
      }
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(${this.flashColor},${this.flash * (BR.ACCESS.reducedFlashes ? 0.12 : 0.45)})`;
        ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);
      }
      if (this.slowmoTimer > 0 && this.state === 'victory') {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);
      }
    }

    _drawIntro(ctx) {
      const t = this.stateTimer;
      const total = R.introTime;
      const fadeIn = Geo.clamp(t / 0.35, 0, 1);
      const fadeOut = Geo.clamp((total - t) / 0.45, 0, 1);
      const a = Math.min(fadeIn, fadeOut);
      const boss = this.boss;
      if (!boss) return;
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${0.55 * a})`;
      ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);
      // Letterbox bars
      const bar = 70 * a;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, C.WIDTH, bar);
      ctx.fillRect(0, C.HEIGHT - bar, C.WIDTH, bar);

      ctx.globalAlpha = a;
      const slide = (1 - Geo.easeOut(Geo.clamp(t / 0.6, 0, 1))) * 60;
      const cy = C.HEIGHT / 2;
      Draw.text(ctx, this.run.mode === 'run' ? `BOSS ${this.run.bossNumber} / ${this.run.totalBosses}` : this.run.mode.toUpperCase(), C.WIDTH / 2, cy - 66, { size: 16, color: '#ff7088', spacing: 8, weight: '700' });
      Draw.text(ctx, boss.name, C.WIDTH / 2 + slide, cy - 14, { size: 64, font: 'Georgia', weight: '700', color: '#fff', spacing: 10, stroke: 'rgba(0,0,0,0.8)', strokeWidth: 8 });
      ctx.fillStyle = boss.def.color;
      const lw = 420 * Geo.easeOut(Geo.clamp(t / 0.8, 0, 1));
      ctx.fillRect(C.WIDTH / 2 - lw / 2, cy + 26, lw, 2);
      Draw.text(ctx, boss.def.title, C.WIDTH / 2 - slide, cy + 52, { size: 20, font: 'Georgia', color: '#d8cfe8', spacing: 4, weight: '400' });
      const stars = '★'.repeat(boss.def.difficulty) + '☆'.repeat(5 - boss.def.difficulty);
      Draw.text(ctx, stars, C.WIDTH / 2, cy + 88, { size: 18, color: '#ffcf4a', spacing: 4 });
      if (boss.elite) Draw.text(ctx, 'ELITE · 체력 +30% · 더 빠름 · SOUL ×1.5', C.WIDTH / 2, cy - 92, { size: 13, color: '#ffd76a', weight: '800' });
      if (boss.def.quote) {
        ctx.globalAlpha = a * Geo.clamp((t - 0.5) / 0.4, 0, 1);
        Draw.text(ctx, `“${boss.def.quote}”`, C.WIDTH / 2, cy + 124, { size: 16, font: 'Georgia', color: '#bfb6d6', weight: '400' });
      }
      ctx.restore();
    }

    _drawBanner(ctx) {
      const b = this.banner;
      const inT = Geo.clamp(b.time / 0.2, 0, 1);
      const outT = Geo.clamp((b.duration - b.time) / 0.4, 0, 1);
      const a = Math.min(inT, outT);
      const scale = 1 + (1 - Geo.easeOut(inT)) * 0.4;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(C.WIDTH / 2, 190);
      ctx.scale(scale, scale);
      const grad = ctx.createLinearGradient(-400, 0, 400, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.6)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(-400, -42, 800, b.sub ? 92 : 70);
      Draw.text(ctx, b.title, 0, -6, { size: 44, font: 'Georgia', weight: '700', color: b.color, spacing: 8, stroke: 'rgba(0,0,0,0.85)', strokeWidth: 6 });
      if (b.sub) Draw.text(ctx, b.sub, 0, 34, { size: 17, color: '#f2ecff', spacing: 4, weight: '700', stroke: 'rgba(0,0,0,0.8)', strokeWidth: 4 });
      ctx.restore();
    }
  }

  BR.Game = Game;
})();
