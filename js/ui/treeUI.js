/*
 * SOUL TREE — the permanent upgrades drawn as a constellation.
 * Every level of every META_UPGRADE is one node; a stat's levels form a chain.
 * Chains branch off other chains (BR.META_TREE: parent + attach index), so deeper stats
 * need points in earlier ones. Allocation is just saveData.meta[stat] (levels), so old saves
 * map onto the tree automatically and nothing new needs saving.
 */
(function () {
  'use strict';
  const W = 1180, H = 520;
  const GROUPS = {
    offense: { angle: 200, rgb: '255,150,70', label: 'OFFENSE' },
    skill: { angle: -20, rgb: '94,200,255', label: 'SKILL' },
    fortune: { angle: 25, rgb: '255,215,106', label: 'FORTUNE' },
    defense: { angle: 155, rgb: '255,90,110', label: 'DEFENSE' },
    mobility: { angle: -90, rgb: '130,255,170', label: 'MOBILITY' },
  };

  class TreeUI {
    constructor(game) {
      this.game = game;
      this.layout = null;
      this.hover = null;
    }

    _build() {
      const defs = {};
      for (const d of BR.META_UPGRADES) defs[d.id] = d;
      const chains = {}, nodes = [], links = [];
      const root = { x: 0, y: 0, root: true };
      const SP = 32, R0 = 50;
      for (const t of BR.META_TREE) {
        const def = defs[t.stat];
        if (!def) continue;
        const grp = GROUPS[t.group];
        let base, dir;
        if (!t.parent) { base = root; dir = (grp.angle * Math.PI) / 180; }
        else { const pc = chains[t.parent]; base = pc.nodes[Math.min(t.at, pc.nodes.length - 1)]; dir = pc.dir + t.turn; }
        const chain = { t, def, grp, dir, nodes: [] };
        for (let i = 0; i < def.maxLevel; i++) {
          const dist = t.parent ? SP * (i + 1) : R0 + SP * i;
          const wig = Math.sin(i * 1.9 + dir * 3) * 5;
          const node = {
            chain, i,
            x: base.x + Math.cos(dir) * dist + Math.cos(dir + Math.PI / 2) * wig,
            y: base.y + Math.sin(dir) * dist + Math.sin(dir + Math.PI / 2) * wig,
            notable: i === def.maxLevel - 1,
          };
          links.push([i === 0 ? base : chain.nodes[i - 1], node]);
          chain.nodes.push(node);
          nodes.push(node);
        }
        chains[t.stat] = chain;
      }
      // fit into the canvas
      const pts = [root, ...nodes];
      const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
      const s = Math.min((W - 80) / (maxX - minX || 1), (H - 60) / (maxY - minY || 1), 3.2);
      const ox = W / 2 - ((minX + maxX) / 2) * s, oy = H / 2 - ((minY + maxY) / 2) * s;
      for (const p of pts) { p.x = p.x * s + ox; p.y = p.y * s + oy; }
      this.layout = { root, nodes, links, chains };
    }

    _state(node) {
      const meta = this.game.saveData.meta;
      const { t, def } = node.chain;
      const level = meta[t.stat] || 0;
      if (node.i < level) return 'owned';
      if (node.i > level) return 'locked';
      if (t.parent && (meta[t.parent] || 0) < t.at + 1) return 'locked';
      return this.game.saveData.soul >= BR.UpgradeSystem.metaCost(def, node.i) ? 'buy' : 'poor';
    }

    show(onBack) {
      const g = this.game;
      if (!this.layout) this._build();
      const legend = Object.values(GROUPS).map((x) => `<span style="color:rgb(${x.rgb})">● ${x.label}</span>`).join('');
      const panel = BR.UIRoot.show('dim', `
        <div class="soul-badge">SOUL <b data-role="soul">${g.saveData.soul}</b></div>
        <div class="heading" style="font-size:34px">SOUL TREE</div>
        <div class="subheading" style="margin-bottom:6px">빛나는 노드를 눌러 획득 · 가지를 따라 뻗어 나간다 · 죽어도 유지</div>
        <div class="tree-wrap"><canvas class="tree-canvas" width="${W}" height="${H}"></canvas><div class="tree-tip" data-role="tip"></div></div>
        <div class="tree-legend">${legend}</div>
        <div class="btn-row" style="margin-top:8px"><button class="btn" data-action="back">Back</button></div>
      `);
      this.canvas = panel.querySelector('canvas');
      this.tip = panel.querySelector('[data-role="tip"]');
      this.soulEl = panel.querySelector('[data-role="soul"]');
      const pick = (e) => {
        const r = this.canvas.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
        let best = null, bd = 14;
        for (const n of this.layout.nodes) { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } }
        return best;
      };
      this.canvas.addEventListener('mousemove', (e) => { const n = pick(e); if (n !== this.hover) { this.hover = n; this.draw(); } });
      this.canvas.addEventListener('mouseleave', () => { this.hover = null; this.draw(); });
      this.canvas.addEventListener('click', (e) => {
        const n = pick(e);
        if (!n) return;
        this.hover = n;
        if (this._state(n) === 'buy' && BR.UpgradeSystem.buyMeta(g.saveData, n.chain.t.stat)) {
          BR.SaveSystem.save(g.saveData);
          g.audio.play('reward');
        } else g.audio.play('button');
        this.draw();
      });
      panel.querySelector('[data-action="back"]').addEventListener('click', () => { g.audio.play('button'); onBack(); });
      this.draw();
    }

    draw() {
      const ctx = this.canvas && this.canvas.getContext('2d');
      if (!ctx) return;
      const { root, nodes, links } = this.layout;
      ctx.clearRect(0, 0, W, H);
      const neb = ctx.createRadialGradient(root.x, root.y, 10, root.x, root.y, 300);
      neb.addColorStop(0, 'rgba(60,110,140,0.35)');
      neb.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, W, H);

      const owned = (n) => n.root || this._state(n) === 'owned';
      ctx.setLineDash([2, 5]);
      ctx.lineWidth = 1.6;
      for (const [a, b] of links) {
        ctx.strokeStyle = owned(a) && owned(b) ? 'rgba(255,240,200,0.85)' : 'rgba(150,150,170,0.28)';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.setLineDash([]);

      for (const n of nodes) {
        const st = this._state(n), rgb = n.chain.grp.rgb;
        const r = n.notable ? 8 : 5.5;
        if (st === 'owned') {
          BR.Draw.glow(ctx, n.x, n.y, r * 3.2, n.notable ? rgb : '255,240,190', 0.8);
          BR.Draw.circle(ctx, n.x, n.y, r, n.notable ? `rgb(${rgb})` : '#fff4d6', '#ffffff', 1.5);
        } else if (st === 'buy') {
          BR.Draw.glow(ctx, n.x, n.y, r * 3, rgb, 0.55);
          BR.Draw.circle(ctx, n.x, n.y, r, '#141020', `rgb(${rgb})`, 2.5);
        } else if (st === 'poor') {
          BR.Draw.circle(ctx, n.x, n.y, r, '#141020', `rgba(${rgb},0.6)`, 2);
        } else {
          BR.Draw.circle(ctx, n.x, n.y, r - 1, '#1a1724', 'rgba(140,135,160,0.45)', 1.2);
        }
        if (n === this.hover) BR.Draw.circle(ctx, n.x, n.y, r + 5, null, '#ffffff', 1.5);
      }
      BR.Draw.glow(ctx, root.x, root.y, 40, '80,140,255', 0.9);
      BR.Draw.circle(ctx, root.x, root.y, 11, '#1a3aa0', '#9fc4ff', 2.5);
      BR.Draw.circle(ctx, root.x, root.y, 5, '#dfeaff');

      if (this.soulEl) this.soulEl.textContent = this.game.saveData.soul;
      const n = this.hover;
      if (!n) { this.tip.style.display = 'none'; return; }
      const { def, t } = n.chain;
      const st = this._state(n);
      const cost = BR.UpgradeSystem.metaCost(def, n.i);
      const parentDef = t.parent ? BR.META_UPGRADES.find((d) => d.id === t.parent) : null;
      const status = st === 'owned' ? '획득함'
        : st === 'buy' ? `클릭해서 획득 · ${cost} SOUL`
        : st === 'poor' ? `SOUL 부족 · ${cost} SOUL`
        : n.i > (this.game.saveData.meta[t.stat] || 0) ? '앞 노드를 먼저 획득'
        : `먼저 ${parentDef ? parentDef.name : ''} ${t.at + 1}레벨 필요`;
      this.tip.innerHTML = `<b style="color:rgb(${n.chain.grp.rgb})">${BR.escapeHtml(def.name)} ${n.i + 1}/${def.maxLevel}</b><br>${BR.fillKeys(BR.escapeHtml(def.desc))}<br><span class="tip-state ${st}">${status}</span>`;
      this.tip.style.display = 'block';
      const px = (n.x / W) * 100, py = (n.y / H) * 100;
      this.tip.style.left = `${Math.min(px, 78)}%`;
      this.tip.style.top = `${Math.min(py + 3, 82)}%`;
    }
  }

  BR.TreeUI = TreeUI;
})();
