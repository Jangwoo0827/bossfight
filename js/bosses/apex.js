/*
 * APEX bosses (★6–9, purple stars) — five harder bosses built from a shared attack kit.
 * Every pattern is telegraphed; difficulty comes from density, tempo and combinations.
 * The kit (BR.ApexKit) is also used by the 10-star Abyss Lord.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;
  const A = BR.CONFIG.ARENA;

  /* ---------------- shared attack kit (generators bound to a boss) ---------------- */
  const K = {
    // A sweep of rotating beams from the boss
    *beams(n = 7, step = 0.42, color) {
      this.stop();
      const dir = Math.random() < 0.5 ? 1 : -1;
      const base = this.angleToPlayer() - dir * step * 1.5;
      this.chargeUp(this.T(0.7), this.def.color);
      yield this.T(0.7);
      for (let i = 0; i < n; i++) {
        this.hazard({ shape: 'line', x: this.x, y: this.y, angle: base + dir * step * i, length: 1500, width: 42, warn: this.T(0.95), damage: 17, hitWindow: 0.2, color: color || this.rgb });
        yield this.T(0.15);
      }
      yield this.T(1.1);
    },

    // Strikes dropped around where you are heading
    *rain(n = 8, r = 64) {
      this.stop();
      this.chargeUp(this.T(0.5), this.def.color);
      yield this.T(0.5);
      const p = this.player;
      for (let i = 0; i < n; i++) {
        const t = Geo.clampToArena(p.x + p.vx * 0.5 + Geo.rand(-80, 80), p.y + p.vy * 0.5 + Geo.rand(-80, 80), 50);
        this.hazard({ shape: 'circle', x: t.x, y: t.y, radius: r, warn: this.T(0.9), damage: 16, color: this.rgb });
        yield this.T(0.26);
      }
      yield this.T(0.8);
    },

    // Aimed fans, re-aimed each volley
    *fan(volleys = 3, count = 9, speed = 290) {
      this.stop();
      this.chargeUp(this.T(0.65), this.def.color);
      yield this.T(0.65);
      for (let v = 0; v < volleys; v++) {
        const a = this.angleToPlayer();
        for (let k = 0; k < count; k++) this.shoot(a + (k - (count - 1) / 2) * 0.16, speed, { kind: 'bullet', radius: 7, damage: 11, life: 3.2, color: this.rgb });
        this.game.audio.play('shoot');
        yield this.T(0.45);
      }
      yield this.T(0.6);
    },

    // Ring of bullets with one wide opening
    *ringGap(rings = 2, n = 24) {
      this.stop();
      this.chargeUp(this.T(0.7), this.def.color);
      this.hazard({ shape: 'circle', x: this.x, y: this.y, radius: this.radius + 36, warn: this.T(0.7), damage: 0, color: this.rgb });
      yield this.T(0.7);
      for (let r = 0; r < rings; r++) {
        const gap = this.angleToPlayer() + Geo.rand(-0.7, 0.7);
        for (let i = 0; i < n; i++) {
          const a = gap + ((i + 0.5) / n) * Math.PI * 2;
          if (i < 3 || i >= n - 3) continue; // the opening
          this.shoot(a, 200 + r * 30, { kind: 'bullet', radius: 9, damage: 12, life: 5, color: this.rgb });
        }
        this.game.audio.play('shoot');
        yield this.T(0.8);
      }
      yield this.T(0.5);
    },

    // Shockwave centred on the boss
    *slam(radius = 200) {
      this.stop();
      const warn = this.T(0.85);
      this.chargeUp(warn, this.def.color);
      this.tremble = warn;
      this.hazard({ shape: 'circle', x: this.x, y: this.y, radius, warn, damage: 22, color: this.rgb });
      yield warn;
      this.game.camera.shakePreset('medium');
      this.game.audio.play('explosion');
      yield this.T(0.5);
    },

    // Telegraphed dash chain
    *rush(n = 3) {
      for (let i = 0; i < n; i++) {
        const a = this.angleToPlayer(), len = Math.min(Geo.rayToArena(this.x, this.y, a, this.radius), this.distToPlayer() + 150);
        this.facing = a;
        const warn = this.T(i === 0 ? 0.7 : 0.5);
        this.chargeUp(warn, this.def.color);
        this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a, length: len + this.radius, width: this.radius * 2, warn, damage: 0, color: this.rgb });
        yield warn;
        this.contactDamage = 18;
        this.game.audio.play('dash');
        yield* this.dash(a, 950, len);
        this.contactDamage = 0;
        yield this.T(0.28);
      }
      yield this.T(0.6);
    },

    // Full-height walls with a moving opening: slide into the gap
    *curtain(n = 4, gapW = 190) {
      this.stop();
      this.chargeUp(this.T(0.7), this.def.color);
      yield this.T(0.7);
      let gx = Geo.clamp(this.player.x + Geo.rand(-120, 120), A.left + 130, A.right - 130);
      for (let i = 0; i < n; i++) {
        const w = this.T(1.25);
        this.hazard({ shape: 'rect', x: A.left, y: A.top, w: Math.max(1, gx - gapW / 2 - A.left), h: A.bottom - A.top, warn: w, damage: 18, color: this.rgb, linger: 0.2 });
        this.hazard({ shape: 'rect', x: gx + gapW / 2, y: A.top, w: Math.max(1, A.right - (gx + gapW / 2)), h: A.bottom - A.top, warn: w, damage: 18, color: this.rgb, linger: 0.2 });
        gx = Geo.clamp(gx + Geo.rand(-190, 190), A.left + 130, A.right - 130);
        yield this.T(0.9);
      }
      yield this.T(0.9);
    },
  };
  BR.ApexKit = K;

  /* ---------------- base class ---------------- */
  class ApexBoss extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.rgb = def.rgb;
      this.baseSpeed = 120;
      this.speed = this.baseSpeed;
      this.tempoByPhase = [0.92, 0.8, 0.7];
      this.recoveryByPhase = [0.5, 0.38, 0.28];
      this.idleTimer = 1.0;
      this.spin = 0;
      this.orbit = 1;
      this.eyeAngle = 0;
    }

    onPhaseChange() { this.speed = this.baseSpeed * 1.2; }

    idleMove() {
      const d = this.distToPlayer(), a = this.angleToPlayer();
      this.facing = a;
      if (this.hitWall) this.orbit *= -1;
      const radial = d > 360 ? 0.8 : d < 240 ? -0.8 : 0;
      this.vx = (Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * this.orbit * 0.6) * this.speed;
      this.vy = (Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * this.orbit * 0.6) * this.speed;
    }

    updateExtra(dt) {
      this.spin += dt;
      if (this.player) this.eyeAngle = Geo.rotateToward(this.eyeAngle, this.angleToPlayer(), 6 * dt);
    }

    // Elite: beams into rain
    *atkElite() {
      this.statusText = 'APEX';
      yield* K.beams.call(this, 6, 0.5);
      yield* K.rain.call(this, 9);
      this.statusText = '';
    }

    drawBody(ctx, time) {
      const r = this.radius, col = this.rgb;
      ctx.save();
      ctx.translate(this.x, this.y);
      Draw.glow(ctx, 0, 0, r * 2.8, col, 0.4 + 0.1 * Math.sin(time * 4));
      ctx.save();
      ctx.rotate(this.spin * 0.9);
      ctx.strokeStyle = `rgba(${col},0.85)`;
      ctx.lineWidth = 3;
      const sp = this.def.spikes || 6;
      for (let i = 0; i < sp; i++) {
        const a = (i / sp) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05);
        ctx.lineTo(Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6);
        ctx.stroke();
      }
      ctx.restore();
      const body = ctx.createRadialGradient(0, -r * 0.3, 4, 0, 0, r);
      body.addColorStop(0, `rgba(${col},0.55)`);
      body.addColorStop(1, '#0b0610');
      Draw.circle(ctx, 0, 0, r, body, `rgb(${col})`, 3);
      Draw.circle(ctx, 0, 0, r * 0.42, '#f4eef8');
      Draw.circle(ctx, Math.cos(this.eyeAngle) * r * 0.16, Math.sin(this.eyeAngle) * r * 0.16, r * 0.2, `rgb(${col})`);
      ctx.restore();
    }
  }

  const eliteEntry = { name: 'elite', weight: 1.6, cooldown: 9, elite: true };

  /* ---------------- 6★ MAGMA TITAN ---------------- */
  class MagmaTitan extends ApexBoss {
    constructor(g, d, o) {
      super(g, d, o);
      this.baseSpeed = 100; this.speed = 100;
      this.attacks = [
        { name: 'lavaRow', weight: 3, cooldown: 3, fn: this.atkLavaRow },
        { name: 'rain', weight: 2, cooldown: 4, fn: function* () { yield* K.rain.call(this, this.phase >= 2 ? 10 : 8, 68); } },
        { name: 'slam', weight: (b, dist) => (dist < 280 ? 4 : 1), cooldown: 3, fn: function* () { yield* K.slam.call(this, 210); } },
        { name: 'rush', weight: 1.6, cooldown: 6, fn: function* () { yield* K.rush.call(this, this.phase >= 2 ? 4 : 3); } },
        { name: 'ring', weight: 1.6, phase: 2, cooldown: 7, fn: function* () { yield* K.ringGap.call(this); } },
        Object.assign({ fn: this.atkElite }, eliteEntry),
      ];
    }

    // A chain of geysers erupts along a locked line toward you
    *atkLavaRow() {
      this.stop();
      const a = this.angleToPlayer();
      this.chargeUp(this.T(0.6), '#ff7a30');
      yield this.T(0.6);
      const rows = this.phase >= 2 ? 2 : 1;
      for (let k = 0; k < rows; k++) {
        const aa = a + (k ? (Math.random() < 0.5 ? 0.5 : -0.5) : 0);
        for (let i = 0; i < 9; i++) {
          const t = { x: this.x + Math.cos(aa) * (90 + i * 85), y: this.y + Math.sin(aa) * (90 + i * 85) };
          if (t.x < A.left || t.x > A.right || t.y < A.top || t.y > A.bottom) break;
          this.hazard({ shape: 'circle', x: t.x, y: t.y, radius: 54, warn: this.T(0.85), damage: 17, color: this.rgb });
          yield this.T(0.1);
        }
        yield this.T(0.35);
      }
      yield this.T(1.0);
    }
  }

  /* ---------------- 7★ PRISM SERAPH ---------------- */
  class PrismSeraph extends ApexBoss {
    constructor(g, d, o) {
      super(g, d, o);
      this.attacks = [
        { name: 'beams', weight: 3, cooldown: 3, fn: function* () { yield* K.beams.call(this, this.phase >= 2 ? 9 : 7, 0.4); } },
        { name: 'fan', weight: 2, cooldown: 4, fn: function* () { yield* K.fan.call(this, 3, 11, 300); } },
        { name: 'rain', weight: 1.4, cooldown: 4, fn: function* () { yield* K.rain.call(this, 8); } },
        { name: 'mirror', weight: 2, cooldown: 6, fn: this.atkMirror },
        { name: 'curtain', weight: 1.6, phase: 2, cooldown: 8, fn: function* () { yield* K.curtain.call(this, 4); } },
        Object.assign({ fn: this.atkElite }, eliteEntry),
      ];
    }

    // Blinks to two spots and fires a locked line volley from each
    *atkMirror() {
      const p = this.player;
      for (let i = 0; i < 3; i++) {
        yield* this.fade(0, 0.14);
        const a = Math.random() * Math.PI * 2;
        this.teleportTo(p.x + Math.cos(a) * 300, p.y + Math.sin(a) * 300, 'magic');
        yield* this.fade(1, 0.1);
        const aim = this.angleToPlayer();
        const warn = this.T(0.6);
        this.chargeUp(warn, this.def.color);
        this.hazard({ shape: 'line', x: this.x, y: this.y, angle: aim, length: 1200, width: 40, warn, damage: 17, hitWindow: 0.15, color: this.rgb });
        yield warn + 0.15;
      }
      yield this.T(0.7);
    }
  }

  /* ---------------- 7★ NIGHT EMPRESS ---------------- */
  class NightEmpress extends ApexBoss {
    constructor(g, d, o) {
      super(g, d, o);
      this.attacks = [
        { name: 'garden', weight: 3, cooldown: 7, fn: this.atkGarden },
        { name: 'fan', weight: 2.2, cooldown: 4, fn: function* () { yield* K.fan.call(this, 4, 7, 320); } },
        { name: 'ring', weight: 2, cooldown: 5, fn: function* () { yield* K.ringGap.call(this, this.phase >= 2 ? 3 : 2); } },
        { name: 'rush', weight: 1.6, cooldown: 6, fn: function* () { yield* K.rush.call(this, 3); } },
        { name: 'beams', weight: 1.6, phase: 2, cooldown: 6, fn: function* () { yield* K.beams.call(this, 8, 0.44); } },
        Object.assign({ fn: this.atkElite }, eliteEntry),
      ];
    }

    // Poison thorns bloom and linger, shrinking the safe floor
    *atkGarden() {
      this.stop();
      this.chargeUp(this.T(0.6), '#c070ff');
      yield this.T(0.6);
      const p = this.player, n = this.phase >= 2 ? 6 : 5;
      for (let i = 0; i < n; i++) {
        const t = Geo.clampToArena(p.x + Geo.rand(-260, 260), p.y + Geo.rand(-190, 190), 60);
        this.hazard({ shape: 'circle', x: t.x, y: t.y, radius: 72, warn: this.T(0.9), damage: 7, tickInterval: 0.45, hitWindow: 5, linger: 0.3, style: 'magic', color: this.rgb });
        yield this.T(0.3);
      }
      yield* K.fan.call(this, 2, 7, 300);
    }
  }

  /* ---------------- 8★ TIDE LEVIATHAN ---------------- */
  class TideLeviathan extends ApexBoss {
    constructor(g, d, o) {
      super(g, d, o);
      this.baseSpeed = 110; this.speed = 110;
      this.attacks = [
        { name: 'curtain', weight: 3, cooldown: 5, fn: function* () { yield* K.curtain.call(this, this.phase >= 2 ? 5 : 4, 180); } },
        { name: 'whirl', weight: 2, cooldown: 5, fn: this.atkWhirl },
        { name: 'slam', weight: (b, dist) => (dist < 300 ? 3 : 1), cooldown: 3, fn: function* () { yield* K.slam.call(this, 230); } },
        { name: 'ring', weight: 2, cooldown: 5, fn: function* () { yield* K.ringGap.call(this, 3); } },
        { name: 'beams', weight: 1.6, phase: 2, cooldown: 6, fn: function* () { yield* K.beams.call(this, 9, 0.4); } },
        Object.assign({ fn: this.atkElite }, eliteEntry),
      ];
    }

    // Whirlpool rings contract around you
    *atkWhirl() {
      this.stop();
      this.chargeUp(this.T(0.6), '#60c8ff');
      yield this.T(0.6);
      const p = this.player;
      const cx = p.x, cy = p.y;
      for (const [r, n, warn] of [[260, 10, 0.95], [150, 7, 0.95]]) {
        const off = Math.random() * 6;
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2, t = Geo.clampToArena(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 40);
          this.hazard({ shape: 'circle', x: t.x, y: t.y, radius: 56, warn: this.T(warn), damage: 16, color: this.rgb });
        }
        yield this.T(0.85);
      }
      this.hazard({ shape: 'circle', x: cx, y: cy, radius: 60, warn: this.T(0.9), damage: 18, color: this.rgb });
      yield this.T(1.4);
    }
  }

  /* ---------------- 9★ RUIN KING ---------------- */
  class RuinKing extends ApexBoss {
    constructor(g, d, o) {
      super(g, d, o);
      this.baseSpeed = 140; this.speed = 140;
      this.tempoByPhase = [0.88, 0.76, 0.66];
      this.recoveryByPhase = [0.42, 0.32, 0.22];
      this.attacks = [
        { name: 'execution', weight: 3, cooldown: 5, fn: this.atkExecution },
        { name: 'rush', weight: 2, cooldown: 5, fn: function* () { yield* K.rush.call(this, this.phase >= 2 ? 5 : 4); } },
        { name: 'beams', weight: 2, cooldown: 4, fn: function* () { yield* K.beams.call(this, 9, 0.4); } },
        { name: 'rain', weight: 1.6, cooldown: 4, fn: function* () { yield* K.rain.call(this, 10, 66); } },
        { name: 'curtain', weight: 1.8, phase: 2, cooldown: 7, fn: function* () { yield* K.curtain.call(this, 5, 180); } },
        { name: 'slam', weight: (b, dist) => (dist < 260 ? 4 : 0.8), cooldown: 3, fn: function* () { yield* K.slam.call(this, 220); } },
        Object.assign({ fn: this.atkElite }, eliteEntry),
      ];
    }

    // Blinks beside you and cuts: shockwave + slash, three times
    *atkExecution() {
      const p = this.player;
      for (let i = 0; i < 3; i++) {
        yield* this.fade(0, 0.12);
        const a = Math.random() * Math.PI * 2;
        const dest = Geo.clampToArena(p.x + Math.cos(a) * 250, p.y + Math.sin(a) * 250, this.radius + 10);
        this.hazard({ shape: 'circle', x: dest.x, y: dest.y, radius: 36, warn: 0.3, damage: 0, color: this.rgb });
        yield 0.3;
        this.teleportTo(dest.x, dest.y, 'abyss');
        yield* this.fade(1, 0.1);
        const aim = this.angleToPlayer(), warn = this.T(0.62);
        this.chargeUp(warn, this.def.color);
        this.hazard({ shape: 'circle', x: this.x, y: this.y, radius: 170, warn, damage: 20, color: this.rgb });
        this.hazard({ shape: 'line', x: this.x, y: this.y, angle: aim, length: 700, width: 64, warn, damage: 20, hitWindow: 0.15, color: this.rgb });
        yield warn + 0.2;
      }
      yield this.T(0.7);
    }
  }

  BR.BossClasses.magmaTitan = MagmaTitan;
  BR.BossClasses.prismSeraph = PrismSeraph;
  BR.BossClasses.nightEmpress = NightEmpress;
  BR.BossClasses.tideLeviathan = TideLeviathan;
  BR.BossClasses.ruinKing = RuinKing;
})();
