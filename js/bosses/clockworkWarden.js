/*
 * CLOCKWORK WARDEN
 * Lesson: rhythm and memory. Clock-hand beams rotate at a fixed speed (walk around with them),
 * Rewind strikes the path you just walked (don't backtrack), tick bombs go off in order.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;

  const HISTORY_INTERVAL = 0.2;
  const HISTORY_SIZE = 16;

  class ClockworkWarden extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 45;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [1, 0.85];
      this.recoveryByPhase = [0.85, 0.6];
      this.history = [];
      this.historyTimer = 0;
      this.handSpeed = 1;
      this.gearSpin = 0;
      this.idleTimer = 1.3;

      this.attacks = [
        { name: 'hands', weight: 2.2, cooldown: 7, fn: this.atkHands },
        { name: 'bombs', weight: 2, cooldown: 4, fn: this.atkTickBombs },
        { name: 'rewind', weight: 1.6, cooldown: 6, fn: this.atkRewind },
        { name: 'gears', weight: 2, cooldown: 2.6, fn: this.atkGears },
        { name: 'pendulum', weight: 1.6, cooldown: 5, phase: 2, fn: this.atkPendulum },
        { name: 'elite', weight: 1.6, cooldown: 8, elite: true, fn: this.atkEliteMidnight },
      ];
    }

    get empowered() { return this.phase >= 2; }

    onPhaseChange() {
      this.speed = 60;
      this.handSpeed = 3;
    }

    idleMove() {
      const d = this.distToPlayer();
      const a = this.angleToPlayer();
      this.facing = a;
      const sp = d > 300 ? this.speed : d < 200 ? -this.speed : 0;
      this.vx = Math.cos(a) * sp;
      this.vy = Math.sin(a) * sp;
    }

    updateExtra(dt) {
      this.gearSpin += dt * this.handSpeed;
      this.historyTimer -= dt;
      if (this.historyTimer <= 0 && this.player) {
        this.historyTimer = HISTORY_INTERVAL;
        this.history.push({ x: this.player.x, y: this.player.y });
        if (this.history.length > HISTORY_SIZE) this.history.shift();
      }
    }

    chime(x, y, r) {
      this.game.effects.push(new BR.RingFx({ x, y, r0: r * 0.3, r1: r, color: '255,210,110', width: 8, life: 0.35 }));
      this.game.particles.emit('spark', x, y, 10, { radius: r * 0.4 });
      this.game.audio.play('explosion');
    }

    /* ---- attacks ---- */
    *atkHands() {
      this.stop();
      const n = this.empowered ? 3 : 2;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const spin = dir * (this.empowered ? 0.95 : 0.75);
      const duration = this.empowered ? 5 : 4.5;
      const warn = this.T(1.2);
      const base = this.angleToPlayer() + Math.PI / (n * 2); // never starts on top of the player
      this.statusText = dir > 0 ? 'CLOCKWISE ↻' : 'COUNTER ↺';
      this.chargeUp(warn, '#ffc85a');
      for (let i = 0; i < n; i++) {
        this.hazard({
          shape: 'line', centered: true, x: this.x, y: this.y, angle: base + (i * Math.PI) / n, length: 1700, width: 30,
          warn, damage: 12, tickInterval: 0.5, hitWindow: duration, linger: 0.4, spin, follow: this,
          style: 'brass', color: '255,190,80',
        });
      }
      yield warn;
      this.handSpeed = 6;
      this.game.audio.play('bossPhase');
      yield duration * 0.5;
      this.statusText = '';
      yield duration * 0.5;
      this.handSpeed = this.empowered ? 3 : 1;
      yield 0.4;
    }

    *atkTickBombs() {
      const n = this.empowered ? 7 : 5;
      const p = this.player;
      const ring = 150;
      const start = Math.random() * Math.PI * 2;
      this.chargeUp(0.5, '#ffd07a');
      for (let i = 0; i < n; i++) {
        const a = start + (i / n) * Math.PI * 2;
        const spot = i === n - 1 ? { x: p.x, y: p.y } : Geo.clampToArena(p.x + Math.cos(a) * ring, p.y + Math.sin(a) * ring, 50);
        this.hazard({
          shape: 'circle', x: spot.x, y: spot.y, radius: 92, warn: 0.85 + i * 0.32, damage: 16, style: 'brass', color: '255,190,80',
          onActivate: (h) => this.chime(h.x, h.y, 92),
        });
      }
      yield 0.85 + n * 0.32 * 0.6;
    }

    *atkRewind() {
      const path = this.history.slice(-10);
      if (path.length < 3) { yield 0.2; return; }
      this.statusText = 'REWIND';
      this.chargeUp(0.6, '#e8d8a0');
      this.game.audio.play('teleport');
      path.forEach((pt, i) => {
        this.hazard({
          shape: 'circle', x: pt.x, y: pt.y, radius: 58, warn: 0.75 + i * 0.16, damage: 14, style: 'brass', color: '255,190,80',
          onActivate: (h) => this.game.particles.emit('spark', h.x, h.y, 6),
        });
      });
      yield 0.75 + path.length * 0.16;
      this.statusText = '';
      yield 0.3;
    }

    *atkGears() {
      const n = this.empowered ? 6 : 4;
      const a = this.angleToPlayer();
      const warn = this.T(0.5);
      const angles = [];
      for (let i = 0; i < n; i++) angles.push(a + (i / (n - 1) - 0.5) * 1.6);
      for (const ang of angles) this.hazard({ shape: 'line', x: this.x, y: this.y, angle: ang, length: 260, width: 28, warn, damage: 0, color: '255,190,80' });
      this.chargeUp(warn, '#ffc85a');
      yield warn;
      for (const ang of angles) this.shoot(ang, 250, { kind: 'gear', radius: 14, damage: 12, life: 6, bounces: 2 });
      this.game.audio.play('shoot');
      yield 0.5;
    }

    *atkPendulum() {
      const sweeps = 2;
      for (let s = 0; s < sweeps; s++) {
        const start = this.angleToPlayer() + (s % 2 === 0 ? -1.3 : 1.3);
        const dir = s % 2 === 0 ? 1 : -1;
        const warn = this.T(0.8);
        this.chargeUp(warn, '#ffd07a');
        this.hazard({
          shape: 'cone', x: this.x, y: this.y, angle: start, arc: 0.5, radius: 340, warn, damage: 20,
          hitWindow: 1.2, linger: 0.2, spin: dir * 2.2, style: 'brass', color: '255,190,80',
        });
        yield warn + 1.2;
      }
      yield 0.4;
    }

    // ELITE: twelve chimes around the clock, in clockwise order — stay inside or outside the dial
    *atkEliteMidnight() {
      this.stop();
      this.statusText = 'MIDNIGHT';
      this.chargeUp(1.0, '#ffd07a');
      for (let i = 0; i < 12; i++) {
        const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
        const pos = Geo.clampToArena(this.x + Math.cos(a) * 230, this.y + Math.sin(a) * 230, 30);
        this.hazard({
          shape: 'circle', x: pos.x, y: pos.y, radius: 78, warn: 1.0 + i * 0.15, damage: 16, style: 'brass', color: '255,190,80',
          onActivate: (h) => this.chime(h.x, h.y, 78),
        });
      }
      yield 1.0 + 12 * 0.15;
      this.statusText = '';
      yield 0.4;
    }

    /* ---- drawing ---- */
    drawBody(ctx, time) {
      const r = this.radius;
      ctx.save();
      ctx.translate(this.x, this.y);
      // Side gears
      for (const [ox, oy, gr, dir] of [[-r * 1.05, -r * 0.6, r * 0.5, 1], [r * 1.0, r * 0.65, r * 0.42, -1]]) {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(this.gearSpin * dir * 1.5);
        ctx.fillStyle = '#8a6a2a';
        ctx.beginPath();
        for (let i = 0; i < 20; i++) {
          const rr = i % 2 === 0 ? gr : gr * 0.75;
          const a = (i / 20) * Math.PI * 2;
          if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        Draw.circle(ctx, 0, 0, gr * 0.3, '#3a2a0c');
        ctx.restore();
      }
      Draw.glow(ctx, 0, 0, r * 2.2, '255,200,90', this.empowered ? 0.5 : 0.3);
      // Clock face
      Draw.circle(ctx, 0, 0, r, '#2a2012', '#c9a24a', 5);
      Draw.circle(ctx, 0, 0, r * 0.86, '#efe4c8', '#8a6a2a', 2);
      ctx.strokeStyle = '#3a2a10';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.lineWidth = i % 3 === 0 ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
        ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
        ctx.stroke();
      }
      // Hands
      const hour = this.gearSpin * 0.3, minute = this.gearSpin * 2.2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1e1408';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(hour) * r * 0.45, Math.sin(hour) * r * 0.45); ctx.stroke();
      ctx.strokeStyle = this.empowered ? '#c0392b' : '#1e1408';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(minute) * r * 0.68, Math.sin(minute) * r * 0.68); ctx.stroke();
      // Eye gem looking at the player
      Draw.circle(ctx, 0, 0, r * 0.16, '#c9a24a');
      Draw.circle(ctx, Math.cos(this.facing) * 2, Math.sin(this.facing) * 2, r * 0.09, this.empowered ? '#ff4a3a' : '#3aa8ff');
      ctx.restore();
    }
  }

  BR.BossClasses.clockworkWarden = ClockworkWarden;
})();
