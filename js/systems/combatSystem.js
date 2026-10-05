/* All damage resolution: player attacks/skills, parries, boss hazards/projectiles, contact. */
(function () {
  'use strict';
  const { Geo } = BR;
  const C = BR.CONFIG;
  const P = C.PLAYER;
  const SK = C.SKILLS;
  const AT = C.ATTACKS;
  const PR = C.PARRY;

  class CombatSystem {
    constructor(game) {
      this.game = game;
    }

    /* ---------------- per-frame collision ---------------- */
    update(dt) {
      const g = this.game;
      const player = g.player;
      const boss = g.boss;
      if (!player) return;

      // Ember Core burn
      if (boss && boss.burnTimer > 0 && !boss.dead) {
        boss.burnTimer -= dt;
        boss.burnTick = (boss.burnTick || 0) - dt;
        if (boss.burnTick <= 0) {
          boss.burnTick = 0.5;
          if (boss.isHittable()) {
            this.damageBoss(player.stats.damage * player.stats.burn * 0.5, boss.x + Geo.rand(-12, 12), boss.y - boss.radius * 0.3, { dot: true, canCrit: false });
          }
        }
      }

      for (const proj of g.projectiles) {
        if (proj.dead) continue;
        if (proj.owner === 'player') {
          if (boss && !proj.hitTargets.has(boss) && boss.isHittable() &&
              Geo.circlesOverlap(proj.x, proj.y, proj.radius, boss.x, boss.y, boss.radius)) {
            proj.hitTargets.add(boss);
            this.damageBoss(proj.damage, proj.x, proj.y, {
              canCrit: proj.canCrit, angle: proj.angle, skill: proj.isSkill, finisher: proj.isFinisher,
              sx: proj.x - proj.vx * 0.05, sy: proj.y - proj.vy * 0.05,
            });
            if (proj.onHit) proj.onHit(proj, g);
            if (!proj.pierce) proj.dead = true;
          }
          if (boss && !proj.dead) {
            for (const t of boss.extraTargets) {
              if (t.dead || proj.hitTargets.has(t) || !Geo.circlesOverlap(proj.x, proj.y, proj.radius, t.x, t.y, t.radius)) continue;
              proj.hitTargets.add(t);
              this.damageTarget(t, proj.damage, proj.x, proj.y);
              if (!proj.pierce) { proj.dead = true; break; }
            }
          }
          if (proj.clearsProjectiles) this._clearAround(proj.x, proj.y, proj.radius + 10);
        } else if (!player.dead && player.iframes <= 0 &&
                   Geo.circlesOverlap(proj.x, proj.y, proj.radius * 0.85, player.x, player.y, player.radius * 0.8)) {
          if (player.stats.reflectChance && !proj.unclearable && Math.random() < player.stats.reflectChance) {
            // Mirror Shield: send it back
            proj.owner = 'player';
            proj.vx *= -1.2;
            proj.vy *= -1.2;
            proj.homing = 0;
            proj.damage = player.stats.damage * 1.5;
            proj.life = Math.max(proj.life, 1.5);
            proj.hitTargets.clear();
            g.spawnText(player.x, player.y - 28, 'REFLECT', { color: '#cfe8ff', size: 14, life: 0.5 });
            g.particles.emit('spark', proj.x, proj.y, 8);
            player.iframes = Math.max(player.iframes, 0.2);
          } else if (this.damagePlayer(proj.damage, proj.x, proj.y)) proj.dead = true;
        }
      }

      if (!player.dead) {
        for (const h of g.hazards) {
          if (!h.isDamaging() || !h.contains(player.x, player.y, player.radius)) continue;
          if (h.slow) { player.slowTimer = 0.15; player.slowFactor = 1 - h.slow; }
          if (h.persistent) {
            if (h.tickTimer <= 0 && this.damagePlayer(h.damage, h.x, h.y)) h.tickTimer = h.tickInterval;
          } else if (!h.hasHit) {
            if (this.damagePlayer(h.damage, h.x, h.y)) h.hasHit = true;
          }
        }
      }

      // Body contact: always pushes, only hurts while the boss is mid-dash
      if (boss && boss.active && !boss.dead && !player.dead && boss.alpha > 0.5 && !boss.airborne) {
        const d = Geo.dist(boss.x, boss.y, player.x, player.y);
        const minDist = boss.radius + player.radius;
        if (d < minDist) {
          if (boss.contactDamage > 0) this.damagePlayer(Math.round(boss.contactDamage * boss.damageMult), boss.x, boss.y);
          const a = d > 0.01 ? Geo.angle(boss.x, boss.y, player.x, player.y) : Math.random() * Geo.TAU;
          const c = Geo.clampToArena(boss.x + Math.cos(a) * minDist, boss.y + Math.sin(a) * minDist, player.radius);
          player.x = c.x;
          player.y = c.y;
        }
      }
    }

    _clearAround(x, y, radius) {
      let cleared = 0;
      for (const p of this.game.projectiles) {
        if (p.owner !== 'boss' || p.dead || p.unclearable) continue;
        if (Geo.circlesOverlap(x, y, radius, p.x, p.y, p.radius)) {
          p.dead = true;
          cleared++;
          this.game.particles.emit('spark', p.x, p.y, 4);
        }
      }
      return cleared;
    }

    /* ---------------- player basic attacks ---------------- */
    playerAttack(player, angle, side, finisher) {
      switch (player.character.attack) {
        case 'gun': return this._gunAttack(player, angle, finisher);
        case 'hammer': return this._hammerAttack(player, angle, side, finisher);
        case 'orb': return this._orbAttack(player, angle, finisher);
        default: return this._slashAttack(player, angle, side, finisher);
      }
    }

    // Melee cone vs boss + extra targets. Returns { bossHit, targets }.
    _meleeCone(player, angle, range, arc, damage, opts) {
      const boss = this.game.boss;
      const result = { bossHit: false, targets: [] };
      if (!boss) return result;
      if (boss.isHittable() && Geo.inCone(boss.x, boss.y, player.x, player.y, angle, arc, range, boss.radius)) {
        const hx = boss.x - Math.cos(angle) * boss.radius * 0.6;
        const hy = boss.y - Math.sin(angle) * boss.radius * 0.6;
        this.damageBoss(damage, hx, hy, Object.assign({ angle, sx: player.x, sy: player.y }, opts));
        result.bossHit = true;
      }
      for (const t of boss.extraTargets) {
        if (t.dead || !Geo.inCone(t.x, t.y, player.x, player.y, angle, arc, range, t.radius)) continue;
        this.damageTarget(t, damage, t.x, t.y);
        result.targets.push(t);
      }
      return result;
    }

    _spawnPlayerProjectiles(player, angle, count, spread, base, skipFirstTargets) {
      const center = Math.floor(count / 2);
      for (let i = 0; i < count; i++) {
        const a = angle + (i - (count - 1) / 2) * spread;
        const proj = new BR.Projectile(Object.assign({}, base, {
          owner: 'player',
          x: player.x + Math.cos(a) * 18, y: player.y + Math.sin(a) * 18,
          angle: a,
        }));
        if (i === center && skipFirstTargets) for (const t of skipFirstTargets) proj.hitTargets.add(t);
        this.game.projectiles.push(proj);
      }
    }

    _slashAttack(player, angle, side, finisher) {
      const g = this.game;
      const s = player.stats;
      const mult = finisher ? AT.finisherMult : 1;
      const range = P.slashRange * (finisher ? 1.25 : 1) * (s.meleeRangeMult || 1);
      const arc = P.slashArc * (finisher ? 1.3 : 1);
      const hit = this._meleeCone(player, angle, range, arc, s.damage * mult, { finisher });

      const skip = hit.targets.slice();
      if (hit.bossHit && g.boss) skip.push(g.boss);
      const speed = P.waveSpeed * s.projectileSpeedMult;
      this._spawnPlayerProjectiles(player, angle, s.projectileCount, P.waveSpread, {
        kind: 'wave', speed, radius: finisher ? 17 : 11,
        damage: s.damage * P.waveDamageRatio * mult, life: (P.waveRange * s.projectileRangeMult) / speed,
        pierce: finisher || s.wavePierce, isFinisher: finisher,
      }, skip);

      g.effects.push(new BR.SlashFx({
        x: player.x, y: player.y, angle, radius: range * 0.85, arc, dir: side, follow: player,
        color: finisher ? '230,255,255' : '150,240,255', width: finisher ? 22 : 14, life: finisher ? 0.2 : 0.14,
      }));
      if (finisher) g.camera.shakePreset('small');
      g.audio.play(finisher ? 'swing' : 'attack');
    }

    _gunAttack(player, angle, finisher) {
      const g = this.game;
      const s = player.stats;
      const G = AT.gun;
      const speed = G.speed * s.projectileSpeedMult;
      const aim = angle + (Math.random() - 0.5) * 2 * G.jitter;
      this._spawnPlayerProjectiles(player, aim, s.projectileCount, G.spread, {
        kind: finisher ? 'bigBullet' : 'bullet', speed, radius: (finisher ? 9 : G.radius) * (s.meleeRangeMult || 1),
        damage: s.damage * (finisher ? 2.6 : 1), life: (G.range * s.projectileRangeMult) / speed,
        pierce: finisher || s.wavePierce, isFinisher: finisher, color: player.character.rgb,
      });
      player.vx -= Math.cos(angle) * (finisher ? 60 : 12);
      player.vy -= Math.sin(angle) * (finisher ? 60 : 12);
      g.particles.emit('spark', player.x + Math.cos(angle) * 22, player.y + Math.sin(angle) * 22, finisher ? 6 : 2, { angle, spread: 0.6 });
      if (finisher) g.camera.shakePreset('small');
      g.audio.play(finisher ? 'crit' : 'shoot');
    }

    _orbAttack(player, angle, finisher) {
      const g = this.game;
      const s = player.stats;
      const speed = 520 * s.projectileSpeedMult;
      const count = s.projectileCount + (finisher ? 2 : 0);
      this._spawnPlayerProjectiles(player, angle, count, finisher ? 0.35 : 0.18, {
        kind: 'orb', speed, radius: (finisher ? 9 : 7) * (s.meleeRangeMult || 1), damage: s.damage * (finisher ? 1.2 : 1),
        life: (600 * s.projectileRangeMult) / speed, homing: 3.2, pierce: !!s.wavePierce,
        isFinisher: finisher, color: player.character.rgb,
      });
      g.particles.emit('magic', player.x + Math.cos(angle) * 18, player.y + Math.sin(angle) * 18, finisher ? 6 : 2, { angle, spread: 0.8 });
      g.audio.play(finisher ? 'skill' : 'shoot');
    }

    // Arcane Bomb explosion (charge skill of the Arcanist)
    arcaneBlast(player, x, y, power) {
      const g = this.game;
      const s = player.stats;
      const B = SK.bomb;
      const radius = Geo.lerp(B.blast[0], B.blast[1], power);
      const dmg = s.damage * Geo.lerp(B.blastMult[0], B.blastMult[1], power) * s.skillDamageMult * (power >= 1 ? s.fullChargeMult : 1);
      const boss = g.boss;
      if (boss && boss.isHittable() && Geo.dist(x, y, boss.x, boss.y) <= radius + boss.radius) {
        const a = Geo.angle(x, y, boss.x, boss.y);
        this.damageBoss(dmg, boss.x - Math.cos(a) * boss.radius * 0.5, boss.y - Math.sin(a) * boss.radius * 0.5, { angle: a, skill: true, sx: x, sy: y });
      }
      if (boss) {
        for (const t of boss.extraTargets) {
          if (!t.dead && Geo.dist(x, y, t.x, t.y) <= radius + t.radius) this.damageTarget(t, dmg, t.x, t.y);
        }
      }
      this._clearAround(x, y, radius);
      g.effects.push(new BR.RingFx({ x, y, r0: 10, r1: radius, color: '195,155,255', width: 14, life: 0.35 }));
      g.particles.emit('magic', x, y, 24, { radius: radius * 0.4, speedMult: 1.6 });
      g.camera.shakePreset(power >= 1 ? 'medium' : 'small');
      g.audio.play('explosion');
    }

    _hammerAttack(player, angle, side, finisher) {
      const g = this.game;
      const s = player.stats;
      const H = AT.hammer;
      if (finisher) {
        // Ground quake around the player
        const r = H.quakeRadius * (s.meleeRangeMult || 1);
        const boss = g.boss;
        if (boss && boss.isHittable() && Geo.dist(player.x, player.y, boss.x, boss.y) <= r + boss.radius) {
          const a = Geo.angle(player.x, player.y, boss.x, boss.y);
          this.damageBoss(s.damage * AT.finisherMult, boss.x - Math.cos(a) * boss.radius, boss.y - Math.sin(a) * boss.radius, { angle: a, finisher: true, sx: player.x, sy: player.y });
        }
        if (boss) {
          for (const t of boss.extraTargets) {
            if (!t.dead && Geo.dist(player.x, player.y, t.x, t.y) <= r + t.radius) this.damageTarget(t, s.damage * AT.finisherMult, t.x, t.y);
          }
        }
        this._clearAround(player.x, player.y, r * 0.6);
        g.effects.push(new BR.RingFx({ x: player.x, y: player.y, r0: 20, r1: r, color: '190,255,170', width: 18, life: 0.35 }));
        g.particles.emit('dust', player.x, player.y, 22, { radius: r * 0.5, speedMult: 1.4 });
        g.particles.emit('rock', player.x, player.y, 8, { radius: 30 });
        g.camera.shakePreset('medium');
        g.audio.play('explosion');
      } else {
        const hRange = H.range * (s.meleeRangeMult || 1);
        const hit = this._meleeCone(player, angle, hRange, H.arc, s.damage, {});
        g.effects.push(new BR.SlashFx({
          x: player.x, y: player.y, angle, radius: hRange * 0.8, arc: H.arc, dir: side, follow: player,
          color: '190,255,170', width: 26, life: 0.18,
        }));
        const skip = hit.targets.slice();
        if (hit.bossHit && g.boss) skip.push(g.boss);
        const speed = 520 * s.projectileSpeedMult;
        this._spawnPlayerProjectiles(player, angle, s.projectileCount, 0.3, {
          kind: 'shock', speed, radius: 16, damage: s.damage * H.shockRatio, pierce: !!s.wavePierce,
          life: (H.shockRange * s.projectileRangeMult) / speed, color: player.character.rgb,
        }, skip);
        if (hit.bossHit) g.camera.shakePreset('small');
        g.audio.play('swing');
      }
    }

    /* ---------------- Q: charge skills ---------------- */
    playerChargeSkill(player, angle, power) {
      const g = this.game;
      const s = player.stats;
      const kind = player.character.charge;
      const def = SK[kind];
      const lerp = (pair) => Geo.lerp(pair[0], pair[1], power);
      const full = power >= 1;
      if (kind === 'bomb') {
        let exploded = false;
        const boom = (p) => { if (exploded) return; exploded = true; p.dead = true; this.arcaneBlast(player, p.x, p.y, power); };
        g.projectiles.push(new BR.Projectile({
          owner: 'player', kind: 'bomb',
          x: player.x + Math.cos(angle) * 20, y: player.y + Math.sin(angle) * 20,
          angle, speed: def.speed, radius: lerp(def.radius), damage: s.damage * lerp(def.damageMult) * s.skillDamageMult,
          life: def.range / def.speed, isSkill: true, onHit: boom, onExpire: boom,
        }));
        player.recoil = 2;
        if (full) {
          g.spawnText(player.x, player.y - 30, 'MAX!', { color: '#ffffff', size: 16, life: 0.5 });
          g.onTutorialEvent('charge');
        }
        g.audio.play('skill');
        return;
      }
      const fullMult = full ? s.fullChargeMult : 1;
      g.projectiles.push(new BR.Projectile({
        owner: 'player', kind,
        x: player.x + Math.cos(angle) * 20, y: player.y + Math.sin(angle) * 20,
        angle, speed: def.speed, radius: lerp(def.radius),
        damage: fullMult * s.damage * lerp(def.damageMult) * s.skillDamageMult * (player.character.attack === 'gun' ? 1.7 : player.character.attack === 'hammer' ? 0.5 : 1),
        life: def.range / def.speed, pierce: true, clearsProjectiles: true, isSkill: true, color: player.character.rgb,
      }));
      player.recoil = 2;
      player.vx -= Math.cos(angle) * (120 + power * 180);
      player.vy -= Math.sin(angle) * (120 + power * 180);
      g.camera.shakePreset(full ? 'medium' : 'small');
      g.particles.emit('hit', player.x, player.y, 10 + Math.round(power * 14), { angle, spread: 0.8, color: player.character.rgb });
      if (full) {
        g.spawnText(player.x, player.y - 30, 'MAX!', { color: '#ffffff', size: 16, life: 0.5 });
        g.onTutorialEvent('charge');
      }
      g.audio.play('skill');
    }

    /* ---------------- E skills + PARRY ---------------- */
    playerESkill(player, type) {
      if (type === 'roll') return this._roll(player);
      if (type === 'bulwark') return this._bulwark(player);
      if (type === 'blink') return this._blink(player);
      return this._nova(player);
    }

    // Something is about to hit the player right now? Cancels it and returns true.
    _tryParry(player) {
      const g = this.game;
      let parried = false;
      for (const h of g.hazards) {
        if (h.damage <= 0 || h.dead) continue;
        const aboutToHit = (h.state === 'warn' && h.progress >= PR.hazardProgress) || (h.state === 'active' && !h.persistent);
        if (aboutToHit && h.contains(player.x, player.y, player.radius)) {
          h.dead = true;
          parried = true;
        }
      }
      if (this._clearAround(player.x, player.y, PR.projectileRadius) > 0) parried = true;
      const boss = g.boss;
      if (boss && boss.contactDamage > 0 && Geo.dist(player.x, player.y, boss.x, boss.y) <= boss.radius + 90) parried = true;
      if (parried) this.onParry(player);
      return parried;
    }

    onParry(player) {
      const g = this.game;
      const healed = player.heal(PR.heal + player.stats.parryHealBonus);
      if (player.stats.counterBuff) player.counterTimer = 3;
      player.energy = Math.min(P.maxEnergy, player.energy + PR.energy);
      player.eTimer *= PR.cooldownRefund;
      g.spawnText(player.x, player.y - 34, 'PARRY!', { color: '#ffffff', size: 22, life: 0.8 });
      if (healed > 0) g.spawnText(player.x + 26, player.y - 14, `+${Math.round(healed)}`, { color: '#7dffa0', size: 15 });
      g.effects.push(new BR.RingFx({ x: player.x, y: player.y, r0: 10, r1: 90, color: '255,255,255', width: 6, life: 0.3 }));
      g.particles.emit('heal', player.x, player.y, 10);
      g.particles.emit('spark', player.x, player.y, 14);
      g.hitstop = Math.max(g.hitstop, 0.12);
      g.flash = Math.max(g.flash, 0.25);
      g.flashColor = '200,255,255';
      g.audio.play('parry');
      g.recordStat('parries', 1);
      // Counter: reflect damage + stun the boss
      const boss = g.boss;
      if (boss && boss.isHittable()) {
        this.damageBoss(player.stats.damage * PR.reflectMult, boss.x, boss.y - boss.radius * 0.4, { canCrit: false, skill: true, parry: true });
        if (!boss.dead && boss.stun(PR.stun)) {
          g.particles.emit('spark', boss.x, boss.y - boss.radius, 12, { angle: -Math.PI / 2, spread: 1.2 });
          g.camera.shakePreset('medium');
        }
      }
      g.onTutorialEvent('parry');
      if (player.stats.relicBattery && player.lanceCharges < player.stats.skillCharges) player.lanceCharges++;
      if (player.stats.perfectCounter) this.playerChargeSkill(player, player.aim, 1);
    }

    _nova(player) {
      const g = this.game;
      const s = player.stats;
      const boss = g.boss;
      const sc = s.eSkillScale || 1;
      const N = Object.assign({}, SK.nova, { radius: SK.nova.radius * sc, clearRadius: SK.nova.clearRadius * sc });
      player.iframes = Math.max(player.iframes, N.iframes);
      this._tryParry(player);
      g.effects.push(new BR.RingFx({ x: player.x, y: player.y, r0: 10, r1: N.radius, color: '120,230,255', width: 16, life: 0.35 }));
      g.effects.push(new BR.RingFx({ x: player.x, y: player.y, r0: 20, r1: N.clearRadius, color: '200,250,255', width: 4, life: 0.45 }));
      g.particles.emitRing('hit', player.x, player.y, 20, 28, { speedMult: 1.6 });
      this._clearAround(player.x, player.y, N.clearRadius);
      const dmg = s.damage * N.damageMult * s.skillDamageMult;
      if (boss && boss.isHittable() && Geo.dist(player.x, player.y, boss.x, boss.y) <= N.radius + boss.radius) {
        const a = Geo.angle(player.x, player.y, boss.x, boss.y);
        this.damageBoss(dmg, boss.x - Math.cos(a) * boss.radius, boss.y - Math.sin(a) * boss.radius, { angle: a, skill: true, sx: player.x, sy: player.y });
      }
      if (boss) {
        for (const t of boss.extraTargets) {
          if (!t.dead && Geo.dist(player.x, player.y, t.x, t.y) <= N.radius + t.radius) this.damageTarget(t, dmg, t.x, t.y);
        }
      }
      g.camera.shakePreset('small');
      g.audio.play('nova');
    }

    _roll(player) {
      const g = this.game;
      const s = player.stats;
      const R = SK.roll;
      this._tryParry(player);
      const back = player.aim + Math.PI;
      player.startBurst(Math.cos(back), Math.sin(back), R.distance * (s.eSkillScale || 1), R.duration, R.iframes);
      // Shotgun blast toward the aim
      const speed = AT.gun.speed * s.projectileSpeedMult;
      for (let i = 0; i < R.shots; i++) {
        const a = player.aim + (i / (R.shots - 1) - 0.5) * R.spread;
        g.projectiles.push(new BR.Projectile({
          owner: 'player', kind: 'bullet', x: player.x, y: player.y, angle: a, speed: speed * 0.85, radius: 6,
          damage: s.damage * R.damageMult * s.skillDamageMult, life: 0.45, isSkill: true, color: player.character.rgb,
        }));
      }
      g.particles.emit('dust', player.x, player.y, 16, { radius: 14 });
      g.camera.shakePreset('small');
      g.audio.play('dash');
    }

    _blink(player) {
      const g = this.game;
      const B = SK.blink;
      this._tryParry(player);
      const from = { x: player.x, y: player.y };
      const dist = B.distance * (player.stats.eSkillScale || 1);
      const to = Geo.clampToArena(player.x + Math.cos(player.aim) * dist, player.y + Math.sin(player.aim) * dist, player.radius);
      g.particles.emit('magic', from.x, from.y, 16, { radius: 12 });
      for (let i = 1; i <= 6; i++) player.afterimages.push({ x: Geo.lerp(from.x, to.x, i / 7), y: Geo.lerp(from.y, to.y, i / 7), life: 0.3 });
      player.x = to.x;
      player.y = to.y;
      player.vx = player.vy = 0;
      player.iframes = Math.max(player.iframes, B.iframes);
      g.particles.emit('magic', to.x, to.y, 16, { radius: 12 });
      g.audio.play('teleport');
    }

    _bulwark(player) {
      const g = this.game;
      player.bulwarkTimer = SK.bulwark.duration * (player.stats.eSkillScale || 1);
      this._tryParry(player);
      g.effects.push(new BR.RingFx({ x: player.x, y: player.y, r0: 10, r1: 60, color: '157,255,138', width: 8, life: 0.3 }));
      g.audio.play('nova');
    }

    /* ---------------- damage ---------------- */
    damageBoss(base, x, y, opts = {}) {
      const g = this.game;
      const boss = g.boss;
      const player = g.player;
      if (!boss || !boss.isHittable() || !player) return 0;
      const s = player.stats;

      // Directional defence (e.g. gun block): source position decides
      const sx = opts.sx !== undefined ? opts.sx : player.x;
      const sy = opts.sy !== undefined ? opts.sy : player.y;
      const incoming = opts.dot || opts.parry ? 1 : boss.incomingMultiplier(sx, sy);
      if (incoming <= 0) {
        g.particles.emit('spark', x, y, 6, { angle: Geo.angle(boss.x, boss.y, sx, sy), spread: 1 });
        g.spawnText(x, y - 12, 'BLOCKED', { color: '#c9c9c9', size: 13, life: 0.45 });
        g.audio.play('hit');
        boss.onBlocked(sx, sy);
        return 0;
      }

      let mult = s.damageMult * incoming;
      if (s.berserker) mult *= 1 + s.berserker * (1 - player.hp / s.maxHp);
      if (s.vengeance && player.rageTimer > 0) mult *= 1 + s.vengeance;
      if (s.executioner && boss.hpRatio <= 0.2) mult *= 1 + s.executioner;
      if (s.counterBuff && player.counterTimer > 0) mult *= 1 + s.counterBuff;
      if (opts.finisher && s.finisherBonus) mult *= 1 + s.finisherBonus;
      const crit = opts.canCrit !== false && Math.random() < s.critChance;
      if (crit) mult *= s.critMultiplier;
      const variance = 1 + (Math.random() * 2 - 1) * C.COMBAT.damageVariance;
      const amount = Math.max(1, Math.round(base * mult * variance));

      if (opts.dot) {
        boss.takeDamage(amount);
        if (g.run) g.run.damageDealt += amount;
        g.spawnDamageNumber(x, y - 10, amount, '#ff9a4a', 13);
        g.particles.emit('fire', x, y, 2);
        if (boss.hp <= 0) g.onBossDefeated();
        return amount;
      }

      boss.takeDamage(amount);
      if (s.burn) boss.burnTimer = 3;
      if (g.run) g.run.damageDealt += amount;
      player.energy = Math.min(P.maxEnergy, player.energy + P.energyOnHit + s.energyOnHitBonus);
      if (opts.finisher) {
        g.recordStat('finishers', 1);
        g.onTutorialEvent('finisher');
      }
      if (s.lifestealPer) {
        player.lifestealAcc += amount;
        const heal = Math.floor(player.lifestealAcc / s.lifestealPer);
        if (heal > 0) {
          player.lifestealAcc -= heal * s.lifestealPer;
          player.heal(heal);
        }
      }
      if (incoming > 1) {
        g.spawnText(x, y - 34, 'BACKSTAB', { color: '#ffb35e', size: 14, life: 0.6 });
        g.recordSpecial('backstab');
      }

      const angle = opts.angle !== undefined ? opts.angle : Geo.angle(player.x, player.y, x, y);
      g.particles.emit(crit ? 'crit' : 'hit', x, y, crit ? 14 : 8, { angle, spread: 1.6 });
      const big = crit || opts.skill || opts.finisher;
      g.spawnDamageNumber(x, y - 10, amount, crit ? '#ffd84a' : opts.skill ? '#8ff3ff' : opts.finisher ? '#d6fbff' : '#ffffff', crit ? 26 : big ? 22 : 17);
      g.hitstop = Math.max(g.hitstop, big ? C.COMBAT.critHitstop : C.COMBAT.hitstop);
      if (crit || opts.skill) g.camera.shakePreset('small');
      g.audio.play(crit ? 'crit' : 'bossHit');

      if (crit && s.critHeal) {
        const healed = player.heal(s.critHeal);
        if (healed > 0) g.particles.emit('heal', player.x, player.y, 4);
      }

      if (s.echoChance && Math.random() < s.echoChance && boss.hp > 0) {
        const echo = Math.max(1, Math.round(amount * 0.5));
        boss.takeDamage(echo);
        g.spawnDamageNumber(x + 18, y - 28, echo, '#c79bff', 15);
        g.particles.emit('magic', x, y, 6);
      }

      if (boss.hp <= 0) g.onBossDefeated();
      return amount;
    }

    // Non-boss attackable objects (crystals, totems...). Plain damage, no crits/procs.
    damageTarget(t, base, x, y) {
      const g = this.game;
      if (!t || t.dead || !g.player) return;
      const amount = Math.max(1, Math.round(base * g.player.stats.damageMult));
      t.hp -= amount;
      t.flash = 1;
      g.spawnDamageNumber(x, y - 10, amount, '#bfe6ff', 15);
      g.particles.emit(t.particle || 'hit', x, y, 6);
      g.audio.play('hit');
      g.hitstop = Math.max(g.hitstop, C.COMBAT.hitstop);
      if (t.hp <= 0) {
        t.dead = true;
        if (t.onDestroy) t.onDestroy(t);
      }
    }

    damagePlayer(amount, sx, sy) {
      const g = this.game;
      const p = g.player;
      if (!p || p.dead || p.iframes > 0 || g.state !== 'fight') return false;
      if (p.bulwarkTimer > 0) {
        // Guardian's Bulwark absorbs the hit and counts as a parry
        p.iframes = 0.25;
        this.onParry(p);
        return true;
      }
      if (p.barrier > 0) {
        p.barrier--;
        p.iframes = 0.6;
        g.spawnText(p.x, p.y - 30, 'BARRIER', { color: '#ffe68c', size: 16, life: 0.7 });
        g.effects.push(new BR.RingFx({ x: p.x, y: p.y, r0: 10, r1: 70, color: '255,230,140', width: 6, life: 0.35 }));
        g.audio.play('nova');
        return true;
      }
      const final = Math.max(1, Math.round(amount * (1 - p.stats.damageReduction) * (p.stats.damageTakenMult || 1)));
      p.hp -= final;
      if (g.run && g.run.mode === 'tutorial') p.hp = Math.max(1, p.hp);
      // Last Stand: once per fight, dropping under 25% grants 2s of invulnerability
      if (p.stats.lastStand && !p.lastStandUsed && p.hp > 0 && p.hp < p.stats.maxHp * 0.25) {
        p.lastStandUsed = true;
        p.iframes = 2;
        g.spawnText(p.x, p.y - 40, 'LAST STAND', { color: '#ffd76a', size: 18, life: 1 });
        g.effects.push(new BR.RingFx({ x: p.x, y: p.y, r0: 10, r1: 90, color: '255,215,106', width: 8, life: 0.5 }));
      }
      p.iframes = P.hitIframes;
      p.hurtTimer = P.hitIframes;
      p.qCharge = -1;
      if (p.stats.vengeance) p.rageTimer = 4;
      if (g.run) {
        g.run.damageTaken += final;
        g.run.bossDamageTaken += final;
      }

      const a = Geo.angle(sx, sy, p.x, p.y);
      p.vx += Math.cos(a) * P.hitKnockback;
      p.vy += Math.sin(a) * P.hitKnockback;

      g.spawnDamageNumber(p.x, p.y - 22, final, '#ff5068', 20);
      g.particles.emit('blood', p.x, p.y, 12, { angle: a, spread: 1.8 });
      g.camera.shakePreset(final >= 20 ? 'medium' : 'hit');
      g.hurtVignette = 1;
      g.hitstop = Math.max(g.hitstop, 0.05);
      g.audio.play('playerHurt');

      if (p.stats.thorns && g.boss && g.boss.isHittable()) {
        const b = g.boss;
        this.damageBoss(p.stats.damage * p.stats.thorns, b.x, b.y - b.radius * 0.5, { canCrit: false, sx: p.x, sy: p.y });
      }

      if (p.hp <= 0) {
        if (p.stats.phoenix > 0) {
          p.stats.phoenix--;
          if (g.run) g.run.phoenixUsed = (g.run.phoenixUsed || 0) + 1;
          p.hp = Math.round(p.stats.maxHp * 0.4);
          p.iframes = 2;
          g.showBanner('REVIVED', 'Phoenix Feather', '#ffb35e', 1.6);
          g.particles.emit('fire', p.x, p.y, 40, { radius: 20 });
          g.effects.push(new BR.RingFx({ x: p.x, y: p.y, r0: 10, r1: 160, color: '255,180,80', width: 12, life: 0.6 }));
          g.audio.play('bossPhase');
          return true;
        }
        p.hp = 0;
        g.onPlayerDeath();
      }
      return true;
    }

    // Shock Step upgrade: burst at the end of a dash
    dashShock(player) {
      const g = this.game;
      const s = player.stats;
      const r = 90 * (s.dashShockRadius || 1);
      const boss = g.boss;
      g.effects.push(new BR.RingFx({ x: player.x, y: player.y, r0: 10, r1: r, color: player.character.rgb, width: 8, life: 0.25 }));
      if (boss && boss.isHittable() && Geo.dist(player.x, player.y, boss.x, boss.y) <= r + boss.radius) {
        const a = Geo.angle(player.x, player.y, boss.x, boss.y);
        this.damageBoss(s.damage * s.dashShock, boss.x - Math.cos(a) * boss.radius, boss.y - Math.sin(a) * boss.radius, { angle: a, sx: player.x, sy: player.y });
      }
    }

    knockPlayer(fromX, fromY, radius, power) {
      const p = this.game.player;
      if (!p || p.dead) return;
      const d = Geo.dist(fromX, fromY, p.x, p.y);
      if (d > radius) return;
      const a = d > 0.01 ? Geo.angle(fromX, fromY, p.x, p.y) : Math.random() * Geo.TAU;
      const k = 1 - d / radius;
      p.vx += Math.cos(a) * power * (0.5 + k);
      p.vy += Math.sin(a) * power * (0.5 + k);
    }
  }

  BR.CombatSystem = CombatSystem;
})();
