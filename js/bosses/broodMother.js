/*
 * BROOD MOTHER — summoner. Lesson: target priority.
 * While 3+ brood are alive she takes half damage. Brood chase you and bite on contact;
 * in phase 2 they burst when killed (telegraphed).
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;
  const MAX_BROOD = 8;

  class BroodMother extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 70;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [1, 0.85];
      this.recoveryByPhase = [0.75, 0.55];
      this.legT = 0;
      this.idleTimer = 1.0;
      this.attacks = [
        { name: 'summon', weight: (b) => (b.alive() < 3 ? 4 : 1), cooldown: 4, fn: this.atkSummon },
        { name: 'acid', weight: 2.4, cooldown: 1.6, fn: this.atkAcid },
        { name: 'pools', weight: 1.4, cooldown: 6, fn: this.atkPools },
        { name: 'slam', weight: (b, d) => (d < 220 ? 4 : 0), cooldown: 2.5, fn: this.atkSlam },
        { name: 'elite', weight: 1.6, cooldown: 9, elite: true, fn: this.atkEliteSwarm },
      ];
    }

    alive() { return this.extraTargets.filter((m) => !m.dead).length; }
    get empowered() { return this.phase >= 2; }
    onPhaseChange() { this.speed = 85; }

    incomingMultiplier() { return this.alive() >= 3 ? 0.5 : 1; }

    idleMove() {
      const d = this.distToPlayer(), a = this.angleToPlayer();
      this.facing = a;
      const sp = d > 320 ? this.speed : d < 200 ? -this.speed : 0;
      this.vx = Math.cos(a) * sp;
      this.vy = Math.sin(a) * sp;
    }

    spawnBrood(x, y, speed = 115) {
      if (this.alive() >= MAX_BROOD) return;
      const hp = Math.round(28 * this.damageMult);
      this.extraTargets.push({
        x, y, radius: 12, hp, maxHp: hp, dead: false, flash: 0, particle: 'blood', speed, bite: 0,
        onDestroy: (t) => {
          this.game.particles.emit('heal', t.x, t.y, 10, { color: '140,255,90' });
          if (this.empowered && !this.dead) {
            this.hazard({ shape: 'circle', x: t.x, y: t.y, radius: 58, warn: 0.6, damage: 12, color: '140,255,90',
              onActivate: (h) => this.game.particles.emit('explosion', h.x, h.y, 10, { color: '140,255,90' }) });
          }
        },
      });
    }

    updateExtra(dt) {
      this.legT += dt * 6;
      const p = this.player;
      for (const m of this.extraTargets) {
        if (m.dead || !p) continue;
        m.flash = Math.max(0, m.flash - dt * 6);
        m.bite -= dt;
        const a = Geo.angle(m.x, m.y, p.x, p.y);
        m.x += Math.cos(a) * m.speed * dt;
        m.y += Math.sin(a) * m.speed * dt;
        for (const o of this.extraTargets) { // simple separation
          if (o === m || o.dead) continue;
          const d = Geo.dist(m.x, m.y, o.x, o.y);
          if (d < 22 && d > 0) { m.x += ((m.x - o.x) / d) * 30 * dt; m.y += ((m.y - o.y) / d) * 30 * dt; }
        }
        const c = Geo.clampToArena(m.x, m.y, m.radius);
        m.x = c.x; m.y = c.y;
        if (m.bite <= 0 && this.active && Geo.dist(m.x, m.y, p.x, p.y) < m.radius + p.radius) {
          m.bite = 0.6;
          this.game.combat.damagePlayer(Math.round(8 * this.damageMult), m.x, m.y);
        }
      }
      this.extraTargets = this.extraTargets.filter((m) => !m.dead);
    }

    *atkSummon() {
      const n = this.empowered ? 4 : 3;
      this.chargeUp(0.8, '#8cff5a');
      this.statusText = 'BROOD';
      const spots = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random();
        spots.push(Geo.clampToArena(this.x + Math.cos(a) * 90, this.y + Math.sin(a) * 90, 20));
      }
      for (const s of spots) this.hazard({ shape: 'circle', x: s.x, y: s.y, radius: 20, warn: 0.8, damage: 0, color: '140,255,90' });
      yield 0.8;
      for (const s of spots) this.spawnBrood(s.x, s.y);
      this.statusText = '';
      yield 0.4;
    }

    *atkAcid() {
      const volleys = this.empowered ? 2 : 1;
      const spread = [-0.35, -0.17, 0, 0.17, 0.35];
      for (let v = 0; v < volleys; v++) {
        const a = this.angleToPlayer();
        const warn = v === 0 ? this.T(0.5) : 0.4;
        for (const s of spread) this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a + s, length: 420, width: 18, warn, damage: 0, color: '140,255,90' });
        this.chargeUp(warn, '#8cff5a');
        yield warn;
        for (const s of spread) this.shoot(a + s, 330, { kind: 'orb', radius: 9, damage: 10, life: 2.5, color: '140,255,90' });
        this.game.audio.play('shoot');
        yield 0.3;
      }
      yield 0.3;
    }

    *atkPools() {
      const p = this.player;
      this.chargeUp(0.6, '#8cff5a');
      for (let i = 0; i < 3; i++) {
        const s = i === 0 ? { x: p.x, y: p.y } : Geo.clampToArena(p.x + Geo.rand(-200, 200), p.y + Geo.rand(-160, 160), 60);
        this.hazard({ shape: 'circle', x: s.x, y: s.y, radius: 80, warn: this.T(0.9) + i * 0.12, damage: 5, tickInterval: 0.5,
          hitWindow: 4, linger: 0.4, slow: 0.3, style: 'magic', color: '140,255,90', activeColor: '120,220,70' });
      }
      yield 0.6;
    }

    *atkSlam() {
      const warn = this.T(0.75);
      this.chargeUp(warn, '#b0ff80');
      this.tremble = warn;
      this.hazard({ shape: 'circle', x: this.x, y: this.y, radius: 170, warn, damage: 20, color: '140,255,90' });
      yield warn;
      this.game.camera.shakePreset('medium');
      this.game.particles.emit('dust', this.x, this.y, 20, { radius: 80 });
      this.game.audio.play('explosion');
      yield 0.6;
    }

    // ELITE: fast brood pour in from the arena edges
    *atkEliteSwarm() {
      const A = BR.CONFIG.ARENA;
      const mx = (A.left + A.right) / 2;
      this.chargeUp(0.9, '#ffffff');
      this.statusText = 'SWARM';
      const spots = [
        { x: A.left + 40, y: A.top + 40 }, { x: A.right - 40, y: A.top + 40 }, { x: A.left + 40, y: A.bottom - 40 },
        { x: A.right - 40, y: A.bottom - 40 }, { x: mx, y: A.top + 40 }, { x: mx, y: A.bottom - 40 },
      ];
      for (const s of spots) this.hazard({ shape: 'circle', x: s.x, y: s.y, radius: 20, warn: 0.9, damage: 0, color: '140,255,90' });
      yield 0.9;
      for (const s of spots) this.spawnBrood(s.x, s.y, 150);
      this.statusText = '';
      yield 0.5;
    }

    draw(ctx, time) {
      for (const m of this.extraTargets) {
        if (m.dead) continue;
        Draw.shadow(ctx, m.x, m.y + 8, 12, 5, 0.35);
        Draw.circle(ctx, m.x, m.y, m.radius, m.flash > 0 ? '#ffffff' : '#2f4a1c', '#8cff5a', 2);
        Draw.circle(ctx, m.x + 4, m.y - 3, 2.2, '#e8ffd0');
        Draw.circle(ctx, m.x - 2, m.y - 4, 2.2, '#e8ffd0');
      }
      super.draw(ctx, time);
      if (this.alive() >= 3 && !this.dead) {
        Draw.circle(ctx, this.x, this.y, this.radius + 12, null, `rgba(140,255,90,${0.45 + 0.25 * Math.sin(time * 6)})`, 3);
      }
    }

    drawBody(ctx, time) {
      const r = this.radius;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.facing);
      ctx.strokeStyle = '#1c2a12';
      ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        for (const s of [-1, 1]) {
          const a = s * (0.6 + i * 0.35) + Math.sin(this.legT + i) * 0.12;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
          ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5);
          ctx.stroke();
        }
      }
      Draw.circle(ctx, -r * 0.6, 0, r * 0.8, '#3e5a26', '#1c2a12', 3);
      Draw.circle(ctx, r * 0.3, 0, r * 0.62, '#577a35', '#1c2a12', 3);
      Draw.glow(ctx, -r * 0.6, 0, r, '140,255,90', 0.25 + 0.1 * Math.sin(time * 4));
      for (const s of [-1, 1]) Draw.circle(ctx, r * 0.62, s * r * 0.2, 3.5, this.empowered ? '#ff5a5a' : '#e8ffd0');
      ctx.restore();
    }
  }

  BR.BossClasses.broodMother = BroodMother;
})();
