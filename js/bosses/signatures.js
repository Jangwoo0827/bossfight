/*
 * Signature attacks — one extra, fully telegraphed pattern per boss, mixed into its normal pool
 * (see BOSS_EXTRAS in boss.js chooseAttack). Only uses the shared Boss API (hazard / shoot / chargeUp).
 */
(function () {
  'use strict';
  const { Geo } = BR;
  const A = BR.CONFIG.ARENA;
  const W = (b) => (b.phase >= 2 ? 2 : 1.2);
  const X = {};

  // Slashes fan out from the knight one after another
  X.swordKnight = { name: 'oathCleave', weight: W, cooldown: 7, fn: function* () {
    this.stop();
    const base = this.angleToPlayer();
    this.chargeUp(this.T(0.6), '#cfd8ff');
    yield this.T(0.6);
    for (const off of [-0.6, 0, 0.6]) {
      this.hazard({ shape: 'line', x: this.x, y: this.y, angle: base + off, length: 560, width: 52, warn: this.T(0.85), damage: 16, hitWindow: 0.2, color: '255,90,90' });
      yield this.T(0.4);
    }
    yield this.T(0.9);
  } };

  // A ring of meteors closes in around you, then one lands where you flee
  X.infernoMage = { name: 'meteorStorm', weight: W, cooldown: 8, fn: function* () {
    this.stop();
    const p = this.player, cx = p.x, cy = p.y;
    this.chargeUp(this.T(0.6), '#ff8a3a');
    yield this.T(0.6);
    const off = Math.random() * 6;
    for (let i = 0; i < 6; i++) {
      const a = off + (i / 6) * Math.PI * 2, t = Geo.clampToArena(cx + Math.cos(a) * 180, cy + Math.sin(a) * 180, 50);
      this.hazard({ shape: 'circle', x: t.x, y: t.y, radius: 62, warn: this.T(1.0), damage: 15, color: '255,120,40' });
    }
    yield this.T(0.9);
    const t = Geo.clampToArena(p.x + p.vx * 0.5, p.y + p.vy * 0.5, 50);
    this.hazard({ shape: 'circle', x: t.x, y: t.y, radius: 80, warn: this.T(0.9), damage: 18, color: '255,120,40' });
    yield this.T(1.2);
  } };

  // Boulders crash all over the arena
  X.stoneGolem = { name: 'rockfall', weight: W, cooldown: 8, fn: function* () {
    this.stop();
    this.chargeUp(this.T(0.7), '#c9a35a');
    yield this.T(0.7);
    const p = this.player;
    for (let i = 0; i < 9; i++) {
      const near = i % 3 === 0;
      const t = near ? Geo.clampToArena(p.x + Geo.rand(-70, 70), p.y + Geo.rand(-70, 70), 60)
        : { x: Geo.rand(A.left + 60, A.right - 60), y: Geo.rand(A.top + 60, A.bottom - 60) };
      this.hazard({ shape: 'circle', x: t.x, y: t.y, radius: 72, warn: this.T(1.1), damage: 18, color: '200,160,90' });
      yield this.T(0.22);
    }
    yield this.T(1.2);
  } };

  // Blinks around you, firing a locked, narrow volley from each spot
  X.voidHunter = { name: 'riftBarrage', weight: W, cooldown: 7, fn: function* () {
    const p = this.player, n = this.phase >= 2 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      yield* this.fade(0, 0.14);
      const a = Math.random() * Math.PI * 2;
      this.teleportTo(p.x + Math.cos(a) * 280, p.y + Math.sin(a) * 280, 'void');
      yield* this.fade(1, 0.1);
      const aim = this.angleToPlayer();
      this.chargeUp(this.T(0.6), '#b070ff');
      this.hazard({ shape: 'line', x: this.x, y: this.y, angle: aim, length: 700, width: 30, warn: this.T(0.6), damage: 0, color: '180,110,255' });
      yield this.T(0.6);
      for (let k = -2; k <= 2; k++) this.shoot(aim + k * 0.13, 330, { kind: 'bullet', radius: 7, damage: 11, life: 3, color: '190,120,255' });
      this.game.audio.play('shoot');
      yield this.T(0.2);
    }
    yield this.T(0.6);
  } };

  // Two staggered rings of ice spikes with a safe pocket near the witch
  X.frostWitch = { name: 'iceSpikes', weight: W, cooldown: 8, fn: function* () {
    this.stop();
    this.chargeUp(this.T(0.7), '#9fe8ff');
    yield this.T(0.7);
    const ring = (r, n, warn) => {
      const off = Math.random() * 6;
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * Math.PI * 2, t = { x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r };
        if (t.x < A.left || t.x > A.right || t.y < A.top || t.y > A.bottom) continue;
        this.hazard({ shape: 'circle', x: t.x, y: t.y, radius: 46, warn, damage: 15, color: '150,230,255' });
      }
    };
    ring(230, 10, this.T(0.95));
    yield this.T(0.8);
    ring(350, 14, this.T(0.95));
    yield this.T(1.6);
  } };

  // Four lightning strikes chase your position
  X.stormCaller = { name: 'chainStrike', weight: W, cooldown: 7, fn: function* () {
    this.stop();
    this.chargeUp(this.T(0.5), '#ffe45e');
    yield this.T(0.5);
    const p = this.player, n = this.phase >= 2 ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const t = Geo.clampToArena(p.x + p.vx * 0.3, p.y + p.vy * 0.3, 50);
      this.hazard({ shape: 'circle', x: t.x, y: t.y, radius: 76, warn: this.T(0.8), damage: 16, color: '255,230,90' });
      yield this.T(0.5);
    }
    yield this.T(1.0);
  } };

  // Parallel crimson spears sweep in; the gaps between them are safe
  X.bloodCount = { name: 'crimsonSpears', weight: W, cooldown: 8, fn: function* () {
    this.stop();
    this.chargeUp(this.T(0.6), '#ff4a6a');
    yield this.T(0.6);
    const horizontal = Math.random() < 0.5;
    const n = horizontal ? 3 : 6, span = horizontal ? A.bottom - A.top : A.right - A.left;
    const gap = span / n;
    for (let i = 0; i < n; i++) {
      const pos = (horizontal ? A.top : A.left) + gap * (i + 0.5) + Geo.rand(-18, 18);
      this.hazard(horizontal
        ? { shape: 'line', x: A.left, y: pos, angle: 0, length: A.right - A.left, width: 54, warn: this.T(1.2), damage: 15, hitWindow: 0.2, color: '220,40,80' }
        : { shape: 'line', x: pos, y: A.top, angle: Math.PI / 2, length: A.bottom - A.top, width: 54, warn: this.T(1.2), damage: 15, hitWindow: 0.2, color: '220,40,80' });
      yield this.T(0.2);
    }
    yield this.T(1.6);
  } };

  // Rapid aimed shots, each with a laser sight
  X.westernShooter = { name: 'quickDraw', weight: W, cooldown: 7, fn: function* () {
    this.stop();
    this.chargeUp(this.T(0.4), '#ffd070');
    yield this.T(0.4);
    const n = this.phase >= 2 ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const aim = this.angleToPlayer();
      this.facing = aim;
      this.hazard({ shape: 'line', x: this.x, y: this.y, angle: aim, length: 1000, width: 22, warn: this.T(0.5), damage: 0, color: '255,200,100' });
      yield this.T(0.5);
      this.shoot(aim, 440, { kind: 'bullet', radius: 7, damage: 12, life: 3, color: '255,210,120' });
      this.game.audio.play('shoot');
      yield this.T(0.3);
    }
    yield this.T(0.7);
  } };

  // Gears slam down in a checkerboard, then the other half
  X.clockworkWarden = { name: 'gearGrid', weight: W, cooldown: 9, fn: function* () {
    this.stop();
    this.chargeUp(this.T(0.7), '#e0b060');
    yield this.T(0.7);
    const rows = [A.top + 100, A.top + 272, A.top + 444];
    const set = (parity) => {
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 8; i++) {
          if ((i + j) % 2 !== parity) continue;
          this.hazard({ shape: 'circle', x: A.left + 80 + i * 160, y: rows[j], radius: 64, warn: this.T(1.1), damage: 16, color: '230,170,80' });
        }
      }
    };
    set(0);
    yield this.T(1.5);
    set(1);
    yield this.T(1.8);
  } };

  // Sand spouts erupt and spray slow bullets
  X.duneWyrm = { name: 'sandSpouts', weight: W, cooldown: 8, fn: function* () {
    this.stop();
    this.chargeUp(this.T(0.6), '#e8c070');
    yield this.T(0.6);
    const p = this.player, n = this.phase >= 2 ? 5 : 4;
    for (let i = 0; i < n; i++) {
      let t, guard = 0;
      do { t = { x: Geo.rand(A.left + 70, A.right - 70), y: Geo.rand(A.top + 70, A.bottom - 70) }; } while (Geo.dist(t.x, t.y, p.x, p.y) < 160 && guard++ < 8);
      this.hazard({ shape: 'circle', x: t.x, y: t.y, radius: 48, warn: this.T(1.0), damage: 14, color: '230,190,100',
        onActivate: (h) => {
          const off = Math.random() * 6;
          for (let k = 0; k < 8; k++) {
            const a = off + (k / 8) * Math.PI * 2;
            this.game.projectiles.push(new BR.Projectile({ owner: 'boss', x: h.x, y: h.y, angle: a, speed: 190, kind: 'bullet', radius: 7, damage: Math.round(10 * this.damageMult), life: 3.5, color: '230,190,100' }));
          }
        } });
      yield this.T(0.35);
    }
    yield this.T(1.6);
  } };

  // Three fast, telegraphed charges in a row
  X.direAlpha = { name: 'packRush', weight: W, cooldown: 8, fn: function* () {
    const n = this.phase >= 2 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const a = this.angleToPlayer(), len = Math.min(Geo.rayToArena(this.x, this.y, a, this.radius), this.distToPlayer() + 140);
      this.facing = a;
      const warn = this.T(i === 0 ? 0.65 : 0.5);
      this.chargeUp(warn, '#ff6a4a');
      this.hazard({ shape: 'line', x: this.x, y: this.y, angle: a, length: len + this.radius, width: this.radius * 2, warn, damage: 0, color: '255,100,70' });
      yield warn;
      this.contactDamage = 16;
      this.game.audio.play('dash');
      yield* this.dash(a, 900, len);
      this.contactDamage = 0;
      yield this.T(0.3);
    }
    yield this.T(0.7);
  } };

  // Spore pods burst and leave a poison cloud
  X.broodMother = { name: 'sporeBurst', weight: W, cooldown: 8, fn: function* () {
    this.stop();
    this.chargeUp(this.T(0.6), '#8cff5a');
    yield this.T(0.6);
    const p = this.player;
    for (let i = 0; i < 4; i++) {
      const t = Geo.clampToArena(p.x + Geo.rand(-220, 220), p.y + Geo.rand(-160, 160), 60);
      this.hazard({ shape: 'circle', x: t.x, y: t.y, radius: 54, warn: this.T(0.9), damage: 12, color: '150,255,90',
        onActivate: (h) => this.hazard({ shape: 'circle', x: h.x, y: h.y, radius: 95, warn: 0.2, damage: 5, tickInterval: 0.5, hitWindow: 3.5, linger: 0.3, style: 'magic', color: '120,220,60' }) });
      yield this.T(0.4);
    }
    yield this.T(1.2);
  } };

  // Two crossing lines through you, then a second X rotated 45 degrees
  X.phantomLancer = { name: 'phantomCrossfire', weight: W, cooldown: 8, fn: function* () {
    this.stop();
    this.chargeUp(this.T(0.6), '#dfe8ff');
    yield this.T(0.6);
    const p = this.player;
    const cross = (cx, cy, rot, warn) => {
      for (let k = 0; k < 2; k++) {
        const a = rot + k * Math.PI / 2;
        this.hazard({ shape: 'line', x: cx - Math.cos(a) * 450, y: cy - Math.sin(a) * 450, angle: a, length: 900, width: 46, warn, damage: 15, hitWindow: 0.2, color: '200,220,255' });
      }
    };
    cross(p.x, p.y, Math.random() * 1.5, this.T(1.1));
    yield this.T(0.9);
    cross(p.x, p.y, Math.PI / 4 + Math.random() * 1.0, this.T(1.1));
    yield this.T(1.5);
  } };

  // Three rotating arms of void bullets
  X.gravitySage = { name: 'starSpiral', weight: W, cooldown: 8, fn: function* () {
    this.stop();
    this.chargeUp(this.T(0.7), '#9fb0ff');
    yield this.T(0.7);
    const steps = this.phase >= 2 ? 16 : 13;
    let a = Math.random() * 6;
    for (let i = 0; i < steps; i++) {
      for (let k = 0; k < 3; k++) {
        this.shoot(a + (k * Math.PI * 2) / 3, 210, { kind: 'void', radius: 8, damage: 10, life: 4.5 });
      }
      a += 0.3;
      this.game.audio.play('shoot');
      yield this.T(0.16);
    }
    yield this.T(1.0);
  } };

  // Final boss: tentacle columns, then bars across
  X.abyssLord = { name: 'tentacleGrid', phase: 2, weight: 2.2, cooldown: 9, fn: function* () {
    this.stop();
    this.chargeUp(this.T(0.8), '#b060ff');
    yield this.T(0.8);
    const off = Geo.rand(-30, 30);
    for (let i = 0; i < 5; i++) {
      this.hazard({ shape: 'line', x: A.left + 110 + i * 250 + off, y: A.top, angle: Math.PI / 2, length: A.bottom - A.top, width: 86, warn: this.T(1.4), damage: 20, hitWindow: 0.25, color: '170,90,255' });
    }
    yield this.T(1.8);
    for (const y of [A.top + 140, A.bottom - 140]) {
      this.hazard({ shape: 'line', x: A.left, y, angle: 0, length: A.right - A.left, width: 86, warn: this.T(1.3), damage: 20, hitWindow: 0.25, color: '170,90,255' });
    }
    yield this.T(2.0);
  } };

  BR.BOSS_EXTRAS = X;
})();
