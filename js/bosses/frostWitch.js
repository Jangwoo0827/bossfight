/*
 * FROST WITCH
 * Lesson: target priority. Crystal Shield makes her immune while a Blizzard charges;
 * break all crystals before it completes and she shatters (long stun).
 * Frost fields slow you, frost lanes force reading the one safe row.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;
  const C = BR.CONFIG;

  const CRYSTAL_HP = 60;
  const CRYSTAL_COUNT = 3;

  class FrostWitch extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 100;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [1, 0.85];
      this.recoveryByPhase = [0.7, 0.5];
      this.orbitDir = 1;
      this.orbitTimer = 2;
      this.shielded = false;
      this.idleTimer = 1.2;

      this.attacks = [
        { name: 'shards', weight: 3, cooldown: 1.2, fn: this.atkShards },
        { name: 'lanes', weight: 1.6, cooldown: 6, fn: this.atkLanes },
        { name: 'nova', weight: (b, d) => (d < 200 ? 5 : 0.5), cooldown: 3, fn: this.atkNova },
        { name: 'orb', weight: 1.8, cooldown: 4, fn: this.atkOrb },
        { name: 'shield', weight: 1.2, cooldown: 16, phase: 2, fn: this.atkCrystalShield },
      ];
    }

    get empowered() { return this.phase >= 2; }

    onPhaseChange() {
      this.speed = 120;
      this.cooldowns.shield = this.time + 12; // transition already performs one shield
    }

    *phaseTransition(phase) {
      yield* super.phaseTransition(phase);
      yield* this.atkCrystalShield();
    }

    idleMove(dt) {
      const d = this.distToPlayer();
      const a = this.angleToPlayer();
      this.facing = a;
      this.orbitTimer -= dt;
      if (this.orbitTimer <= 0 || this.hitWall) { this.orbitDir *= -1; this.orbitTimer = Geo.rand(1.6, 3); }
      const radial = d < 260 ? -0.9 : d > 400 ? 0.7 : 0;
      this.vx = (Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * 0.6 * this.orbitDir) * this.speed;
      this.vy = (Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * 0.6 * this.orbitDir) * this.speed;
    }

    updateExtra(dt) {
      for (const c of this.extraTargets) c.flash = Math.max(0, (c.flash || 0) - dt * 6);
      if (Math.random() < dt * 10) this.game.particles.emit('snow', this.x + Geo.rand(-20, 20), this.y + Geo.rand(-20, 20), 1);
    }

    shatterFx(x, y, r) {
      this.game.particles.emit('ice', x, y, Math.round(r / 5), { radius: r * 0.5 });
      this.game.effects.push(new BR.RingFx({ x, y, r0: r * 0.3, r1: r, color: '170,230,255', width: 8, life: 0.35 }));
      this.game.audio.play('explosion');
    }

    burstShards(x, y, count, speed, offset = 0) {
      for (let i = 0; i < count; i++) {
        const a = offset + (i / count) * Math.PI * 2;
        const p = new BR.Projectile({ owner: 'boss', kind: 'ice', x, y, angle: a, speed, radius: 7, damage: Math.round(10 * this.damageMult), life: 3 });
        this.game.projectiles.push(p);
      }
    }

    /* ---- attacks ---- */
    *atkShards() {
      const fans = this.empowered ? 2 : 1;
      for (let f = 0; f < fans; f++) {
        const a = this.angleToPlayer();
        const count = this.empowered ? 9 : 7;
        const spread = 0.95;
        const warn = f === 0 ? this.T(0.55) : 0.4;
        for (let i = 0; i < count; i++) {
          const ang = a + (i / (count - 1) - 0.5) * spread;
          this.hazard({ shape: 'line', x: this.x, y: this.y, angle: ang, length: 520, width: 16, warn, damage: 0, color: '150,210,255' });
        }
        this.chargeUp(warn, '#9ad8ff');
        yield warn;
        for (let i = 0; i < count; i++) {
          const ang = a + (i / (count - 1) - 0.5) * spread;
          this.shoot(ang, 400, { kind: 'ice', radius: 8, damage: 11, life: 2.4 });
        }
        this.game.audio.play('shoot');
        yield 0.3;
      }
      yield this.T(0.3);
    }

    *atkLanes() {
      const A = C.ARENA;
      const waves = this.empowered ? 2 : 1;
      const vertical = Math.random() < 0.4;
      const lanes = vertical ? 7 : 5;
      const span = vertical ? A.right - A.left : A.bottom - A.top;
      const size = span / lanes;
      const warn = this.T(1.2);
      let safe = Geo.randInt(0, lanes - 1);
      this.chargeUp(warn, '#bfe8ff');
      this.statusText = 'FIND THE SAFE LANE';
      for (let w = 0; w < waves; w++) {
        if (w > 0) {
          let next = safe;
          while (next === safe) next = Geo.randInt(0, lanes - 1);
          safe = next;
        }
        for (let i = 0; i < lanes; i++) {
          if (i === safe) continue;
          const rect = vertical
            ? { x: A.left + i * size + 2, y: A.top + 2, w: size - 4, h: A.bottom - A.top - 4 }
            : { x: A.left + 2, y: A.top + i * size + 2, w: A.right - A.left - 4, h: size - 4 };
          this.hazard(Object.assign({
            shape: 'rect', warn: warn + w * 1.0, damage: 20, style: 'ice', color: '150,210,255', linger: 0.4,
            onActivate: i === (safe + 1) % lanes ? () => { this.game.camera.shakePreset('medium'); this.game.audio.play('explosion'); } : null,
          }, rect));
        }
      }
      yield warn + (waves - 1) * 1.0;
      this.statusText = '';
      yield 0.5;
    }

    *atkNova() {
      const radius = 170;
      const warn = this.T(0.8);
      this.chargeUp(warn, '#e0f6ff');
      this.hazard({
        shape: 'circle', x: this.x, y: this.y, radius, warn, damage: 18, style: 'ice', color: '150,210,255',
        onActivate: (h, game) => {
          this.shatterFx(h.x, h.y, radius);
          game.camera.shakePreset('small');
          // Lingering frost field: slows and chips
          this.hazard({
            shape: 'circle', x: h.x, y: h.y, radius, warn: 0, noMinWarn: true, damage: 3, tickInterval: 0.5,
            hitWindow: 3, linger: 0.5, slow: 0.45, style: 'ice', color: '150,210,255',
          });
        },
      });
      yield warn + 0.4;
    }

    *atkOrb() {
      const orbs = this.empowered ? 2 : 1;
      for (let i = 0; i < orbs; i++) {
        const a = this.angleToPlayer() + (orbs > 1 ? (i - 0.5) * 0.7 : 0);
        this.chargeUp(0.45, '#9ad8ff');
        yield 0.45;
        this.shoot(a, 140, {
          kind: 'frostOrb', radius: 20, damage: 16, life: 2.0,
          onExpire: (p) => {
            this.shatterFx(p.x, p.y, 60);
            this.burstShards(p.x, p.y, 10, 250, Math.random());
          },
        });
        this.game.audio.play('shoot');
        yield 0.25;
      }
      yield this.T(0.5);
    }

    *atkCrystalShield() {
      this.stop();
      const A = C.ARENA;
      // Spread the crystals out: one per region away from the witch
      const crystals = [];
      for (let i = 0; i < CRYSTAL_COUNT; i++) {
        let spot = null;
        for (let tries = 0; tries < 20; tries++) {
          const s = this.randomArenaPoint(90);
          const ok = Geo.dist(s.x, s.y, this.x, this.y) > 220 && crystals.every((c) => Geo.dist(s.x, s.y, c.x, c.y) > 260);
          spot = s;
          if (ok) break;
        }
        const crystal = {
          x: spot.x, y: spot.y, radius: 20, hp: CRYSTAL_HP, maxHp: CRYSTAL_HP, dead: false, flash: 0, particle: 'ice',
          onDestroy: (c) => { this.shatterFx(c.x, c.y, 70); this.game.camera.shakePreset('small'); },
        };
        crystals.push(crystal);
        this.game.particles.emit('ice', spot.x, spot.y, 14, { radius: 16 });
      }
      this.extraTargets = crystals;
      this.shielded = true;
      this.invulnerable = true;
      this.statusText = 'BREAK THE CRYSTALS';
      this.game.audio.play('bossPhase');

      const channel = this.empowered ? 6.0 : 6.5;
      const blizzard = this.hazard({
        shape: 'rect', x: A.left, y: A.top, w: A.right - A.left, h: A.bottom - A.top, warn: channel, damage: 32,
        style: 'ice', color: '150,210,255', linger: 0.8,
        onActivate: () => {
          this.game.camera.shakePreset('big');
          this.game.flash = 0.7;
          this.game.flashColor = '200,240,255';
          this.game.audio.play('explosion');
        },
      });

      let t = 0, nextFan = 1.2, broken = false;
      while (t < channel) {
        yield 0;
        t += this.dt;
        if (crystals.every((c) => c.dead)) { broken = true; break; }
        if (t >= nextFan) {
          nextFan += 1.7;
          const a = this.angleToPlayer();
          for (let i = -2; i <= 2; i++) this.shoot(a + i * 0.22, 300, { kind: 'ice', radius: 7, damage: 10, life: 2.5 });
          this.game.audio.play('shoot');
        }
      }

      this.extraTargets = [];
      this.shielded = false;
      this.invulnerable = false;
      if (broken) {
        blizzard.dead = true;
        this.game.recordSpecial('shatter');
        this.shatterFx(this.x, this.y, 120);
        this.game.showBanner('SHATTERED!', '지금 공격하라', '#9ad8ff', 1.4);
        this.statusText = 'STUNNED';
        for (let s = 0; s < 2.4; s += 0.3) {
          this.game.particles.emit('ice', this.x, this.y - this.radius, 2, { angle: -Math.PI / 2, spread: 1 });
          yield 0.3;
        }
      } else {
        this.statusText = '';
        yield 0.9;
      }
      this.statusText = '';
    }

    /* ---- drawing ---- */
    draw(ctx, time) {
      // Crystals + tethers (under the witch)
      for (const c of this.extraTargets) {
        if (c.dead) continue;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(150,220,255,${0.35 + 0.25 * Math.sin(time * 10)})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -time * 40;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        ctx.restore();

        Draw.glow(ctx, c.x, c.y, 50, '120,200,255', 0.8);
        ctx.save();
        ctx.translate(c.x, c.y + Math.sin(time * 3 + c.x) * 3);
        ctx.fillStyle = c.flash > 0 ? '#ffffff' : '#bfeaff';
        ctx.strokeStyle = '#4aa8e8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -c.radius * 1.5);
        ctx.lineTo(c.radius * 0.8, 0);
        ctx.lineTo(0, c.radius * 1.5);
        ctx.lineTo(-c.radius * 0.8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        // HP bar
        const w = 44;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(c.x - w / 2, c.y + c.radius * 1.6 + 6, w, 5);
        ctx.fillStyle = '#9ad8ff';
        ctx.fillRect(c.x - w / 2, c.y + c.radius * 1.6 + 6, w * Math.max(0, c.hp / c.maxHp), 5);
      }
      super.draw(ctx, time);
    }

    drawBody(ctx, time) {
      const r = this.radius;
      ctx.save();
      ctx.translate(this.x, this.y + Math.sin(time * 2.5) * 3);
      Draw.glow(ctx, 0, 0, r * 2.6, '130,200,255', 0.4);

      if (this.shielded) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + time * 0.6;
          const x = Math.cos(a) * r * 1.9, y = Math.sin(a) * r * 1.9;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(120,200,255,0.18)';
        ctx.fill();
        ctx.strokeStyle = `rgba(200,240,255,${0.6 + 0.3 * Math.sin(time * 8)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }

      ctx.rotate(this.facing);
      // Gown (hexagon)
      const gown = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.2);
      gown.addColorStop(0, '#e8f7ff');
      gown.addColorStop(1, '#3b6d96');
      ctx.fillStyle = gown;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const rr = r * (1.1 + 0.06 * Math.sin(time * 4 + i));
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#dff4ff';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Head + crown
      Draw.circle(ctx, r * 0.2, 0, r * 0.5, '#f4fbff', '#6aa9d6', 2);
      ctx.fillStyle = '#9ad8ff';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.1, i * r * 0.25 - 4);
        ctx.lineTo(-r * 0.75, i * r * 0.32);
        ctx.lineTo(-r * 0.1, i * r * 0.25 + 4);
        ctx.closePath();
        ctx.fill();
      }
      Draw.circle(ctx, r * 0.42, -r * 0.15, 2.5, '#2a7fd0');
      Draw.circle(ctx, r * 0.42, r * 0.15, 2.5, '#2a7fd0');
      // Staff
      ctx.strokeStyle = '#a7c7dd';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.85);
      ctx.lineTo(r * 1.3, r * 0.85);
      ctx.stroke();
      Draw.glow(ctx, r * 1.35, r * 0.85, 16, '150,220,255', 0.9);
      ctx.restore();
    }
  }

  BR.BossClasses.frostWitch = FrostWitch;
})();
