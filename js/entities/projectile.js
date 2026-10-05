/* Projectiles for both sides. owner: 'player' | 'boss'. */
(function () {
  'use strict';
  const { Draw } = BR;

  const TRAILS = { fireball: 'fire', void: 'void', abyss: 'abyss', lance: 'hit', rail: 'spark', quake: 'dust', slug: 'spark', sand: 'dust', spirit: 'magic' };

  class Projectile {
    constructor(o) {
      this.owner = o.owner || 'boss';
      this.kind = o.kind || 'orb';
      this.x = o.x;
      this.y = o.y;
      const speed = o.speed || 300;
      this.vx = o.vx !== undefined ? o.vx : Math.cos(o.angle || 0) * speed;
      this.vy = o.vy !== undefined ? o.vy : Math.sin(o.angle || 0) * speed;
      this.radius = o.radius || 8;
      this.damage = o.damage || 10;
      this.life = o.life || 3;
      this.maxLife = this.life;
      this.pierce = !!o.pierce;
      this.canCrit = o.canCrit !== false;
      this.clearsProjectiles = !!o.clearsProjectiles;
      this.hitTargets = new Set();
      this.homing = o.homing || 0;          // rad/s turn rate toward the player
      this.bounces = o.bounces || 0;        // wall bounces left
      this.onExpire = o.onExpire || null;   // called when life runs out (not on hit)
      this.color = o.color || null;         // rgb string for tinted kinds
      this.isSkill = !!o.isSkill;
      this.isFinisher = !!o.isFinisher;
      this.unclearable = !!o.unclearable;   // skills can't delete it (big boss bullets)
      this.onHit = o.onHit || null;         // player projectiles: called when hitting the boss
      this.age = 0;
      this.dead = false;
    }

    get angle() { return Math.atan2(this.vy, this.vx); }

    update(dt, game) {
      this.age += dt;
      const homingTarget = this.owner === 'player'
        ? (game && game.boss && game.boss.isHittable() ? game.boss : null)
        : (game && game.player && !game.player.dead ? game.player : null);
      if (this.homing && homingTarget) {
        const speed = Math.hypot(this.vx, this.vy);
        const target = Math.atan2(homingTarget.y - this.y, homingTarget.x - this.x);
        const a = BR.Geo.rotateToward(this.angle, target, this.homing * dt);
        this.vx = Math.cos(a) * speed;
        this.vy = Math.sin(a) * speed;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;
      if (this.life <= 0 && !this.dead) {
        this.dead = true;
        if (this.onExpire && game) this.onExpire(this, game);
      }

      const trail = TRAILS[this.kind];
      if (trail && game && Math.random() < dt * (this.kind === 'lance' || this.kind === 'rail' ? 60 : 22)) {
        game.particles.emit(trail, this.x, this.y, 1, { speedMult: 0.3 });
      }

      const A = BR.CONFIG.ARENA;
      if (this.bounces > 0) {
        const r = this.radius;
        if ((this.x < A.left + r && this.vx < 0) || (this.x > A.right - r && this.vx > 0)) { this.vx = -this.vx; this.bounces--; }
        if ((this.y < A.top + r && this.vy < 0) || (this.y > A.bottom - r && this.vy > 0)) { this.vy = -this.vy; this.bounces--; }
      }
      const m = 20;
      if (this.x < A.left - m || this.x > A.right + m || this.y < A.top - m || this.y > A.bottom + m) {
        this.dead = true;
      }
    }

    draw(ctx, time) {
      const fadeIn = Math.min(1, this.age / 0.05);
      const fadeOut = Math.min(1, this.life / 0.08);
      ctx.save();
      ctx.globalAlpha = fadeIn * fadeOut;
      const a = this.angle;
      switch (this.kind) {
        case 'wave': {
          Draw.glow(ctx, this.x, this.y, this.radius * 2.4, '94,231,255', 0.55);
          ctx.translate(this.x, this.y);
          ctx.rotate(a);
          ctx.beginPath();
          ctx.arc(-this.radius * 0.6, 0, this.radius, -1.15, 1.15);
          ctx.arc(-this.radius * 1.1, 0, this.radius * 0.95, 1.0, -1.0, true);
          ctx.closePath();
          ctx.fillStyle = '#d9fbff';
          ctx.fill();
          break;
        }
        case 'lance': {
          Draw.glow(ctx, this.x, this.y, this.radius * 3.4, '94,231,255', 0.9);
          ctx.translate(this.x, this.y);
          ctx.rotate(a);
          const grad = ctx.createLinearGradient(-this.radius * 4, 0, this.radius * 1.6, 0);
          grad.addColorStop(0, 'rgba(94,231,255,0)');
          grad.addColorStop(1, 'rgba(240,255,255,1)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(this.radius * 1.8, 0);
          ctx.lineTo(-this.radius * 0.2, -this.radius * 0.55);
          ctx.lineTo(-this.radius * 4, 0);
          ctx.lineTo(-this.radius * 0.2, this.radius * 0.55);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'crescent': {
          Draw.glow(ctx, this.x, this.y, this.radius * 2.2, '255,70,90', 0.7);
          ctx.translate(this.x, this.y);
          ctx.rotate(a);
          ctx.beginPath();
          ctx.arc(-this.radius * 0.4, 0, this.radius, -1.25, 1.25);
          ctx.arc(-this.radius * 1.0, 0, this.radius * 0.95, 1.1, -1.1, true);
          ctx.closePath();
          ctx.fillStyle = '#ffe1e5';
          ctx.fill();
          ctx.strokeStyle = '#ff4060';
          ctx.lineWidth = 2;
          ctx.stroke();
          break;
        }
        case 'fireball': {
          Draw.glow(ctx, this.x, this.y, this.radius * 2.8, '255,120,30', 0.85);
          Draw.circle(ctx, this.x, this.y, this.radius, '#ffb347');
          Draw.circle(ctx, this.x, this.y, this.radius * 0.55, '#fff2c4');
          break;
        }
        case 'void': {
          Draw.glow(ctx, this.x, this.y, this.radius * 2.6, '140,60,255', 0.8);
          Draw.circle(ctx, this.x, this.y, this.radius, '#1a0638', '#c79bff', 2.5);
          break;
        }
        case 'abyss': {
          const pulse = 1 + 0.15 * Math.sin(time * 20 + this.age * 10);
          Draw.glow(ctx, this.x, this.y, this.radius * 2.6 * pulse, '255,40,110', 0.8);
          Draw.circle(ctx, this.x, this.y, this.radius, '#2a0414', '#ff6fa3', 2.5);
          Draw.circle(ctx, this.x, this.y, this.radius * 0.35, '#ffd0e0');
          break;
        }
        case 'bullet': {
          const rgb = this.color || '255,200,120';
          Draw.glow(ctx, this.x, this.y, this.radius * 3, rgb, 0.7);
          ctx.translate(this.x, this.y);
          ctx.rotate(a);
          ctx.fillStyle = '#fff6dc';
          ctx.fillRect(-this.radius * 1.8, -this.radius * 0.6, this.radius * 3, this.radius * 1.2);
          break;
        }
        case 'bigBullet': {
          const rgb = this.color || '255,200,120';
          Draw.glow(ctx, this.x, this.y, this.radius * 3, rgb, 0.9);
          Draw.circle(ctx, this.x, this.y, this.radius, '#fffbe8', `rgb(${rgb})`, 2.5);
          break;
        }
        case 'rail': {
          const rgb = this.color || '255,200,120';
          Draw.glow(ctx, this.x, this.y, this.radius * 4, rgb, 0.9);
          ctx.translate(this.x, this.y);
          ctx.rotate(a);
          ctx.fillStyle = `rgba(${rgb},0.5)`;
          ctx.fillRect(-this.radius * 14, -this.radius * 0.8, this.radius * 14, this.radius * 1.6);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-this.radius * 8, -this.radius * 0.35, this.radius * 9, this.radius * 0.7);
          break;
        }
        case 'quake':
        case 'shock': {
          const rgb = this.color || '157,255,138';
          Draw.glow(ctx, this.x, this.y, this.radius * 1.8, rgb, this.kind === 'quake' ? 0.8 : 0.45);
          ctx.translate(this.x, this.y);
          ctx.rotate(a);
          ctx.strokeStyle = `rgba(${rgb},0.95)`;
          ctx.lineWidth = this.kind === 'quake' ? 6 : 3;
          ctx.beginPath();
          ctx.arc(-this.radius * 0.5, 0, this.radius, -1.1, 1.1);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(-this.radius * 0.8, 0, this.radius * 0.8, -0.9, 0.9);
          ctx.stroke();
          break;
        }
        case 'slug': {
          const pulse = 1 + 0.1 * Math.sin(time * 18);
          Draw.glow(ctx, this.x, this.y, this.radius * 2.6 * pulse, '255,150,60', 0.9);
          Draw.circle(ctx, this.x, this.y, this.radius, '#ffe0a8', '#ff7a2a', 4);
          Draw.circle(ctx, this.x, this.y, this.radius * 0.45, '#fff8e6');
          break;
        }
        case 'gear': {
          Draw.glow(ctx, this.x, this.y, this.radius * 2, '230,190,90', 0.5);
          ctx.translate(this.x, this.y);
          ctx.rotate(this.age * 8);
          ctx.fillStyle = '#c9a24a';
          ctx.strokeStyle = '#5a4416';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 16; i++) {
            const r = i % 2 === 0 ? this.radius : this.radius * 0.72;
            const ang = (i / 16) * Math.PI * 2;
            if (i === 0) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r); else ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          Draw.circle(ctx, 0, 0, this.radius * 0.3, '#3a2a0c');
          break;
        }
        case 'sand': {
          Draw.glow(ctx, this.x, this.y, this.radius * 2.2, '230,180,100', 0.5);
          Draw.circle(ctx, this.x, this.y, this.radius, '#e2b878', '#8a6430', 2);
          break;
        }
        case 'spirit': {
          Draw.glow(ctx, this.x, this.y, this.radius * 2.8, '170,210,255', 0.8);
          ctx.translate(this.x, this.y);
          ctx.rotate(a);
          ctx.fillStyle = 'rgba(210,230,255,0.9)';
          ctx.beginPath();
          ctx.moveTo(this.radius * 1.4, 0);
          ctx.lineTo(-this.radius, -this.radius * 0.8);
          ctx.lineTo(-this.radius * 0.5, 0);
          ctx.lineTo(-this.radius, this.radius * 0.8);
          ctx.closePath();
          ctx.fill();
          Draw.circle(ctx, this.radius * 0.6, -2, 1.8, '#2050ff');
          break;
        }
        case 'orb': {
          const rgb = this.color || '195,155,255';
          Draw.glow(ctx, this.x, this.y, this.radius * 3, rgb, 0.85);
          Draw.circle(ctx, this.x, this.y, this.radius, '#f3eaff', `rgb(${rgb})`, 2);
          break;
        }
        case 'bomb': {
          const pulse = 1 + 0.15 * Math.sin(time * 25);
          Draw.glow(ctx, this.x, this.y, this.radius * 3.2 * pulse, '195,155,255', 0.95);
          Draw.circle(ctx, this.x, this.y, this.radius, '#2a1440', '#e6d4ff', 3);
          Draw.circle(ctx, this.x, this.y, this.radius * 0.45, '#ffffff');
          break;
        }
        case 'ice': {
          Draw.glow(ctx, this.x, this.y, this.radius * 2.6, '150,220,255', 0.7);
          ctx.translate(this.x, this.y);
          ctx.rotate(a);
          ctx.fillStyle = '#e8f8ff';
          ctx.strokeStyle = '#6ec8ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(this.radius * 1.8, 0);
          ctx.lineTo(-this.radius, -this.radius * 0.6);
          ctx.lineTo(-this.radius * 0.6, 0);
          ctx.lineTo(-this.radius, this.radius * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'frostOrb': {
          const pulse = 1 + 0.12 * Math.sin(time * 12);
          Draw.glow(ctx, this.x, this.y, this.radius * 2.4 * pulse, '120,200,255', 0.9);
          Draw.circle(ctx, this.x, this.y, this.radius, 'rgba(200,240,255,0.85)', '#ffffff', 2);
          ctx.translate(this.x, this.y);
          ctx.rotate(this.age * 3);
          ctx.strokeStyle = 'rgba(80,160,230,0.9)';
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            ctx.rotate(Math.PI / 3);
            ctx.beginPath();
            ctx.moveTo(-this.radius * 0.7, 0);
            ctx.lineTo(this.radius * 0.7, 0);
            ctx.stroke();
          }
          break;
        }
        case 'lightning': {
          Draw.glow(ctx, this.x, this.y, this.radius * 3, '255,240,140', 0.9);
          ctx.strokeStyle = '#fffbe0';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const ang = time * 9 + i * 2.1;
            const rr = this.radius * (0.6 + Math.random() * 0.6);
            if (i === 0) ctx.moveTo(this.x + Math.cos(ang) * rr, this.y + Math.sin(ang) * rr);
            else ctx.lineTo(this.x + Math.cos(ang) * rr, this.y + Math.sin(ang) * rr);
          }
          ctx.stroke();
          Draw.circle(ctx, this.x, this.y, this.radius * 0.55, '#fff8c0');
          break;
        }
        case 'bat': {
          Draw.glow(ctx, this.x, this.y, this.radius * 2.4, '255,30,50', 0.6);
          ctx.translate(this.x, this.y);
          ctx.rotate(a);
          const flap = Math.sin(this.age * 30) * 0.5 + 0.5;
          ctx.fillStyle = '#2a0508';
          ctx.strokeStyle = '#ff4a5a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(this.radius, 0);
          ctx.lineTo(-this.radius * 0.4, -this.radius * (0.6 + flap));
          ctx.lineTo(-this.radius * 0.2, 0);
          ctx.lineTo(-this.radius * 0.4, this.radius * (0.6 + flap));
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        default: {
          Draw.glow(ctx, this.x, this.y, this.radius * 2.4, '255,80,80', 0.7);
          Draw.circle(ctx, this.x, this.y, this.radius, '#ffd0d0', '#ff4050', 2);
        }
      }
      ctx.restore();
    }
  }

  BR.Projectile = Projectile;
})();
