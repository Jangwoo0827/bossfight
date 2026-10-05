/*
 * WESTERN SHOOTER
 * Lesson: flank. Gun Block stops every frontal hit (and answers with a counter shot),
 * hits from behind deal 1.5x. A huge ricochet slug keeps bouncing around the arena.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;

  const BULLET_RGB = '255,150,80';
  const GUARD_ARC = 1.15;     // half-angle of the blocked front
  const BACKSTAB_ARC = 2.1;   // half-angle beyond which a hit counts as from behind

  class WesternShooter extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 150;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [1, 0.85];
      this.recoveryByPhase = [0.6, 0.42];
      this.guarding = false;
      this.guardAngle = 0;
      this.pendingCounter = false;
      this.strafeDir = 1;
      this.strafeTimer = 1.5;
      this.gunKick = 0;
      this.idleTimer = 1.1;

      this.attacks = [
        { name: 'triple', weight: 3, cooldown: 1.2, fn: this.atkTriple },
        { name: 'fan', weight: 2, cooldown: 3.2, fn: this.atkFanHammer },
        { name: 'ricochet', weight: 1.4, cooldown: 7, fn: this.atkRicochet },
        { name: 'guard', weight: (b, d) => (d < 260 ? 1.8 : 1.1), cooldown: 7.5, fn: this.atkGuard },
        { name: 'roll', weight: 1.8, cooldown: 2.5, fn: this.atkRoll },
        { name: 'highNoon', weight: 1.3, cooldown: 11, phase: 2, fn: this.atkHighNoon },
      ];
    }

    get empowered() { return this.phase >= 2; }

    onPhaseChange() {
      this.speed = 175;
      this.guarding = false;
      this.cooldowns.highNoon = this.time + 2;
    }

    incomingMultiplier(sx, sy) {
      if (!this.guarding) return 1;
      const diff = Math.abs(Geo.angleDiff(this.guardAngle, Geo.angle(this.x, this.y, sx, sy)));
      if (diff <= GUARD_ARC) return 0;
      if (diff >= BACKSTAB_ARC) return 1.5;
      return 1;
    }

    onBlocked() {
      this.pendingCounter = true;
      this.gunKick = 1;
    }

    idleMove(dt) {
      const d = this.distToPlayer();
      const a = this.angleToPlayer();
      this.facing = a;
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0 || this.hitWall) { this.strafeDir *= -1; this.strafeTimer = Geo.rand(0.8, 1.8); }
      const radial = d > 340 ? 0.6 : d < 230 ? -0.7 : 0;
      this.vx = (Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * this.strafeDir * 0.8) * this.speed;
      this.vy = (Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * this.strafeDir * 0.8) * this.speed;
    }

    updateExtra(dt) {
      this.gunKick = Math.max(0, this.gunKick - dt * 6);
    }

    fire(angle, speed, opts = {}) {
      this.gunKick = 1;
      this.game.particles.emit('spark', this.x + Math.cos(angle) * 34, this.y + Math.sin(angle) * 34, 4, { angle, spread: 0.6 });
      return this.shoot(angle, speed, Object.assign({ kind: 'bullet', radius: 6, damage: 11, life: 2.5, color: BULLET_RGB, offset: 34 }, opts));
    }

    /* ---- attacks ---- */
    *atkTriple() {
      const volleys = this.empowered ? 2 : 1;
      for (let v = 0; v < volleys; v++) {
        const a = this.angleToPlayer();
        this.facing = a;
        const warn = v === 0 ? this.T(0.5) : 0.38;
        for (const s of [-0.26, 0, 0.26]) {
          this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a + s, length: 640, width: 18, warn, damage: 0, color: '255,160,80' });
        }
        this.chargeUp(warn, '#ffb35e');
        yield warn;
        for (const s of [-0.26, 0, 0.26]) this.fire(a + s, 560, { damage: 12 });
        this.game.audio.play('shoot');
        yield 0.22;
      }
      yield this.T(0.3);
    }

    *atkFanHammer() {
      const bursts = this.empowered ? 4 : 3;
      const a = this.angleToPlayer();
      this.facing = a;
      const arc = 1.1;
      const warn = this.T(0.65);
      this.hazard({ shape: 'cone', x: this.x, y: this.y, angle: a, arc, radius: 520, warn, damage: 0, color: '255,160,80' });
      this.chargeUp(warn, '#ff9a4a');
      this.statusText = 'FAN THE HAMMER';
      yield warn;
      for (let b = 0; b < bursts; b++) {
        for (let i = 0; i < 7; i++) {
          this.fire(a + (Math.random() - 0.5) * arc, Geo.rand(360, 470), { damage: 9, radius: 5 });
        }
        this.game.audio.play('shoot');
        this.game.camera.shake(2, 0.08);
        yield 0.2;
      }
      this.statusText = '';
      yield this.T(0.45);
    }

    *atkRicochet() {
      const slugs = this.empowered ? 2 : 1;
      for (let i = 0; i < slugs; i++) {
        const a = this.angleToPlayer() + (i === 0 ? 0 : (Math.random() < 0.5 ? -0.7 : 0.7));
        this.facing = a;
        const warn = this.T(0.85);
        this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a, length: Geo.rayToArena(this.x, this.y, a, 0), width: 52, warn, damage: 0, color: '255,150,60' });
        this.chargeUp(warn, '#ff7a2a');
        this.tremble = warn;
        this.statusText = 'RICOCHET';
        yield warn;
        this.fire(a, 330, { kind: 'slug', radius: 24, damage: 22, life: 11, bounces: this.empowered ? 7 : 5, unclearable: true });
        this.game.camera.shakePreset('small');
        this.game.audio.play('explosion');
        yield 0.35;
      }
      this.statusText = '';
      yield 0.4;
    }

    *atkGuard() {
      this.stop();
      this.guarding = true;
      this.guardAngle = this.angleToPlayer();
      this.statusText = 'GUARD — FLANK HIM!';
      const duration = this.empowered ? 2.6 : 2.2;
      const turnRate = this.empowered ? 1.6 : 1.25;
      let t = 0, counterAt = -1, counterAngle = 0;
      while (t < duration) {
        yield 0;
        t += this.dt;
        this.guardAngle = Geo.rotateToward(this.guardAngle, this.angleToPlayer(), turnRate * this.dt);
        this.facing = this.guardAngle;
        if (this.pendingCounter && counterAt < 0) {
          this.pendingCounter = false;
          counterAngle = this.angleToPlayer();
          counterAt = t + 0.32;
          this.hazard({ shape: 'line', x: this.x, y: this.y, angle: counterAngle, length: 700, width: 18, warn: 0.32, damage: 0, color: '255,160,80' });
        }
        if (counterAt >= 0 && t >= counterAt) {
          this.fire(counterAngle, 640, { damage: 13 });
          this.game.audio.play('shoot');
          counterAt = -1;
        }
      }
      this.guarding = false;
      this.pendingCounter = false;
      this.statusText = '';
      yield 0.35;
    }

    *atkRoll() {
      const rolls = this.empowered ? 2 : 1;
      for (let r = 0; r < rolls; r++) {
        const toPlayer = this.angleToPlayer();
        const side = Math.random() < 0.5 ? 1 : -1;
        const dir = toPlayer + side * Math.PI / 2;
        this.game.particles.emit('dust', this.x, this.y, 10, { radius: 10 });
        this.game.audio.play('dash');
        yield* this.dash(dir, 950, 230);
        this.game.particles.emit('dust', this.x, this.y, 8, { radius: 10 });
        const a = this.angleToPlayer();
        this.facing = a;
        this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a, length: 700, width: 20, warn: 0.38, damage: 0, color: '255,160,80' });
        yield 0.38;
        this.fire(a, 650, { kind: 'bigBullet', radius: 8, damage: 14 });
        this.game.audio.play('crit');
        yield 0.18;
      }
      yield this.T(0.35);
    }

    *atkHighNoon() {
      this.stop();
      this.statusText = 'HIGH NOON';
      this.game.showBanner('HIGH NOON', '6발이 온다 — 계속 움직여라', '#ffb35e', 1.6);
      this.game.flash = 0.35;
      this.game.flashColor = '255,170,80';
      this.chargeUp(1.0, '#ffcf6a');
      yield 1.0;
      for (let i = 0; i < 6; i++) {
        const a = this.angleToPlayer();
        this.facing = a;
        this.hazard({
          shape: 'line', x: this.x, y: this.y, angle: a, length: Geo.rayToArena(this.x, this.y, a, 0), width: 30,
          warn: 0.55, damage: 16, hitWindow: 0.08, linger: 0.25, color: '255,170,80', activeColor: '255,230,160',
          onActivate: () => { this.gunKick = 1; this.game.audio.play('crit'); this.game.camera.shake(3, 0.1); },
        });
        yield 0.42;
      }
      this.statusText = '';
      yield 0.9;
    }

    /* ---- drawing ---- */
    drawBody(ctx, time) {
      const r = this.radius;
      ctx.save();
      ctx.translate(this.x, this.y);

      if (this.guarding) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(0, 0, r + 18, this.guardAngle - GUARD_ARC, this.guardAngle + GUARD_ARC);
        ctx.strokeStyle = `rgba(255,220,150,${0.7 + 0.3 * Math.sin(time * 14)})`;
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r + 26, this.guardAngle + Math.PI - (Math.PI - BACKSTAB_ARC), this.guardAngle + Math.PI + (Math.PI - BACKSTAB_ARC));
        ctx.strokeStyle = 'rgba(255,90,60,0.5)';
        ctx.setLineDash([5, 6]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      ctx.rotate(this.facing);
      // Poncho
      ctx.fillStyle = '#7a3b1e';
      ctx.strokeStyle = '#2a1408';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rr = r * (i % 2 === 0 ? 1.1 : 0.95);
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#e8b25a';
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.3); ctx.lineTo(r * 0.6, -r * 0.3);
      ctx.moveTo(-r * 0.8, r * 0.3); ctx.lineTo(r * 0.6, r * 0.3);
      ctx.stroke();

      // Revolver (raised in front while guarding)
      const kick = this.gunKick * 5;
      ctx.save();
      if (this.guarding) {
        ctx.translate(r * 0.9, 0);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#c8ccd2';
        ctx.fillRect(-r * 0.9, -4, r * 1.8, 8);
      } else {
        ctx.translate(r * 0.4 - kick, r * 0.55);
        ctx.fillStyle = '#5a3a1e';
        ctx.fillRect(-4, -4, 10, 10);
        ctx.fillStyle = '#c8ccd2';
        ctx.fillRect(4, -3, 26, 6);
      }
      ctx.restore();

      // Hat (brim + crown)
      ctx.fillStyle = '#4a2c14';
      ctx.beginPath();
      ctx.ellipse(r * 0.1, 0, r * 0.95, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1e1006';
      ctx.stroke();
      Draw.circle(ctx, r * 0.1, 0, r * 0.48, '#6b4423', '#1e1006', 2);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(r * 0.05 - 2, -r * 0.48, 4, r * 0.96);
      if (this.empowered) Draw.glow(ctx, r * 0.5, 0, 18, '255,120,60', 0.6);
      ctx.restore();
    }
  }

  BR.BossClasses.westernShooter = WesternShooter;
})();
