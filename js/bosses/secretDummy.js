/*
 * UNBOUND DUMMY — the easter-egg boss. Summoned by destroying the tutorial's training dummy.
 * 50000 HP, 2.5x movement speed, relentless (but still telegraphed) patterns built from the APEX kit.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;
  const A = BR.CONFIG.ARENA;
  const K = BR.ApexKit;

  class SecretDummy extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.rgb = def.rgb;
      this.speedMult = 2.5;
      this.baseSpeed = 110;
      this.speed = 110;
      this.tempoByPhase = [0.8, 0.7, 0.6, 0.5];
      this.recoveryByPhase = [0.35, 0.25, 0.18, 0.1];
      this.idleTimer = 1.2;
      this.spin = 0;
      this.orbit = 1;
      this.attacks = [
        { name: 'barrage', weight: 2, cooldown: 4, fn: function* () { yield* K.beams.call(this, this.phase >= 3 ? 13 : 10, 0.3); yield* K.rain.call(this, 12, 66); } },
        { name: 'storm', weight: 2, cooldown: 6, fn: function* () { yield* K.curtain.call(this, this.phase >= 3 ? 8 : 6, 175); } },
        { name: 'rush', weight: 2, cooldown: 4, fn: function* () { yield* K.rush.call(this, this.phase >= 3 ? 7 : 5); } },
        { name: 'rings', weight: 1.6, cooldown: 6, fn: function* () { yield* K.ringGap.call(this, 4, 28); } },
        { name: 'fan', weight: 1.6, cooldown: 4, fn: function* () { yield* K.fan.call(this, 5, 13, 330); } },
        { name: 'hell', weight: 1.8, cooldown: 7, fn: this.atkHell },
        { name: 'cross', weight: 1.8, cooldown: 6, fn: this.atkCross },
        { name: 'blink', weight: 2, cooldown: 5, fn: this.atkBlink },
        { name: 'meteors', weight: 1.6, cooldown: 6, fn: this.atkMeteors },
      ];
    }

    onPhaseChange() { this.speed *= 1.1; }

    idleMove() {
      const d = this.distToPlayer(), a = this.angleToPlayer();
      this.facing = a;
      if (this.hitWall || Math.random() < 0.01) this.orbit *= -1;
      const radial = d > 300 ? 0.9 : d < 180 ? -0.9 : 0;
      this.vx = (Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * this.orbit * 0.8) * this.speed;
      this.vy = (Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * this.orbit * 0.8) * this.speed;
    }

    updateExtra(dt) { this.spin += dt; }

    *atkHell() {
      this.stop();
      this.chargeUp(this.T(0.7), '#ff3030');
      yield this.T(0.7);
      const arms = 4, dir = Math.random() < 0.5 ? 1 : -1;
      let a = this.angleToPlayer() + Math.PI / arms;
      const steps = this.phase >= 3 ? 26 : 20;
      for (let i = 0; i < steps; i++) {
        for (let k = 0; k < arms; k++) this.shoot(a + (k * Math.PI * 2) / arms, 230, { kind: 'bullet', radius: 8, damage: 10, life: 5, color: this.rgb });
        a += dir * 0.32;
        if (i % 3 === 0) this.game.audio.play('shoot');
        yield 0.1;
      }
      yield this.T(0.8);
    }

    *atkCross() {
      this.stop();
      this.chargeUp(this.T(0.6), '#ff3030');
      yield this.T(0.6);
      const p = this.player;
      for (let r = 0; r < 2; r++) {
        const rot = Math.random() * 1.5 + (r * Math.PI) / 8;
        for (let k = 0; k < 4; k++) {
          const a = rot + (k * Math.PI) / 4;
          this.hazard({ shape: 'line', x: p.x - Math.cos(a) * 500, y: p.y - Math.sin(a) * 500, angle: a, length: 1000, width: 44, warn: this.T(1.0), damage: 17, hitWindow: 0.2, color: this.rgb });
        }
        yield this.T(0.85);
      }
      yield this.T(1.0);
    }

    *atkBlink() {
      const p = this.player, n = this.phase >= 3 ? 6 : 5;
      for (let i = 0; i < n; i++) {
        yield* this.fade(0, 0.1);
        const a = Math.random() * Math.PI * 2;
        const dest = Geo.clampToArena(p.x + Math.cos(a) * 230, p.y + Math.sin(a) * 230, this.radius + 10);
        this.hazard({ shape: 'circle', x: dest.x, y: dest.y, radius: 34, warn: 0.3, damage: 0, color: this.rgb });
        yield 0.3;
        this.teleportTo(dest.x, dest.y, 'abyss');
        yield* this.fade(1, 0.08);
        const aim = this.angleToPlayer(), warn = this.T(0.65);
        this.hazard({ shape: 'circle', x: this.x, y: this.y, radius: 160, warn, damage: 18, color: this.rgb });
        this.hazard({ shape: 'line', x: this.x, y: this.y, angle: aim, length: 700, width: 60, warn, damage: 18, hitWindow: 0.15, color: this.rgb });
        yield warn + 0.1;
      }
      yield this.T(0.6);
    }

    *atkMeteors() {
      this.stop();
      this.chargeUp(this.T(0.6), '#ff3030');
      yield this.T(0.6);
      const p = this.player, n = this.phase >= 3 ? 26 : 20;
      for (let i = 0; i < n; i++) {
        const near = i % 4 === 0;
        const t = near ? Geo.clampToArena(p.x + p.vx * 0.5 + Geo.rand(-60, 60), p.y + p.vy * 0.5 + Geo.rand(-60, 60), 50)
          : { x: Geo.rand(A.left + 50, A.right - 50), y: Geo.rand(A.top + 50, A.bottom - 50) };
        this.hazard({ shape: 'circle', x: t.x, y: t.y, radius: 66, warn: this.T(1.1), damage: 15, color: this.rgb });
        yield 0.14;
      }
      yield this.T(1.2);
    }

    drawBody(ctx, time) {
      const r = this.radius, hot = 0.6 + 0.4 * Math.sin(time * 9);
      ctx.save();
      ctx.translate(this.x, this.y);
      Draw.glow(ctx, 0, 0, r * 3.4, '255,40,40', 0.3 + 0.2 * hot);
      // orbiting nails
      for (let i = 0; i < 8; i++) {
        const a = this.spin * 1.8 + (i / 8) * Math.PI * 2;
        ctx.save();
        ctx.translate(Math.cos(a) * r * 1.9, Math.sin(a) * r * 1.9);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = '#d8d0c8';
        ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(3, 6); ctx.lineTo(-3, 6); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // wooden arms (cross beam), splintered
      ctx.save();
      ctx.rotate(Math.sin(time * 3) * 0.12);
      ctx.fillStyle = '#6a4424'; ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 3;
      ctx.fillRect(-r * 1.7, -r * 0.18, r * 3.4, r * 0.36); ctx.strokeRect(-r * 1.7, -r * 0.18, r * 3.4, r * 0.36);
      ctx.strokeStyle = '#d9c28a'; ctx.lineWidth = 2;
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(s * r * 1.7, (k - 1.5) * 5); ctx.lineTo(s * r * 2.0, (k - 1.5) * 9); ctx.stroke(); }
      ctx.restore();
      // body (straw sack head)
      const g = ctx.createRadialGradient(0, -r * 0.3, 4, 0, 0, r);
      g.addColorStop(0, '#c8a060'); g.addColorStop(1, '#4a2e14');
      Draw.circle(ctx, 0, 0, r, g, '#ff3030', 3);
      ctx.strokeStyle = `rgba(255,50,50,${0.5 + 0.4 * hot})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.5); ctx.lineTo(-r * 0.2, -r * 0.1); ctx.lineTo(-r * 0.5, r * 0.4); ctx.moveTo(r * 0.6, -r * 0.6); ctx.lineTo(r * 0.3, 0); ctx.lineTo(r * 0.7, r * 0.45); ctx.stroke();
      // glowing X eyes + stitched mouth
      Draw.glow(ctx, -r * 0.32, -r * 0.2, 14, '255,40,40', 0.9); Draw.glow(ctx, r * 0.32, -r * 0.2, 14, '255,40,40', 0.9);
      ctx.strokeStyle = '#ffeded'; ctx.lineWidth = 3;
      for (const s of [-1, 1]) { const ex = s * r * 0.32, ey = -r * 0.2; ctx.beginPath(); ctx.moveTo(ex - 6, ey - 6); ctx.lineTo(ex + 6, ey + 6); ctx.moveTo(ex + 6, ey - 6); ctx.lineTo(ex - 6, ey + 6); ctx.stroke(); }
      ctx.strokeStyle = '#1a0a04'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.35); ctx.lineTo(r * 0.4, r * 0.35); ctx.stroke();
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.12, r * 0.27); ctx.lineTo(i * r * 0.12, r * 0.43); ctx.stroke(); }
      ctx.restore();
    }
  }

  BR.BossClasses.secretDummy = SecretDummy;
})();
