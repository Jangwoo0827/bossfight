/* In-canvas HUD (no per-frame DOM work). */
(function () {
  'use strict';
  const { Draw, Geo } = BR;
  const C = BR.CONFIG;

  class HUD {
    constructor(game) {
      this.game = game;
      this.bossBarAlpha = 0;
    }

    draw(ctx, dt) {
      const g = this.game;
      if (!g.player || !g.run) return;
      this._drawBossBar(ctx, dt);
      this._drawPlayerPanel(ctx);
      this._drawRunInfo(ctx);
      this._drawBuild(ctx);
      this._drawControls(ctx);
    }

    _drawBossBar(ctx, dt) {
      const boss = this.game.boss;
      const visible = boss && !boss.dead && this.game.state !== 'intro';
      this.bossBarAlpha = Geo.clamp(this.bossBarAlpha + (visible ? dt * 3 : -dt * 2), 0, 1);
      if (!boss || this.bossBarAlpha <= 0) return;

      const w = 640, h = 16, x = (C.WIDTH - w) / 2, y = 52;
      ctx.save();
      ctx.globalAlpha = this.bossBarAlpha;
      const color = boss.def.color || '#ff4d6a';
      Draw.text(ctx, boss.name, C.WIDTH / 2, 26, { size: 22, font: 'Georgia', weight: '700', color: '#fff', spacing: 6, stroke: 'rgba(0,0,0,0.8)', strokeWidth: 5 });
      Draw.text(ctx, `PHASE ${boss.phase}`, x + w, 38, { size: 11, align: 'right', color: '#c9c0dd', spacing: 2 });

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      ctx.fillStyle = '#2a1820';
      ctx.fillRect(x, y, w, h);
      // Damage trail (white) then current HP
      ctx.fillStyle = 'rgba(255,240,220,0.85)';
      ctx.fillRect(x, y, w * Geo.clamp(boss.displayHp / boss.maxHp, 0, 1), h);
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, '#ff6a7c');
      grad.addColorStop(1, '#a3122c');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w * Geo.clamp(boss.hp / boss.maxHp, 0, 1), h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, y, w * Geo.clamp(boss.hp / boss.maxHp, 0, 1), 4);
      // Phase markers
      for (const t of boss.phaseThresholds) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + w * t - 1, y - 4, 2, h + 8);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 3.5, y - 3.5, w + 7, h + 7);
      Draw.text(ctx, `${Math.ceil(boss.hp)} / ${boss.maxHp}`, C.WIDTH / 2, y + h / 2 + 1, { size: 11, color: '#fff', weight: '700', stroke: 'rgba(0,0,0,0.7)', strokeWidth: 3 });
      ctx.restore();
    }

    _bar(ctx, x, y, w, h, ratio, colorA, colorB, label, valueText) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.fillStyle = '#1d1824';
      ctx.fillRect(x, y, w, h);
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, colorA);
      grad.addColorStop(1, colorB);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w * Geo.clamp(ratio, 0, 1), h);
      Draw.text(ctx, label, x + 6, y + h / 2 + 1, { size: 11, align: 'left', color: '#fff', weight: '800', spacing: 1, stroke: 'rgba(0,0,0,0.7)', strokeWidth: 3 });
      Draw.text(ctx, valueText, x + w - 6, y + h / 2 + 1, { size: 11, align: 'right', color: '#fff', weight: '700', stroke: 'rgba(0,0,0,0.7)', strokeWidth: 3 });
    }

    // Label for an action's key, following key bindings (or gamepad buttons when a pad is in use)
    keyFor(action, short) {
      const g = this.game;
      if (g.input.lastDevice === 'gamepad') return { dash: 'A', charge: 'X', skill: 'B' }[action] || '';
      const code = (g.saveData.settings.keys || {})[action] || BR.INPUT_ACTIONS[action];
      const label = BR.keyLabel(code);
      if (!short || label.length <= 3) return label;
      const abbr = { SPACE: 'SPC', 'L-SHIFT': 'L⇧', 'R-SHIFT': 'R⇧', 'L-CTRL': 'LCT', 'L-ALT': 'LAL', ENTER: 'ENT', CAPS: 'CAP' };
      return abbr[label] || label.slice(0, 3);
    }

    _cooldownIcon(ctx, x, y, key, label, remaining, total, ready, extra) {
      const r = 19;
      Draw.circle(ctx, x, y, r, 'rgba(10,8,16,0.85)', ready ? '#5ee7ff' : '#4a4460', 2);
      if (!ready && total > 0) {
        const k = Geo.clamp(remaining / total, 0, 1);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, r - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
        ctx.closePath();
        ctx.fillStyle = 'rgba(90,80,120,0.55)';
        ctx.fill();
      } else if (ready) {
        Draw.glow(ctx, x, y, r * 1.6, '94,231,255', 0.25);
      }
      Draw.text(ctx, key, x, y + 1, { size: key.length <= 1 ? 14 : 12, color: ready ? '#fff' : '#9a93b0', weight: '800' });
      Draw.text(ctx, label, x, y + r + 10, { size: 9, color: '#a59fbc', spacing: 1 });
      if (extra) Draw.text(ctx, extra, x + r - 2, y - r + 4, { size: 10, color: '#ffe37a', weight: '800', stroke: '#000', strokeWidth: 3 });
    }

    _drawPlayerPanel(ctx) {
      const p = this.game.player;
      const s = p.stats;
      const x = 52, y = 654;
      this._bar(ctx, x, y, 260, 16, p.hp / s.maxHp, '#ff6a80', '#b0162f', 'HP', `${Math.ceil(p.hp)} / ${s.maxHp}`);
      if (p.hp / s.maxHp < 0.3 && p.hp > 0) {
        ctx.strokeStyle = `rgba(255,60,80,${0.5 + 0.5 * Math.sin(this.game.time * 10)})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 3, y - 3, 266, 22);
      }
      this._bar(ctx, x, y + 24, 260, 10, p.energy / C.PLAYER.maxEnergy, '#9aa6ff', '#4a52c9', '', '');
      Draw.text(ctx, 'ENERGY', x + 6, y + 29, { size: 8, align: 'left', color: '#dfe2ff', weight: '800', spacing: 1 });

      const ix = 352, iy = 672;
      const dashReady = p.dashCooldownTimer <= 0;
      this._cooldownIcon(ctx, ix, iy, this.keyFor('dash', true), dashReady ? 'DASH READY' : 'DASH', p.dashCooldownTimer, p.dashCooldown, dashReady);
      const ch = p.character;
      const lanceReady = p.lanceCharges > 0 && p.energy >= C.SKILLS.charge.energyCost;
      const lanceRemain = p.lanceCharges > 0 ? 0 : p.lanceRecharge;
      this._cooldownIcon(ctx, ix + 56, iy, this.keyFor('charge', true), p.isCharging ? `${Math.round(p.chargePower * 100)}%` : ch.qName, lanceRemain, p.lanceCooldown, lanceReady,
        s.skillCharges > 1 ? `${p.lanceCharges}` : '');
      const eReady = p.eTimer <= 0 && p.energy >= p.eSkill.energyCost;
      this._cooldownIcon(ctx, ix + 112, iy, this.keyFor('skill', true), ch.eName, Math.max(0, p.eTimer), p.eCooldown, eReady);
    }

    _drawRunInfo(ctx) {
      const g = this.game;
      const run = g.run;
      const x = C.WIDTH - 52;
      Draw.text(ctx, run.mode === 'run' ? `BOSS ${Math.min(run.bossNumber, run.totalBosses)} / ${run.totalBosses}` : run.mode.toUpperCase(), x, 30, { size: 18, align: 'right', color: '#fff', weight: '800', spacing: 3, font: 'Georgia' });
      // Progress pips
      for (let i = 0; i < run.totalBosses; i++) {
        const px = x - (run.totalBosses - 1 - i) * 14 - 4;
        const done = i < run.stage;
        const current = i === run.stage;
        Draw.circle(ctx, px, 54, 4.5, done ? '#ff4d6a' : current ? '#ffd166' : '#2f2840', current ? '#fff' : null, 1.5);
      }
      Draw.text(ctx, `SOUL ${g.saveData.soul}`, 52, 30, { size: 15, align: 'left', color: C.COLORS.soul, weight: '800', spacing: 2 });
      const theme = g.renderer.getTheme(g.theme);
      Draw.text(ctx, `${run.rush ? 'BOSS RUSH · ' : ''}${run.daily ? 'DAILY · ' : ''}${run.difficulty.name} · ${run.character.name} · ${theme.label.toUpperCase()}`, 52, 52, { size: 10, align: 'left', color: '#8d86a6', spacing: 2 });
      if (run.relics.length) Draw.text(ctx, run.relics.map((r) => r.icon).join(' '), 52, 76, { size: 15, align: 'left', color: '#ffd76a' });
      if (run.modifiers.length) Draw.text(ctx, run.modifiers.map((m) => m.icon).join(' '), 52 + run.relics.length * 24 + (run.relics.length ? 10 : 0), 76, { size: 14, align: 'left', color: '#ff8da0' });
      Draw.text(ctx, run.difficulty.name, x, 72, { size: 10, align: 'right', color: run.difficulty.color, weight: '800', spacing: 3 });
    }

    _drawBuild(ctx) {
      const summary = this.game.run.buildSummary();
      if (!summary.length) return;
      let x = C.WIDTH - 52;
      const y = 676;
      ctx.save();
      for (let i = summary.length - 1; i >= 0; i--) {
        const item = summary[i];
        const label = item.stacks > 1 ? `${item.short} x${item.stacks}` : item.short;
        ctx.font = '700 11px Segoe UI, sans-serif';
        const w = ctx.measureText(label).width + 14;
        if (x - w < 560) break;
        ctx.fillStyle = 'rgba(160,120,255,0.14)';
        ctx.fillRect(x - w, y - 11, w, 22);
        ctx.strokeStyle = 'rgba(180,140,255,0.45)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - w + 0.5, y - 10.5, w - 1, 21);
        Draw.text(ctx, label, x - w / 2, y + 1, { size: 11, color: '#e2d8ff', weight: '700' });
        x -= w + 6;
      }
      ctx.restore();
      Draw.text(ctx, 'BUILD', C.WIDTH - 52, 656, { size: 9, align: 'right', color: '#7d7695', spacing: 3 });
    }

    _drawControls(ctx) {
      const g = this.game;
      if (g.run.stage > 0 && g.time - g.fightStartTime > 12) return;
      const k = (a) => this.keyFor(a, false);
      const move = ['up', 'left', 'down', 'right'].map(k).join('');
      Draw.text(ctx, `${move} 이동 · 마우스 조준 · 좌클릭 공격 · ${k('dash')} 대시 · ${k('charge')} 충전 스킬 (꾹) · ${k('skill')} 스킬/패리 · ESC 일시정지`,
        C.WIDTH / 2, 712, { size: 11, color: 'rgba(200,190,225,0.55)', spacing: 1 });
    }
  }

  // Replace {move} {up} {down} {left} {right} {dash} {charge} {skill} with the bound keys
  BR.fillKeys = (text) => {
    const hud = BR.game && BR.game.hud;
    if (!hud || !text) return text;
    return String(text).replace(/\{(move|up|down|left|right|dash|charge|skill)\}/g, (m, a) =>
      a === 'move' ? ['up', 'left', 'down', 'right'].map((x) => hud.keyFor(x, false)).join('') : hud.keyFor(a, false));
  };

  BR.HUD = HUD;
})();
