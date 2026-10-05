/*
 * Boss base class.
 *
 * State machine: IDLE -> ATTACK (coroutine) -> RECOVERY -> IDLE ... ; ENRAGED during
 * phase transitions; DEAD at the end.
 *
 * Attacks are data: { name, weight, cooldown, minRange, maxRange, phase, maxPhase, fn }
 * `fn` is a generator method. It yields a number of seconds to wait (0 = next frame),
 * which keeps every telegraph -> strike -> recovery sequence readable and linear.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;
  const C = BR.CONFIG;

  class Boss {
    constructor(game, def, options = {}) {
      this.game = game;
      this.def = def;
      this.id = def.id;
      this.name = def.name;
      this.maxHp = Math.round(def.hp * (options.hpMult || 1));
      this.hp = this.maxHp;
      this.displayHp = this.hp;
      this.damageMult = options.damageMult || 1;
      this.radius = def.radius || 30;
      const A = C.ARENA;
      this.x = (A.left + A.right) / 2;
      this.y = A.top + 170;
      this.vx = 0;
      this.vy = 0;
      this.baseSpeed = 100;
      this.speed = 100;
      this.facing = Math.PI / 2;

      this.phase = 1;
      this.phaseThresholds = def.phaseThresholds || [0.5];
      this.tempoByPhase = [1, 0.82, 0.72];
      this.recoveryByPhase = [0.6, 0.45, 0.35];
      this.tempo = 1;

      this.state = 'IDLE';
      this.attacks = [];
      this.routine = null;
      this.wait = 0;
      this.currentAttack = null;
      this.lastAttack = null;
      this.cooldowns = {};
      this.idleTimer = 1.0;

      this.active = false;          // becomes true when the intro ends
      this.dead = false;
      this.deathTime = 0;
      this.invulnerable = false;
      this.alpha = 1;
      this.flash = 0;
      this.tremble = 0;
      this.contactDamage = 0;
      this.hitWall = false;
      this.charge = null;            // telegraph glow {time, duration, color}
      this.time = 0;
      this.dt = 0;
      this.statusText = '';
      this.extraTargets = [];        // attackable objects: {x, y, radius, hp, maxHp, dead, onDestroy}
      this.airborne = false;         // leaping: no body contact, not hittable
    }

    /* ---------------- queries ---------------- */
    get player() { return this.game.player; }
    get hpRatio() { return this.hp / this.maxHp; }
    angleToPlayer() { return Geo.angle(this.x, this.y, this.player.x, this.player.y); }
    distToPlayer() { return Geo.dist(this.x, this.y, this.player.x, this.player.y); }
    isHittable() { return this.active && !this.dead && !this.invulnerable && !this.airborne && this.alpha > 0.35; }
    T(seconds) { return seconds * this.tempo; }
    recoveryTime() { return this.recoveryByPhase[this.phase - 1] ?? 0.4; }

    /* ---------------- main update ---------------- */
    update(dt) {
      this.dt = dt;
      this.time += dt;
      this.flash = Math.max(0, this.flash - dt * 6);
      this.tremble = Math.max(0, this.tremble - dt);
      this.displayHp += (this.hp - this.displayHp) * Math.min(1, dt * 3);
      if (this.charge) {
        this.charge.time += dt;
        if (this.charge.time >= this.charge.duration) this.charge = null;
      }
      if (this.dead) {
        this.deathTime += dt;
        return;
      }
      if (!this.active) {
        this.updateExtra(dt);
        return;
      }

      this.checkPhase();
      if (this.routine) {
        this.stepRoutine(dt);
      } else {
        this.idleTimer -= dt;
        this.state = this.idleTimer > 0 && this.lastAttack ? 'RECOVERY' : 'IDLE';
        this.idleMove(dt);
        if (this.idleTimer <= 0) this.chooseAttack();
      }
      this.integrate(dt);
      this.updateExtra(dt);
    }

    integrate(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const A = C.ARENA, r = this.radius;
      this.hitWall = false;
      if (this.x < A.left + r) { this.x = A.left + r; this.hitWall = true; }
      if (this.x > A.right - r) { this.x = A.right - r; this.hitWall = true; }
      if (this.y < A.top + r) { this.y = A.top + r; this.hitWall = true; }
      if (this.y > A.bottom - r) { this.y = A.bottom - r; this.hitWall = true; }
    }

    stepRoutine(dt) {
      this.wait -= dt;
      let guard = 0;
      while (this.routine && this.wait <= 0 && guard++ < 24) {
        const result = this.routine.next();
        if (result.done) {
          this.endRoutine();
          break;
        }
        const v = Number(result.value) || 0;
        if (v <= 0) { this.wait = 0; break; }
        this.wait += v;
      }
    }

    endRoutine() {
      this.routine = null;
      this.currentAttack = null;
      this.contactDamage = 0;
      this.invulnerable = false;
      this.alpha = 1;
      this.stop();
      this.idleTimer = this.recoveryTime();
      this.state = 'RECOVERY';
    }

    chooseAttack() {
      const d = this.distToPlayer();
      const candidates = [];
      let total = 0;
      for (const atk of this.attacks) {
        if ((atk.phase || 1) > this.phase) continue;
        if (atk.maxPhase && this.phase > atk.maxPhase) continue;
        if ((this.cooldowns[atk.name] || 0) > this.time) continue;
        if (d < (atk.minRange || 0) || d > (atk.maxRange ?? Infinity)) continue;
        let w = typeof atk.weight === 'function' ? atk.weight(this, d) : atk.weight;
        if (atk.name === this.lastAttack) w *= 0.3;
        if (w <= 0) continue;
        candidates.push([atk, w]);
        total += w;
      }
      if (!candidates.length) { this.idleTimer = 0.12; return; }
      let roll = Math.random() * total;
      for (const [atk, w] of candidates) {
        roll -= w;
        if (roll <= 0) return this.startAttack(atk);
      }
      this.startAttack(candidates[candidates.length - 1][0]);
    }

    startAttack(atk) {
      this.cooldowns[atk.name] = this.time + (atk.cooldown || 0);
      this.lastAttack = atk.name;
      this.currentAttack = atk;
      this.state = 'ATTACK';
      this.stop();
      this.routine = atk.fn.call(this);
      this.wait = 0;
      this.stepRoutine(0);
    }

    checkPhase() {
      const idx = this.phase - 1;
      if (idx >= this.phaseThresholds.length || this.hpRatio > this.phaseThresholds[idx]) return;
      this.phase++;
      this.tempo = this.tempoByPhase[this.phase - 1] ?? this.tempo;
      this.routine = null;
      this.contactDamage = 0;
      this.alpha = 1;
      this.stop();
      this.onPhaseChange(this.phase);
      this.game.onBossPhase(this, this.phase);
      this.state = 'ENRAGED';
      this.routine = this.phaseTransition(this.phase);
      this.wait = 0;
      this.stepRoutine(0);
    }

    *phaseTransition() {
      this.invulnerable = true;
      this.chargeUp(1.3, '#ff3344');
      this.tremble = 1.3;
      yield 0.6;
      this.game.camera.shakePreset('big');
      this.game.combat.knockPlayer(this.x, this.y, 520, 260);
      this.game.effects.push(new BR.RingFx({ x: this.x, y: this.y, r0: this.radius, r1: 300, color: '255,80,100', width: 12, life: 0.6 }));
      this.game.particles.emitRing('spark', this.x, this.y, this.radius, 30, { speedMult: 1.4 });
      yield 0.8;
      this.invulnerable = false;
    }

    /* ---------------- hooks for subclasses ---------------- */
    idleMove() { this.stop(); }
    updateExtra() {}
    onPhaseChange() {}
    onDamaged() {}
    // Damage multiplier for a hit coming from (sx, sy). 0 = blocked.
    incomingMultiplier() { return 1; }
    onBlocked() {}
    drawBody(ctx) { Draw.circle(ctx, this.x, this.y, this.radius, '#844', '#fff', 2); }

    /* ---------------- helpers for attack coroutines ---------------- */
    stop() { this.vx = 0; this.vy = 0; }

    moveToward(x, y, speed) {
      const a = Geo.angle(this.x, this.y, x, y);
      this.vx = Math.cos(a) * speed;
      this.vy = Math.sin(a) * speed;
    }

    chargeUp(duration, color) {
      this.charge = { time: 0, duration, color };
    }

    hazard(opts) {
      const h = new BR.Hazard(opts);
      h.damage = Math.round(h.damage * this.damageMult);
      this.game.hazards.push(h);
      return h;
    }

    shoot(angle, speed, opts = {}) {
      const offset = opts.offset !== undefined ? opts.offset : this.radius * 0.8;
      const p = new BR.Projectile(Object.assign({
        owner: 'boss',
        x: this.x + Math.cos(angle) * offset,
        y: this.y + Math.sin(angle) * offset,
        angle,
        speed,
      }, opts));
      p.damage = Math.round(p.damage * this.damageMult);
      this.game.projectiles.push(p);
      return p;
    }

    // Move in a straight line; returns true if a wall stopped the dash
    *dash(angle, speed, maxDist) {
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      let travelled = 0;
      while (travelled < maxDist) {
        yield 0;
        travelled += speed * this.dt;
        if (this.hitWall) { this.stop(); return true; }
      }
      this.stop();
      return false;
    }

    *fade(target, duration) {
      const start = this.alpha;
      let t = 0;
      while (t < duration) {
        yield 0;
        t += this.dt;
        this.alpha = Geo.lerp(start, target, Math.min(1, t / duration));
      }
      this.alpha = target;
    }

    teleportTo(x, y, particle = 'magic') {
      this.game.particles.emit(particle, this.x, this.y, 18, { radius: this.radius });
      const c = Geo.clampToArena(x, y, this.radius + 4);
      this.x = c.x;
      this.y = c.y;
      this.game.particles.emit(particle, this.x, this.y, 18, { radius: this.radius });
      this.game.audio.play('teleport');
    }

    // A spot far enough from the player (used for teleports)
    pointAwayFromPlayer(minDist, margin = 90) {
      const A = C.ARENA;
      let best = null, bestScore = -Infinity;
      for (let i = 0; i < 14; i++) {
        const x = Geo.rand(A.left + margin, A.right - margin);
        const y = Geo.rand(A.top + margin, A.bottom - margin);
        const d = Geo.dist(x, y, this.player.x, this.player.y);
        const score = d >= minDist ? 1000 - Math.abs(d - minDist - 80) : d;
        if (score > bestScore) { bestScore = score; best = { x, y }; }
      }
      return best;
    }

    randomArenaPoint(margin = 60) {
      const A = C.ARENA;
      return { x: Geo.rand(A.left + margin, A.right - margin), y: Geo.rand(A.top + margin, A.bottom - margin) };
    }

    takeDamage(amount) {
      if (this.dead) return;
      this.hp = Math.max(0, this.hp - amount);
      this.flash = 1;
      this.onDamaged(amount);
    }

    heal(amount) {
      if (this.dead || amount <= 0) return;
      this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    die() {
      this.dead = true;
      this.state = 'DEAD';
      this.routine = null;
      this.contactDamage = 0;
      this.stop();
      this.deathTime = 0;
      this.extraTargets.length = 0;
    }

    /* ---------------- drawing ---------------- */
    draw(ctx, time) {
      let alpha = this.alpha;
      let scale = 1;
      if (this.dead) {
        const t = Math.min(1, this.deathTime / 1.4);
        alpha *= 1 - t;
        scale = 1 + t * 0.25;
        if (alpha <= 0.01) return;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      Draw.shadow(ctx, this.x, this.y + this.radius * 0.75, this.radius * 1.15, this.radius * 0.45, 0.45);

      if (this.charge) {
        const p = this.charge.time / this.charge.duration;
        const pulse = 0.6 + 0.4 * Math.sin(time * 30);
        const rgb = hexToRgb(this.charge.color);
        Draw.glow(ctx, this.x, this.y, this.radius * (2.0 + p * 0.8), rgb, 0.35 + p * 0.45 * pulse);
      }

      if (this.tremble > 0 || scale !== 1) {
        const tx = this.tremble > 0 ? (Math.random() - 0.5) * 4 : 0;
        const ty = this.tremble > 0 ? (Math.random() - 0.5) * 4 : 0;
        ctx.translate(this.x + tx, this.y + ty);
        ctx.scale(scale, scale);
        ctx.translate(-this.x, -this.y);
      }
      this.drawBody(ctx, time);

      if (this.flash > 0) {
        ctx.globalCompositeOperation = 'lighter';
        Draw.circle(ctx, this.x, this.y, this.radius * 1.05, `rgba(255,255,255,${this.flash * 0.55})`);
      }
      ctx.restore();

      if (this.statusText && !this.dead) {
        Draw.text(ctx, this.statusText, this.x, this.y - this.radius - 22, { size: 14, color: '#ffe37a', weight: '800', stroke: '#000', strokeWidth: 4, spacing: 2 });
      }
    }
  }

  const rgbCache = new Map();
  function hexToRgb(hex) {
    let v = rgbCache.get(hex);
    if (v) return v;
    const n = parseInt(hex.replace('#', ''), 16);
    v = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    rgbCache.set(hex, v);
    return v;
  }

  BR.hexToRgb = hexToRgb;
  BR.Boss = Boss;
  BR.BossClasses = {};
})();
