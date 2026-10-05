/* Arena rendering (cached per theme) + shared drawing helpers. */
(function () {
  'use strict';
  const C = BR.CONFIG;

  const THEMES = {
    stone: {
      label: 'Stone Arena', bg: '#0c0d12', floorA: '#2b2d35', floorB: '#25272e', grout: 'rgba(0,0,0,0.35)',
      wall: '#4b4f5c', wallGlow: '150,170,255', accent: '#8fa3c7', ambient: 'dust', ambientRate: 3, tile: 68,
    },
    burning: {
      label: 'Burning Arena', bg: '#150705', floorA: '#2e1712', floorB: '#28130f', grout: 'rgba(0,0,0,0.4)',
      wall: '#5c2a1a', wallGlow: '255,110,40', accent: '#ff7a33', ambient: 'ember', ambientRate: 16, tile: 60, lava: true,
    },
    cave: {
      label: 'Cave Arena', bg: '#090b09', floorA: '#292c26', floorB: '#232620', grout: 'rgba(0,0,0,0.3)',
      wall: '#3f4239', wallGlow: '170,210,130', accent: '#9bb37a', ambient: 'dust', ambientRate: 6, tile: 90, rocks: true,
    },
    void: {
      label: 'Void Arena', bg: '#05030b', floorA: '#161125', floorB: '#120e1f', grout: 'rgba(120,80,255,0.07)',
      wall: '#2e2050', wallGlow: '150,80,255', accent: '#9b6bff', ambient: 'voidMote', ambientRate: 10, tile: 56, grid: true,
    },
    abyss: {
      label: 'Abyss Arena', bg: '#050207', floorA: '#1b0b15', floorB: '#160912', grout: 'rgba(0,0,0,0.4)',
      wall: '#401027', wallGlow: '255,40,100', accent: '#ff3d7f', ambient: 'abyssMote', ambientRate: 12, tile: 64, runes: true,
    },
    ice: {
      label: 'Frozen Arena', bg: '#050a10', floorA: '#1d2b38', floorB: '#192632', grout: 'rgba(160,210,255,0.08)',
      wall: '#3a5468', wallGlow: '150,210,255', accent: '#9ad8ff', ambient: 'snow', ambientRate: 14, tile: 64,
    },
    storm: {
      label: 'Storm Arena', bg: '#06070c', floorA: '#1f222b', floorB: '#1a1d25', grout: 'rgba(0,0,0,0.35)',
      wall: '#3b4054', wallGlow: '255,230,120', accent: '#ffe27a', ambient: 'staticMote', ambientRate: 8, tile: 72, grid: true, gridRgb: '255,230,120',
    },
    western: {
      label: 'Dusty Saloon Street', bg: '#120a05', floorA: '#4a3420', floorB: '#45301d', grout: 'rgba(0,0,0,0.25)',
      wall: '#6b4423', wallGlow: '255,180,90', accent: '#ffb35e', ambient: 'dust', ambientRate: 5, tile: 80,
    },
    clock: {
      label: 'Clockwork Tower', bg: '#0b0806', floorA: '#2c2418', floorB: '#272015', grout: 'rgba(255,200,90,0.06)',
      wall: '#5a4520', wallGlow: '255,200,90', accent: '#ffc85a', ambient: 'staticMote', ambientRate: 3, tile: 64, runes: true,
    },
    dune: {
      label: 'Sunken Dunes', bg: '#140d05', floorA: '#5a4426', floorB: '#544023', grout: 'rgba(0,0,0,0.12)',
      wall: '#7a5a30', wallGlow: '255,210,140', accent: '#e8c27a', ambient: 'dust', ambientRate: 9, tile: 96, rocks: true,
    },
    forest: {
      label: 'Moonlit Glade', bg: '#040806', floorA: '#18241a', floorB: '#152017', grout: 'rgba(0,0,0,0.3)',
      wall: '#2a3a2a', wallGlow: '170,210,255', accent: '#bcd8ff', ambient: 'voidMote', ambientRate: 4, tile: 72, rocks: true,
    },
    blood: {
      label: 'Crimson Hall', bg: '#0c0304', floorA: '#251015', floorB: '#200d11', grout: 'rgba(0,0,0,0.45)',
      wall: '#4a1218', wallGlow: '255,40,50', accent: '#ff3a4a', ambient: 'bloodMote', ambientRate: 8, tile: 60, lava: true, lavaRgb: '200,20,40',
    },
  };

  // Deterministic pseudo-random so cached arenas look the same every time
  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* ---------- Glow sprite cache (cheap soft light without shadowBlur) ---------- */
  const glowCache = new Map();
  function glowSprite(rgb) {
    let sprite = glowCache.get(rgb);
    if (sprite) return sprite;
    const size = 64;
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = size;
    const g = sprite.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.35, `rgba(${rgb},0.45)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    glowCache.set(rgb, sprite);
    return sprite;
  }

  const Draw = {
    glow(ctx, x, y, radius, rgb, alpha = 1) {
      if (radius <= 0 || alpha <= 0) return;
      const prevAlpha = ctx.globalAlpha;
      const prevOp = ctx.globalCompositeOperation;
      ctx.globalAlpha = prevAlpha * alpha;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glowSprite(rgb), x - radius, y - radius, radius * 2, radius * 2);
      ctx.globalAlpha = prevAlpha;
      ctx.globalCompositeOperation = prevOp;
    },
    circle(ctx, x, y, r, fill, stroke, lineWidth = 2) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
    },
    roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },
    shadow(ctx, x, y, rx, ry, alpha = 0.35) {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    text(ctx, str, x, y, { size = 16, color = '#fff', align = 'center', baseline = 'middle', font = 'Segoe UI', weight = '600', stroke = null, strokeWidth = 4, spacing = 0 } = {}) {
      ctx.font = `${weight} ${size}px ${font}, "Malgun Gothic", sans-serif`;
      ctx.textAlign = align;
      ctx.textBaseline = baseline;
      // letterSpacing forces a costly font re-resolve in Chromium: only use it for big titles
      const spaced = spacing >= 5 && size >= 18 && 'letterSpacing' in ctx;
      if (spaced) ctx.letterSpacing = `${spacing}px`;
      if (stroke) {
        ctx.lineJoin = 'round';
        ctx.strokeStyle = stroke;
        ctx.lineWidth = strokeWidth;
        ctx.strokeText(str, x, y);
      }
      ctx.fillStyle = color;
      ctx.fillText(str, x, y);
      if (spaced) ctx.letterSpacing = '0px';
    },
  };

  class Renderer {
    constructor() {
      this.cache = new Map();
    }

    getTheme(key) {
      return THEMES[key] || THEMES.stone;
    }

    _buildArena(key) {
      const theme = this.getTheme(key);
      const canvas = document.createElement('canvas');
      canvas.width = C.WIDTH;
      canvas.height = C.HEIGHT;
      const g = canvas.getContext('2d');
      const A = C.ARENA;
      const w = A.right - A.left, h = A.bottom - A.top;
      const rnd = seeded(key.length * 7919 + key.charCodeAt(0));

      // Outer background
      g.fillStyle = theme.bg;
      g.fillRect(0, 0, C.WIDTH, C.HEIGHT);

      // Floor tiles
      g.save();
      g.beginPath();
      g.rect(A.left, A.top, w, h);
      g.clip();
      const ts = theme.tile;
      for (let y = A.top; y < A.bottom; y += ts) {
        const offset = (Math.floor((y - A.top) / ts) % 2) * (ts / 2);
        for (let x = A.left - ts; x < A.right; x += ts) {
          g.fillStyle = rnd() < 0.5 ? theme.floorA : theme.floorB;
          g.fillRect(x + offset, y, ts, ts);
          g.globalAlpha = 0.03 + rnd() * 0.04;
          g.fillStyle = rnd() < 0.7 ? '#000' : '#fff';
          g.fillRect(x + offset + 3, y + 3, ts - 6, ts - 6);
          g.globalAlpha = 1;
          g.strokeStyle = theme.grout;
          g.lineWidth = 2;
          g.strokeRect(x + offset, y, ts, ts);
        }
      }

      // Cracks
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 1.5;
      for (let i = 0; i < 26; i++) {
        let cx = A.left + rnd() * w, cy = A.top + rnd() * h;
        g.beginPath();
        g.moveTo(cx, cy);
        for (let s = 0; s < 4; s++) {
          cx += (rnd() - 0.5) * 50;
          cy += (rnd() - 0.5) * 50;
          g.lineTo(cx, cy);
        }
        g.stroke();
      }

      if (theme.lava) {
        g.lineCap = 'round';
        for (let i = 0; i < 14; i++) {
          let cx = A.left + rnd() * w, cy = A.top + rnd() * h;
          g.beginPath();
          g.moveTo(cx, cy);
          for (let s = 0; s < 5; s++) {
            cx += (rnd() - 0.5) * 80;
            cy += (rnd() - 0.5) * 80;
            g.lineTo(cx, cy);
          }
          const lava = theme.lavaRgb || '255,120,40';
          g.strokeStyle = `rgba(${lava},0.18)`;
          g.lineWidth = 9;
          g.stroke();
          g.strokeStyle = `rgba(${lava},0.55)`;
          g.lineWidth = 2.5;
          g.stroke();
        }
      }

      if (theme.grid) {
        g.strokeStyle = `rgba(${theme.gridRgb || '140,90,255'},0.10)`;
        g.lineWidth = 1;
        for (let x = A.left; x < A.right; x += 40) { g.beginPath(); g.moveTo(x, A.top); g.lineTo(x, A.bottom); g.stroke(); }
        for (let y = A.top; y < A.bottom; y += 40) { g.beginPath(); g.moveTo(A.left, y); g.lineTo(A.right, y); g.stroke(); }
        for (let i = 0; i < 90; i++) {
          g.fillStyle = `rgba(${theme.gridRgb || '200,170,255'},${0.15 + rnd() * 0.4})`;
          g.fillRect(A.left + rnd() * w, A.top + rnd() * h, 1.5, 1.5);
        }
      }

      if (theme.runes) {
        const cx = (A.left + A.right) / 2, cy = (A.top + A.bottom) / 2;
        g.strokeStyle = 'rgba(255,50,110,0.16)';
        for (const r of [90, 170, 240]) {
          g.lineWidth = r === 170 ? 3 : 1.5;
          g.beginPath();
          g.arc(cx, cy, r, 0, Math.PI * 2);
          g.stroke();
        }
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          g.save();
          g.translate(cx + Math.cos(a) * 205, cy + Math.sin(a) * 205);
          g.rotate(a);
          g.strokeRect(-7, -7, 14, 14);
          g.restore();
        }
        g.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
          const px = cx + Math.cos(a) * 160, py = cy + Math.sin(a) * 160;
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
        g.stroke();
      }

      if (theme.rocks) {
        for (let i = 0; i < 34; i++) {
          const side = Math.floor(rnd() * 4);
          let x, y;
          if (side === 0) { x = A.left + rnd() * w; y = A.top + 8 + rnd() * 18; }
          else if (side === 1) { x = A.left + rnd() * w; y = A.bottom - 8 - rnd() * 18; }
          else if (side === 2) { x = A.left + 8 + rnd() * 18; y = A.top + rnd() * h; }
          else { x = A.right - 8 - rnd() * 18; y = A.top + rnd() * h; }
          const r = 8 + rnd() * 16;
          g.fillStyle = rnd() < 0.5 ? '#3a3d35' : '#33362f';
          g.beginPath();
          for (let k = 0; k < 7; k++) {
            const a = (k / 7) * Math.PI * 2;
            const rr = r * (0.7 + rnd() * 0.4);
            if (k === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
            else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          }
          g.closePath();
          g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.lineWidth = 1.5;
          g.stroke();
        }
      }

      // Vignette inside arena
      const vg = g.createRadialGradient(C.WIDTH / 2, (A.top + A.bottom) / 2, 120, C.WIDTH / 2, (A.top + A.bottom) / 2, 700);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.62)');
      g.fillStyle = vg;
      g.fillRect(A.left, A.top, w, h);
      g.restore();

      // Walls
      g.lineWidth = 10;
      g.strokeStyle = theme.wall;
      g.strokeRect(A.left - 5, A.top - 5, w + 10, h + 10);
      g.lineWidth = 2;
      g.strokeStyle = `rgba(${theme.wallGlow},0.55)`;
      g.strokeRect(A.left - 1, A.top - 1, w + 2, h + 2);
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.strokeRect(A.left - 10, A.top - 10, w + 20, h + 20);

      // Pillars on corners
      for (const [px, py] of [[A.left, A.top], [A.right, A.top], [A.left, A.bottom], [A.right, A.bottom]]) {
        g.fillStyle = theme.wall;
        g.fillRect(px - 15, py - 15, 30, 30);
        g.strokeStyle = `rgba(${theme.wallGlow},0.5)`;
        g.lineWidth = 2;
        g.strokeRect(px - 15, py - 15, 30, 30);
        g.fillStyle = `rgba(${theme.wallGlow},0.6)`;
        g.fillRect(px - 4, py - 4, 8, 8);
      }
      return canvas;
    }

    drawArena(ctx, key, time) {
      let cached = this.cache.get(key);
      if (!cached) {
        cached = this._buildArena(key);
        this.cache.set(key, cached);
      }
      ctx.drawImage(cached, 0, 0);

      // Live ambient light along the walls
      const theme = this.getTheme(key);
      const A = C.ARENA;
      const pulse = 0.5 + 0.5 * Math.sin(time * 1.6);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${theme.wallGlow},${0.08 + pulse * 0.08})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(A.left - 3, A.top - 3, A.right - A.left + 6, A.bottom - A.top + 6);
      ctx.restore();
    }
  }

  BR.THEMES = THEMES;
  BR.Draw = Draw;
  BR.Renderer = Renderer;
})();
