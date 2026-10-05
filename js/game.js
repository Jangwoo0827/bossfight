/*
 * Game: owns the loop, world lists and the flow
 * menu -> intro -> fight -> victory -> reward -> (select) -> intro ... -> result
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;
  const C = BR.CONFIG;
  const R = C.RUN;

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.input = new BR.Input(canvas);
      this.camera = new BR.Camera();
      this.particles = new BR.ParticleSystem(C.PARTICLE_LIMIT);
      this.audio = new BR.AudioManager();
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
      };

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
      this.lastTime = performance.now();
      requestAnimationFrame(this._loop);
    }

    applySettings() {
      const s = this.saveData.settings;
      this.audio.setVolume(s.volume);
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
      if (this.toasts.length) {
        this.toasts[0].time += realDt;
        if (this.toasts[0].time >= this.toasts[0].duration) this.toasts.shift();
      }
      this.updateState(realDt);
    }

    updateWorld(dt) {
      const controlled = this.state === 'intro' || this.state === 'fight' || this.state === 'victory';
      if (this.player) this.player.update(dt, this.input, controlled);
      if (this.boss) this.boss.update(dt);
      for (const p of this.projectiles) p.update(dt, this);
      for (const h of this.hazards) h.update(dt, this);
      this.combat.update(dt);
      for (const e of this.effects) e.update(dt, this);
      Geo.compact(this.projectiles);
      Geo.compact(this.hazards);
      Geo.compact(this.effects);
      this.particles.update(dt);
      if (this.run && this.state === 'fight') {
        this.run.time += dt;
        this.saveData.stats.playTime += dt;
      }
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
            if (this.run.isComplete) this.showResult(true);
            else this.showReward();
          }
          break;
        case 'dying':
          if (this.stateTimer >= R.deathDelay) this.showResult(false);
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

    startRun(characterId, difficultyId) {
      BR.UIRoot.clear();
      this.paused = false;
      const settings = this.saveData.settings;
      const character = BR.CHARACTER_BY_ID[characterId || settings.lastCharacter] || BR.CHARACTERS[0];
      const difficulty = BR.DIFFICULTY_BY_ID[difficultyId || settings.lastDifficulty] || BR.DIFFICULTY_BY_ID.normal;
      settings.lastCharacter = character.id;
      settings.lastDifficulty = difficulty.id;
      this.run = new BR.RunSystem(difficulty, character, this.saveData.meta);
      const stats = BR.UpgradeSystem.createBaseStats(this.saveData.meta, character);
      this.player = new BR.Player(this, stats, character);
      // Head Start: random upgrades before the first boss
      const head = BR.UpgradeSystem.metaValue(this.saveData.meta, 'headstart');
      for (const up of BR.RewardSystem.roll(head, this.run.upgrades)) {
        this.run.addUpgrade(up);
        BR.UpgradeSystem.apply(this.player.stats, up, this.player);
      }
      this.saveData.stats.runs++;
      BR.SaveSystem.save(this.saveData);
      this.beginBoss(this.run.firstBossId());
    }

    beginBoss(id) {
      BR.UIRoot.clear();
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
      this.boss = BR.BossSystem.create(id, this, this.run);
      this.run.bossDamageTaken = 0;
      this.run.bossStartTime = this.run.time;
      this.state = 'intro';
      this.stateTimer = 0;
      this.audio.play('bossIntro');
    }

    onBossPhase(boss, phase) {
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
      this.particles.emit('death', boss.x, boss.y, 90, { radius: boss.radius * 0.6 });
      this.particles.emit('explosion', boss.x, boss.y, 40, { radius: boss.radius });
      this.effects.push(new BR.RingFx({ x: boss.x, y: boss.y, r0: boss.radius, r1: 420, color: '255,240,200', width: 16, life: 0.9 }));
      for (const h of this.hazards) h.dead = true;
      for (const p of this.projectiles) if (p.owner === 'boss') p.dead = true;
      this.audio.play('bossDeath');

      const soul = this.run.recordBossDefeat(boss.id);
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
      this.showBanner('BOSS DEFEATED', `+${soul} SOUL`, '#ffd76a', R.victoryDelay);
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
      const choices = BR.RewardSystem.roll(3, this.run.upgrades);
      this.ui.reward.show(choices, this.lastSoulGain || 0, this.boss ? this.boss.name : '');
    }

    onRewardChosen(upgrade) {
      this.run.addUpgrade(upgrade);
      BR.UpgradeSystem.apply(this.player.stats, upgrade, this.player);
      // Recover between bosses
      const s = this.player.stats;
      this.player.heal(s.maxHp * R.healBetweenBossesRatio + s.healAfterBoss);
      const options = this.run.nextBossOptions();
      if (options.length > 1) {
        this.state = 'select';
        this.ui.bossSelect.show(options);
      } else {
        this.beginBoss(options[0]);
      }
    }

    showResult(cleared) {
      const st = this.saveData.stats;
      st.totalDamage += this.run.damageDealt;
      st.damageTaken += this.run.damageTaken;
      BR.SaveSystem.save(this.saveData);
      this.state = 'result';
      this.stateTimer = 0;
      this.input.releaseMouse();
      if (cleared) this.audio.play('clear');
      this.ui.result.show(cleared);
    }

    abandonRun() {
      this.paused = false;
      this.goToMenu();
    }

    goToMenu(sub) {
      this.state = 'menu';
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
      const st = this.saveData.stats;
      st[key] = (st[key] || 0) + amount;
      if (key === 'parries') this.checkAchievements();
    }

    recordSpecial(key) {
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
      this.effects.push(new BR.FloatingText(x, y, amount, { color, size }));
    }

    /* ---------------- rendering ---------------- */
    render(dt) {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#07060b';
      ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);

      ctx.save();
      ctx.translate(this.camera.offsetX, this.camera.offsetY);
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
      if (this.player && this.run && this.state !== 'menu') this.hud.draw(ctx, dt);
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
      Draw.text(ctx, 'ACHIEVEMENT UNLOCKED', x + 64, y + 17, { size: 10, align: 'left', color: '#ffd76a', spacing: 2, weight: '800' });
      Draw.text(ctx, t.title, x + 64, y + 35, { size: 16, align: 'left', color: '#fff', font: 'Georgia', weight: '700' });
      Draw.text(ctx, t.desc, x + 64, y + 52, { size: 11, align: 'left', color: '#b8b0cc' });
      ctx.restore();
    }

    _drawScreenEffects(ctx) {
      if (this.hurtVignette > 0) {
        const g = ctx.createRadialGradient(C.WIDTH / 2, C.HEIGHT / 2, 260, C.WIDTH / 2, C.HEIGHT / 2, 760);
        g.addColorStop(0, 'rgba(255,0,30,0)');
        g.addColorStop(1, `rgba(255,0,30,${0.38 * this.hurtVignette})`);
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
        ctx.fillStyle = `rgba(${this.flashColor},${this.flash * 0.45})`;
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
      Draw.text(ctx, `BOSS ${this.run.bossNumber} / ${this.run.totalBosses}`, C.WIDTH / 2, cy - 66, { size: 16, color: '#ff7088', spacing: 8, weight: '700' });
      Draw.text(ctx, boss.name, C.WIDTH / 2 + slide, cy - 14, { size: 64, font: 'Georgia', weight: '700', color: '#fff', spacing: 10, stroke: 'rgba(0,0,0,0.8)', strokeWidth: 8 });
      ctx.fillStyle = boss.def.color;
      const lw = 420 * Geo.easeOut(Geo.clamp(t / 0.8, 0, 1));
      ctx.fillRect(C.WIDTH / 2 - lw / 2, cy + 26, lw, 2);
      Draw.text(ctx, boss.def.title, C.WIDTH / 2 - slide, cy + 52, { size: 20, font: 'Georgia', color: '#d8cfe8', spacing: 4, weight: '400' });
      const stars = '★'.repeat(boss.def.difficulty) + '☆'.repeat(5 - boss.def.difficulty);
      Draw.text(ctx, stars, C.WIDTH / 2, cy + 88, { size: 18, color: '#ffcf4a', spacing: 4 });
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
