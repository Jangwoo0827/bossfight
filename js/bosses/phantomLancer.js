/*
 * PHANTOM LANCER — dash-centric. Every dash leaves a short-lived lance trail (a wall).
 * Lesson: keep open space; the trails box you in, so don't get cornered.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;
  const C = BR.CONFIG;

  class PhantomLancer extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 160;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [1, 0.86];
      this.recoveryByPhase = [0.6, 0.42];
      this.trail = [];
      this.orbit = 1;
      this.idleTimer = 1.0;
      this.attacks = [
        { name: 'lunge', weight: 3, cooldown: 1.2, fn: this.atkLunge },
        { name: 'zigzag', weight: 2, cooldown: 4, fn: this.atkZigzag },
        { name: 'cross', weight: 1.5, cooldown: 6, fn: this.atkCross },
        { name: 'volley', weight: 1.5, cooldown: 3.5, fn: this.atkVolley },
        { name: 'elite', weight: 1.6, cooldown: 9, elite: true, fn: this.atkEliteStarfall },
      ];
    }

    get empowered() { return this.phase >= 2; }
    onPhaseChange() { this.speed = 190; }

    idleMove() {
      const d = this.distToPlayer(), a = this.angleToPlayer();
      this.facing = a;
      if (this.hitWall) this.orbit *= -1;
      const radial = d > 320 ? 0.7 : d < 220 ? -0.7 : 0;
      this.vx = (Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * this.orbit * 0.7) * this.speed;
      this.vy = (Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * this.orbit * 0.7) * this.speed;
    }

    updateExtra(dt) {
      if (Math.hypot(this.vx, this.vy) > 400) this.trail.push({ x: this.x, y: this.y, life: 0.25, a: this.facing });
      for (let i = this.trail.length - 1; i >= 0; i--) {
        this.trail[i].life -= dt;
        if (this.trail[i].life <= 0) this.trail.splice(i, 1);
      }
    }

    // Dash along a telegraphed line and leave a lingering lance wall behind
    *lanceDash(a, len, warn) {
      const sx = this.x, sy = this.y;
      this.facing = a;
      this.hazard({ shape: 'line', x: sx, y: sy, angle: a, length: len + this.radius, width: this.radius * 2 + 10, warn, damage: 0, color: '200,220,255' });
      this.chargeUp(warn, '#dfe8ff');
      yield warn;
      this.contactDamage = 18;
      this.game.audio.play('dash');
      yield* this.dash(a, 1250, len);
      this.contactDamage = 0;
      const tl = Geo.dist(sx, sy, this.x, this.y);
      if (tl > 30) {
        this.hazard({ shape: 'line', x: sx, y: sy, angle: a, length: tl, width: 24, warn: 0.3, damage: 6, tickInterval: 0.5,
          hitWindow: this.empowered ? 2.6 : 2.0, linger: 0.4, style: 'magic', color: '200,220,255', activeColor: '170,190,255' });
      }
    }

    *atkLunge() {
      const a = this.angleToPlayer();
      const len = Math.min(Geo.rayToArena(this.x, this.y, a, this.radius), this.distToPlayer() + 160);
      yield* this.lanceDash(a, len, this.T(0.55));
      yield 0.45;
    }

    *atkZigzag() {
      const n = this.empowered ? 6 : 4;
      let side = Math.random() < 0.5 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const a = this.angleToPlayer() + side * 0.9;
        side *= -1;
        const len = Math.min(260, Geo.rayToArena(this.x, this.y, a, this.radius));
        yield* this.lanceDash(a, Math.max(60, len), i === 0 ? this.T(0.6) : 0.4);
        yield 0.08;
      }
      yield 0.5;
    }

    *atkCross() {
      const A = C.ARENA;
      const p = this.player;
      for (const horizontal of [true, false]) {
        yield* this.fade(0, 0.18);
        if (horizontal) this.teleportTo(p.x < (A.left + A.right) / 2 ? A.right - 40 : A.left + 40, p.y, 'magic');
        else this.teleportTo(p.x, p.y < (A.top + A.bottom) / 2 ? A.bottom - 40 : A.top + 40, 'magic');
        yield* this.fade(1, 0.12);
        const a = horizontal ? (this.x > p.x ? Math.PI : 0) : (this.y > p.y ? -Math.PI / 2 : Math.PI / 2);
        yield* this.lanceDash(a, Geo.rayToArena(this.x, this.y, a, this.radius), this.T(0.7));
        yield 0.2;
      }
      yield 0.5;
    }

    *atkVolley() {
      const warn = this.T(0.6);
      this.chargeUp(warn, '#dfe8ff');
      this.hazard({ shape: 'circle', x: this.x, y: this.y, radius: this.radius + 30, warn, damage: 0, color: '200,220,255' });
      yield warn;
      const n = this.empowered ? 10 : 8, off = Math.random() * Math.PI;
      for (let i = 0; i < n; i++) this.shoot(off + (i / n) * Math.PI * 2, 260, { kind: 'bullet', radius: 7, damage: 11, life: 3, color: '200,220,255' });
      this.game.audio.play('shoot');
      yield 0.5;
    }

    // ELITE: phantom lances streak in from the edges, one after another
    *atkEliteStarfall() {
      this.stop();
      this.statusText = 'STARFALL';
      this.chargeUp(0.6, '#ffffff');
      const p = this.player;
      const base = Math.random() * Math.PI * 2;
      for (let i = 0; i < 5; i++) {
        const ang = base + (i * Math.PI * 2) / 5;
        const start = Geo.clampToArena(p.x + Math.cos(ang) * 340, p.y + Math.sin(ang) * 340, 30);
        const dir = Geo.angle(start.x, start.y, p.x, p.y);
        this.hazard({ shape: 'line', x: start.x, y: start.y, angle: dir, length: Math.max(240, Geo.rayToArena(start.x, start.y, dir, 20)),
          width: 36, warn: 0.9 + i * 0.4, damage: 16, hitWindow: 0.15, color: '200,220,255',
          onActivate: () => this.game.audio.play('dash') });
      }
      yield 0.9 + 5 * 0.4 + 0.2;
      this.statusText = '';
    }

    drawFigure(ctx, x, y, a, alpha) {
      const r = this.radius;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = '#c9d2e6';
      ctx.fillRect(r * 0.2, -2.5, r * 2.6, 5);
      ctx.beginPath();
      ctx.moveTo(r * 2.8, 0);
      ctx.lineTo(r * 2.4, -6);
      ctx.lineTo(r * 2.4, 6);
      ctx.closePath();
      ctx.fill();
      Draw.circle(ctx, 0, 0, r, '#2a3042', this.empowered ? '#ffffff' : '#9fb0d8', 2.5);
      Draw.circle(ctx, r * 0.35, 0, r * 0.45, '#5a6688');
      Draw.glow(ctx, r * 0.5, 0, 12, '200,220,255', 0.8);
      ctx.restore();
    }

    draw(ctx, time) {
      for (const t of this.trail) this.drawFigure(ctx, t.x, t.y, t.a, t.life * 1.6 * this.alpha);
      super.draw(ctx, time);
    }

    drawBody(ctx) {
      Draw.glow(ctx, this.x, this.y, this.radius * 2.4, '200,220,255', 0.35);
      this.drawFigure(ctx, this.x, this.y, this.facing, 1);
    }
  }

  BR.BossClasses.phantomLancer = PhantomLancer;
})();
