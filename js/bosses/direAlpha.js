/*
 * DIRE ALPHA
 * Lesson: read the shadow. Pounces are untouchable mid-air — leave the landing circle.
 * Frenzy bounces off walls several times, then the wolf is dizzy (punish window).
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;

  class DireAlpha extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 170;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [1, 0.82];
      this.recoveryByPhase = [0.55, 0.38];
      this.jumpHeight = 0;
      this.tailWag = 0;
      this.idleTimer = 1.0;

      this.attacks = [
        { name: 'claws', weight: 3, cooldown: 0.8, maxRange: 200, fn: this.atkClaws },
        { name: 'pounce', weight: 2.5, cooldown: 2.6, minRange: 140, fn: this.atkPounce },
        { name: 'frenzy', weight: 1.5, cooldown: 7, fn: this.atkFrenzy },
        { name: 'howl', weight: 1.2, cooldown: 9, fn: this.atkHowl },
      ];
    }

    get bloodMoon() { return this.phase >= 2; }

    onPhaseChange() {
      this.speed = 210;
      this.airborne = false;
      this.jumpHeight = 0;
    }

    idleMove(dt) {
      const d = this.distToPlayer();
      const a = this.angleToPlayer();
      this.facing = Geo.rotateToward(this.facing, a, 6 * dt);
      // Circle in, then close the gap
      const tangent = d > 220 ? 0.7 : 0.2;
      const radial = d > 120 ? 1 : 0;
      this.vx = (Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * tangent) * this.speed;
      this.vy = (Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * tangent) * this.speed;
    }

    updateExtra(dt) {
      this.tailWag += dt * (Math.hypot(this.vx, this.vy) > 50 ? 14 : 4);
    }

    land(x, y, r) {
      this.game.particles.emit('dust', x, y, 20, { radius: r * 0.5, speedMult: 1.3 });
      this.game.effects.push(new BR.RingFx({ x, y, r0: 20, r1: r, color: '200,220,255', width: 10, life: 0.35 }));
      this.game.camera.shakePreset('medium');
      this.game.audio.play('explosion');
    }

    /* ---- attacks ---- */
    *atkClaws() {
      const n = this.bloodMoon ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const target = this.angleToPlayer();
        const a = i === 0 ? target : Geo.rotateToward(this.facing, target, 0.8);
        this.facing = a;
        if (i > 0) {
          this.vx = Math.cos(a) * 400;
          this.vy = Math.sin(a) * 400;
          yield 0.1;
          this.stop();
        }
        const warn = i === 0 ? this.T(0.48) : 0.36;
        this.chargeUp(warn, '#bcd8ff');
        this.hazard({ shape: 'cone', x: this.x, y: this.y, angle: a, arc: 1.5, radius: 150, warn, damage: 15 });
        yield warn;
        this.game.effects.push(new BR.SlashFx({ x: this.x, y: this.y, angle: a, radius: 120, arc: 1.5, color: '210,230,255', width: 10, life: 0.16 }));
        this.game.audio.play('swing');
        yield 0.12;
      }
      yield this.T(0.4);
    }

    *atkPounce() {
      const n = this.bloodMoon ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const p = this.player;
        const lead = i === 0 ? 0 : 0.35;
        const target = Geo.clampToArena(p.x + p.vx * lead, p.y + p.vy * lead, this.radius + 4);
        const warn = i === 0 ? this.T(0.85) : 0.62;
        const radius = 95;
        this.hazard({ shape: 'circle', x: target.x, y: target.y, radius, warn, damage: 22 });
        this.facing = Geo.angle(this.x, this.y, target.x, target.y);
        const sx = this.x, sy = this.y;
        this.airborne = true;
        this.game.audio.play('dash');
        let t = 0;
        while (t < warn) {
          yield 0;
          t += this.dt;
          const k = Math.min(1, t / warn);
          this.x = Geo.lerp(sx, target.x, Geo.easeInOut(k));
          this.y = Geo.lerp(sy, target.y, Geo.easeInOut(k));
          this.jumpHeight = Math.sin(Math.PI * k) * 90;
        }
        this.x = target.x;
        this.y = target.y;
        this.jumpHeight = 0;
        this.airborne = false;
        this.land(this.x, this.y, radius);
        yield 0.22;
      }
      yield this.T(0.5);
    }

    *atkFrenzy() {
      const bounces = this.bloodMoon ? 4 : 3;
      this.statusText = 'FRENZY';
      for (let i = 0; i < bounces; i++) {
        const a = this.angleToPlayer();
        this.facing = a;
        const len = Geo.rayToArena(this.x, this.y, a, this.radius);
        const warn = i === 0 ? this.T(0.7) : 0.36;
        this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a, length: len + this.radius, width: this.radius * 2 + 8, warn, damage: 0 });
        this.chargeUp(warn, '#ff5a6a');
        yield warn;
        this.contactDamage = 18;
        this.game.audio.play('dash');
        const hit = yield* this.dash(a, 1000, len);
        this.contactDamage = 0;
        if (hit) {
          this.game.particles.emit('dust', this.x, this.y, 12, { radius: 10 });
          this.game.camera.shakePreset('small');
          this.game.audio.play('explosion');
        }
      }
      this.game.recordSpecial('wallstun');
      this.statusText = 'DIZZY';
      for (let t = 0; t < 1.3; t += 0.26) {
        this.game.particles.emit('spark', this.x + Geo.rand(-14, 14), this.y - this.radius, 2, { angle: -Math.PI / 2, spread: 1 });
        yield 0.26;
      }
      this.statusText = '';
    }

    *atkHowl() {
      this.stop();
      const warn = this.T(0.8);
      this.chargeUp(warn, '#d0e4ff');
      this.tremble = warn;
      this.statusText = 'HOWL';
      this.game.audio.play('bossPhase');
      yield warn;
      this.statusText = '';
      this.game.combat.knockPlayer(this.x, this.y, 260, 420);
      this.game.effects.push(new BR.RingFx({ x: this.x, y: this.y, r0: this.radius, r1: 260, color: '200,220,255', width: 12, life: 0.5 }));
      const n = this.bloodMoon ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
        this.shoot(a, 190, { kind: 'spirit', radius: 9, damage: 10, life: 4, homing: 1.4 });
      }
      yield 0.7;
    }

    /* ---- drawing ---- */
    drawBody(ctx, time) {
      const r = this.radius;
      const lift = this.jumpHeight;
      const scale = 1 + lift / 300;
      ctx.save();
      ctx.translate(this.x, this.y - lift);
      ctx.scale(scale, scale);
      if (this.bloodMoon) Draw.glow(ctx, 0, 0, r * 2.4, '255,60,80', 0.35);
      ctx.rotate(this.facing);
      const fur = this.bloodMoon ? '#6a5a70' : '#5d6a7e';
      // Tail
      ctx.save();
      ctx.translate(-r * 1.1, 0);
      ctx.rotate(Math.sin(this.tailWag) * 0.4);
      ctx.fillStyle = fur;
      ctx.beginPath();
      ctx.ellipse(-r * 0.4, 0, r * 0.55, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Body
      ctx.fillStyle = fur;
      ctx.strokeStyle = '#1c2230';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, 0, r * 1.05, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(220,230,245,0.25)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.3, 0, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.fillStyle = fur;
      ctx.beginPath();
      ctx.ellipse(r * 0.8, 0, r * 0.5, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#7a879c';
      ctx.beginPath();
      ctx.ellipse(r * 1.2, 0, r * 0.28, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ears
      ctx.fillStyle = '#3c4658';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(r * 0.6, s * r * 0.25);
        ctx.lineTo(r * 0.5, s * r * 0.62);
        ctx.lineTo(r * 0.82, s * r * 0.35);
        ctx.closePath();
        ctx.fill();
      }
      // Eyes
      const eye = this.bloodMoon ? '255,60,80' : '170,220,255';
      for (const s of [-1, 1]) {
        Draw.glow(ctx, r * 1.0, s * r * 0.17, 9, eye, 0.9);
        Draw.circle(ctx, r * 1.0, s * r * 0.17, 2.4, `rgb(${eye})`);
      }
      ctx.restore();
    }
  }

  BR.BossClasses.direAlpha = DireAlpha;
})();
