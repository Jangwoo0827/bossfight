/*
 * Unique silhouettes for the five APEX bosses (apex.js holds their behaviour).
 * Each boss is drawn completely differently so none of them reads as a recolour.
 */
(function () {
  'use strict';
  const { Draw } = BR;
  const CL = BR.BossClasses;
  const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };

  // MAGMA TITAN — hulking rock giant with swinging fists and a molten core
  CL.magmaTitan.prototype.drawBody = function (ctx, time) {
    const r = this.radius, hot = 0.6 + 0.4 * Math.sin(time * 5);
    ctx.save();
    ctx.translate(this.x, this.y);
    Draw.glow(ctx, 0, 0, r * 3, '255,110,30', 0.28 + 0.15 * hot);
    const sw = Math.sin(time * 2.2) * 0.2;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * r * 1.05, -r * 0.35);
      ctx.rotate(s * 0.3 + sw);
      ctx.fillStyle = '#2a1610'; ctx.strokeStyle = '#ff7a30'; ctx.lineWidth = 2.5;
      ctx.fillRect(-r * 0.26, 0, r * 0.52, r * 0.95); ctx.strokeRect(-r * 0.26, 0, r * 0.52, r * 0.95);
      poly(ctx, [[-r * 0.45, r * 0.95], [-r * 0.2, r * 1.5], [r * 0.25, r * 1.55], [r * 0.46, r * 1.0]]);
      ctx.fillStyle = '#3a1c10'; ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    const pts = [];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const k = i % 2 ? 0.86 : 1.12; pts.push([Math.cos(a) * r * k * 1.05, Math.sin(a) * r * k * 0.95]); }
    poly(ctx, pts);
    const g = ctx.createRadialGradient(0, -r * 0.3, 4, 0, 0, r * 1.2);
    g.addColorStop(0, '#4a2616'); g.addColorStop(1, '#170a06');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#ff7a30'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = `rgba(255,170,60,${0.5 + 0.4 * hot})`; ctx.lineWidth = 2.5;
    for (const c of [[-0.7, -0.5, -0.2, 0.1], [0.6, -0.6, 0.25, 0.0], [-0.5, 0.6, -0.1, 0.25], [0.55, 0.5, 0.1, 0.15]]) {
      ctx.beginPath(); ctx.moveTo(c[0] * r, c[1] * r); ctx.lineTo(c[2] * r, c[3] * r); ctx.lineTo(c[2] * r + 6, c[3] * r + r * 0.4); ctx.stroke();
    }
    Draw.glow(ctx, 0, r * 0.05, r * 0.7, '255,150,40', 0.5 + 0.4 * hot);
    Draw.circle(ctx, 0, r * 0.05, r * 0.28, '#ffd070', '#ff7a30', 2);
    Draw.circle(ctx, 0, -r * 1.08, r * 0.42, '#2a1610', '#ff7a30', 2.5);
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(-r * 0.26, -r * 1.14, r * 0.18, r * 0.07); ctx.fillRect(r * 0.08, -r * 1.14, r * 0.18, r * 0.07);
    ctx.restore();
  };

  // PRISM SERAPH — floating crystal with glass wings, a halo and orbiting shards
  CL.prismSeraph.prototype.drawBody = function (ctx, time) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    Draw.glow(ctx, 0, 0, r * 3.2, '127,255,232', 0.3);
    for (let i = 0; i < 6; i++) {
      const a = time * 1.5 + (i * Math.PI) / 3;
      ctx.save();
      ctx.translate(Math.cos(a) * r * 2.1, Math.sin(a) * r * 1.5);
      ctx.rotate(a * 2);
      poly(ctx, [[0, -7], [4, 0], [0, 7], [-4, 0]]);
      ctx.fillStyle = `hsla(${(i * 60 + time * 80) % 360},90%,75%,0.85)`; ctx.fill();
      ctx.restore();
    }
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.scale(s, 1);
      ctx.rotate(Math.sin(time * 3) * 0.1);
      for (let k = 0; k < 3; k++) {
        poly(ctx, [[r * 0.5, -r * 0.2 - k * 3], [r * (2.5 - k * 0.3), -r * (1.3 - k * 0.35)], [r * (2.0 - k * 0.3), r * (0.1 + k * 0.3)], [r * 0.5, r * 0.3]]);
        ctx.fillStyle = `rgba(127,255,232,${0.14 + k * 0.05})`; ctx.fill();
        ctx.strokeStyle = 'rgba(200,255,245,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.restore();
    }
    poly(ctx, [[0, -r * 1.35], [r * 0.85, 0], [0, r * 1.35], [-r * 0.85, 0]]);
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#9ffff0'); g.addColorStop(1, '#3a7bd0');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -r * 1.35); ctx.lineTo(0, r * 1.35); ctx.moveTo(-r * 0.85, 0); ctx.lineTo(r * 0.85, 0); ctx.stroke();
    ctx.fillStyle = '#10223a';
    poly(ctx, [[-r * 0.1, -r * 0.2], [0, -r * 0.5], [r * 0.1, -r * 0.2], [0, r * 0.15]]); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -r * 1.85, r * 0.7, r * 0.2, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  };

  // NIGHT EMPRESS — a veiled bloom: two rings of petals, thorn crown, trailing vines
  CL.nightEmpress.prototype.drawBody = function (ctx, time) {
    const r = this.radius, col = this.rgb;
    ctx.save();
    ctx.translate(this.x, this.y);
    Draw.glow(ctx, 0, 0, r * 3, col, 0.32);
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + (i - 2) * 0.5, w = Math.sin(time * 2 + i) * 8;
      ctx.strokeStyle = 'rgba(70,200,120,0.7)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, r * 0.4); ctx.quadraticCurveTo(Math.cos(a) * r * 1.4 + w, r * 1.2, Math.cos(a) * r * 2.1, r * 2.0 + Math.abs(w)); ctx.stroke();
    }
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate(this.spin * (layer ? -0.35 : 0.25) + (i * Math.PI) / 4 + layer * 0.4);
        ctx.beginPath(); ctx.ellipse(0, -r * (1.45 - layer * 0.35), r * 0.42, r * (1.0 - layer * 0.2), 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col},${0.3 + layer * 0.22})`; ctx.fill();
        ctx.strokeStyle = `rgba(${col},0.95)`; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
    }
    Draw.circle(ctx, 0, 0, r * 0.7, '#efe0f8', '#2a0a44', 2.5);
    ctx.fillStyle = '#1d0830'; ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0.05 * Math.PI, 0.95 * Math.PI); ctx.closePath(); ctx.fill();
    Draw.glow(ctx, -r * 0.24, -r * 0.1, 10, col, 0.9); Draw.glow(ctx, r * 0.24, -r * 0.1, 10, col, 0.9);
    ctx.fillStyle = '#ff9aff';
    ctx.beginPath(); ctx.arc(-r * 0.24, -r * 0.1, 3, 0, Math.PI * 2); ctx.arc(r * 0.24, -r * 0.1, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a0a44'; ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.3;
      poly(ctx, [[Math.cos(a - 0.1) * r * 0.7, Math.sin(a - 0.1) * r * 0.7], [Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05], [Math.cos(a + 0.1) * r * 0.7, Math.sin(a + 0.1) * r * 0.7]]);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  };

  // TIDE LEVIATHAN — a sea serpent: a segmented body that follows its head, fins, open jaws
  const TL = CL.tideLeviathan.prototype;
  const baseExtra = TL.updateExtra;
  TL.updateExtra = function (dt) {
    baseExtra.call(this, dt);
    const tr = this.tr || (this.tr = []);
    this.trT = (this.trT || 0) + dt;
    if (this.trT > 0.045) { this.trT = 0; tr.unshift({ x: this.x, y: this.y }); if (tr.length > 22) tr.pop(); }
  };
  TL.drawBody = function (ctx, time) {
    const r = this.radius, tr = this.tr || [];
    for (let i = tr.length - 1; i >= 1; i -= 2) {
      const t = tr[i], k = 1 - i / 26, wob = Math.sin(time * 4 + i) * 4;
      Draw.circle(ctx, t.x, t.y + wob, r * (0.35 + 0.5 * k), `rgba(30,90,140,${0.5 + 0.4 * k})`, 'rgba(96,200,255,0.8)', 2);
      if (i % 4 === 1) {
        ctx.fillStyle = 'rgba(96,200,255,0.6)';
        poly(ctx, [[t.x - 5, t.y - r * 0.4 * k - 4 + wob], [t.x + 5, t.y - r * 0.4 * k - 4 + wob], [t.x, t.y - r * (0.75 * k + 0.2) + wob]]);
        ctx.fill();
      }
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    Draw.glow(ctx, 0, 0, r * 2.6, '96,200,255', 0.3);
    ctx.rotate(this.facing);
    if (Math.cos(this.facing) < 0) ctx.scale(1, -1);
    const jaw = 0.25 + 0.2 * Math.sin(time * 3);
    ctx.fillStyle = '#10345a'; ctx.strokeStyle = '#60c8ff'; ctx.lineWidth = 2.5;
    ctx.save();
    ctx.rotate(jaw);
    poly(ctx, [[0, 0], [r * 1.5, r * 0.05], [r * 1.3, r * 0.55], [0, r * 0.7]]); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8fbff';
    for (let i = 0; i < 4; i++) {
      poly(ctx, [[r * (0.4 + i * 0.28), r * 0.05], [r * (0.5 + i * 0.28), -r * 0.2], [r * (0.58 + i * 0.28), r * 0.06]]);
      ctx.fill();
    }
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, -r * 0.1, r * 1.25, r * 0.85, 0, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#2a78b8'); g.addColorStop(1, '#0b2a48');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#60c8ff'; ctx.stroke();
    ctx.fillStyle = '#60c8ff';
    poly(ctx, [[-r * 0.6, -r * 0.8], [-r * 0.2, -r * 1.6], [r * 0.2, -r * 0.85]]); ctx.fill();
    poly(ctx, [[-r * 0.2, r * 0.55], [-r * 0.9, r * 1.2], [-r * 0.7, r * 0.4]]); ctx.fill();
    Draw.glow(ctx, r * 0.5, -r * 0.35, 14, '255,255,160', 0.9);
    Draw.circle(ctx, r * 0.5, -r * 0.35, r * 0.15, '#fff6a0', '#10345a', 1.5);
    ctx.restore();
  };

  // RUIN KING — hooded and tattered, a shattered crown floating above, a greatsword toward you
  CL.ruinKing.prototype.drawBody = function (ctx, time) {
    const r = this.radius, col = this.rgb, bob = Math.sin(time * 2) * 3;
    ctx.save();
    ctx.translate(this.x, this.y);
    Draw.glow(ctx, 0, 0, r * 3, col, 0.28);
    ctx.strokeStyle = `rgba(${col},0.6)`; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) { const a0 = this.spin * 0.4 + (i / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(0, -r * 0.3, r * 2.1, a0, a0 + 0.8); ctx.stroke(); }
    const hem = [];
    for (let k = 0; k <= 6; k++) hem.push([r * (1.4 - k * 0.467), r * (1.5 + (k % 2 ? 0.35 : 0)) + bob + Math.sin(time * 3 + k) * 3]);
    poly(ctx, [[-r * 0.65, -r * 0.45], [r * 0.65, -r * 0.45], ...hem]);
    const g = ctx.createLinearGradient(0, -r, 0, r * 1.8); g.addColorStop(0, '#2a0c14'); g.addColorStop(1, '#07030a');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = `rgba(${col},0.55)`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.2); ctx.lineTo(-r * 0.2, r * 0.7); ctx.moveTo(r * 0.3, 0); ctx.lineTo(r * 0.5, r * 0.9); ctx.stroke();
    Draw.circle(ctx, 0, -r * 0.75, r * 0.56, '#190a12', `rgb(${col})`, 2.5);
    Draw.glow(ctx, -r * 0.2, -r * 0.78, 9, col, 0.95); Draw.glow(ctx, r * 0.2, -r * 0.78, 9, col, 0.95);
    ctx.fillStyle = '#ffd0d0'; ctx.fillRect(-r * 0.3, -r * 0.8, r * 0.2, 3); ctx.fillRect(r * 0.1, -r * 0.8, r * 0.2, 3);
    ctx.save();
    ctx.translate(0, -r * 1.75 + bob);
    ctx.fillStyle = '#c9a23a'; ctx.strokeStyle = '#6a4a10'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate((i - 1.5) * r * 0.34, Math.sin(time * 2 + i) * 3 - (i % 2) * 4);
      ctx.rotate((i - 1.5) * 0.18);
      poly(ctx, [[-5, 8], [0, -10], [5, 8]]); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.save();
    ctx.rotate(this.facing);
    Draw.glow(ctx, r * 2.2, 0, r * 1.3, col, 0.35);
    ctx.fillStyle = '#4a3020'; ctx.fillRect(r * 0.7, -3, r * 0.5, 6);
    ctx.fillStyle = '#c9a23a'; ctx.fillRect(r * 1.15, -r * 0.45, 6, r * 0.9);
    const bl = ctx.createLinearGradient(0, -6, 0, 6); bl.addColorStop(0, '#ffffff'); bl.addColorStop(1, '#a0a8b8');
    ctx.fillStyle = bl; poly(ctx, [[r * 1.2, -6], [r * 3.1, -4], [r * 3.5, 0], [r * 3.1, 4], [r * 1.2, 6]]); ctx.fill();
    ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    ctx.restore();
  };
})();
