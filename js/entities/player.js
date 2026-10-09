/*
 * The player: movement, dash, combo attacks, charge skill (hold Q) and E skill.
 * What each attack does depends on the character; damage resolution lives in CombatSystem.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;
  const P = BR.CONFIG.PLAYER;
  const SK = BR.CONFIG.SKILLS;
  const AT = BR.CONFIG.ATTACKS;

  class Player {
    constructor(game, stats, character) {
      this.game = game;
      this.stats = stats;
      this.character = character || BR.CHARACTERS[0];
      this.radius = P.radius;
      this.x = 0;
      this.y = 0;
      this.hp = stats.maxHp;
      this.dead = false;
      this.afterimages = [];
      this.resetForFight(BR.CONFIG.WIDTH / 2, BR.CONFIG.ARENA.bottom - 100);
    }

    resetForFight(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.aim = -Math.PI / 2;
      this.energy = P.maxEnergy;
      this.attackTimer = 0;
      this.dashCooldownTimer = 0;
      this.dashTime = 0;
      this.dashSpeed = 0;
      this.dashDirX = 0;
      this.dashDirY = 0;
      this.dashBuffer = 0;
      this.iframes = 0;
      this.hurtTimer = 0;
      this.slowTimer = 0;
      this.slowFactor = 1;
      this.rageTimer = 0;
      this.lanceCharges = this.stats.skillCharges;
      this.lanceRecharge = 0;
      this.qCharge = -1;          // < 0 = not charging
      this.eTimer = 0;
      this.bulwarkTimer = 0;
      this.overheatTimer = 0;
      this.comboStep = 0;
      this.comboTimer = 0;
      this.swingSide = 1;
      this.recoil = 0;
      this.afterimages.length = 0;
      this.barrier = this.stats.barrier || 0;
      this.counterTimer = 0;
      this.lifestealAcc = 0;
      this.hasteTimer = 0;
      this.lastStandUsed = false;
      this.wasDash = false;
      this.dead = false;
    }

    get chargeTime() { return SK.charge.chargeTime * this.stats.chargeTimeMult; }
    get comboLength() { return Math.max(2, this.character.comboLength - this.stats.comboReduce); }

    get isDashing() { return this.dashTime > 0; }
    get isCharging() { return this.qCharge >= 0; }
    get dashCooldown() { return this.stats.dashCooldown; }
    get lanceCooldown() { return SK.charge.cooldown * this.stats.skillCooldownMult; }
    get eSkill() { return SK[this.character.e]; }
    get eCooldown() { return this.eSkill.cooldown * this.stats.skillCooldownMult; }
    get chargePower() { return this.isCharging ? Geo.clamp(this.qCharge / this.chargeTime, 0, 1) : 0; }

    onStatsChanged() {
      if (this.lanceCharges > this.stats.skillCharges) this.lanceCharges = this.stats.skillCharges;
      this.hp = Math.min(this.hp, this.stats.maxHp);
    }

    heal(amount) {
      if (amount <= 0 || this.dead) return 0;
      const before = this.hp;
      this.hp = Math.min(this.stats.maxHp, this.hp + amount);
      return this.hp - before;
    }

    // A dash-like burst of movement (used by dash and roll)
    startBurst(dx, dy, distance, duration, iframes) {
      this.dashDirX = dx;
      this.dashDirY = dy;
      this.dashTime = duration;
      this.dashSpeed = distance / duration;
      this.iframes = Math.max(this.iframes, iframes);
    }

    update(dt, input, allowControl) {
      if (this.dead) return;
      this._tickTimers(dt);

      const move = allowControl ? input.moveVector() : { x: 0, y: 0 };
      if (allowControl) {
        this.aim = input.aimAngle !== null ? input.aimAngle : Geo.angle(this.x, this.y, input.mouse.x, input.mouse.y);
        if (input.wasPressed('Space') || input.wasPressed('ShiftLeft')) this.dashBuffer = P.dashBuffer;
        if (this.dashBuffer > 0 && this.dashCooldownTimer <= 0 && !this.isDashing) this._startDash(move);
      } else if (this.isCharging) {
        this.qCharge = -1;
      }

      if (this.isDashing) {
        this.vx = this.dashDirX * this.dashSpeed;
        this.vy = this.dashDirY * this.dashSpeed;
        this.dashTime -= dt;
        this.afterimages.push({ x: this.x, y: this.y, life: 0.22 });
        if (this.dashTime <= 0) {
          this.vx *= 0.35;
          this.vy *= 0.35;
          if (this.wasDash && this.stats.dashShock) this.game.combat.dashShock(this);
          this.wasDash = false;
        }
      } else {
        let speed = this.stats.moveSpeed * (this.slowTimer > 0 ? this.slowFactor : 1);
        if (this.isCharging) speed *= SK.charge.moveSlow;
        const k = 1 - Math.exp(-P.acceleration * dt);
        this.vx += (move.x * speed - this.vx) * k;
        this.vy += (move.y * speed - this.vy) * k;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const c = Geo.clampToArena(this.x, this.y, this.radius);
      this.x = c.x;
      this.y = c.y;

      if (!allowControl) return;

      if (input.attacking && this.attackTimer <= 0 && !this.isDashing && !this.isCharging) this._attack();

      if (this.isCharging) {
        if (input.isDown('KeyQ')) {
          const before = this.qCharge;
          this.qCharge = Math.min(this.chargeTime, this.qCharge + dt);
          if (before < this.chargeTime && this.qCharge >= this.chargeTime) {
            this.game.audio.play('button');
            this.game.particles.emitRing('hit', this.x, this.y, 18, 14, { color: this.character.rgb });
          }
        } else {
          this._releaseCharge();
        }
      } else if (input.wasPressed('KeyQ')) {
        this._beginCharge();
      }

      if (input.wasPressed('KeyE')) this._castE();
    }

    _tickTimers(dt) {
      this.attackTimer -= dt;
      this.dashCooldownTimer -= dt;
      this.dashBuffer -= dt;
      this.iframes -= dt;
      this.hurtTimer -= dt;
      this.slowTimer -= dt;
      this.rageTimer -= dt;
      this.eTimer -= dt;
      this.bulwarkTimer -= dt;
      this.overheatTimer -= dt;
      this.comboTimer -= dt;
      this.counterTimer -= dt;
      this.hasteTimer -= dt;
      this.recoil = Math.max(0, this.recoil - dt * 8);
      this.energy = Math.min(P.maxEnergy, this.energy + P.energyRegen * this.stats.energyRegenMult * dt);
      if (this.lanceCharges < this.stats.skillCharges) {
        this.lanceRecharge -= dt;
        if (this.lanceRecharge <= 0) {
          this.lanceCharges++;
          if (this.lanceCharges < this.stats.skillCharges) this.lanceRecharge = this.lanceCooldown;
        }
      }
      for (let i = this.afterimages.length - 1; i >= 0; i--) {
        const a = this.afterimages[i];
        a.life -= dt;
        if (a.life <= 0) this.afterimages.splice(i, 1);
      }
    }

    _startDash(move) {
      let dx = move.x, dy = move.y;
      if (dx === 0 && dy === 0) { dx = Math.cos(this.aim); dy = Math.sin(this.aim); }
      this.startBurst(dx, dy, this.stats.dashDistance, P.dashDuration, P.dashIframes);
      this.wasDash = true;
      if (this.stats.dashHaste) this.hasteTimer = 1.5;
      this.game.onTutorialEvent('dash');
      this.dashCooldownTimer = this.dashCooldown;
      this.dashBuffer = 0;
      this.qCharge = -1;
      this.game.audio.play('dash');
      this.game.particles.emit('dust', this.x, this.y + 6, 6, { angle: Math.atan2(-dy, -dx), spread: 1.2, speedMult: 0.8 });
    }

    _attack() {
      const frenzy = this.stats.bloodFrenzy && this.hp < this.stats.maxHp * 0.5 ? 1.35 : 1;
      const haste = this.hasteTimer > 0 ? 1 + this.stats.dashHaste : 1;
      const heat = this.overheatTimer > 0 ? 1.7 : 1;
      this.attackTimer = this.character.attackCooldown / (this.stats.attackSpeedMult * frenzy * haste * heat);
      if (this.comboTimer <= 0) this.comboStep = 0;
      this.comboStep++;
      const finisher = this.comboStep >= this.comboLength;
      if (finisher) this.comboStep = 0;
      this.comboTimer = AT.comboWindow;
      this.swingSide *= -1;
      this.recoil = finisher ? 1.6 : 1;
      this.game.combat.playerAttack(this, this.aim, this.swingSide, finisher);
    }

    _beginCharge() {
      if (this.lanceCharges <= 0) return this._fail('NO CHARGE');
      if (this.energy < SK.charge.energyCost) return this._fail('NO ENERGY');
      this.qCharge = 0;
      this.game.audio.play('telegraph');
    }

    _releaseCharge() {
      const power = this.chargePower;
      this.qCharge = -1;
      if (this.lanceCharges <= 0 || this.energy < SK.charge.energyCost) return;
      this.energy -= SK.charge.energyCost;
      if (this.lanceCharges === this.stats.skillCharges) this.lanceRecharge = this.lanceCooldown;
      this.lanceCharges--;
      this.game.combat.playerChargeSkill(this, this.aim, power);
      if (power >= 1 && this.stats.chargeRefund) {
        this.energy = Math.min(P.maxEnergy, this.energy + SK.charge.energyCost * this.stats.chargeRefund);
      }
    }

    _castE() {
      if (this.eTimer > 0) return;
      const skill = this.eSkill;
      if (this.energy < skill.energyCost) return this._fail('NO ENERGY');
      this.energy -= skill.energyCost;
      this.eTimer = this.eCooldown;
      this.game.combat.playerESkill(this, this.character.e);
    }

    _fail(text) {
      this.game.spawnText(this.x, this.y - 26, text, { color: '#9aa4c8', size: 13, life: 0.5 });
    }

    draw(ctx, time) {
      const rgb = this.character.rgb;
      for (const a of this.afterimages) {
        Draw.circle(ctx, a.x, a.y, this.radius * 0.95, `rgba(${rgb},${a.life * 1.6})`);
      }
      if (this.dead) return;
      if (this.hurtTimer > 0 && Math.floor(time * 20) % 2 === 0) return;

      Draw.shadow(ctx, this.x, this.y + this.radius * 0.8, this.radius * 1.1, this.radius * 0.45);

      if (this.rageTimer > 0) Draw.glow(ctx, this.x, this.y, 34, '255,60,60', 0.5);
      if (this.counterTimer > 0) Draw.glow(ctx, this.x, this.y, 38, '255,255,255', 0.35);
      if (this.barrier > 0) Draw.circle(ctx, this.x, this.y, this.radius + 7, null, 'rgba(255,230,140,0.75)', 2);
      if (this.slowTimer > 0) Draw.circle(ctx, this.x, this.y, this.radius + 6, null, 'rgba(150,80,255,0.7)', 2);
      Draw.glow(ctx, this.x, this.y, 30, rgb, this.isDashing ? 0.9 : 0.45);

      // Charge indicator
      if (this.isCharging) {
        const p = this.chargePower;
        const full = p >= 1;
        Draw.glow(ctx, this.x, this.y, 30 + p * 26, rgb, 0.4 + p * 0.5);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
        ctx.strokeStyle = full ? '#ffffff' : `rgb(${rgb})`;
        ctx.lineWidth = full ? 4 : 3;
        ctx.stroke();
        // aim preview
        ctx.save();
        ctx.globalAlpha = 0.25 + p * 0.35;
        ctx.strokeStyle = `rgb(${rgb})`;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(this.aim) * 220, this.y + Math.sin(this.aim) * 220);
        ctx.stroke();
        ctx.restore();
      }

      // Bulwark shield
      if (this.overheatTimer > 0) Draw.glow(ctx, this.x, this.y, 52, '255,120,50', 0.35 + 0.2 * Math.sin(time * 20));
      if (this.bulwarkTimer > 0) {
        const pulse = 0.6 + 0.4 * Math.sin(time * 25);
        Draw.glow(ctx, this.x, this.y, 46, '157,255,138', 0.5);
        Draw.circle(ctx, this.x, this.y, this.radius + 14, `rgba(157,255,138,${0.15 * pulse})`, `rgba(220,255,210,${0.8 * pulse})`, 3);
      }

      // Weapon pointing toward aim
      const bx = this.x + Math.cos(this.aim) * (this.radius - 2 - this.recoil * 3);
      const by = this.y + Math.sin(this.aim) * (this.radius - 2 - this.recoil * 3);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(this.aim);
      ctx.fillStyle = '#f2fbff';
      if (this.character.attack === 'gun') {
        ctx.fillRect(2, -3, 18, 6);
        ctx.fillStyle = '#6b4a2a';
        ctx.fillRect(-2, -3, 6, 9);
      } else if (this.character.attack === 'orb') {
        Draw.glow(ctx, 16, 0, 12, this.character.rgb, 0.9);
        ctx.fillStyle = '#f3eaff';
        ctx.beginPath();
        ctx.arc(16, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.character.attack === 'spear') {
        ctx.fillStyle = '#8a6a3a';
        ctx.fillRect(-6, -1.5, 40, 3);
        ctx.fillStyle = '#fff2c8';
        ctx.beginPath();
        ctx.moveTo(48, 0);
        ctx.lineTo(32, -5);
        ctx.lineTo(32, 5);
        ctx.closePath();
        ctx.fill();
      } else if (this.character.attack === 'flame') {
        ctx.fillStyle = '#5a3a30';
        ctx.fillRect(2, -4, 14, 8);
        Draw.glow(ctx, 20, 0, 12 + 3 * Math.sin(time * 30), '255,130,50', 0.9);
      } else if (this.character.attack === 'hammer') {
        ctx.fillStyle = '#8a8f98';
        ctx.fillRect(2, -2, 16, 4);
        ctx.fillStyle = '#d8dde4';
        ctx.fillRect(16, -9, 10, 18);
      } else {
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(4, -4);
        ctx.lineTo(0, 0);
        ctx.lineTo(4, 4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      const body = this.character.attack === 'hammer' ? this.radius + 2 : this.radius;
      Draw.circle(ctx, this.x, this.y, body, '#14262e', `rgb(${rgb})`, 2.5);
      Draw.circle(ctx, this.x + Math.cos(this.aim) * 3, this.y + Math.sin(this.aim) * 3, body * 0.45, '#effdff');
      // Combo pips
      if (this.comboStep > 0 && this.comboTimer > 0) {
        const n = this.comboLength - 1;
        for (let i = 0; i < n; i++) {
          Draw.circle(ctx, this.x - (n - 1) * 4 + i * 8, this.y + this.radius + 9, 2.2, i < this.comboStep ? `rgb(${rgb})` : 'rgba(255,255,255,0.2)');
        }
      }
    }
  }

  BR.Player = Player;
})();
