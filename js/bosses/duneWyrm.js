/*
 * DUNE WYRM
 * Lesson: bait and punish. While burrowed it is immune and a sand mound hunts you;
 * when the mound stops it erupts — sidestep, then hit the exposed head.
 * Tail Sweep is a ring: hugging the head is the safe spot.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;

  const SEGMENTS = 7;
  const SEGMENT_GAP = 5;   // history samples between body segments

  class DuneWyrm extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 90;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [1, 0.85];
      this.recoveryByPhase = [0.8, 0.55];
      this.burrowed = false;
      this.trail = [];
      this.idleTimer = 1.3;

      this.attacks = [
        { name: 'burrow', weight: 2.4, cooldown: 5, fn: this.atkBurrow },
        { name: 'breath', weight: 2, cooldown: 2.8, maxRange: 380, fn: this.atkSandBreath },
        { name: 'tail', weight: (b, d) => (d < 240 ? 4 : 0), cooldown: 3, fn: this.atkTailSweep },
        { name: 'quicksand', weight: 1.3, cooldown: 8, fn: this.atkQuicksand },
        { name: 'fissure', weight: 1.6, cooldown: 5, phase: 2, fn: this.atkFissure },
        { name: 'elite', weight: 1.6, cooldown: 8, elite: true, fn: this.atkEliteSandstorm },
      ];
    }

    get empowered() { return this.phase >= 2; }

    onPhaseChange() {
      this.speed = 115;
      this.burrowed = false;
      this.airborne = false;
    }

    idleMove(dt) {
      const a = this.angleToPlayer();
      this.facing = Geo.rotateToward(this.facing, a, 2.5 * dt);
      const sp = this.distToPlayer() > 170 ? this.speed : 0;
      this.vx = Math.cos(this.facing) * sp;
      this.vy = Math.sin(this.facing) * sp;
    }

    updateExtra() {
      const last = this.trail[this.trail.length - 1];
      if (!last || Geo.dist(last.x, last.y, this.x, this.y) > 8) {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > SEGMENTS * SEGMENT_GAP + 2) this.trail.shift();
      }
      if (this.burrowed && Math.random() < 0.6) {
        this.game.particles.emit('dust', this.x + Geo.rand(-20, 20), this.y + Geo.rand(-10, 10), 1, { speedMult: 0.6 });
      }
    }

    erupt(x, y, r) {
      this.game.particles.emit('dust', x, y, 26, { radius: r * 0.6, speedMult: 1.5 });
      this.game.particles.emit('rock', x, y, 10, { radius: r * 0.3 });
      this.game.effects.push(new BR.RingFx({ x, y, r0: r * 0.3, r1: r, color: '230,190,120', width: 12, life: 0.4 }));
      this.game.camera.shakePreset('medium');
      this.game.audio.play('explosion');
    }

    /* ---- attacks ---- */
    *atkBurrow() {
      const times = this.empowered ? 2 : 1;
      for (let i = 0; i < times; i++) {
        this.burrowed = true;
        this.airborne = true;   // underground: no body contact, not hittable
        this.invulnerable = true;
        this.statusText = 'BURROWED';
        this.erupt(this.x, this.y, 60);
        this.trail.length = 0;
        const chase = this.empowered ? 1.4 : 1.8;
        let t = 0;
        while (t < chase) {
          yield 0;
          t += this.dt;
          this.moveToward(this.player.x, this.player.y, 235);
        }
        this.stop();
        const radius = 118;
        const warn = this.T(0.7);
        this.hazard({ shape: 'circle', x: this.x, y: this.y, radius, warn, damage: 24, style: 'sand', color: '255,170,80' });
        this.tremble = warn;
        yield warn;
        this.burrowed = false;
        this.airborne = false;
        this.invulnerable = false;
        this.erupt(this.x, this.y, radius);
        this.statusText = '';
        if (i < times - 1) yield 0.5;
      }
      // Head exposed after surfacing
      this.statusText = 'EXPOSED';
      yield this.empowered ? 0.9 : 1.2;
      this.statusText = '';
    }

    *atkSandBreath() {
      const a = this.angleToPlayer();
      this.facing = a;
      const warn = this.T(0.65);
      this.chargeUp(warn, '#e8c27a');
      this.hazard({ shape: 'cone', x: this.x, y: this.y, angle: a, arc: 0.8, radius: 330, warn, damage: 18, style: 'sand', color: '255,170,80', linger: 0.4 });
      yield warn;
      this.game.particles.emit('dust', this.x + Math.cos(a) * 120, this.y + Math.sin(a) * 120, 30, { angle: a, spread: 0.8, speedMult: 2 });
      for (let i = 0; i < 6; i++) this.shoot(a + (Math.random() - 0.5) * 0.8, Geo.rand(320, 420), { kind: 'sand', radius: 8, damage: 9, life: 2 });
      this.game.audio.play('explosion');
      yield this.T(0.55);
    }

    *atkTailSweep() {
      const inner = 70, outer = 230;
      const warn = this.T(0.8);
      this.chargeUp(warn, '#ffd59a');
      this.statusText = 'GET CLOSE';
      this.hazard({ shape: 'ring', x: this.x, y: this.y, radius: (inner + outer) / 2, width: outer - inner, warn, damage: 20, style: 'sand', color: '255,170,80' });
      yield warn;
      this.statusText = '';
      this.erupt(this.x, this.y, outer);
      yield 0.6;
    }

    *atkQuicksand() {
      const p = this.player;
      const spots = [{ x: p.x, y: p.y }, this.randomArenaPoint(90), this.randomArenaPoint(90)];
      if (this.empowered) spots.push(this.randomArenaPoint(90));
      const warn = this.T(1.0);
      this.chargeUp(0.5, '#e8c27a');
      for (const s of spots) {
        this.game.effects.push(new BR.ArcFx({ sx: this.x, sy: this.y - 20, tx: s.x, ty: s.y, duration: warn, height: 200, kind: 'rock', size: 12 }));
        this.hazard({
          shape: 'circle', x: s.x, y: s.y, radius: 92, warn, damage: 4, tickInterval: 0.5, hitWindow: 4.5, linger: 0.5,
          slow: 0.5, style: 'sand', color: '255,170,80',
          onActivate: (h) => this.game.particles.emit('dust', h.x, h.y, 14, { radius: 50 }),
        });
      }
      yield 0.7;
    }

    *atkFissure() {
      const a = this.angleToPlayer();
      const count = 8;
      this.chargeUp(0.5, '#ffb35e');
      yield 0.3;
      for (let i = 0; i < count; i++) {
        const d = 90 + i * 85;
        const spot = { x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d };
        this.hazard({
          shape: 'circle', x: spot.x, y: spot.y, radius: 68, warn: 0.55 + i * 0.1, damage: 18, style: 'sand', color: '255,170,80',
          onActivate: (h) => this.game.particles.emit('rock', h.x, h.y, 6, { radius: 20 }),
        });
      }
      yield 0.55 + count * 0.1;
    }

    // ELITE: two sand tornadoes cross the arena slowly — they are slower than you
    *atkEliteSandstorm() {
      this.stop();
      const A = BR.CONFIG.ARENA;
      this.statusText = 'SANDSTORM';
      this.chargeUp(0.8, '#e8c27a');
      const tornadoes = [];
      for (let i = 0; i < 2; i++) {
        const fromLeft = i === 0;
        const y = Geo.rand(A.top + 110, A.bottom - 110);
        const t = { x: fromLeft ? A.left + 70 : A.right - 70, y, vx: fromLeft ? 150 : -150, vy: Geo.rand(-50, 50), dead: false };
        tornadoes.push(t);
        this.hazard({
          shape: 'circle', x: t.x, y: t.y, radius: 70, warn: 0.8, damage: 8, tickInterval: 0.45, hitWindow: 6.5, linger: 0.4,
          style: 'sand', color: '255,170,80', follow: t,
        });
      }
      yield 0.8;
      let time = 0;
      while (time < 6.5) {
        yield 0;
        time += this.dt;
        for (const t of tornadoes) {
          t.x += t.vx * this.dt;
          t.y += t.vy * this.dt;
          if (t.y < A.top + 70 || t.y > A.bottom - 70) t.vy *= -1;
          if (Math.random() < 0.5) this.game.particles.emit('dust', t.x + Geo.rand(-30, 30), t.y + Geo.rand(-30, 30), 1, { speedMult: 1.5 });
        }
        if (time > 1.5 && this.statusText) this.statusText = '';
      }
      for (const t of tornadoes) t.dead = true;
      yield 0.3;
    }

    /* ---- drawing ---- */
    draw(ctx, time) {
      if (this.burrowed && !this.dead) {
        // Sand mound only
        Draw.shadow(ctx, this.x, this.y + 6, this.radius * 1.2, this.radius * 0.5, 0.4);
        ctx.save();
        ctx.fillStyle = '#8a6a3a';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.radius * 1.1, this.radius * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4a3418';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          const a = time * 2 + i * 2;
          ctx.arc(this.x, this.y, this.radius * (0.3 + i * 0.25), a, a + 1.4);
          ctx.stroke();
        }
        ctx.restore();
        Draw.text(ctx, this.statusText, this.x, this.y - this.radius - 14, { size: 13, color: '#ffe37a', weight: '800', stroke: '#000', strokeWidth: 4 });
        return;
      }
      // Body segments trailing behind the head
      if (!this.dead) {
        for (let s = SEGMENTS; s >= 1; s--) {
          const idx = this.trail.length - 1 - s * SEGMENT_GAP;
          if (idx < 0) continue;
          const seg = this.trail[idx];
          const r = this.radius * (0.85 - s * 0.07);
          Draw.circle(ctx, seg.x, seg.y, r, s % 2 ? '#a47e46' : '#8f6c3a', '#3e2a12', 2);
          ctx.strokeStyle = 'rgba(60,40,15,0.6)';
          ctx.beginPath();
          ctx.arc(seg.x, seg.y, r * 0.6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      super.draw(ctx, time);
    }

    drawBody(ctx, time) {
      const r = this.radius;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.facing);
      const body = ctx.createRadialGradient(-r * 0.3, 0, 3, 0, 0, r);
      body.addColorStop(0, '#d6a862');
      body.addColorStop(1, '#6e4f24');
      Draw.circle(ctx, 0, 0, r, body, '#3e2a12', 3);
      // Plates
      ctx.strokeStyle = 'rgba(62,42,18,0.8)';
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(-r * 0.3, 0, r * (0.55 + i * 0.15), -1.2, 1.2);
        ctx.stroke();
      }
      // Mandibles
      const open = 0.3 + 0.2 * Math.sin(time * 6) + (this.charge ? 0.35 : 0);
      ctx.fillStyle = '#f0e2c0';
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(r * 0.75, side * r * 0.35);
        ctx.rotate(side * open);
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(r * 0.7, side * 4);
        ctx.lineTo(0, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // Maw
      Draw.circle(ctx, r * 0.6, 0, r * 0.28, '#2a0e06');
      Draw.glow(ctx, r * 0.6, 0, 16, this.empowered ? '255,90,40' : '255,170,80', 0.6);
      ctx.restore();
    }
  }

  BR.BossClasses.duneWyrm = DuneWyrm;
})();
