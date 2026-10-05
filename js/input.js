/*
 * Input: keyboard + mouse, gamepad (twin-stick) and virtual touch controls.
 * Everything is folded into the same API: isDown / wasPressed / moveVector / attacking / aimAngle.
 * Physical key codes are used so Korean IME layouts still work.
 */
(function () {
  'use strict';
  const BLOCKED = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const DEADZONE = 0.2;

  // Standard gamepad mapping -> game key codes
  const PAD_BUTTONS = {
    Space: [0, 4],     // A / LB : dash
    KeyE: [1, 5],      // B / RB : E skill
    KeyQ: [2, 6],      // X / LT : charge skill (hold)
    Escape: [9],       // Start  : pause
  };
  const PAD_ATTACK = 7; // RT

  // Rebindable actions -> the canonical key code the game logic listens to
  const ACTIONS = {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
    dash: 'Space', charge: 'KeyQ', skill: 'KeyE',
  };

  class Input {
    constructor(canvas) {
      this.canvas = canvas;
      this.keys = new Set();       // keyboard
      this.vkeys = new Set();      // touch buttons
      this.padKeys = new Set();    // gamepad buttons
      this.pressed = new Set();
      this.mouse = { x: BR.CONFIG.WIDTH / 2, y: BR.CONFIG.HEIGHT / 2, down: false };
      this.stick = { x: 0, y: 0 }; // analog move (touch or gamepad)
      this.aimAngle = null;        // overrides mouse aim when set
      this.touchAttack = false;
      this.padAttack = false;
      this.padPrev = {};
      this.padNavPrev = {};
      this.focusIndex = -1;
      this.lastDevice = 'mouse';

      this.remap = new Map();
      this.capturing = false; // true while the controls screen waits for a key
      window.addEventListener('keydown', (e) => {
        if (this.capturing) return;
        const code = this._translate(e.code);
        if (BLOCKED.has(e.code)) e.preventDefault();
        if (!code) return;
        if (!this.keys.has(code)) this.pressed.add(code);
        this.keys.add(code);
        this.lastDevice = 'keyboard';
      });
      window.addEventListener('keyup', (e) => {
        const code = this._translate(e.code);
        if (code) this.keys.delete(code);
      });
      window.addEventListener('blur', () => {
        this.keys.clear();
        this.vkeys.clear();
        this.mouse.down = false;
      });
      window.addEventListener('mousemove', (e) => this._updateMouse(e));
      // A real mouse (not touch-emulated) always takes aim back, even after touch/gamepad use
      window.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        this.aimAngle = null;
        this.lastDevice = 'mouse';
      });
      canvas.addEventListener('mousedown', (e) => {
        if (this.lastDevice === 'touch') return;
        this._updateMouse(e);
        if (e.button === 0) this.mouse.down = true;
      });
      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.mouse.down = false;
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // bindings: { action: physicalCode }. Rebound default keys stop triggering their old action.
    setBindings(bindings) {
      this.remap.clear();
      const custom = bindings || {};
      const used = new Set(Object.values(custom));
      for (const [action, canonical] of Object.entries(ACTIONS)) {
        const key = custom[action];
        if (key && key !== canonical) {
          this.remap.set(key, canonical);
          if (!used.has(canonical)) this.remap.set(canonical, null);
        }
      }
      this.keys.clear();
    }

    _translate(code) {
      return this.remap.has(code) ? this.remap.get(code) : code;
    }

    _updateMouse(e) {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * BR.CONFIG.WIDTH;
      this.mouse.y = ((e.clientY - rect.top) / rect.height) * BR.CONFIG.HEIGHT;
    }

    isDown(code) { return this.keys.has(code) || this.vkeys.has(code) || this.padKeys.has(code); }
    wasPressed(code) { return this.pressed.has(code); }
    get attacking() { return this.mouse.down || this.touchAttack || this.padAttack; }

    // Touch buttons
    virtualPress(code) {
      if (!this.vkeys.has(code)) this.pressed.add(code);
      this.vkeys.add(code);
    }
    virtualRelease(code) { this.vkeys.delete(code); }

    moveVector() {
      let x = 0, y = 0;
      if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
      if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
      if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
      if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
      const len = Math.hypot(x, y);
      if (len > 0) return { x: x / len, y: y / len };
      const s = Math.hypot(this.stick.x, this.stick.y);
      if (s > DEADZONE) {
        const k = Math.min(1, s) / s;
        return { x: this.stick.x * k, y: this.stick.y * k };
      }
      return { x: 0, y: 0 };
    }

    releaseMouse() {
      this.mouse.down = false;
      this.touchAttack = false;
    }

    /* ---------------- gamepad ---------------- */
    pollGamepad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let gp = null;
      for (const p of pads) if (p && p.connected) { gp = p; break; }
      if (!gp) {
        if (this.lastDevice === 'gamepad') { this.padKeys.clear(); this.padAttack = false; this.stick.x = this.stick.y = 0; }
        return;
      }
      const btn = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
      const dz = (v) => (Math.abs(v || 0) < DEADZONE ? 0 : v);
      const lx = dz(gp.axes[0]), ly = dz(gp.axes[1]), rx = dz(gp.axes[2]), ry = dz(gp.axes[3]);
      const anyInput = lx || ly || rx || ry || gp.buttons.some((b) => b && b.pressed);
      if (!anyInput && this.lastDevice !== 'gamepad') return;
      if (anyInput) this.lastDevice = 'gamepad';

      for (const code of Object.keys(PAD_BUTTONS)) {
        const down = PAD_BUTTONS[code].some(btn);
        if (down && !this.padPrev[code]) this.pressed.add(code);
        if (down) this.padKeys.add(code); else this.padKeys.delete(code);
        this.padPrev[code] = down;
      }
      this.stick.x = lx;
      this.stick.y = ly;
      const aimMag = Math.hypot(rx, ry);
      if (aimMag > 0.3) this.aimAngle = Math.atan2(ry, rx);
      else if (Math.hypot(lx, ly) > 0.3 && !btn(PAD_ATTACK)) this.aimAngle = Math.atan2(ly, lx);
      this.padAttack = btn(PAD_ATTACK) || aimMag > 0.6;

      this._padMenuNav(gp, btn, ly);
    }

    // D-pad / stick moves focus between overlay buttons, A clicks
    _padMenuNav(gp, btn, ly) {
      const root = document.getElementById('ui-root');
      if (!root || !root.querySelector('.overlay')) { this.focusIndex = -1; return; }
      const items = [...root.querySelectorAll('.btn:not([disabled]), .card, .diff-btn, .shop-item .btn')];
      if (!items.length) return;
      const nav = {
        prev: btn(12) || btn(14) || ly < -0.6,
        next: btn(13) || btn(15) || ly > 0.6,
        ok: btn(0),
      };
      const edge = (k) => nav[k] && !this.padNavPrev[k];
      if (this.focusIndex >= items.length) this.focusIndex = 0;
      if (edge('prev')) this.focusIndex = this.focusIndex <= 0 ? items.length - 1 : this.focusIndex - 1;
      if (edge('next')) this.focusIndex = (this.focusIndex + 1) % items.length;
      if (edge('prev') || edge('next')) {
        items.forEach((el) => el.classList.remove('gp-focus'));
        items[this.focusIndex].classList.add('gp-focus');
        items[this.focusIndex].scrollIntoView({ block: 'nearest' });
      }
      if (edge('ok') && this.focusIndex >= 0 && items[this.focusIndex]) items[this.focusIndex].click();
      this.padNavPrev = nav;
    }

    endFrame() { this.pressed.clear(); }
  }

  BR.INPUT_ACTIONS = ACTIONS;
  BR.keyLabel = (code) => {
    if (!code) return '—';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    const names = { Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', AltLeft: 'L-ALT',
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Tab: 'TAB', CapsLock: 'CAPS', Enter: 'ENTER' };
    return names[code] || code.toUpperCase();
  };
  BR.Input = Input;
})();
