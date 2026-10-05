/*
 * BOSS 2 — INFERNO MAGE
 * Ranged zoner. Lesson: close the distance and control space.
 * Hugging her triggers Teleport, which leaves an explosion behind.
 * Fire Circle is a ring: the center is the safe spot ("in"), phase 2 adds a follow-up "out".
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;
  const C = BR.CONFIG;

  class InfernoMage extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 120;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [1, 0.85];
      this.recoveryByPhase = [0.75, 0.5];
      this.orbitDir = 1;
      this.orbitTimer = 2;
      this.castGlow = 0;
      this.idleTimer = 1.2;

      this.attacks = [
        { name: 'fireball', weight: 3, cooldown: 1.0, fn: this.atkFireball },
        { name: 'fireCircle', weight: 2, cooldown: 3.2, fn: this.atkFireCircle },
        { name: 'meteor', weight: 1.6, cooldown: 5, fn: this.atkMeteor },
        { name: 'teleport', weight: (b, d) => (d < 170 ? 7 : 0.3), cooldown: 2.6, fn: this.atkTeleport },
        { name: 'flameWall', weight: 1.2, cooldown: 7.5, fn: this.atkFlameWall },
        { name: 'elite', weight: 1.6, cooldown: 8, elite: true, fn: this.atkEliteSpiral },
      ];
    }

    get empowered() { return this.phase >= 2; }

    onPhaseChange() {
      this.speed = 140;
    }

    idleMove(dt) {
      const d = this.distToPlayer();
      const a = this.angleToPlayer();
      this.facing = a;
      this.orbitTimer -= dt;
      if (this.orbitTimer <= 0) { this.orbitDir *= -1; this.orbitTimer = Geo.rand(1.5, 3); }
      let radial = 0;
      if (d < 300) radial = -1;
      else if (d > 430) radial = 0.8;
      const tangent = 0.7 * this.orbitDir;
      this.vx = (Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * tangent) * this.speed;
      this.vy = (Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * tangent) * this.speed;
      if (this.hitWall) this.orbitDir *= -1;
    }

    updateExtra(dt) {
      this.castGlow = Math.max(0, this.castGlow - dt * 2);
      if (Math.random() < dt * 18) {
        this.game.particles.emit('fire', this.x + Geo.rand(-14, 14), this.y + Geo.rand(-6, 16), 1);
      }
    }

    explode(x, y, radius) {
      this.game.particles.emit('explosion', x, y, Math.round(radius / 5), { radius: radius * 0.5 });
      this.game.particles.emit('fire', x, y, 10, { radius: radius * 0.7 });
      this.game.effects.push(new BR.RingFx({ x, y, r0: radius * 0.4, r1: radius * 1.1, color: '255,150,60', width: 10, life: 0.35 }));
      this.game.audio.play('explosion');
    }

    /* ---- attacks ---- */
    *atkFireball() {
      const shots = this.empowered ? 5 : 3;
      const warn = this.T(0.55);
      const a0 = this.angleToPlayer();
      this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a0, length: 640, width: 26, warn, damage: 0, color: '255,130,50' });
      this.chargeUp(warn, '#ff8a30');
      this.castGlow = 1;
      yield warn;
      for (let i = 0; i < shots; i++) {
        // Each shot tracks the player: keep moving sideways to dodge the stream
        const spread = this.empowered ? (i - (shots - 1) / 2) * 0.1 : 0;
        this.shoot(this.angleToPlayer() + spread, 330, { kind: 'fireball', radius: 12, damage: 12, life: 3 });
        this.game.audio.play('shoot');
        yield 0.18;
      }
      if (this.empowered) {
        // Phase 2: a ring of fire around the player while the volley flies
        yield* this.ringAt(this.player.x, this.player.y, this.T(1.0));
      }
      yield this.T(0.35);
    }

    // Donut-shaped danger zone. Safe at the very center or outside.
    *ringAt(x, y, warn) {
      const inner = 62, outer = 170;
      this.hazard({
        shape: 'ring', x, y, radius: (inner + outer) / 2, width: outer - inner, warn, damage: 16,
        style: 'fire', linger: 0.45, onActivate: (h) => this.explode(h.x, h.y, outer * 0.7),
      });
      yield 0;
    }

    *atkFireCircle() {
      const p = this.player;
      const cx = p.x, cy = p.y;
      const warn = this.T(1.0);
      this.chargeUp(warn, '#ff6020');
      this.castGlow = 1;
      yield* this.ringAt(cx, cy, warn);
      if (this.empowered) {
        // ...then the center erupts: step in, then step out
        this.hazard({
          shape: 'circle', x: cx, y: cy, radius: 95, warn: warn + 0.55, damage: 18, style: 'fire', linger: 0.4,
          onActivate: (h) => this.explode(h.x, h.y, 90),
        });
      }
      yield warn * 0.6;
    }

    *atkMeteor() {
      const count = this.empowered ? 3 : 1;
      const warn = this.T(1.35);
      this.chargeUp(0.5, '#ffb030');
      this.castGlow = 1;
      yield 0.3;
      for (let i = 0; i < count; i++) {
        const p = this.player;
        const radius = this.empowered ? 115 : 140;
        const t = Geo.clampToArena(p.x, p.y, 20);
        this.hazard({
          shape: 'circle', x: t.x, y: t.y, radius, warn, damage: 26, style: 'fire', linger: 0.5,
          onActivate: (h) => {
            this.explode(h.x, h.y, radius);
            this.game.camera.shakePreset('medium');
          },
        });
        this.game.effects.push(new BR.ArcFx({ sx: t.x + 260, sy: t.y - 640, tx: t.x, ty: t.y, duration: warn, kind: 'meteor', size: 22 }));
        yield 0.42;
      }
      yield 0.5;
    }

    *atkTeleport() {
      const ox = this.x, oy = this.y;
      // Explosion left at the old position punishes face-hugging
      this.hazard({
        shape: 'circle', x: ox, y: oy, radius: 105, warn: this.T(0.65), damage: 15, style: 'fire',
        onActivate: (h) => this.explode(h.x, h.y, 100),
      });
      this.chargeUp(0.3, '#ffcc66');
      yield* this.fade(0, 0.25);
      const dest = this.pointAwayFromPlayer(380);
      this.hazard({ shape: 'circle', x: dest.x, y: dest.y, radius: 34, warn: 0.4, damage: 0, color: '255,170,70' });
      yield 0.4;
      this.teleportTo(dest.x, dest.y, 'fire');
      yield* this.fade(1, 0.2);
      if (this.empowered) yield* this.atkFireball();
      yield 0.2;
    }

    *atkFlameWall() {
      const p = this.player;
      const A = C.ARENA;
      const warn = this.T(1.15);
      const cx = (A.left + A.right) / 2, cy = (A.top + A.bottom) / 2;
      const horizontal = { x: cx, y: p.y, angle: 0, length: A.right - A.left };
      const vertical = { x: p.x, y: cy, angle: Math.PI / 2, length: A.bottom - A.top };
      const walls = this.empowered ? [horizontal, vertical] : [Math.random() < 0.5 ? horizontal : vertical];
      this.chargeUp(warn, '#ff5a1f');
      this.castGlow = 1;
      for (const w of walls) {
        this.hazard({
          shape: 'line', centered: true, x: w.x, y: w.y, angle: w.angle, length: w.length, width: 54,
          warn, damage: 7, tickInterval: 0.4, hitWindow: 4.2, linger: 0.5, style: 'fire',
          onActivate: (h) => {
            this.game.audio.play('explosion');
            const [ax, ay, bx, by] = h.endpoints();
            for (let i = 0; i <= 12; i++) {
              this.game.particles.emit('fire', Geo.lerp(ax, bx, i / 12), Geo.lerp(ay, by, i / 12), 3, { sizeMult: 1.5 });
            }
          },
        });
      }
      yield warn * 0.7;
    }

    // ELITE: three staggered rings of slow fireballs — weave through the gaps
    *atkEliteSpiral() {
      this.stop();
      this.statusText = 'INFERNO SPIRAL';
      this.chargeUp(0.8, '#ff5a1f');
      this.hazard({ shape: 'circle', x: this.x, y: this.y, radius: this.radius + 40, warn: 0.8, damage: 0, color: '255,140,60' });
      yield 0.8;
      const offset = Math.random() * Math.PI * 2;
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 10; i++) {
          const a = offset + ((i + r * 0.5) / 10) * Math.PI * 2;
          this.shoot(a, 170, { kind: 'fireball', radius: 11, damage: 12, life: 6 });
        }
        this.explode(this.x, this.y, 60);
        yield 0.55;
      }
      this.statusText = '';
      yield 0.5;
    }

    /* ---- drawing ---- */
    drawBody(ctx, time) {
      const r = this.radius;
      const bob = Math.sin(time * 3) * 3;
      ctx.save();
      ctx.translate(this.x, this.y + bob);
      Draw.glow(ctx, 0, 0, r * 2.6, '255,110,30', 0.35 + this.castGlow * 0.4);

      // Robe
      ctx.save();
      ctx.rotate(this.facing);
      const robe = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.3);
      robe.addColorStop(0, '#d64a1c');
      robe.addColorStop(1, '#4a0f08');
      ctx.fillStyle = robe;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rr = r * (1.05 + 0.12 * Math.sin(time * 6 + i * 1.7));
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Hood
      Draw.circle(ctx, r * 0.15, 0, r * 0.58, '#2a0905', '#ff8a3d', 2);
      Draw.circle(ctx, r * 0.42, -r * 0.16, 3, '#fff3b0');
      Draw.circle(ctx, r * 0.42, r * 0.16, 3, '#fff3b0');

      // Staff + orb
      ctx.strokeStyle = '#5a3418';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, r * 0.8);
      ctx.lineTo(r * 1.2, r * 0.8);
      ctx.stroke();
      const orbPulse = 1 + 0.2 * Math.sin(time * 10) + this.castGlow * 0.6;
      Draw.glow(ctx, r * 1.3, r * 0.8, 18 * orbPulse, '255,200,80', 0.9);
      Draw.circle(ctx, r * 1.3, r * 0.8, 6, '#fff2c4');
      ctx.restore();

      if (this.empowered) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const a = time * 2 + (i * Math.PI * 2) / 3;
          Draw.glow(ctx, Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6, 14, '255,140,40', 0.9);
        }
      }
      ctx.restore();
    }
  }

  BR.BossClasses.infernoMage = InfernoMage;
})();
