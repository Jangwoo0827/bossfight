/* Lightweight particle system with a hard cap. Dead particles are swap-removed. */
(function () {
  'use strict';

  const TYPES = {
    hit:       { colors: ['255,255,255', '160,245,255', '94,231,255'], speed: [140, 380], life: [0.15, 0.35], size: [1.5, 3.5], drag: 6, glow: true },
    slash:     { colors: ['220,250,255', '120,230,255'], speed: [60, 200], life: [0.12, 0.28], size: [1.5, 3], drag: 5, glow: true },
    crit:      { colors: ['255,240,150', '255,200,80', '255,255,255'], speed: [180, 460], life: [0.2, 0.45], size: [2, 4], drag: 5, glow: true },
    explosion: { colors: ['255,243,176', '255,179,71', '255,94,58'], speed: [80, 420], life: [0.3, 0.75], size: [2.5, 6], drag: 3.5, glow: true },
    fire:      { colors: ['255,209,102', '255,123,41', '255,61,31'], speed: [20, 90], life: [0.35, 0.8], size: [2, 5], drag: 1.5, gravity: -70, glow: true },
    ember:     { colors: ['255,170,60', '255,110,30'], speed: [5, 25], life: [1.6, 3.2], size: [1, 2.4], drag: 0.2, gravity: -22, glow: true },
    dust:      { colors: ['138,125,107', '163,149,128', '107,96,82'], speed: [30, 150], life: [0.4, 0.9], size: [2.5, 6], drag: 3 },
    rock:      { colors: ['110,104,92', '90,85,76', '140,132,118'], speed: [120, 360], life: [0.4, 0.8], size: [2.5, 5], drag: 2.5, gravity: 380 },
    magic:     { colors: ['179,136,255', '124,77,255', '225,190,231'], speed: [40, 220], life: [0.3, 0.7], size: [1.5, 3.5], drag: 3, glow: true },
    voidMote:  { colors: ['130,70,255', '190,140,255'], speed: [4, 18], life: [1.5, 3], size: [1, 2.6], drag: 0.2, gravity: -10, glow: true },
    void:      { colors: ['110,40,255', '60,10,140', '200,160,255'], speed: [60, 260], life: [0.25, 0.6], size: [2, 4.5], drag: 4, glow: true },
    abyssMote: { colors: ['255,40,110', '170,20,80'], speed: [4, 20], life: [1.5, 3], size: [1, 2.4], drag: 0.2, gravity: -14, glow: true },
    abyss:     { colors: ['255,50,120', '200,20,90', '255,180,210'], speed: [60, 300], life: [0.25, 0.65], size: [2, 4.5], drag: 4, glow: true },
    blood:     { colors: ['255,70,90', '200,30,50'], speed: [80, 260], life: [0.25, 0.5], size: [2, 4], drag: 4 },
    death:     { colors: ['255,255,255', '255,213,79', '255,82,82'], speed: [120, 640], life: [0.6, 1.5], size: [2.5, 7], drag: 2, glow: true },
    spark:     { colors: ['255,230,160', '255,255,255'], speed: [200, 500], life: [0.1, 0.25], size: [1, 2.2], drag: 6, glow: true },
    snow:       { colors: ['220,240,255', '180,220,255'], speed: [10, 30], life: [2, 4], size: [1, 2.6], drag: 0.1, gravity: 14, glow: true },
    ice:        { colors: ['200,240,255', '120,200,255', '255,255,255'], speed: [80, 300], life: [0.25, 0.6], size: [2, 4], drag: 3.5, glow: true },
    lightning:  { colors: ['255,250,200', '255,230,100', '200,220,255'], speed: [150, 450], life: [0.1, 0.3], size: [1.5, 3], drag: 5, glow: true },
    staticMote: { colors: ['255,240,150', '170,200,255'], speed: [10, 40], life: [0.4, 1.2], size: [1, 2], drag: 1, glow: true },
    bloodMote:  { colors: ['200,20,40', '255,60,70'], speed: [4, 18], life: [1.5, 3], size: [1, 2.4], drag: 0.2, gravity: 10, glow: true },
    heal:      { colors: ['120,255,160', '200,255,220'], speed: [20, 80], life: [0.5, 1], size: [1.5, 3], drag: 1, gravity: -60, glow: true },
  };

  class ParticleSystem {
    constructor(limit) {
      this.limit = limit;
      this.list = [];
    }

    /**
     * @param {string} type particle preset
     * @param {object} opts angle, spread, speedMult, sizeMult, color (rgb override), radius (spawn area)
     */
    emit(type, x, y, count, opts = {}) {
      const def = TYPES[type];
      if (!def) return;
      const room = this.limit - this.list.length;
      const n = Math.min(count, room);
      const spread = opts.spread !== undefined ? opts.spread : Math.PI * 2;
      const baseAngle = opts.angle !== undefined ? opts.angle : 0;
      const speedMult = opts.speedMult || 1;
      const sizeMult = opts.sizeMult || 1;
      const area = opts.radius || 0;
      for (let i = 0; i < n; i++) {
        const a = baseAngle + (Math.random() - 0.5) * spread;
        const sp = (def.speed[0] + Math.random() * (def.speed[1] - def.speed[0])) * speedMult;
        const life = def.life[0] + Math.random() * (def.life[1] - def.life[0]);
        const ra = Math.random() * Math.PI * 2, rr = Math.random() * area;
        this.list.push({
          x: x + Math.cos(ra) * rr,
          y: y + Math.sin(ra) * rr,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life,
          maxLife: life,
          size: (def.size[0] + Math.random() * (def.size[1] - def.size[0])) * sizeMult,
          color: opts.color || def.colors[(Math.random() * def.colors.length) | 0],
          drag: def.drag || 0,
          gravity: def.gravity || 0,
          glow: !!def.glow,
        });
      }
    }

    // Particles distributed along a ring (used for shockwaves)
    emitRing(type, x, y, radius, count, opts = {}) {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        this.emit(type, x + Math.cos(a) * radius, y + Math.sin(a) * radius, 1, Object.assign({ angle: a, spread: 0.5 }, opts));
      }
    }

    update(dt) {
      const list = this.list;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) {
          list[i] = list[list.length - 1];
          list.pop();
          continue;
        }
        const drag = Math.max(0, 1 - p.drag * dt);
        p.vx *= drag;
        p.vy = p.vy * drag + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    draw(ctx) {
      const list = this.list;
      // Pass 1: solid particles
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (p.glow) continue;
        const t = p.life / p.maxLife;
        ctx.globalAlpha = t;
        ctx.fillStyle = `rgb(${p.color})`;
        const s = p.size * (0.4 + 0.6 * t);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
      // Pass 2: additive glowing particles
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (!p.glow) continue;
        const t = p.life / p.maxLife;
        ctx.globalAlpha = t;
        ctx.fillStyle = `rgb(${p.color})`;
        const s = p.size * (0.4 + 0.6 * t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    clear() {
      this.list.length = 0;
    }
  }

  BR.ParticleSystem = ParticleSystem;
})();
