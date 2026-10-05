/*
 * STORM CALLER
 * Lesson: navigate a changing lattice and never stand still.
 * Lightning arcs between lightning rods (pylons); Storm Marks strike where you stand.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;
  const C = BR.CONFIG;

  // Jagged lightning bolt visual between two points
  class LightningFx {
    constructor(x1, y1, x2, y2, life = 0.25, width = 3) {
      this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
      this.life = life; this.maxLife = life; this.width = width;
      this.dead = false;
      this.points = this._build();
    }
    _build() {
      const pts = [];
      const steps = Math.max(4, Math.round(Geo.dist(this.x1, this.y1, this.x2, this.y2) / 28));
      const nx = -(this.y2 - this.y1), ny = this.x2 - this.x1;
      const len = Math.hypot(nx, ny) || 1;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const off = i === 0 || i === steps ? 0 : (Math.random() - 0.5) * 26;
        pts.push([Geo.lerp(this.x1, this.x2, t) + (nx / len) * off, Geo.lerp(this.y1, this.y2, t) + (ny / len) * off]);
      }
      return pts;
    }
    update(dt) {
      this.life -= dt;
      if (Math.random() < 0.5) this.points = this._build();
      if (this.life <= 0) this.dead = true;
    }
    draw(ctx) {
      const a = Math.max(0, this.life / this.maxLife);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round';
      for (const [w, col] of [[this.width * 3.5, `rgba(255,220,90,${0.25 * a})`], [this.width, `rgba(255,255,230,${a})`]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        this.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  class StormCaller extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 85;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [1, 0.85];
      this.recoveryByPhase = [0.75, 0.5];
      this.idleTimer = 1.2;
      const A = C.ARENA;
      const w = A.right - A.left, h = A.bottom - A.top;
      this.pylons = [
        { x: A.left + w * 0.2, y: A.top + h * 0.25 },
        { x: A.left + w * 0.8, y: A.top + h * 0.25 },
        { x: A.left + w * 0.2, y: A.top + h * 0.75 },
        { x: A.left + w * 0.8, y: A.top + h * 0.75 },
      ];
      this.extraPylons = [
        { x: A.left + w * 0.5, y: A.top + h * 0.12 },
        { x: A.left + w * 0.5, y: A.top + h * 0.88 },
      ];

      this.attacks = [
        { name: 'conduit', weight: 2.4, cooldown: 3.2, fn: this.atkConduit },
        { name: 'marks', weight: 2, cooldown: 4, fn: this.atkStormMarks },
        { name: 'balls', weight: 1.5, cooldown: 6, fn: this.atkBallLightning },
        { name: 'slam', weight: (b, d) => (d < 220 ? 5 : 0), cooldown: 3, fn: this.atkThunderSlam },
        { name: 'beam', weight: 2, cooldown: 2, minRange: 160, fn: this.atkBeam },
        { name: 'elite', weight: 1.6, cooldown: 8, elite: true, fn: this.atkEliteStorm },
      ];
    }

    get empowered() { return this.phase >= 2; }

    onPhaseChange() {
      this.speed = 105;
      for (const p of this.extraPylons) {
        this.pylons.push(p);
        this.game.effects.push(new LightningFx(p.x, C.ARENA.top - 60, p.x, p.y, 0.5, 5));
        this.game.particles.emit('lightning', p.x, p.y, 20);
      }
    }

    idleMove() {
      const d = this.distToPlayer();
      const a = this.angleToPlayer();
      this.facing = a;
      const radial = d > 330 ? 0.8 : d < 220 ? -0.8 : 0;
      const tangent = Math.sin(this.time * 0.9) * 0.7;
      this.vx = (Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * tangent) * this.speed;
      this.vy = (Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * tangent) * this.speed;
    }

    updateExtra(dt) {
      if (Math.random() < dt * 6) {
        const p = Geo.pick(this.pylons);
        this.game.particles.emit('staticMote', p.x, p.y - 26, 1);
      }
      if (Math.random() < dt * 8) this.game.particles.emit('lightning', this.x + Geo.rand(-25, 25), this.y + Geo.rand(-25, 25), 1, { speedMult: 0.3 });
    }

    strikeFx(x, y, r) {
      this.game.effects.push(new LightningFx(x + Geo.rand(-40, 40), C.ARENA.top - 80, x, y, 0.28, 4));
      this.game.effects.push(new BR.RingFx({ x, y, r0: r * 0.3, r1: r, color: '255,240,140', width: 8, life: 0.3 }));
      this.game.particles.emit('lightning', x, y, 12, { radius: r * 0.4 });
      this.game.audio.play('explosion');
    }

    /* ---- attacks ---- */
    *atkConduit() {
      const waves = this.empowered ? 2 : 1;
      const warn = this.T(1.05);
      this.chargeUp(warn, '#ffe27a');
      for (let w = 0; w < waves; w++) {
        // Random distinct pylon pairs
        const pairs = [];
        const count = this.empowered ? 3 : 2;
        for (let tries = 0; tries < 30 && pairs.length < count; tries++) {
          const i = Geo.randInt(0, this.pylons.length - 1), j = Geo.randInt(0, this.pylons.length - 1);
          if (i === j || pairs.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) continue;
          pairs.push([i, j]);
        }
        for (const [i, j] of pairs) {
          const a = this.pylons[i], b = this.pylons[j];
          this.hazard({
            shape: 'line', x: a.x, y: a.y, angle: Geo.angle(a.x, a.y, b.x, b.y), length: Geo.dist(a.x, a.y, b.x, b.y),
            width: 34, warn: warn + w * 0.9, damage: 18, hitWindow: 0.25, linger: 0.2, style: 'storm', color: '255,220,90',
            onActivate: () => {
              this.game.effects.push(new LightningFx(a.x, a.y, b.x, b.y, 0.45, 4));
              this.game.audio.play('explosion');
              this.game.camera.shakePreset('small');
            },
          });
        }
      }
      yield warn + (waves - 1) * 0.9 + 0.3;
    }

    *atkStormMarks() {
      const n = this.empowered ? 6 : 4;
      this.chargeUp(0.4, '#fff3a0');
      this.statusText = 'KEEP MOVING';
      yield 0.4;
      for (let i = 0; i < n; i++) {
        const p = this.player;
        this.hazard({
          shape: 'circle', x: p.x, y: p.y, radius: 66, warn: 0.75, damage: 14, style: 'storm', color: '255,220,90',
          onActivate: (h) => this.strikeFx(h.x, h.y, 66),
        });
        yield this.empowered ? 0.32 : 0.4;
      }
      this.statusText = '';
      yield 0.6;
    }

    *atkBallLightning() {
      const n = this.empowered ? 4 : 3;
      const warn = this.T(0.6);
      const a = this.angleToPlayer();
      const angles = [];
      for (let i = 0; i < n; i++) angles.push(a + (i - (n - 1) / 2) * 0.55);
      for (const ang of angles) this.hazard({ shape: 'line', x: this.x, y: this.y, angle: ang, length: 300, width: 26, warn, damage: 0, color: '255,220,90' });
      this.chargeUp(warn, '#ffe27a');
      yield warn;
      for (const ang of angles) this.shoot(ang, 210, { kind: 'lightning', radius: 13, damage: 12, life: 6, bounces: 3 });
      this.game.audio.play('shoot');
      yield 0.5;
    }

    *atkThunderSlam() {
      const warn = this.T(0.8);
      const radius = 180;
      this.chargeUp(warn, '#fff6c0');
      this.tremble = warn;
      this.hazard({ shape: 'circle', x: this.x, y: this.y, radius, warn, damage: 20, style: 'storm', color: '255,220,90' });
      yield warn;
      this.strikeFx(this.x, this.y, radius);
      this.game.camera.shakePreset('medium');
      // Follow-up ring: starts a beat later from the boss and has an opening toward the player,
      // because anyone who dashed out of the slam has no dash left for a ring right behind it.
      yield 0.35;
      this.hazard({
        shape: 'ring', x: this.x, y: this.y, radius: this.radius, width: 26, growSpeed: 330, maxRadius: 760,
        warn: 0, noMinWarn: true, damage: 14, linger: 0.2, style: 'storm',
        gapAngle: this.angleToPlayer(), gapArc: 1.2,
      });
      yield 0.6;
    }

    *atkBeam() {
      const a = this.angleToPlayer();
      const len = Geo.rayToArena(this.x, this.y, a, 0);
      const warn = this.T(0.65);
      this.chargeUp(warn, '#ffe27a');
      const angles = this.empowered ? [a, a - 0.4, a + 0.4] : [a];
      angles.forEach((ang, i) => {
        const l = Geo.rayToArena(this.x, this.y, ang, 0);
        this.hazard({
          shape: 'line', x: this.x, y: this.y, angle: ang, length: i === 0 ? len : l, width: 36,
          warn: warn + (i === 0 ? 0 : 0.45), damage: 20, hitWindow: 0.15, linger: 0.25, style: 'storm', color: '255,220,90',
          onActivate: (h) => {
            const [x1, y1, x2, y2] = h.endpoints();
            this.game.effects.push(new LightningFx(x1, y1, x2, y2, 0.3, 5));
            this.game.audio.play('explosion');
            this.game.camera.shakePreset('small');
          },
        });
      });
      yield warn + (this.empowered ? 0.45 : 0) + 0.35;
    }

    // ELITE: the whole lattice lights up — every pylon links to its neighbours and to the caller
    *atkEliteStorm() {
      this.stop();
      const warn = this.T(1.3);
      this.statusText = 'FULL STORM';
      this.chargeUp(warn, '#ffffff');
      const links = [];
      const sorted = this.pylons.slice().sort((a, b) => Math.atan2(a.y - 368, a.x - 640) - Math.atan2(b.y - 368, b.x - 640));
      for (let i = 0; i < sorted.length; i++) links.push([sorted[i], sorted[(i + 1) % sorted.length]]);
      for (let i = 0; i < sorted.length; i += 2) links.push([{ x: this.x, y: this.y }, sorted[i]]);
      for (const [a, b] of links) {
        this.hazard({
          shape: 'line', x: a.x, y: a.y, angle: Geo.angle(a.x, a.y, b.x, b.y), length: Geo.dist(a.x, a.y, b.x, b.y),
          width: 30, warn, damage: 18, hitWindow: 0.25, linger: 0.2, style: 'storm', color: '255,220,90',
          onActivate: () => this.game.effects.push(new LightningFx(a.x, a.y, b.x, b.y, 0.45, 4)),
        });
      }
      yield warn;
      this.game.camera.shakePreset('medium');
      this.game.audio.play('explosion');
      this.statusText = '';
      yield 0.7;
    }

    /* ---- drawing ---- */
    draw(ctx, time) {
      for (const p of this.pylons) {
        Draw.shadow(ctx, p.x, p.y + 12, 18, 7, 0.4);
        ctx.fillStyle = '#3b4054';
        ctx.strokeStyle = '#1b1d26';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - 12, p.y + 10);
        ctx.lineTo(p.x - 5, p.y - 26);
        ctx.lineTo(p.x + 5, p.y - 26);
        ctx.lineTo(p.x + 12, p.y + 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        Draw.glow(ctx, p.x, p.y - 28, 22, '255,230,120', 0.6 + 0.3 * Math.sin(time * 7 + p.x));
        Draw.circle(ctx, p.x, p.y - 28, 5, '#fff7c8');
      }
      super.draw(ctx, time);
    }

    drawBody(ctx, time) {
      const r = this.radius;
      ctx.save();
      ctx.translate(this.x, this.y);
      Draw.glow(ctx, 0, 0, r * 2.4, '255,220,90', 0.3 + 0.1 * Math.sin(time * 9));
      // Orbiting sparks
      for (let i = 0; i < 3; i++) {
        const a = time * 3 + (i * Math.PI * 2) / 3;
        Draw.glow(ctx, Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5, 10, '255,240,150', 0.9);
      }
      ctx.rotate(this.facing);
      const body = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 3, 0, 0, r);
      body.addColorStop(0, '#4b5677');
      body.addColorStop(1, '#151927');
      Draw.circle(ctx, 0, 0, r, body, '#ffe27a', 2.5);
      // Shoulder coils
      Draw.circle(ctx, -r * 0.1, -r * 0.85, r * 0.35, '#2a2f42', '#ffe27a', 2);
      Draw.circle(ctx, -r * 0.1, r * 0.85, r * 0.35, '#2a2f42', '#ffe27a', 2);
      // Lightning rune
      ctx.strokeStyle = this.empowered ? '#ffffff' : '#ffe27a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.3);
      ctx.lineTo(0, r * 0.05);
      ctx.lineTo(-r * 0.15, r * 0.15);
      ctx.lineTo(r * 0.45, r * 0.4);
      ctx.stroke();
      // Visor
      Draw.circle(ctx, r * 0.55, 0, r * 0.28, '#0b0d14', '#ffe27a', 1.5);
      Draw.glow(ctx, r * 0.6, 0, 14, '255,240,150', 0.9);
      ctx.restore();
    }
  }

  BR.BossClasses.stormCaller = StormCaller;
})();
