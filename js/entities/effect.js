/*
 * Hazard = a telegraphed danger zone (warn -> active -> linger).
 * Plus purely visual effects: floating text, slash arcs, rings, falling objects.
 */
(function () {
  'use strict';
  const { Geo, Draw } = BR;

  const STYLE_ACTIVE = {
    default: '255,210,150',
    fire: '255,140,40',
    rock: '220,200,170',
    void: '130,60,255',
    sand: '230,180,100',
    brass: '255,200,90',
    dark: '255,40,110',
    magic: '200,150,255',
    ice: '150,220,255',
    storm: '255,240,140',
    blood: '220,20,40',
  };

  BR.ACCESS = BR.ACCESS || { colorblind: false, reducedFlashes: false };

  class Hazard {
    /**
     * shape: circle | cone | line | ring | rect
     * line: x,y = start (or center when centered), angle, length, width
     * ring: radius (center line), width; growSpeed makes it an expanding shockwave
     * rect: x,y = top-left, w, h
     */
    constructor(o) {
      this.shape = o.shape || 'circle';
      this.x = o.x || 0;
      this.y = o.y || 0;
      this.radius = o.radius || 60;
      this.angle = o.angle || 0;
      this.arc = o.arc || 1;
      this.length = o.length || 400;
      this.width = o.width || 40;
      this.w = o.w || 100;
      this.h = o.h || 100;
      this.centered = !!o.centered;
      this.damage = o.damage || 0;
      const minWarn = this.damage > 0 && !o.noMinWarn ? BR.CONFIG.COMBAT.minTelegraph : 0;
      this.warn = Math.max(o.warn !== undefined ? o.warn : 0.6, minWarn);
      this.hitWindow = o.hitWindow !== undefined ? o.hitWindow : 0.1;
      this.linger = o.linger !== undefined ? o.linger : 0.3;
      this.tickInterval = o.tickInterval || 0;
      this.tickTimer = 0;
      this.slow = o.slow || 0;
      this.growSpeed = o.growSpeed || 0;
      this.maxRadius = o.maxRadius || 1600;
      this.color = o.color || BR.CONFIG.COLORS.danger;
      this.style = o.style || 'default';
      this.activeColor = o.activeColor || STYLE_ACTIVE[this.style] || STYLE_ACTIVE.default;
      this.onActivate = o.onActivate || null;
      this.follow = o.follow || null;
      this.spin = o.spin || 0;
      this.gapAngle = o.gapAngle || 0;
      this.gapArc = o.gapArc || 0;     // ring only: safe opening        // rad/s rotation while active (clock hands, sweeping beams)
      this.hideWarn = !!o.hideWarn;
      this.timer = 0;
      this.state = 'warn';
      this.hasHit = false;
      this.dead = false;
      this.seed = Math.random() * 100;
      if (BR.ACCESS.colorblind) this.color = this.damage > 0 ? '255,190,0' : '0,200,255';
    }

    get progress() {
      return this.state === 'warn' ? Geo.clamp(this.timer / this.warn, 0, 1) : 1;
    }

    get persistent() {
      return this.tickInterval > 0;
    }

    update(dt, game) {
      this.timer += dt;
      if (this.follow && !this.follow.dead) {
        this.x = this.follow.x;
        this.y = this.follow.y;
      }
      if (this.state === 'warn') {
        if (this.timer >= this.warn) {
          this.state = 'active';
          this.timer = 0;
          if (this.onActivate) this.onActivate(this, game);
        }
      } else if (this.state === 'active') {
        if (this.tickTimer > 0) this.tickTimer -= dt;
        if (this.spin) this.angle += this.spin * dt;
        if (this.growSpeed) {
          this.radius += this.growSpeed * dt;
          if (this.radius >= this.maxRadius) { this.state = 'linger'; this.timer = 0; }
        } else if (this.timer >= this.hitWindow) {
          this.state = 'linger';
          this.timer = 0;
        }
      } else if (this.state === 'linger') {
        if (this.timer >= this.linger) this.dead = true;
      }
    }

    isDamaging() {
      return this.state === 'active' && this.damage > 0;
    }

    endpoints() {
      const c = Math.cos(this.angle), s = Math.sin(this.angle);
      if (this.centered) {
        const h = this.length / 2;
        return [this.x - c * h, this.y - s * h, this.x + c * h, this.y + s * h];
      }
      return [this.x, this.y, this.x + c * this.length, this.y + s * this.length];
    }

    contains(px, py, pr) {
      const pad = pr * (1 - BR.CONFIG.COMBAT.forgiveness);
      switch (this.shape) {
        case 'circle':
          return Geo.dist(this.x, this.y, px, py) <= this.radius + pad;
        case 'cone':
          return Geo.inCone(px, py, this.x, this.y, this.angle, this.arc, this.radius, pad);
        case 'line': {
          const [ax, ay, bx, by] = this.endpoints();
          return Geo.segDist(px, py, ax, ay, bx, by) <= this.width / 2 + pad;
        }
        case 'ring': {
          const d = Geo.dist(this.x, this.y, px, py);
          if (Math.abs(d - this.radius) > this.width / 2 + pad) return false;
          if (this.gapArc > 0 && d > 0) {
            // Inside the opening (shrunk by the player's size so the gap stays honest)
            const half = this.gapArc / 2 - Math.asin(Math.min(1, pad / d));
            if (Math.abs(Geo.angleDiff(this.gapAngle, Geo.angle(this.x, this.y, px, py))) < half) return false;
          }
          return true;
        }
        case 'rect':
          return px + pad >= this.x && px - pad <= this.x + this.w && py + pad >= this.y && py - pad <= this.y + this.h;
        default:
          return false;
      }
    }

    // Builds the zone path (scale lets the warn fill grow inside the outline)
    _path(ctx, scale) {
      ctx.beginPath();
      switch (this.shape) {
        case 'circle':
          ctx.arc(this.x, this.y, Math.max(0, this.radius * scale), 0, Math.PI * 2);
          break;
        case 'cone':
          ctx.moveTo(this.x, this.y);
          ctx.arc(this.x, this.y, Math.max(0, this.radius * scale), this.angle - this.arc / 2, this.angle + this.arc / 2);
          ctx.closePath();
          break;
        case 'line': {
          const [ax, ay] = this.endpoints();
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(this.angle);
          if (this.centered) {
            const hw = (this.width / 2) * scale;
            ctx.rect(0, -hw, this.length, hw * 2);
          } else {
            ctx.rect(0, -this.width / 2, this.length * scale, this.width);
          }
          ctx.restore();
          break;
        }
        case 'ring': {
          const outer = this.radius + this.width / 2, inner = Math.max(0, this.radius - this.width / 2);
          if (this.gapArc > 0) {
            const a0 = this.gapAngle + this.gapArc / 2, a1 = this.gapAngle - this.gapArc / 2 + Math.PI * 2;
            ctx.arc(this.x, this.y, outer, a0, a1);
            ctx.arc(this.x, this.y, inner, a1, a0, true);
            ctx.closePath();
          } else {
            ctx.arc(this.x, this.y, outer, 0, Math.PI * 2);
            ctx.moveTo(this.x + inner, this.y);
            ctx.arc(this.x, this.y, inner, 0, Math.PI * 2, true);
          }
          break;
        }
        case 'rect': {
          const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
          ctx.rect(cx - (this.w / 2) * scale, cy - (this.h / 2) * scale, this.w * scale, this.h * scale);
          break;
        }
      }
    }

    draw(ctx, time) {
      const visualOnly = this.damage <= 0;
      if (this.state === 'warn') {
        if (this.hideWarn) return;
        const p = this.progress;
        const pulse = 0.5 + 0.5 * Math.sin(time * 18 + this.seed);
        ctx.save();
        // base area
        this._path(ctx, 1);
        ctx.fillStyle = `rgba(${this.color},${visualOnly ? 0.06 : 0.09 + pulse * 0.05})`;
        ctx.fill('evenodd');
        ctx.strokeStyle = `rgba(${this.color},${visualOnly ? 0.45 : 0.55 + 0.4 * p})`;
        ctx.lineWidth = visualOnly ? 1.5 : BR.ACCESS.colorblind ? 3.5 : 2;
        if (visualOnly) ctx.setLineDash([10, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
        // growing fill = "time until impact"
        if (this.shape !== 'ring') {
          this._path(ctx, p);
          ctx.fillStyle = `rgba(${this.color},${visualOnly ? 0.12 : 0.18 + 0.2 * p})`;
          ctx.fill();
        } else {
          ctx.globalAlpha = p;
          this._path(ctx, 1);
          ctx.fillStyle = `rgba(${this.color},0.25)`;
          ctx.fill('evenodd');
        }
        ctx.restore();
        return;
      }

      // Active / linger visuals
      const fade = this.state === 'linger' ? 1 - Geo.clamp(this.timer / this.linger, 0, 1) : 1;
      ctx.save();
      if (this.persistent) {
        this._drawPersistent(ctx, time, fade);
      } else {
        this._path(ctx, 1);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(${this.activeColor},${(visualOnly ? 0.18 : 0.55) * fade})`;
        ctx.fill('evenodd');
        ctx.strokeStyle = `rgba(255,255,255,${0.7 * fade})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawPersistent(ctx, time, fade) {
      const flick = 0.75 + 0.25 * Math.sin(time * 14 + this.seed) * Math.sin(time * 9.3);
      this._path(ctx, 1);
      if (this.style === 'void') {
        ctx.fillStyle = `rgba(20,5,45,${0.75 * fade})`;
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(150,80,255,${0.8 * fade * flick})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        if (this.shape === 'circle') {
          for (let i = 0; i < 3; i++) {
            const a = time * (1.5 + i * 0.4) + i * 2 + this.seed;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * (0.35 + i * 0.2), a, a + 1.6);
            ctx.strokeStyle = `rgba(190,140,255,${0.35 * fade})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(${this.activeColor},${0.38 * fade * flick})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255,220,140,${0.7 * fade})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  class FloatingText {
    constructor(x, y, text, o = {}) {
      this.x = x + (Math.random() - 0.5) * 16;
      this.y = y;
      this.text = String(text);
      this.color = o.color || '#ffffff';
      this.size = o.size || 18;
      this.life = o.life || 0.75;
      this.maxLife = this.life;
      this.vy = o.vy !== undefined ? o.vy : -70;
      this.pop = o.pop || 1.4;
      this.dead = false;
    }
    update(dt) {
      this.life -= dt;
      this.y += this.vy * dt;
      this.vy *= Math.max(0, 1 - 3 * dt);
      if (this.life <= 0) this.dead = true;
    }
    draw(ctx) {
      const age = this.maxLife - this.life;
      const scale = age < 0.08 ? Geo.lerp(this.pop, 1, age / 0.08) : 1;
      ctx.save();
      ctx.globalAlpha = Geo.clamp(this.life / (this.maxLife * 0.4), 0, 1);
      Draw.text(ctx, this.text, this.x, this.y, {
        size: Math.round(this.size * scale), color: this.color, weight: '800', stroke: 'rgba(0,0,0,0.85)', strokeWidth: 4,
      });
      ctx.restore();
    }
  }

  class SlashFx {
    constructor(o) {
      this.x = o.x; this.y = o.y;
      this.angle = o.angle;
      this.radius = o.radius;
      this.arc = o.arc;
      this.color = o.color || '170,240,255';
      this.width = o.width || 16;
      this.dir = o.dir || 1;
      this.life = o.life || 0.16;
      this.maxLife = this.life;
      this.follow = o.follow || null;
      this.dead = false;
    }
    update(dt) {
      this.life -= dt;
      if (this.follow) { this.x = this.follow.x; this.y = this.follow.y; }
      if (this.life <= 0) this.dead = true;
    }
    draw(ctx) {
      const t = 1 - this.life / this.maxLife;
      const sweep = Geo.easeOut(Math.min(1, t * 1.8));
      const start = this.angle - (this.arc / 2) * this.dir;
      const end = start + this.arc * sweep * this.dir;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const r = this.radius * (0.72 + i * 0.13);
        ctx.arc(this.x, this.y, r, Math.min(start, end), Math.max(start, end));
        ctx.strokeStyle = `rgba(${this.color},${(1 - t) * (0.75 - i * 0.2)})`;
        ctx.lineWidth = this.width * (1 - t * 0.6) * (1 - i * 0.25);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  class RingFx {
    constructor(o) {
      this.x = o.x; this.y = o.y;
      this.r0 = o.r0 || 10;
      this.r1 = o.r1 || 120;
      this.color = o.color || '255,255,255';
      this.width = o.width || 6;
      this.life = o.life || 0.4;
      this.maxLife = this.life;
      this.dead = false;
    }
    update(dt) { this.life -= dt; if (this.life <= 0) this.dead = true; }
    draw(ctx) {
      const t = 1 - this.life / this.maxLife;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.arc(this.x, this.y, Geo.lerp(this.r0, this.r1, Geo.easeOut(t)), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${this.color},${1 - t})`;
      ctx.lineWidth = this.width * (1 - t * 0.7);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Object travelling from (sx,sy) to (tx,ty), arriving exactly when its hazard fires
  class ArcFx {
    constructor(o) {
      this.sx = o.sx; this.sy = o.sy; this.tx = o.tx; this.ty = o.ty;
      this.duration = o.duration;
      this.height = o.height || 0;
      this.kind = o.kind || 'rock';
      this.size = o.size || 16;
      this.t = 0;
      this.spin = Math.random() * 6;
      this.dead = false;
    }
    update(dt, game) {
      this.t += dt;
      if (this.t >= this.duration) this.dead = true;
      if (this.kind === 'meteor' && game && Math.random() < dt * 40) {
        const p = this.pos();
        game.particles.emit('fire', p.x, p.y, 1, { sizeMult: 1.6 });
      }
    }
    pos() {
      const p = Geo.clamp(this.t / this.duration, 0, 1);
      const e = this.kind === 'meteor' ? p * p : p;
      return {
        x: Geo.lerp(this.sx, this.tx, e),
        y: Geo.lerp(this.sy, this.ty, e) - Math.sin(Math.PI * p) * this.height,
        p,
      };
    }
    draw(ctx) {
      const { x, y, p } = this.pos();
      Draw.shadow(ctx, this.tx, this.ty, this.size * (0.4 + p), this.size * (0.2 + p * 0.5), 0.25 + p * 0.3);
      if (this.kind === 'meteor') {
        Draw.glow(ctx, x, y, this.size * 3, '255,120,40', 0.9);
        Draw.circle(ctx, x, y, this.size, '#ffcf7a', '#ff6a1f', 3);
      } else {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.spin + this.t * 8);
        ctx.fillStyle = '#7a7266';
        ctx.strokeStyle = '#2d2a25';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const s = this.size;
        ctx.moveTo(-s, -s * 0.4); ctx.lineTo(-s * 0.3, -s); ctx.lineTo(s * 0.7, -s * 0.6);
        ctx.lineTo(s, s * 0.3); ctx.lineTo(s * 0.2, s); ctx.lineTo(-s * 0.8, s * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  BR.Hazard = Hazard;
  BR.FloatingText = FloatingText;
  BR.SlashFx = SlashFx;
  BR.RingFx = RingFx;
  BR.ArcFx = ArcFx;
})();
