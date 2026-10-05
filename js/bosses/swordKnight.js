/*
 * BOSS 1 — SWORD KNIGHT
 * Teaching boss: every attack has a clear wind-up and a clear punish window.
 * Lesson: read the cone, step out, hit back. Charges end with a wall stun.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;

  class SwordKnight extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 105;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [1, 0.8];
      this.recoveryByPhase = [0.6, 0.38];
      this.swordAngle = Math.PI / 2;
      this.swordSide = 1;
      this.swing = null; // {from, to, t, dur}
      this.idleTimer = 1.1;

      this.attacks = [
        { name: 'slash', weight: 3, cooldown: 0.3, maxRange: 200, fn: this.atkSlash },
        { name: 'triple', weight: 2, cooldown: 3.4, maxRange: 280, fn: this.atkTriple },
        { name: 'charge', weight: 1.8, cooldown: 4.5, minRange: 230, fn: this.atkCharge },
        { name: 'wave', weight: 1.5, cooldown: 3.2, minRange: 170, fn: this.atkWave },
      ];
    }

    get enraged() { return this.phase >= 2; }

    onPhaseChange() {
      this.speed = 150;
    }

    idleMove() {
      const a = this.angleToPlayer();
      const d = this.distToPlayer();
      this.facing = Geo.rotateToward(this.facing, a, 6 * this.dt);
      const sp = d > 105 ? this.speed : 0;
      this.vx = Math.cos(this.facing) * sp;
      this.vy = Math.sin(this.facing) * sp;
    }

    updateExtra(dt) {
      if (this.swing) {
        this.swing.t += dt;
        const k = Math.min(1, this.swing.t / this.swing.dur);
        this.swordAngle = Geo.lerp(this.swing.from, this.swing.to, Geo.easeOut(k));
        if (k >= 1) this.swing = null;
      } else {
        const rest = this.facing + 0.9 * this.swordSide;
        this.swordAngle = Geo.rotateToward(this.swordAngle, rest, 8 * dt);
      }
      if (this.enraged && Math.random() < dt * 14) {
        this.game.particles.emit('fire', this.x + Geo.rand(-20, 20), this.y + Geo.rand(-10, 20), 1, { color: '255,60,60' });
      }
    }

    /* ---- animation helpers ---- */
    windup(angle, duration) {
      this.chargeUp(duration, this.enraged ? '#ff2040' : '#ff6070');
      this.swordSide *= -1;
      this.swing = { from: this.swordAngle, to: angle + 1.5 * this.swordSide, t: 0, dur: Math.min(0.25, duration * 0.6) };
      this.game.audio.play('telegraph');
    }

    strike(angle, radius, arc) {
      this.swing = { from: angle + (arc / 2) * this.swordSide, to: angle - (arc / 2) * this.swordSide, t: 0, dur: 0.12 };
      this.game.effects.push(new BR.SlashFx({
        x: this.x, y: this.y, angle, radius: radius * 0.85, arc, color: '255,120,130', width: 22, dir: -this.swordSide, life: 0.2,
      }));
      this.game.audio.play('swing');
      this.game.camera.shakePreset('small');
      const tipX = this.x + Math.cos(angle) * radius * 0.7, tipY = this.y + Math.sin(angle) * radius * 0.7;
      this.game.particles.emit('spark', tipX, tipY, 6, { angle, spread: 1.4 });
    }

    /* ---- attacks ---- */
    *atkSlash() {
      const a = this.angleToPlayer();
      this.facing = a;
      const warn = this.T(0.55);
      const radius = 150, arc = 1.9;
      this.windup(a, warn);
      this.hazard({ shape: 'cone', x: this.x, y: this.y, angle: a, arc, radius, warn, damage: 16 });
      yield warn;
      this.strike(a, radius, arc);
      yield this.T(0.5);
    }

    *atkTriple() {
      const count = this.enraged ? 4 : 3;
      const warn = this.enraged ? 0.36 : 0.46;
      const radius = 140, arc = 1.7;
      for (let i = 0; i < count; i++) {
        // Re-aim, but with a limited turn so a side-step still works
        const target = this.angleToPlayer();
        const a = i === 0 ? target : Geo.rotateToward(this.facing, target, 0.9);
        this.facing = a;
        if (i > 0) {
          const lunge = 60;
          this.vx = Math.cos(a) * lunge / 0.1;
          this.vy = Math.sin(a) * lunge / 0.1;
          yield 0.1;
          this.stop();
        }
        this.windup(a, warn);
        this.hazard({ shape: 'cone', x: this.x, y: this.y, angle: a, arc, radius, warn, damage: 13 });
        yield warn;
        this.strike(a, radius, arc);
        yield 0.14;
      }
      if (this.enraged) {
        // Spin finisher: get out of the circle
        const spinWarn = 0.65;
        this.chargeUp(spinWarn, '#ff1030');
        this.tremble = spinWarn;
        this.statusText = 'SPIN!';
        this.hazard({ shape: 'circle', x: this.x, y: this.y, radius: 175, warn: spinWarn, damage: 18 });
        yield spinWarn;
        this.statusText = '';
        this.swing = { from: this.swordAngle, to: this.swordAngle + Math.PI * 2 * this.swordSide, t: 0, dur: 0.25 };
        this.game.effects.push(new BR.RingFx({ x: this.x, y: this.y, r0: 40, r1: 180, color: '255,90,110', width: 18, life: 0.3 }));
        this.game.camera.shakePreset('medium');
        this.game.audio.play('swing');
        yield 0.7;
      } else {
        yield 0.55;
      }
    }

    *atkCharge() {
      const times = this.enraged ? 2 : 1;
      let hitWall = false;
      for (let i = 0; i < times; i++) {
        const a = this.angleToPlayer();
        this.facing = a;
        const len = Geo.rayToArena(this.x, this.y, a, this.radius);
        const warn = i === 0 ? this.T(0.85) : 0.6;
        this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a, length: len + this.radius, width: this.radius * 2 + 10, warn, damage: 0 });
        this.chargeUp(warn, '#ff3040');
        this.tremble = warn;
        this.swing = { from: this.swordAngle, to: a + Math.PI * 0.85, t: 0, dur: 0.2 };
        this.game.audio.play('telegraph');
        yield warn;

        this.contactDamage = 22;
        this.game.audio.play('dash');
        hitWall = yield* this.dash(a, 1000, len);
        this.contactDamage = 0;
        if (hitWall) {
          this.game.recordSpecial('wallstun');
          this.game.camera.shakePreset('medium');
          this.game.particles.emit('dust', this.x + Math.cos(a) * this.radius, this.y + Math.sin(a) * this.radius, 18, { angle: a + Math.PI, spread: 2 });
          this.game.particles.emit('rock', this.x + Math.cos(a) * this.radius, this.y + Math.sin(a) * this.radius, 8, { angle: a + Math.PI, spread: 1.6 });
          this.game.audio.play('explosion');
        }
        yield 0.12;
      }
      if (hitWall) {
        // Punish window
        this.statusText = 'STUNNED';
        const stun = this.enraged ? 0.85 : 1.25;
        for (let t = 0; t < stun; t += 0.25) {
          this.game.particles.emit('spark', this.x + Geo.rand(-14, 14), this.y - this.radius, 2, { angle: -Math.PI / 2, spread: 1 });
          yield 0.25;
        }
        this.statusText = '';
      } else {
        yield 0.5;
      }
    }

    *atkWave() {
      const a = this.angleToPlayer();
      this.facing = a;
      const angles = this.enraged ? [a - 0.3, a, a + 0.3] : [a];
      const warn = this.T(0.6);
      for (const ang of angles) {
        this.hazard({ shape: 'line', x: this.x, y: this.y, angle: ang, length: 760, width: 40, warn, damage: 0 });
      }
      this.windup(a, warn);
      yield warn;
      this.strike(a, 110, 2.4);
      for (const ang of angles) {
        this.shoot(ang, 480, { kind: 'crescent', radius: 20, damage: 14, life: 2.2 });
      }
      yield this.T(0.55);
    }

    /* ---- drawing ---- */
    drawBody(ctx, time) {
      const r = this.radius;
      const f = this.facing;
      const visor = this.enraged ? '#ff3048' : '#7fd8ff';
      ctx.save();
      ctx.translate(this.x, this.y);

      if (this.enraged) Draw.glow(ctx, 0, 0, r * 2.2, '255,40,60', 0.35 + 0.1 * Math.sin(time * 8));

      // Cape (behind)
      ctx.save();
      ctx.rotate(f);
      const sway = Math.sin(time * 5) * 4;
      ctx.fillStyle = this.enraged ? '#6a0d1a' : '#4a1520';
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.8);
      ctx.lineTo(-r * 1.6, -r * 0.95 + sway);
      ctx.lineTo(-r * 1.75, r * 0.95 + sway);
      ctx.lineTo(-r * 0.2, r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Sword
      ctx.save();
      ctx.rotate(this.swordAngle);
      ctx.fillStyle = '#3a2c1c';
      ctx.fillRect(r * 0.55, -3, 16, 6);
      ctx.fillStyle = '#c9a85a';
      ctx.fillRect(r * 0.55 + 14, -11, 5, 22);
      const blade = ctx.createLinearGradient(r, 0, r + 78, 0);
      blade.addColorStop(0, '#e9eef8');
      blade.addColorStop(1, this.enraged ? '#ff8f9e' : '#bcd3f0');
      ctx.fillStyle = blade;
      ctx.beginPath();
      ctx.moveTo(r * 0.55 + 19, -5);
      ctx.lineTo(r * 0.55 + 88, -3);
      ctx.lineTo(r * 0.55 + 98, 0);
      ctx.lineTo(r * 0.55 + 88, 3);
      ctx.lineTo(r * 0.55 + 19, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Body armor
      ctx.rotate(f);
      const body = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
      body.addColorStop(0, '#9aa7bf');
      body.addColorStop(1, '#3d4456');
      Draw.circle(ctx, 0, 0, r, body, '#1a1d26', 3);
      // Pauldrons
      Draw.circle(ctx, -r * 0.1, -r * 0.82, r * 0.42, '#5d6780', '#1a1d26', 2.5);
      Draw.circle(ctx, -r * 0.1, r * 0.82, r * 0.42, '#5d6780', '#1a1d26', 2.5);
      // Helmet
      Draw.circle(ctx, r * 0.3, 0, r * 0.55, '#7d889f', '#1a1d26', 2.5);
      ctx.fillStyle = visor;
      ctx.fillRect(r * 0.55, -r * 0.3, r * 0.18, r * 0.6);
      Draw.glow(ctx, r * 0.66, 0, r * 0.7, this.enraged ? '255,40,60' : '120,210,255', 0.6);
      // Plume
      ctx.fillStyle = this.enraged ? '#ff2a40' : '#c0283a';
      ctx.fillRect(-r * 0.15, -3, r * 0.5, 6);
      ctx.restore();
    }
  }

  BR.BossClasses.swordKnight = SwordKnight;
})();
