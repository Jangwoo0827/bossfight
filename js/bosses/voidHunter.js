/*
 * BOSS 4 — VOID HUNTER
 * Fast assassin. Short (but always present) telegraphs; tests reactions and dash discipline.
 * Clones are not enemies: they are moving telegraphed lines.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;

  class VoidHunter extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 230;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [1, 0.85];
      this.recoveryByPhase = [0.5, 0.34];
      this.orbitDir = 1;
      this.orbitTimer = 1.5;
      this.trail = [];
      this.clones = [];
      this.idleTimer = 1.0;

      this.attacks = [
        { name: 'dashStrike', weight: 3, cooldown: 1.4, fn: this.atkDashStrike },
        { name: 'triple', weight: 2.2, cooldown: 1.6, minRange: 140, fn: this.atkTriple },
        { name: 'clone', weight: 1.3, cooldown: 7, fn: this.atkClone },
        { name: 'teleportSlash', weight: 1.6, cooldown: 3.5, fn: this.atkTeleportSlash },
        { name: 'voidField', weight: 1, cooldown: 9, fn: this.atkVoidField },
      ];
    }

    get empowered() { return this.phase >= 2; }

    onPhaseChange() {
      this.speed = 270;
    }

    idleMove(dt) {
      const d = this.distToPlayer();
      const a = this.angleToPlayer();
      this.facing = a;
      this.orbitTimer -= dt;
      if (this.orbitTimer <= 0 || this.hitWall) { this.orbitDir *= -1; this.orbitTimer = Geo.rand(0.8, 1.8); }
      const radial = d > 260 ? 0.7 : d < 190 ? -0.7 : 0;
      this.vx = (Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * this.orbitDir) * this.speed;
      this.vy = (Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * this.orbitDir) * this.speed;
    }

    updateExtra(dt) {
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > 150 && this.alpha > 0.5) this.trail.push({ x: this.x, y: this.y, life: 0.25, a: this.facing });
      for (let i = this.trail.length - 1; i >= 0; i--) {
        this.trail[i].life -= dt;
        if (this.trail[i].life <= 0) this.trail.splice(i, 1);
      }
      for (let i = this.clones.length - 1; i >= 0; i--) {
        const c = this.clones[i];
        c.t += dt;
        if (c.state === 'appear') {
          c.alpha = Math.min(0.75, c.alpha + dt * 3);
        } else if (c.state === 'dash') {
          const k = Math.min(1, c.t / c.dashTime);
          c.x = Geo.lerp(c.sx, c.ex, k);
          c.y = Geo.lerp(c.sy, c.ey, k);
          this.game.particles.emit('void', c.x, c.y, 1);
          if (k >= 1) { c.state = 'fade'; c.t = 0; }
        } else if (c.state === 'fade') {
          c.alpha -= dt * 3;
          if (c.alpha <= 0) this.clones.splice(i, 1);
        }
      }
    }

    die() {
      super.die();
      this.clones.length = 0;
    }

    voidSlash(x, y, radius) {
      this.game.effects.push(new BR.SlashFx({ x, y, angle: Math.random() * 6, radius, arc: Math.PI * 1.6, color: '170,110,255', width: 18, life: 0.22 }));
      this.game.particles.emit('void', x, y, 18, { radius: radius * 0.6 });
      this.game.camera.shakePreset('small');
      this.game.audio.play('swing');
    }

    /* ---- attacks ---- */
    *atkDashStrike() {
      const reps = this.empowered ? 3 : 1;
      for (let i = 0; i < reps; i++) {
        const a = this.angleToPlayer();
        this.facing = a;
        const len = Math.min(Geo.rayToArena(this.x, this.y, a, this.radius), this.distToPlayer() + 170);
        const warn = i === 0 ? this.T(0.5) : 0.4;
        this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a, length: len + this.radius, width: this.radius * 2 + 8, warn, damage: 0, color: '190,90,255' });
        this.chargeUp(warn, '#b070ff');
        this.game.audio.play('telegraph');
        yield warn;
        this.contactDamage = 18;
        this.game.audio.play('dash');
        yield* this.dash(a, 1300, len);
        this.contactDamage = 0;
        this.voidSlash(this.x, this.y, 50);
        yield 0.1;
      }
      // Overextended: punish window
      yield 0.55;
    }

    *atkTriple() {
      const volleys = this.empowered ? 2 : 1;
      for (let v = 0; v < volleys; v++) {
        const a = this.angleToPlayer();
        this.facing = a;
        const spreads = this.empowered ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.3, 0, 0.3];
        const warn = this.T(0.42);
        for (const s of spreads) {
          this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a + s, length: 560, width: 22, warn, damage: 0, color: '190,90,255' });
        }
        this.chargeUp(warn, '#9b6bff');
        yield warn;
        for (const s of spreads) this.shoot(a + s, 470, { kind: 'void', radius: 9, damage: 11, life: 2.5 });
        this.game.audio.play('shoot');
        yield 0.3;
      }
      yield 0.25;
    }

    *atkClone() {
      const n = this.empowered ? 3 : 2;
      const base = Math.random() * Math.PI * 2;
      const p = this.player;
      this.chargeUp(0.4, '#c090ff');
      this.statusText = 'CLONES';
      yield 0.3;
      for (let i = 0; i < n; i++) {
        const ang = base + (i * Math.PI * 2) / n;
        const start = Geo.clampToArena(p.x + Math.cos(ang) * 280, p.y + Math.sin(ang) * 280, 30);
        const dir = Geo.angle(start.x, start.y, p.x, p.y);
        const len = Math.max(200, Geo.rayToArena(start.x, start.y, dir, 20));
        const warn = 0.9 + i * 0.3;
        const clone = {
          x: start.x, y: start.y, sx: start.x, sy: start.y,
          ex: start.x + Math.cos(dir) * len, ey: start.y + Math.sin(dir) * len,
          angle: dir, alpha: 0, t: 0, state: 'appear', dashTime: 0.16,
        };
        this.clones.push(clone);
        this.game.particles.emit('void', start.x, start.y, 10, { radius: 14 });
        this.hazard({
          shape: 'line', x: start.x, y: start.y, angle: dir, length: len, width: 40, warn, damage: 16,
          hitWindow: clone.dashTime, color: '190,90,255', style: 'void',
          onActivate: () => { clone.state = 'dash'; clone.t = 0; this.game.audio.play('dash'); },
        });
      }
      this.statusText = '';
      yield 0.9 + n * 0.3 + 0.2;
    }

    *atkTeleportSlash() {
      const reps = this.empowered ? 2 : 1;
      for (let i = 0; i < reps; i++) {
        yield* this.fade(0, 0.15);
        const p = this.player;
        const cx = p.x, cy = p.y;
        const warn = this.empowered ? 0.55 : this.T(0.7);
        const radius = 100;
        this.hazard({ shape: 'circle', x: cx, y: cy, radius, warn, damage: 20, color: '200,100,255', activeColor: '170,110,255' });
        this.game.audio.play('teleport');
        yield warn * 0.55;
        const side = Math.random() * Math.PI * 2;
        this.teleportTo(cx + Math.cos(side) * 120, cy + Math.sin(side) * 120, 'void');
        this.facing = Geo.angle(this.x, this.y, cx, cy);
        yield* this.fade(1, 0.12);
        yield Math.max(0, warn * 0.45 - 0.12);
        this.voidSlash(cx, cy, radius * 0.9);
        yield 0.3;
      }
      yield 0.35;
    }

    *atkVoidField() {
      const n = this.empowered ? 5 : 3;
      const p = this.player;
      const warn = this.T(0.85);
      this.chargeUp(warn, '#7030ff');
      for (let i = 0; i < n; i++) {
        const spot = i === 0
          ? { x: p.x, y: p.y }
          : Geo.clampToArena(p.x + Geo.rand(-260, 260), p.y + Geo.rand(-200, 200), 60);
        this.hazard({
          shape: 'circle', x: spot.x, y: spot.y, radius: 85, warn: warn + i * 0.08, damage: 5,
          tickInterval: 0.45, hitWindow: 5, linger: 0.5, slow: 0.5, style: 'void', color: '170,80,255',
        });
      }
      yield 0.5;
    }

    /* ---- drawing ---- */
    drawFigure(ctx, x, y, angle, alpha, time, ghost) {
      const r = this.radius;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(x, y);
      Draw.glow(ctx, 0, 0, r * 2.4, ghost ? '170,110,255' : '120,60,255', ghost ? 0.4 : 0.5);
      ctx.rotate(angle);
      // Cloak (diamond)
      ctx.fillStyle = ghost ? 'rgba(120,80,220,0.6)' : '#1c1030';
      ctx.strokeStyle = this.empowered ? '#e0b0ff' : '#9b6bff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(r * 1.25, 0);
      ctx.lineTo(-r * 0.2, -r * 1.1);
      ctx.lineTo(-r * 1.2, 0);
      ctx.lineTo(-r * 0.2, r * 1.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Twin blades
      ctx.fillStyle = '#d9c4ff';
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(r * 0.2, s * r * 0.85);
        ctx.rotate(s * 0.5);
        ctx.fillRect(0, -2, r * 1.3, 4);
        ctx.restore();
      }
      // Eyes
      Draw.circle(ctx, r * 0.5, -r * 0.22, 3, '#f0d0ff');
      Draw.circle(ctx, r * 0.5, r * 0.22, 3, '#f0d0ff');
      ctx.restore();
    }

    draw(ctx, time) {
      for (const t of this.trail) {
        this.drawFigure(ctx, t.x, t.y, t.a, t.life * 1.6 * this.alpha, time, true);
      }
      for (const c of this.clones) this.drawFigure(ctx, c.x, c.y, c.angle, c.alpha, time, true);
      super.draw(ctx, time);
    }

    drawBody(ctx, time) {
      this.drawFigure(ctx, this.x, this.y, this.facing, 1, time, false);
    }
  }

  BR.BossClasses.voidHunter = VoidHunter;
})();
