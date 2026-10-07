/*
 * BOSS 5 — ABYSS LORD (final)
 * Remixes earlier lessons across three phases:
 *  P1  bolt streams, pools, close-range shock
 *  P2  (<=65%) checkerboard strikes, radial bursts + fast bolts, blink
 *  P3  (<=30%) spiral barrage, abyss cross, short combo
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;
  const C = BR.CONFIG;

  const PHASE_COLORS = ['255,40,110', '230,60,255', '255,90,70', '255,255,255'];

  class AbyssLord extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 70;
      this.speed = this.baseSpeed;
      this.rgb = '255,40,110';
      this.tempoByPhase = [0.9, 0.78, 0.66, 0.56];
      this.recoveryByPhase = [0.6, 0.42, 0.3, 0.18];
      this.eyeAngle = Math.PI / 2;
      this.ringSpin = 0;
      this.idleTimer = 1.4;

      this.attacks = [
        { name: 'boltStream', weight: 2.5, cooldown: 1.5, fn: this.atkBoltStream },
        { name: 'pools', weight: 2, cooldown: 3.5, fn: this.atkPools },
        { name: 'nearShock', weight: (b, d) => (d < 210 ? 6 : 0), cooldown: 2.4, fn: this.atkNearShock },
        { name: 'grid', weight: 1.7, cooldown: 8, phase: 2, fn: this.atkGrid },
        { name: 'burst', weight: 1.8, cooldown: 3, phase: 2, fn: this.atkBurst },
        { name: 'blink', weight: 1, cooldown: 5, phase: 2, fn: this.atkBlink },
        { name: 'spiral', weight: 1.6, cooldown: 7, phase: 3, fn: this.atkSpiral },
        { name: 'cross', weight: 1.5, cooldown: 6, phase: 3, fn: this.atkCross },
        { name: 'combo', weight: 1.5, cooldown: 6, phase: 3, fn: this.atkCombo },
        { name: 'curtain', weight: 1.4, cooldown: 8, phase: 3, fn: function* () { yield* BR.ApexKit.curtain.call(this, 5, 175); } },
        { name: 'judgement', weight: 2, cooldown: 7, phase: 4, fn: this.atkJudgement },
        { name: 'breath', weight: 2.2, cooldown: 8, phase: 4, fn: this.atkBreath },
        { name: 'finale', weight: 1.6, cooldown: 9, phase: 4, fn: this.atkFinale },
      ];
    }

    get color() { return PHASE_COLORS[this.phase - 1] || PHASE_COLORS[0]; }

    onPhaseChange(phase) {
      this.speed = [70, 85, 105, 135][phase - 1] || 135;
      this.rgb = this.color;
      if (phase === 4) this.statusText = 'LAST BREATH';
    }

    *phaseTransition(phase) {
      // Clear the board so the new phase starts readable
      for (const h of this.game.hazards) h.dead = true;
      for (const p of this.game.projectiles) if (p.owner === 'boss') p.dead = true;
      yield* super.phaseTransition(phase);
      if (phase === 2) {
        const A = C.ARENA;
        this.teleportTo((A.left + A.right) / 2, (A.top + A.bottom) / 2, 'abyss');
        yield 0.3;
      }
    }

    idleMove(dt) {
      const d = this.distToPlayer();
      const a = this.angleToPlayer();
      const radial = d > 360 ? 0.6 : d < 260 ? -0.6 : 0;
      const t = Math.sin(this.time * 0.7) * 0.6;
      this.vx = (Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * t) * this.speed;
      this.vy = (Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * t) * this.speed;
      this.facing = a;
    }

    updateExtra(dt) {
      this.ringSpin += dt * (0.6 + this.phase * 0.4);
      if (this.player) this.eyeAngle = Geo.rotateToward(this.eyeAngle, this.angleToPlayer(), 5 * dt);
      if (Math.random() < dt * (6 + this.phase * 6)) {
        this.game.particles.emit('abyss', this.x + Geo.rand(-30, 30), this.y + Geo.rand(-30, 30), 1, { speedMult: 0.3, color: this.color });
      }
    }

    burstFx(x, y, radius) {
      this.game.particles.emit('abyss', x, y, Math.round(radius / 6), { radius: radius * 0.6, color: this.color });
      this.game.effects.push(new BR.RingFx({ x, y, r0: radius * 0.3, r1: radius * 1.05, color: this.color, width: 10, life: 0.35 }));
    }

    /* ---- Phase 1 ---- */
    *atkBoltStream() {
      const streams = this.phase >= 2 ? 2 : 1;
      for (let s = 0; s < streams; s++) {
        const a = this.angleToPlayer();
        const warn = s === 0 ? this.T(0.65) : 0.45;
        this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a, length: 900, width: 26, warn, damage: 0, color: this.color });
        this.chargeUp(warn, '#ff3d7f');
        yield warn;
        for (let i = 0; i < 6; i++) {
          this.shoot(a, 560, { kind: 'abyss', radius: 9, damage: 11, life: 2.5 });
          if (i % 2 === 0) this.game.audio.play('shoot');
          yield 0.07;
        }
      }
      yield 0.35;
    }

    *atkPools() {
      const n = this.phase >= 3 ? 5 : 3;
      const p = this.player;
      const warn = this.T(1.0);
      this.chargeUp(warn * 0.6, '#ff3d7f');
      for (let i = 0; i < n; i++) {
        const spot = i === 0 ? { x: p.x, y: p.y } : Geo.clampToArena(p.x + Geo.rand(-220, 220), p.y + Geo.rand(-180, 180), 50);
        this.hazard({
          shape: 'circle', x: spot.x, y: spot.y, radius: 92, warn: warn + i * 0.14, damage: 18, style: 'dark', color: this.color,
          onActivate: (h) => { this.burstFx(h.x, h.y, 92); this.game.audio.play('explosion'); },
        });
      }
      yield 0.6;
    }

    *atkNearShock(warnOverride) {
      const warn = warnOverride || this.T(0.8);
      const radius = 200;
      this.chargeUp(warn, '#ff2050');
      this.tremble = warn;
      this.hazard({ shape: 'circle', x: this.x, y: this.y, radius, warn, damage: 22, style: 'dark', color: this.color });
      yield warn;
      this.burstFx(this.x, this.y, radius);
      this.game.camera.shakePreset('medium');
      this.game.audio.play('explosion');
      yield 0.5;
    }

    /* ---- Phase 2 ---- */
    *atkGrid() {
      const A = C.ARENA;
      const cols = 8, rows = 4;
      const cw = (A.right - A.left) / cols, ch = (A.bottom - A.top) / rows;
      const warn = this.T(1.25);
      const gap = 0.95;
      this.chargeUp(warn, '#e040ff');
      this.statusText = 'FIND THE SAFE TILES';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const even = (r + c) % 2 === 0;
          this.hazard({
            shape: 'rect', x: A.left + c * cw + 2, y: A.top + r * ch + 2, w: cw - 4, h: ch - 4,
            warn: even ? warn : warn + gap, damage: 20, style: 'dark', color: this.color, linger: 0.35,
          });
        }
      }
      yield warn;
      this.game.camera.shakePreset('medium');
      this.game.audio.play('explosion');
      yield gap;
      this.game.camera.shakePreset('medium');
      this.game.audio.play('explosion');
      this.statusText = '';
      yield 0.5;
    }

    *atkBurst() {
      const rings = this.phase >= 3 ? 2 : 1;
      const count = 18;
      const warn = this.T(0.7);
      this.chargeUp(warn, '#ff60c0');
      this.hazard({ shape: 'circle', x: this.x, y: this.y, radius: this.radius + 40, warn, damage: 0, color: this.color });
      yield warn;
      const offset = Math.random() * Math.PI * 2;
      for (let r = 0; r < rings; r++) {
        for (let i = 0; i < count; i++) {
          const a = offset + ((i + r * 0.5) / count) * Math.PI * 2;
          this.shoot(a, 210, { kind: 'abyss', radius: 10, damage: 12, life: 5 });
        }
        this.burstFx(this.x, this.y, this.radius * 1.6);
        this.game.audio.play('shoot');
        yield 0.45;
      }
      // Fast aimed bolt while the ring is still flying
      const a = this.angleToPlayer();
      this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a, length: 1000, width: 22, warn: 0.45, damage: 0, color: this.color });
      yield 0.45;
      this.shoot(a, 780, { kind: 'abyss', radius: 11, damage: 15, life: 2 });
      this.game.audio.play('shoot');
      yield 0.4;
    }

    *atkBlink() {
      yield* this.fade(0, 0.2);
      const dest = this.pointAwayFromPlayer(300, 110);
      this.hazard({ shape: 'circle', x: dest.x, y: dest.y, radius: 40, warn: 0.35, damage: 0, color: this.color });
      yield 0.35;
      this.teleportTo(dest.x, dest.y, 'abyss');
      yield* this.fade(1, 0.15);
      yield* this.atkPools();
    }

    /* ---- Phase 3 ---- */
    *atkSpiral() {
      const warn = 0.8;
      const arms = 3;
      this.chargeUp(warn, '#ff5040');
      this.tremble = warn;
      this.statusText = 'SPIRAL';
      yield warn;
      this.statusText = '';
      const dir = Math.random() < 0.5 ? 1 : -1;
      let angle = this.angleToPlayer() + Math.PI / arms; // never starts aimed straight at the player
      const duration = 2.8, interval = 0.11;
      for (let t = 0; t < duration; t += interval) {
        for (let i = 0; i < arms; i++) {
          this.shoot(angle + (i * Math.PI * 2) / arms, 235, { kind: 'abyss', radius: 9, damage: 10, life: 5 });
        }
        angle += dir * 1.5 * interval;
        if (Math.round(t / interval) % 3 === 0) this.game.audio.play('shoot');
        yield interval;
      }
      yield 0.5;
    }

    *atkCross() {
      const warn = this.T(0.95);
      const len = 2600, width = 74;
      this.chargeUp(warn + 0.7, '#ff2040');
      for (const a of [0, Math.PI / 2]) {
        this.hazard({ shape: 'line', centered: true, x: this.x, y: this.y, angle: a, length: len, width, warn, damage: 24, style: 'dark', color: this.color, linger: 0.4 });
      }
      for (const a of [Math.PI / 4, -Math.PI / 4]) {
        this.hazard({ shape: 'line', centered: true, x: this.x, y: this.y, angle: a, length: len, width, warn: warn + 0.75, damage: 24, style: 'dark', color: this.color, linger: 0.4 });
      }
      yield warn;
      this.game.camera.shakePreset('medium');
      this.game.audio.play('explosion');
      yield 0.75;
      this.game.camera.shakePreset('medium');
      this.game.audio.play('explosion');
      yield 0.5;
    }

    *atkCombo() {
      // Blink beside the player -> shock -> bolt stream
      yield* this.fade(0, 0.18);
      const p = this.player;
      const side = Math.random() * Math.PI * 2;
      const target = Geo.clampToArena(p.x + Math.cos(side) * 230, p.y + Math.sin(side) * 230, this.radius + 10);
      this.hazard({ shape: 'circle', x: target.x, y: target.y, radius: 40, warn: 0.3, damage: 0, color: this.color });
      yield 0.3;
      this.teleportTo(target.x, target.y, 'abyss');
      yield* this.fade(1, 0.12);
      yield* this.atkNearShock(0.62);
      const a = this.angleToPlayer();
      this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a, length: 900, width: 26, warn: 0.42, damage: 0, color: this.color });
      yield 0.42;
      for (let i = 0; i < 5; i++) {
        this.shoot(a, 600, { kind: 'abyss', radius: 9, damage: 11, life: 2.5 });
        yield 0.06;
      }
      yield 0.4;
    }

    /* ---- Phase 4: LAST BREATH ---- */
    *atkJudgement() {
      yield* BR.ApexKit.beams.call(this, 11, 0.34, this.color);
      yield* BR.ApexKit.rain.call(this, 8, 72);
    }

    *atkBreath() {
      yield* this.atkGrid();
      yield* this.atkCross();
    }

    *atkFinale() {
      yield* this.atkSpiral();
      yield* BR.ApexKit.curtain.call(this, 5, 175);
    }

    /* ---- drawing ---- */
    drawBody(ctx, time) {
      const r = this.radius;
      const col = this.color;
      ctx.save();
      ctx.translate(this.x, this.y);
      Draw.glow(ctx, 0, 0, r * 3, col, 0.45 + 0.1 * Math.sin(time * 4));

      // Tendrils
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.sin(time * 1.3 + i) * 0.2;
        ctx.strokeStyle = `rgba(${col},0.55)`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
        const wob = Math.sin(time * 3 + i * 1.7) * 10;
        ctx.quadraticCurveTo(
          Math.cos(a + 0.3) * r * 1.4 + wob, Math.sin(a + 0.3) * r * 1.4 - wob,
          Math.cos(a) * r * 1.85, Math.sin(a) * r * 1.85,
        );
        ctx.stroke();
      }

      // Rune ring
      ctx.save();
      ctx.rotate(this.ringSpin);
      ctx.strokeStyle = `rgba(${col},0.8)`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a0 = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.45, a0, a0 + 0.7);
        ctx.stroke();
      }
      ctx.restore();

      // Core body
      const body = ctx.createRadialGradient(0, -r * 0.3, 4, 0, 0, r);
      body.addColorStop(0, '#3a0a24');
      body.addColorStop(1, '#0c0208');
      Draw.circle(ctx, 0, 0, r, body, `rgb(${col})`, 3);

      // Crown spikes
      ctx.fillStyle = '#1a0510';
      ctx.strokeStyle = `rgb(${col})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.38;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - 0.12) * r * 0.9, Math.sin(a - 0.12) * r * 0.9);
        ctx.lineTo(Math.cos(a) * r * (1.45 + (i === 2 ? 0.25 : 0)), Math.sin(a) * r * (1.45 + (i === 2 ? 0.25 : 0)));
        ctx.lineTo(Math.cos(a + 0.12) * r * 0.9, Math.sin(a + 0.12) * r * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Eye tracking the player
      const ex = Math.cos(this.eyeAngle) * r * 0.25, ey = Math.sin(this.eyeAngle) * r * 0.25;
      Draw.circle(ctx, 0, 0, r * 0.45, '#f6e6ec');
      Draw.circle(ctx, ex, ey, r * 0.24, `rgb(${col})`);
      Draw.circle(ctx, ex * 1.15, ey * 1.15, r * 0.1, '#000');
      ctx.restore();
    }
  }

  BR.BossClasses.abyssLord = AbyssLord;
})();
