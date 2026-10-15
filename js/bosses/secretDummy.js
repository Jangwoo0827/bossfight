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
      this.speedMult = 3.5;
      this.blockText = 'MISS';
      this.exhausted = 0;
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
        // Last-Breath style
        { name: 'blasters', weight: 2.4, cooldown: 6, fn: this.atkBlasters },
        { name: 'boneWave', weight: 2.4, cooldown: 6, fn: this.atkBoneWave },
        { name: 'blueOrange', weight: 2, phase: 2, cooldown: 9, fn: this.atkBlueOrange },
        { name: 'gravity', weight: 1.8, phase: 2, cooldown: 10, fn: this.atkGravity },
        { name: 'lastBreath', weight: 2.6, phase: 3, cooldown: 20, fn: this.atkLastBreath },
      ];
      this.blasters = [];
      this.gravity = 0;
      this.gravDir = [1, 0];
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

    // Sans-style: almost every normal hit is dodged. Parry counters, burns and stunned / exhausted moments always land.
    incomingMultiplier() {
      if (this.exhausted > 0) return 1.5;
      if (this.state === 'STUNNED') return 1;
      if (Math.random() < (this.phase >= 3 ? 0.94 : 0.9)) {
        const a = this.angleToPlayer() + (Math.random() < 0.5 ? 1 : -1) * Geo.rand(1.0, 2.2);
        this.teleportTo(this.x + Math.cos(a) * Geo.rand(110, 190), this.y + Math.sin(a) * Geo.rand(110, 190), 'abyss');
        return 0;
      }
      return 1;
    }

    updateExtra(dt) {
      this.spin += dt;
      this.exhausted = Math.max(0, this.exhausted - dt);
      for (let i = this.blasters.length - 1; i >= 0; i--) {
        this.blasters[i].age += dt;
        if (this.blasters[i].age > this.blasters[i].warn + 0.8) this.blasters.splice(i, 1);
      }
      if (this.gravity > 0) {
        this.gravity -= dt;
        const p = this.player;
        if (p && !p.dead && !p.isDashing) {
          const c = Geo.clampToArena(p.x + this.gravDir[0] * 300 * dt, p.y + this.gravDir[1] * 300 * dt, p.radius);
          p.x = c.x;
          p.y = c.y;
        }
      }
    }

    die() {
      super.die();
      this.blasters.length = 0;
      this.gravity = 0;
    }

    // A Gaster-Blaster style skull at the arena edge: charges, then fires a thick beam through where you were
    blaster(x, y, angle, warn) {
      this.blasters.push({ x, y, angle, age: 0, warn });
      this.hazard({ shape: 'line', x, y, angle, length: 1800, width: 84, warn, damage: 22, hitWindow: 0.45, linger: 0.2, color: '255,255,255',
        onActivate: () => { this.game.camera.shakePreset('small'); this.game.audio.play('explosion'); } });
    }

    edgePoint(fromX, fromY, ang) {
      return { x: Geo.clamp(fromX + Math.cos(ang) * 900, A.left + 14, A.right - 14), y: Geo.clamp(fromY + Math.sin(ang) * 900, A.top + 14, A.bottom - 14) };
    }

    bone(x, y, vx, vy, extra) {
      this.game.projectiles.push(new BR.Projectile(Object.assign({
        owner: 'boss', x, y, vx, vy, kind: 'bullet', radius: 10, damage: Math.round(12 * this.damageMult), life: 5, color: '255,255,255',
      }, extra || {})));
    }

    // Three rounds of blasters: a few aimed ones, a denser aimed volley, then a ring all aiming at the centre
    *atkBlasters() {
      this.stop();
      this.chargeUp(this.T(0.6), '#ffffff');
      yield this.T(0.6);
      const p = this.player;
      const aimed = (n, warn, gap) => {
        for (let i = 0; i < n; i++) {
          const e = this.edgePoint(p.x, p.y, Math.random() * Math.PI * 2);
          this.blaster(e.x, e.y, Geo.angle(e.x, e.y, p.x, p.y), warn + i * gap);
        }
      };
      aimed(3, this.T(1.0), 0.28);
      yield this.T(1.5);
      aimed(this.phase >= 3 ? 6 : 5, this.T(0.95), 0.2);
      yield this.T(1.6);
      const cx = (A.left + A.right) / 2, cy = (A.top + A.bottom) / 2, off = Math.random() * 6;
      const n = this.phase >= 3 ? 10 : 8;
      for (let i = 0; i < n; i++) {
        const e = this.edgePoint(cx, cy, off + (i / n) * Math.PI * 2);
        this.blaster(e.x, e.y, Geo.angle(e.x, e.y, cx, cy), this.T(1.2));
      }
      yield this.T(2.0);
    }

    // A wall of bones sweeps across with a gap near you; walls alternate sides (and axes later)
    *atkBoneWave() {
      this.stop();
      this.chargeUp(this.T(0.5), '#ffffff');
      yield this.T(0.5);
      const p = this.player, n = this.phase >= 3 ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const vertical = this.phase >= 3 ? i % 2 === 0 : true;
        if (vertical) {
          const dirX = i % 2 === 0 ? 1 : -1;
          const x = dirX > 0 ? A.left + 12 : A.right - 12;
          const gy = Geo.clamp(p.y + Geo.rand(-200, 200), A.top + 90, A.bottom - 90);
          this.hazard({ shape: 'line', x, y: A.top, angle: Math.PI / 2, length: A.bottom - A.top, width: 14, warn: 0.5, damage: 0, color: '255,255,255' });
          for (let y = A.top + 18; y < A.bottom; y += 38) if (Math.abs(y - gy) >= 78) this.bone(x, y, dirX * (340 + i * 14), 0);
        } else {
          const dirY = (i >> 1) % 2 === 0 ? 1 : -1;
          const y = dirY > 0 ? A.top + 12 : A.bottom - 12;
          const gx = Geo.clamp(p.x + Geo.rand(-200, 200), A.left + 90, A.right - 90);
          this.hazard({ shape: 'line', x: A.left, y, angle: 0, length: A.right - A.left, width: 14, warn: 0.5, damage: 0, color: '255,255,255' });
          for (let x = A.left + 18; x < A.right; x += 38) if (Math.abs(x - gx) >= 78) this.bone(x, y, 0, dirY * 330);
        }
        this.game.audio.play('shoot');
        yield this.T(0.95);
      }
      yield this.T(1.4);
    }

    // Blue bones hurt only if you MOVE, orange ones only if you STAND STILL
    *atkBlueOrange() {
      this.stop();
      this.chargeUp(this.T(0.6), '#4ab0ff');
      let blue = Math.random() < 0.5;
      yield this.T(0.6);
      for (let i = 0; i < 6; i++) {
        this.statusText = blue ? 'BLUE — STAND STILL' : 'ORANGE — KEEP MOVING';
        const dirX = i % 2 === 0 ? 1 : -1, x = dirX > 0 ? A.left + 12 : A.right - 12;
        const rgb = blue ? '80,170,255' : '255,160,50';
        this.hazard({ shape: 'line', x, y: A.top, angle: Math.PI / 2, length: A.bottom - A.top, width: 18, warn: 0.7, damage: 0, color: rgb });
        yield 0.7;
        for (let y = A.top + 18; y < A.bottom; y += 36) {
          this.bone(x, y, dirX * 500, 0, { radius: 11, damage: Math.round(14 * this.damageMult), life: 3, color: rgb, mode: blue ? 'blue' : 'orange', unclearable: true });
        }
        blue = !blue;
        yield this.T(1.3);
      }
      this.statusText = '';
      yield this.T(0.6);
    }

    // Gravity: you are dragged toward a side wall while its spike strip charges
    *atkGravity() {
      this.stop();
      const right = Math.random() < 0.5, x0 = right ? A.right - 120 : A.left;
      this.chargeUp(this.T(0.6), '#4a6bff');
      this.statusText = right ? 'GRAVITY →' : 'GRAVITY ←';
      yield this.T(0.6);
      this.hazard({ shape: 'rect', x: x0, y: A.top, w: 120, h: A.bottom - A.top, warn: 1.8, damage: 20, color: '90,120,255', linger: 0.4 });
      this.gravDir = [right ? 1 : -1, 0];
      yield 0.3;
      this.gravity = 0.8;
      yield 1.8;
      this.statusText = '';
      const p = this.player;
      for (let i = 0; i < 2; i++) {
        const e = this.edgePoint(p.x, p.y, Math.random() * Math.PI * 2);
        this.blaster(e.x, e.y, Geo.angle(e.x, e.y, p.x, p.y), this.T(1.0) + i * 0.3);
      }
      yield this.T(1.8);
    }

    // The finale: everything, back to back, no breathing room
    *atkLastBreath() {
      this.statusText = 'LAST BREATH';
      yield* this.atkBoneWave();
      yield 0.15;
      yield* this.atkBlasters();
      yield 0.15;
      yield* this.atkBlueOrange();
      yield 0.15;
      yield* this.atkGravity();
      yield 0.15;
      yield* this.atkBlasters();
      // ...and then it runs out of breath
      this.stop();
      this.exhausted = 4;
      this.statusText = 'EXHAUSTED — HIT NOW!';
      yield 4;
      this.statusText = '';
    }

    draw(ctx, time) {
      for (const b of this.blasters) {
        const open = Math.min(1, Math.max(0, (b.age - b.warn + 0.12) / 0.2));
        const pulse = Math.min(1, b.age / b.warn);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        Draw.glow(ctx, 8, 0, 40, '255,255,255', 0.25 + 0.5 * pulse);
        ctx.fillStyle = '#f4f4f4'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, 24, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(8, -7, 4, 0, Math.PI * 2); ctx.arc(8, 7, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(90,200,255,${0.4 + 0.6 * pulse})`;
        ctx.beginPath(); ctx.arc(8, -7, 2, 0, Math.PI * 2); ctx.arc(8, 7, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(14, -9 - open * 6, 12, 5); ctx.fillRect(14, 4 + open * 6, 12, 5);
        ctx.restore();
      }
      super.draw(ctx, time);
    }

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
