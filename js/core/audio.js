/*
 * AudioManager: works with zero audio files by synthesizing short placeholder
 * sounds with WebAudio. Real files can be attached later with
 * audio.register('hit', 'sounds/hit.wav') — registered files take priority.
 */
(function () {
  'use strict';

  const SYNTH = {
    attack:     { wave: 'triangle', f0: 760, f1: 240, dur: 0.07, vol: 0.07, noise: 0.05, filter: 4000 },
    hit:        { wave: 'square', f0: 320, f1: 110, dur: 0.07, vol: 0.05, noise: 0.08, filter: 2500 },
    bossHit:    { wave: 'sawtooth', f0: 240, f1: 80, dur: 0.08, vol: 0.06, noise: 0.1, filter: 2200 },
    crit:       { wave: 'square', f0: 1100, f1: 300, dur: 0.12, vol: 0.07, noise: 0.12, filter: 5000 },
    dash:       { noise: 0.16, dur: 0.14, filter: 1700 },
    playerHurt: { wave: 'sawtooth', f0: 200, f1: 55, dur: 0.25, vol: 0.14, noise: 0.14, filter: 1400 },
    bossPhase:  { wave: 'sawtooth', f0: 90, f1: 35, dur: 1.1, vol: 0.18, noise: 0.18, filter: 900 },
    bossDeath:  { wave: 'sawtooth', f0: 220, f1: 28, dur: 1.7, vol: 0.2, noise: 0.25, filter: 1200 },
    bossIntro:  { wave: 'sine', f0: 60, f1: 45, dur: 1.4, vol: 0.22, noise: 0.06, filter: 500 },
    reward:     { arp: [523, 659, 784, 1046], wave: 'triangle', dur: 0.11, vol: 0.08 },
    button:     { wave: 'sine', f0: 620, f1: 900, dur: 0.06, vol: 0.06 },
    explosion:  { wave: 'sine', f0: 110, f1: 30, dur: 0.4, vol: 0.18, noise: 0.22, filter: 700 },
    swing:      { noise: 0.1, dur: 0.12, filter: 2600 },
    shoot:      { wave: 'triangle', f0: 500, f1: 260, dur: 0.09, vol: 0.04 },
    skill:      { wave: 'triangle', f0: 300, f1: 1300, dur: 0.2, vol: 0.09, noise: 0.05, filter: 5000 },
    nova:       { wave: 'sine', f0: 900, f1: 180, dur: 0.3, vol: 0.12, noise: 0.12, filter: 3000 },
    teleport:   { wave: 'sine', f0: 300, f1: 1500, dur: 0.18, vol: 0.06 },
    death:      { wave: 'sawtooth', f0: 300, f1: 40, dur: 1.0, vol: 0.18, noise: 0.15, filter: 900 },
    clear:      { arp: [392, 523, 659, 784, 1046, 1318], wave: 'triangle', dur: 0.13, vol: 0.09 },
  };

  class AudioManager {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.noiseBuffer = null;
      this.volume = 0.5;
      this.files = new Map(); // name -> HTMLAudioElement
      this.lastPlayed = new Map();
      const unlock = () => this.unlock();
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
    }

    unlock() {
      try {
        if (!this.ctx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          this.ctx = new Ctx();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.volume;
          this.master.connect(this.ctx.destination);
          const len = this.ctx.sampleRate;
          this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const data = this.noiseBuffer.getChannelData(0);
          for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) {
        this.ctx = null;
      }
    }

    register(name, url) {
      const el = new Audio(url);
      el.preload = 'auto';
      this.files.set(name, el);
    }

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.master) this.master.gain.value = this.volume;
    }

    play(name) {
      if (this.volume <= 0) return;
      const now = performance.now();
      const last = this.lastPlayed.get(name) || 0;
      if (now - last < 35) return; // avoid stacking identical sounds
      this.lastPlayed.set(name, now);

      const file = this.files.get(name);
      if (file) {
        const clone = file.cloneNode();
        clone.volume = this.volume;
        clone.play().catch(() => {});
        return;
      }
      if (!this.ctx || this.ctx.state !== 'running') return;
      const def = SYNTH[name];
      if (!def) return;
      const t = this.ctx.currentTime;
      if (def.arp) {
        def.arp.forEach((f, i) => this._tone(def.wave, f, f * 1.01, def.dur * 1.6, def.vol, t + i * def.dur));
        return;
      }
      // Small random pitch variation so repeated hits don't sound identical
      const j = 0.94 + Math.random() * 0.12;
      if (def.wave && def.vol) this._tone(def.wave, def.f0 * j, def.f1 * j, def.dur, def.vol, t);
      if (def.noise) this._noise(def.noise, def.dur, def.filter || 3000, t);
    }

    _tone(type, f0, f1, dur, vol, t) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    _noise(vol, dur, freq, t) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.02);
    }
  }

  BR.AudioManager = AudioManager;
})();
