/*
 * BLOOD COUNT
 * Lesson: aggression. Crimson Siphon heals him while you stay far away;
 * step inside the circle and burst him to STAGGER the channel.
 * Bats home in slowly — dash through them or clear them with Q / E.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;

  const SIPHON_RADIUS = 220;
  const SIPHON_TICK = 0.4;
  const SIPHON_HEAL_RATIO = 0.015;      // of max HP per tick while the player is outside
  const STAGGER_RATIO = 0.06;           // damage (of max HP) needed to interrupt

  class BloodCount extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 110;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [1, 0.85];
      this.recoveryByPhase = [0.65, 0.45];
      this.channeling = false;
      this.siphonDamage = 0;
      this.draining = false;
      this.capeSway = 0;
      this.idleTimer = 1.2;

      this.attacks = [
        { name: 'whip', weight: 3, cooldown: 0.8, maxRange: 260, fn: this.atkWhip },
        { name: 'bats', weight: 1.8, cooldown: 5, fn: this.atkBats },
        { name: 'pools', weight: 1.6, cooldown: 5, fn: this.atkPools },
        { name: 'rush', weight: 2, cooldown: 3, minRange: 200, fn: this.atkRush },
        { name: 'siphon', weight: (b, d) => (d > 240 ? 3 : 1), cooldown: 9, fn: this.atkSiphon },
        { name: 'elite', weight: 1.6, cooldown: 8, elite: true, fn: this.atkEliteMoon },
      ];
    }

    get empowered() { return this.phase >= 2; }

    onPhaseChange() {
      this.speed = 135;
      this.attacks.find((a) => a.name === 'siphon').cooldown = 6.5;
    }

    onDamaged(amount) {
      if (this.channeling) this.siphonDamage += amount;
    }

    idleMove(dt) {
      const d = this.distToPlayer();
      const a = this.angleToPlayer();
      this.facing = Geo.rotateToward(this.facing, a, 5 * dt);
      const sway = Math.sin(this.time * 1.7) * 0.5;
      const radial = d > 180 ? 1 : d < 120 ? -0.5 : 0;
      this.vx = (Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * sway) * this.speed;
      this.vy = (Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * sway) * this.speed;
    }

    updateExtra(dt) {
      this.capeSway += dt;
      if (Math.random() < dt * 6) this.game.particles.emit('bloodMote', this.x + Geo.rand(-20, 20), this.y + Geo.rand(-20, 20), 1);
    }

    /* ---- attacks ---- */
    *atkWhip() {
      const lashes = this.empowered ? 3 : 2;
      let side = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < lashes; i++) {
        const a = this.angleToPlayer() + (i === 0 ? 0 : side * 0.35);
        side *= -1;
        this.facing = a;
        const warn = i === 0 ? this.T(0.6) : 0.42;
        const radius = 235;
        this.chargeUp(warn, '#ff3a4a');
        this.hazard({ shape: 'cone', x: this.x, y: this.y, angle: a, arc: 0.7, radius, warn, damage: 16, style: 'blood', color: '255,40,60' });
        yield warn;
        this.game.effects.push(new BR.SlashFx({ x: this.x, y: this.y, angle: a, radius: radius * 0.8, arc: 0.7, color: '255,50,70', width: 12, life: 0.18 }));
        this.game.particles.emit('blood', this.x + Math.cos(a) * radius * 0.8, this.y + Math.sin(a) * radius * 0.8, 8, { angle: a, spread: 1 });
        this.game.audio.play('swing');
        yield 0.12;
      }
      yield this.T(0.45);
    }

    *atkBats() {
      const n = this.empowered ? 8 : 5;
      this.chargeUp(0.6, '#ff2030');
      this.statusText = 'BATS';
      yield 0.6;
      this.statusText = '';
      const a0 = this.angleToPlayer();
      for (let i = 0; i < n; i++) {
        const a = a0 + Math.PI + (i / n - 0.5) * Math.PI * 1.4; // launched backwards, then curve toward you
        this.shoot(a, 175, { kind: 'bat', radius: 9, damage: 9, life: 4, homing: 1.9 });
        this.game.particles.emit('blood', this.x, this.y, 3);
        yield 0.06;
      }
      this.game.audio.play('shoot');
      yield 0.5;
    }

    *atkPools() {
      const n = this.empowered ? 4 : 3;
      const p = this.player;
      const warn = this.T(0.95);
      this.chargeUp(warn * 0.6, '#ff3a4a');
      for (let i = 0; i < n; i++) {
        const spot = i === 0 ? { x: p.x, y: p.y } : Geo.clampToArena(p.x + Geo.rand(-200, 200), p.y + Geo.rand(-170, 170), 60);
        this.hazard({
          shape: 'circle', x: spot.x, y: spot.y, radius: 78, warn: warn + i * 0.12, damage: 6, tickInterval: 0.5,
          hitWindow: 3.5, linger: 0.5, style: 'blood', color: '255,40,60',
          onActivate: (h) => this.game.particles.emit('blood', h.x, h.y, 14, { radius: 50 }),
        });
      }
      yield 0.6;
    }

    *atkRush() {
      const a = this.angleToPlayer();
      this.facing = a;
      const len = Math.min(Geo.rayToArena(this.x, this.y, a, this.radius), this.distToPlayer() + 200);
      const warn = this.T(0.6);
      const sx = this.x, sy = this.y;
      this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a, length: len + this.radius, width: this.radius * 2 + 8, warn, damage: 0, color: '255,40,60' });
      this.chargeUp(warn, '#ff3a4a');
      this.tremble = warn;
      yield warn;
      this.contactDamage = 18;
      this.alpha = 0.55;
      this.game.audio.play('dash');
      yield* this.dash(a, 1150, len);
      this.contactDamage = 0;
      this.alpha = 1;
      // Blood trail left on the path
      this.hazard({
        shape: 'line', x: sx, y: sy, angle: a, length: Geo.dist(sx, sy, this.x, this.y), width: 30, warn: 0.3,
        damage: 6, tickInterval: 0.5, hitWindow: 2.5, linger: 0.4, style: 'blood', color: '255,40,60',
      });
      yield 0.55;
    }

    *atkSiphon() {
      this.stop();
      const channel = 3.4;
      this.channeling = true;
      this.siphonDamage = 0;
      this.statusText = 'SIPHON — GET CLOSE!';
      this.chargeUp(channel, '#ff1030');
      this.game.audio.play('bossPhase');
      // Visual zone: inside = no drain
      const zone = this.hazard({ shape: 'circle', x: this.x, y: this.y, radius: SIPHON_RADIUS, warn: channel, damage: 0, color: '255,60,80', follow: this });
      let t = 0, tick = 0, staggered = false, healed = 0;
      while (t < channel) {
        yield 0;
        t += this.dt;
        tick += this.dt;
        this.draining = this.distToPlayer() > SIPHON_RADIUS;
        if (tick >= SIPHON_TICK) {
          tick -= SIPHON_TICK;
          if (this.draining && this.hp < this.maxHp) {
            const amount = Math.round(this.maxHp * SIPHON_HEAL_RATIO);
            this.heal(amount);
            healed += amount;
            this.game.spawnText(this.x, this.y - this.radius - 30, `+${amount}`, { color: '#ff6a7a', size: 16 });
            this.game.particles.emit('blood', this.player.x, this.player.y, 4);
          }
        }
        if (this.siphonDamage >= this.maxHp * STAGGER_RATIO) { staggered = true; break; }
      }
      zone.dead = true;
      this.channeling = false;
      this.draining = false;
      this.charge = null;
      if (staggered) {
        this.statusText = 'STAGGERED';
        this.game.recordSpecial('stagger');
        this.game.camera.shakePreset('medium');
        this.game.particles.emit('blood', this.x, this.y, 24, { radius: 20 });
        this.game.showBanner('STAGGERED!', '흡혈 차단', '#ff6a7a', 1.2);
        yield 1.8;
      } else {
        this.statusText = '';
        if (healed > 0) this.game.spawnText(this.x, this.y - this.radius - 50, `DRAINED ${healed}`, { color: '#ff3a4a', size: 18, life: 1.2 });
        yield 0.4;
      }
      this.statusText = '';
    }

    // ELITE: a ring of bats closes in slowly from every side — dash through the gaps or clear them
    *atkEliteMoon() {
      this.stop();
      this.statusText = 'CRIMSON MOON';
      this.chargeUp(0.9, '#ff1030');
      const p = this.player;
      const n = 12;
      const offset = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = offset + (i / n) * Math.PI * 2;
        const pos = Geo.clampToArena(p.x + Math.cos(a) * 330, p.y + Math.sin(a) * 330, 20);
        this.hazard({ shape: 'circle', x: pos.x, y: pos.y, radius: 18, warn: 0.9, damage: 0, color: '255,40,60' });
      }
      yield 0.9;
      for (let i = 0; i < n; i++) {
        const a = offset + (i / n) * Math.PI * 2;
        const pos = Geo.clampToArena(p.x + Math.cos(a) * 330, p.y + Math.sin(a) * 330, 20);
        const proj = new BR.Projectile({ owner: 'boss', kind: 'bat', x: pos.x, y: pos.y, angle: a + Math.PI, speed: 140, radius: 9, damage: Math.round(9 * this.damageMult), life: 4.5, homing: 0.7 });
        this.game.projectiles.push(proj);
      }
      this.game.audio.play('shoot');
      this.statusText = '';
      yield 0.8;
    }

    /* ---- drawing ---- */
    draw(ctx, time) {
      if (this.channeling && this.player) {
        const p = this.player;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = this.draining ? `rgba(255,30,50,${0.6 + 0.3 * Math.sin(time * 20)})` : 'rgba(255,80,100,0.15)';
        ctx.lineWidth = this.draining ? 5 : 2;
        ctx.setLineDash(this.draining ? [] : [6, 8]);
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        const mx = (this.x + p.x) / 2 + Math.sin(time * 8) * 14, my = (this.y + p.y) / 2 + Math.cos(time * 8) * 14;
        ctx.quadraticCurveTo(mx, my, p.x, p.y);
        ctx.stroke();
        ctx.restore();
        // stagger meter
        const k = Math.min(1, this.siphonDamage / (this.maxHp * STAGGER_RATIO));
        const w = 70;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(this.x - w / 2, this.y + this.radius + 14, w, 6);
        ctx.fillStyle = '#ffd0d6';
        ctx.fillRect(this.x - w / 2, this.y + this.radius + 14, w * k, 6);
      }
      super.draw(ctx, time);
    }

    drawBody(ctx, time) {
      const r = this.radius;
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.channeling) Draw.glow(ctx, 0, 0, r * 3, '255,20,40', 0.6 + 0.2 * Math.sin(time * 12));
      ctx.rotate(this.facing);
      // Cape
      const sway = Math.sin(this.capeSway * 4) * 5;
      ctx.fillStyle = '#4a0610';
      ctx.strokeStyle = '#ff3a4a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(r * 0.1, -r * 1.0);
      ctx.lineTo(-r * 1.7, -r * 1.25 + sway);
      ctx.lineTo(-r * 1.4, 0);
      ctx.lineTo(-r * 1.7, r * 1.25 + sway);
      ctx.lineTo(r * 0.1, r * 1.0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Body
      const body = ctx.createRadialGradient(-r * 0.3, 0, 2, 0, 0, r);
      body.addColorStop(0, '#3a1520');
      body.addColorStop(1, '#12050a');
      Draw.circle(ctx, 0, 0, r, body, '#8a1a28', 2.5);
      // High collar
      ctx.fillStyle = '#7a0c1a';
      ctx.beginPath();
      ctx.moveTo(-r * 0.1, -r * 0.75);
      ctx.lineTo(-r * 0.55, -r * 0.2);
      ctx.lineTo(-r * 0.55, r * 0.2);
      ctx.lineTo(-r * 0.1, r * 0.75);
      ctx.closePath();
      ctx.fill();
      // Pale face + red eyes
      Draw.circle(ctx, r * 0.3, 0, r * 0.45, '#e9dcdc', '#5a1a24', 1.5);
      Draw.circle(ctx, r * 0.48, -r * 0.14, 2.8, '#ff2030');
      Draw.circle(ctx, r * 0.48, r * 0.14, 2.8, '#ff2030');
      Draw.glow(ctx, r * 0.5, 0, 14, '255,30,50', 0.6);
      ctx.restore();
    }
  }

  BR.BossClasses.bloodCount = BloodCount;
})();
