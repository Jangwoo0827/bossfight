/*
 * GRAVITY SAGE — forced movement. Gravity wells pull you toward a damaging core;
 * Collapse drags you toward the sage before a blast. The pull is always weaker than your run speed.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;

  class GravitySage extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 80;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [1, 0.86];
      this.recoveryByPhase = [0.8, 0.55];
      this.wells = [];
      this.spin = 0;
      this.collapsing = false;
      this.idleTimer = 1.2;
      this.attacks = [
        { name: 'well', weight: (b) => (b.wells.length < 2 ? 2.6 : 0.6), cooldown: 4, fn: this.atkWell },
        { name: 'spiral', weight: 2, cooldown: 3, fn: this.atkSpiral },
        { name: 'collapse', weight: 1.4, cooldown: 7, fn: this.atkCollapse },
        { name: 'meteors', weight: 2, cooldown: 3.5, fn: this.atkMeteors },
        { name: 'elite', weight: 1.6, cooldown: 10, elite: true, fn: this.atkEliteHorizon },
      ];
    }

    get empowered() { return this.phase >= 2; }
    onPhaseChange() { this.speed = 95; this.collapsing = false; }

    die() {
      super.die();
      this.collapsing = false;
      for (const w of this.wells) w.dead = true;
      this.wells.length = 0;
    }

    idleMove() {
      const d = this.distToPlayer(), a = this.angleToPlayer();
      this.facing = a;
      const sp = d > 340 ? this.speed : d < 240 ? -this.speed : 0;
      const t = Math.sin(this.time) * 40;
      this.vx = Math.cos(a) * sp + Math.cos(a + Math.PI / 2) * t;
      this.vy = Math.sin(a) * sp + Math.sin(a + Math.PI / 2) * t;
    }

    // Moves the player toward (x, y); strength stays below run speed (240), dashing ignores it
    pull(x, y, radius, strength, dt) {
      const p = this.player;
      if (!p || p.dead || p.isDashing) return;
      const d = Geo.dist(x, y, p.x, p.y);
      if (d > radius || d < 1) return;
      const f = strength * (1 - (d / radius) * 0.5) * dt;
      const c = Geo.clampToArena(p.x + ((x - p.x) / d) * f, p.y + ((y - p.y) / d) * f, p.radius);
      p.x = c.x;
      p.y = c.y;
    }

    updateExtra(dt) {
      this.spin += dt;
      for (let i = this.wells.length - 1; i >= 0; i--) {
        const w = this.wells[i];
        w.life -= dt;
        if (w.life <= 0 || this.dead) { w.dead = true; this.wells.splice(i, 1); continue; }
        if (w.armed && this.active) this.pull(w.x, w.y, w.radius, w.strength, dt);
      }
      if (this.collapsing && this.active && this.state !== 'STUNNED') this.pull(this.x, this.y, 560, 150, dt);
    }

    addWell(x, y, life) {
      const w = { x, y, radius: 230, strength: 120, life: life + 0.8, armed: false, dead: false };
      this.wells.push(w);
      this.hazard({ shape: 'circle', x, y, radius: 36, warn: 0.8, damage: 8, tickInterval: 0.4, hitWindow: life, linger: 0.3,
        style: 'void', color: '120,140,255', follow: w, onActivate: () => { w.armed = true; } });
    }

    *atkWell() {
      const n = this.empowered ? 2 : 1;
      this.chargeUp(0.8, '#7890ff');
      const p = this.player;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = Geo.clampToArena(p.x + Math.cos(a) * 170, p.y + Math.sin(a) * 170, 60);
        this.addWell(s.x, s.y, 5);
      }
      yield 0.8;
    }

    *atkSpiral() {
      const warn = this.T(0.6);
      this.chargeUp(warn, '#9fb0ff');
      yield warn;
      const n = this.empowered ? 14 : 10, off = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * Math.PI * 2;
        this.shoot(a, 150, { kind: 'void', radius: 9, damage: 10, life: 5,
          vx: Math.cos(a) * 140 + Math.cos(a + Math.PI / 2) * 80, vy: Math.sin(a) * 140 + Math.sin(a + Math.PI / 2) * 80 });
      }
      this.game.audio.play('shoot');
      yield 0.5;
    }

    *atkCollapse() {
      this.stop();
      const warn = this.T(1.6);
      this.statusText = 'COLLAPSE — RUN!';
      this.chargeUp(warn, '#ffffff');
      this.collapsing = true;
      this.hazard({ shape: 'circle', x: this.x, y: this.y, radius: 200, warn, damage: 26, style: 'void', color: '120,140,255' });
      yield warn;
      this.collapsing = false;
      this.statusText = '';
      this.game.effects.push(new BR.RingFx({ x: this.x, y: this.y, r0: 30, r1: 220, color: '160,180,255', width: 14, life: 0.4 }));
      this.game.camera.shakePreset('big');
      this.game.audio.play('explosion');
      yield 0.7;
    }

    *atkMeteors() {
      const n = this.empowered ? 5 : 4;
      this.chargeUp(0.5, '#9fb0ff');
      for (let i = 0; i < n; i++) {
        const p = this.player;
        const t = Geo.clampToArena(p.x + p.vx * 0.4, p.y + p.vy * 0.4, 40);
        const warn = this.T(1.0);
        this.hazard({ shape: 'circle', x: t.x, y: t.y, radius: 70, warn, damage: 16, style: 'void', color: '120,140,255',
          onActivate: (h) => this.game.particles.emit('void', h.x, h.y, 14, { radius: 30 }) });
        this.game.effects.push(new BR.ArcFx({ sx: t.x - 200, sy: t.y - 600, tx: t.x, ty: t.y, duration: warn, kind: 'meteor', size: 14 }));
        yield 0.35;
      }
      yield 0.5;
    }

    // ELITE: three wells at once, then a collapse
    *atkEliteHorizon() {
      this.statusText = 'EVENT HORIZON';
      const A = BR.CONFIG.ARENA;
      for (let i = 0; i < 3; i++) this.addWell(Geo.rand(A.left + 120, A.right - 120), Geo.rand(A.top + 100, A.bottom - 100), 5);
      yield 1.2;
      yield* this.atkCollapse();
    }

    draw(ctx, time) {
      for (const w of this.wells) {
        ctx.save();
        ctx.globalAlpha = w.armed ? 1 : 0.4;
        Draw.glow(ctx, w.x, w.y, 70, '90,100,255', 0.5);
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(w.x, w.y, 50 + i * 40, time * (2 - i * 0.5), time * (2 - i * 0.5) + 2);
          ctx.strokeStyle = `rgba(150,170,255,${0.4 - i * 0.1})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        Draw.circle(ctx, w.x, w.y, 24, '#05050f', '#9fb0ff', 2);
        ctx.restore();
      }
      super.draw(ctx, time);
    }

    drawBody(ctx) {
      const r = this.radius;
      ctx.save();
      ctx.translate(this.x, this.y);
      Draw.glow(ctx, 0, 0, r * 2.6, '120,140,255', this.collapsing ? 0.8 : 0.35);
      for (let i = 0; i < 2; i++) {
        ctx.save();
        ctx.rotate(this.spin * (i ? -1.2 : 0.8));
        ctx.scale(1, 0.4);
        ctx.beginPath();
        ctx.arc(0, 0, r * (1.5 + i * 0.35), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(170,190,255,0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
      Draw.circle(ctx, 0, 0, r, '#141432', '#9fb0ff', 2.5);
      Draw.circle(ctx, 0, 0, r * 0.4, '#05050f', this.empowered ? '#ffffff' : '#6070ff', 2);
      ctx.restore();
    }
  }

  BR.BossClasses.gravitySage = GravitySage;
})();
