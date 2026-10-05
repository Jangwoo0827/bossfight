/*
 * Touch controls (phones / tablets): floating left stick = move,
 * floating right stick = aim + auto attack, buttons for DASH / Q (hold) / E / pause.
 * Only created on touch-capable devices; hidden outside battle.
 */
(function () {
  'use strict';
  const STICK_RADIUS = 70;

  class TouchUI {
    constructor(game) {
      this.game = game;
      this.enabled = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      if (!this.enabled) return;
      this.wrap = document.getElementById('game-wrap');
      this.el = document.createElement('div');
      this.el.id = 'touch-ui';
      this.el.innerHTML = `
        <div class="tzone left"></div>
        <div class="tzone right"></div>
        <div class="tstick left"><div class="tknob"></div></div>
        <div class="tstick right"><div class="tknob"></div></div>
        <div class="tbtn dash" data-code="Space">DASH</div>
        <div class="tbtn q" data-code="KeyQ">Q</div>
        <div class="tbtn e" data-code="KeyE">E</div>
        <div class="tbtn pause" data-code="Escape">❚❚</div>
      `;
      this.wrap.appendChild(this.el);
      this.sticks = {
        left: { zone: this.el.querySelector('.tzone.left'), base: this.el.querySelector('.tstick.left'), id: null, ox: 0, oy: 0 },
        right: { zone: this.el.querySelector('.tzone.right'), base: this.el.querySelector('.tstick.right'), id: null, ox: 0, oy: 0 },
      };
      for (const side of ['left', 'right']) this._bindStick(side);
      this.el.querySelectorAll('.tbtn').forEach((b) => this._bindButton(b));
      this.visible = null;
    }

    _local(e) {
      const r = this.wrap.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * BR.CONFIG.WIDTH, y: ((e.clientY - r.top) / r.height) * BR.CONFIG.HEIGHT };
    }

    _bindStick(side) {
      const s = this.sticks[side];
      const input = this.game.input;
      const knob = s.base.querySelector('.tknob');
      s.zone.addEventListener('pointerdown', (e) => {
        if (s.id !== null) return;
        e.preventDefault();
        input.lastDevice = 'touch';
        s.id = e.pointerId;
        try { s.zone.setPointerCapture(e.pointerId); } catch (err) { /* capture unsupported: still works without */ }
        const p = this._local(e);
        s.ox = p.x;
        s.oy = p.y;
        s.base.style.left = `${p.x - STICK_RADIUS}px`;
        s.base.style.top = `${p.y - STICK_RADIUS}px`;
        s.base.classList.add('on');
        knob.style.transform = 'translate(0px, 0px)';
      });
      s.zone.addEventListener('pointermove', (e) => {
        if (e.pointerId !== s.id) return;
        const p = this._local(e);
        let dx = p.x - s.ox, dy = p.y - s.oy;
        const len = Math.hypot(dx, dy);
        if (len > STICK_RADIUS) { dx *= STICK_RADIUS / len; dy *= STICK_RADIUS / len; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        const nx = dx / STICK_RADIUS, ny = dy / STICK_RADIUS;
        if (side === 'left') {
          input.stick.x = nx;
          input.stick.y = ny;
        } else if (Math.hypot(nx, ny) > 0.25) {
          input.aimAngle = Math.atan2(ny, nx);
          input.touchAttack = true;
        }
      });
      const end = (e) => {
        if (e.pointerId !== s.id) return;
        s.id = null;
        s.base.classList.remove('on');
        if (side === 'left') { input.stick.x = 0; input.stick.y = 0; } else input.touchAttack = false;
      };
      s.zone.addEventListener('pointerup', end);
      s.zone.addEventListener('pointercancel', end);
    }

    _bindButton(b) {
      const input = this.game.input;
      const code = b.dataset.code;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        input.lastDevice = 'touch';
        b.classList.add('down');
        input.virtualPress(code);
      });
      const up = () => { b.classList.remove('down'); input.virtualRelease(code); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    }

    update() {
      if (!this.enabled) return;
      const g = this.game;
      const show = !g.paused && (g.state === 'intro' || g.state === 'fight' || g.state === 'victory');
      if (show !== this.visible) {
        this.visible = show;
        this.el.classList.toggle('hidden', !show);
        if (!show) {
          g.input.stick.x = g.input.stick.y = 0;
          g.input.touchAttack = false;
          g.input.vkeys.clear();
        }
      }
    }
  }

  BR.TouchUI = TouchUI;
})();
