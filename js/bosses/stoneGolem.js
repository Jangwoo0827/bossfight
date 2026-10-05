/*
 * BOSS 3 — STONE GOLEM
 * Slow, huge, heavy hits with long recoveries.
 * Lesson: patience + dash timing. Shockwave rings must be dashed THROUGH (i-frames).
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;

  class StoneGolem extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 55;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [1, 0.88];
      this.recoveryByPhase = [0.9, 0.65];
      this.arms = [{ raise: 0, extend: 0 }, { raise: 0, extend: 0 }];
      this.nextArm = 0;
      this.walkCycle = 0;
      this.idleTimer = 1.4;
      // jagged outline generated once
      this.outline = [];
      for (let i = 0; i < 14; i++) this.outline.push(0.86 + Math.random() * 0.2);

      this.attacks = [
        { name: 'punch', weight: 3, cooldown: 0.8, maxRange: 240, fn: this.atkPunch },
        { name: 'slam', weight: 2, cooldown: 4, maxRange: 260, fn: this.atkSlam },
        { name: 'shockwave', weight: 1.5, cooldown: 6, fn: this.atkShockwave },
        { name: 'rockThrow', weight: 2, cooldown: 3, minRange: 250, fn: this.atkRockThrow },
        { name: 'fallingRocks', weight: 1.2, cooldown: 8, fn: this.atkFallingRocks },
      ];
    }

    get empowered() { return this.phase >= 2; }
    get reach() { return this.empowered ? 1.25 : 1; }

    onPhaseChange() {
      this.speed = 68;
    }

    idleMove(dt) {
      const a = this.angleToPlayer();
      this.facing = Geo.rotateToward(this.facing, a, 2.2 * dt);
      const sp = this.distToPlayer() > 140 ? this.speed : 0;
      this.vx = Math.cos(this.facing) * sp;
      this.vy = Math.sin(this.facing) * sp;
      if (sp > 0) {
        const prev = this.walkCycle;
        this.walkCycle += dt * 2.4;
        if (Math.floor(prev) !== Math.floor(this.walkCycle)) {
          this.game.camera.shake(1.5, 0.08);
          this.game.particles.emit('dust', this.x, this.y + this.radius * 0.7, 4);
        }
      }
    }

    updateExtra(dt) {
      for (const arm of this.arms) {
        arm.raise = Math.max(0, arm.raise - dt * 1.5);
        arm.extend = Math.max(0, arm.extend - dt * 3);
      }
      if (this.empowered && Math.random() < dt * 10) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const a = this.facing + side * Math.PI / 2;
        this.game.particles.emit('fire', this.x + Math.cos(a) * this.radius, this.y + Math.sin(a) * this.radius, 1, { color: '255,70,40' });
      }
    }

    impact(x, y, radius, shake = 'medium') {
      this.game.camera.shakePreset(shake);
      this.game.particles.emit('dust', x, y, Math.round(radius / 6), { radius: radius * 0.6, speedMult: 1.4 });
      this.game.particles.emit('rock', x, y, Math.round(radius / 14), { radius: radius * 0.3 });
      this.game.effects.push(new BR.RingFx({ x, y, r0: radius * 0.3, r1: radius, color: '210,190,160', width: 10, life: 0.4 }));
      this.game.audio.play('explosion');
    }

    /* ---- attacks ---- */
    *atkPunch() {
      const punches = this.empowered ? 2 : 1;
      for (let i = 0; i < punches; i++) {
        const target = this.angleToPlayer();
        const a = i === 0 ? target : Geo.rotateToward(this.facing, target, 0.8);
        this.facing = a;
        const arm = this.arms[this.nextArm];
        this.nextArm = 1 - this.nextArm;
        const warn = i === 0 ? this.T(0.8) : 0.6;
        const radius = 185 * this.reach;
        arm.raise = 1.5;
        this.chargeUp(warn, this.empowered ? '#ff4020' : '#ffd080');
        this.hazard({ shape: 'cone', x: this.x, y: this.y, angle: a, arc: 1.15, radius, warn, damage: 24 });
        yield warn;
        arm.extend = 1;
        arm.raise = 0;
        this.impact(this.x + Math.cos(a) * radius * 0.75, this.y + Math.sin(a) * radius * 0.75, 70, 'medium');
        yield 0.3;
      }
      yield this.T(0.6);
    }

    *atkSlam() {
      const warn = this.T(1.15);
      const radius = 215 * this.reach;
      this.arms[0].raise = this.arms[1].raise = 2;
      this.chargeUp(warn, this.empowered ? '#ff3010' : '#ffcc66');
      this.tremble = warn;
      this.hazard({ shape: 'circle', x: this.x, y: this.y, radius, warn, damage: 30 });
      yield warn;
      this.arms[0].extend = this.arms[1].extend = 1;
      this.impact(this.x, this.y, radius, 'big');
      // Long recovery: fists stuck in the ground. Best damage window in the fight.
      this.statusText = 'STUCK';
      yield this.empowered ? 1.0 : 1.35;
      this.statusText = '';
    }

    *atkShockwave() {
      const waves = this.empowered ? 2 : 1;
      const warn = this.T(0.95);
      this.arms[0].raise = this.arms[1].raise = 2;
      this.chargeUp(warn, '#ffe0a0');
      this.tremble = warn;
      this.statusText = 'DASH THROUGH!';
      this.hazard({ shape: 'circle', x: this.x, y: this.y, radius: this.radius + 30, warn, damage: 0, color: '255,200,120' });
      yield warn;
      this.statusText = '';
      for (let i = 0; i < waves; i++) {
        this.arms[0].extend = this.arms[1].extend = 1;
        this.impact(this.x, this.y, this.radius * 1.6, 'medium');
        this.hazard({
          shape: 'ring', x: this.x, y: this.y, radius: this.radius, width: 30, growSpeed: 300, maxRadius: 1300,
          warn: 0, noMinWarn: true, damage: 20, linger: 0.2, style: 'rock',
        });
        if (i < waves - 1) {
          yield 0.6;
          this.arms[0].raise = this.arms[1].raise = 1;
        }
      }
      yield 0.9;
    }

    *atkRockThrow() {
      const rocks = this.empowered ? 3 : 1;
      for (let i = 0; i < rocks; i++) {
        const p = this.player;
        const lead = i === 0 ? 0 : 0.5;
        const t = BR.Geo.clampToArena(p.x + p.vx * lead, p.y + p.vy * lead, 30);
        const warn = this.T(1.0);
        const arm = this.arms[this.nextArm];
        this.nextArm = 1 - this.nextArm;
        arm.raise = 1.2;
        this.facing = this.angleToPlayer();
        this.hazard({
          shape: 'circle', x: t.x, y: t.y, radius: 74, warn, damage: 20, style: 'rock',
          onActivate: (h) => this.impact(h.x, h.y, 80, 'small'),
        });
        this.game.effects.push(new BR.ArcFx({ sx: this.x, sy: this.y - 20, tx: t.x, ty: t.y, duration: warn, height: 230, kind: 'rock', size: 18 }));
        yield 0.38;
      }
      yield 0.7;
    }

    *atkFallingRocks() {
      const count = this.empowered ? 12 : 8;
      this.arms[0].raise = this.arms[1].raise = 1.5;
      this.chargeUp(0.5, '#ffd080');
      yield 0.5;
      this.impact(this.x, this.y, 90, 'medium');
      this.statusText = 'RUMBLE';
      const spots = [{ x: this.player.x, y: this.player.y }];
      for (let i = 0; i < count - 1; i++) spots.push(this.randomArenaPoint(70));
      spots.forEach((s, i) => {
        const warn = 1.15 + i * 0.09;
        this.hazard({
          shape: 'circle', x: s.x, y: s.y, radius: 60, warn, damage: 18, style: 'rock',
          onActivate: (h) => this.impact(h.x, h.y, 60, 'small'),
        });
        this.game.effects.push(new BR.ArcFx({ sx: s.x + 30, sy: s.y - 620, tx: s.x, ty: s.y, duration: warn, kind: 'rock', size: 16 }));
      });
      yield 1.0;
      this.statusText = '';
    }

    /* ---- drawing ---- */
    drawBody(ctx, time) {
      const r = this.radius;
      const glowArms = this.empowered;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.facing);

      // Arms
      const sides = [-1, 1];
      sides.forEach((side, i) => {
        const arm = this.arms[i];
        const ax = r * 0.15 + arm.extend * r * 0.9 - arm.raise * r * 0.1;
        const ay = side * r * (0.95 + arm.raise * 0.08);
        const ar = r * 0.42 * (1 + arm.raise * 0.1);
        if (glowArms) Draw.glow(ctx, ax, ay, ar * 2.4, '255,60,30', 0.55 + 0.2 * Math.sin(time * 6));
        Draw.circle(ctx, ax, ay, ar, glowArms ? '#7a3a2a' : '#6f6858', '#25221c', 3);
        ctx.strokeStyle = glowArms ? 'rgba(255,120,60,0.9)' : 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax - ar * 0.5, ay - ar * 0.2);
        ctx.lineTo(ax + ar * 0.1, ay + ar * 0.3);
        ctx.lineTo(ax + ar * 0.5, ay - ar * 0.1);
        ctx.stroke();
      });

      // Body
      const body = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 4, 0, 0, r);
      body.addColorStop(0, '#9a927e');
      body.addColorStop(1, '#4a463c');
      ctx.fillStyle = body;
      ctx.beginPath();
      this.outline.forEach((k, i) => {
        const a = (i / this.outline.length) * Math.PI * 2;
        const x = Math.cos(a) * r * k, y = Math.sin(a) * r * k;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#25221c';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Moss / cracks
      ctx.strokeStyle = glowArms ? 'rgba(255,90,40,0.8)' : 'rgba(30,25,20,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(-r * 0.1, r * 0.1); ctx.lineTo(-r * 0.3, r * 0.5);
      ctx.moveTo(r * 0.1, -r * 0.6); ctx.lineTo(-r * 0.05, -r * 0.3);
      ctx.stroke();
      ctx.fillStyle = 'rgba(110,140,70,0.55)';
      ctx.beginPath();
      ctx.arc(-r * 0.45, -r * 0.45, r * 0.22, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      const eye = glowArms ? '255,60,40' : '255,210,90';
      Draw.glow(ctx, r * 0.55, -r * 0.22, 14, eye, 0.9);
      Draw.glow(ctx, r * 0.55, r * 0.22, 14, eye, 0.9);
      Draw.circle(ctx, r * 0.55, -r * 0.22, 4, `rgb(${eye})`);
      Draw.circle(ctx, r * 0.55, r * 0.22, 4, `rgb(${eye})`);
      ctx.restore();
    }
  }

  BR.BossClasses.stoneGolem = StoneGolem;
})();
