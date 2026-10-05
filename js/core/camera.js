/* Screen shake. The arena never scrolls, so the camera is only an offset. */
(function () {
  'use strict';

  class Camera {
    constructor() {
      this.amplitude = 0;
      this.duration = 0;
      this.timer = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      this.intensity = 1; // settings multiplier (0 = off)
    }

    shake(amplitude, duration) {
      const amp = amplitude * this.intensity;
      if (amp <= 0) return;
      // Stronger shake wins; weak shakes never cut a strong one short
      const current = this.timer > 0 ? this.amplitude * (this.timer / this.duration) : 0;
      if (amp >= current) {
        this.amplitude = Math.min(amp, 14);
        this.duration = duration;
        this.timer = duration;
      }
    }

    shakePreset(name) {
      const preset = BR.CONFIG.SHAKE[name];
      if (preset) this.shake(preset[0], preset[1]);
    }

    update(dt) {
      if (this.timer > 0) {
        this.timer -= dt;
        const k = Math.max(0, this.timer / this.duration);
        const a = this.amplitude * k * k;
        this.offsetX = (Math.random() * 2 - 1) * a;
        this.offsetY = (Math.random() * 2 - 1) * a;
      } else {
        this.offsetX = 0;
        this.offsetY = 0;
      }
    }

    reset() {
      this.timer = 0;
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }

  BR.Camera = Camera;
})();
