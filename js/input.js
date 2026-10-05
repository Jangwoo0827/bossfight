/* Keyboard + mouse state. Uses physical key codes so Korean IME layouts still work. */
(function () {
  'use strict';
  const BLOCKED = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  class Input {
    constructor(canvas) {
      this.canvas = canvas;
      this.keys = new Set();
      this.pressed = new Set();
      this.mouse = { x: BR.CONFIG.WIDTH / 2, y: BR.CONFIG.HEIGHT / 2, down: false };

      window.addEventListener('keydown', (e) => {
        if (!this.keys.has(e.code)) this.pressed.add(e.code);
        this.keys.add(e.code);
        if (BLOCKED.has(e.code)) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => this.keys.delete(e.code));
      window.addEventListener('blur', () => {
        this.keys.clear();
        this.mouse.down = false;
      });
      window.addEventListener('mousemove', (e) => this._updateMouse(e));
      canvas.addEventListener('mousedown', (e) => {
        this._updateMouse(e);
        if (e.button === 0) this.mouse.down = true;
      });
      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.mouse.down = false;
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _updateMouse(e) {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * BR.CONFIG.WIDTH;
      this.mouse.y = ((e.clientY - rect.top) / rect.height) * BR.CONFIG.HEIGHT;
    }

    isDown(code) { return this.keys.has(code); }
    wasPressed(code) { return this.pressed.has(code); }

    moveVector() {
      let x = 0, y = 0;
      if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
      if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
      if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
      if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
      const len = Math.hypot(x, y);
      return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    }

    releaseMouse() { this.mouse.down = false; }

    endFrame() { this.pressed.clear(); }
  }

  BR.Input = Input;
})();
