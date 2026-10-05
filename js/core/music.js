/*
 * MusicManager: procedural background music (no audio files).
 * Each arena theme gets its own key / scale / tempo; patterns are generated from a seed,
 * so a track always sounds the same. intensity (boss phase) adds drums and density.
 * Notes are scheduled slightly ahead on the WebAudio clock for tight timing.
 */
(function () {
  'use strict';

  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
  };

  const TRACKS = {
    menu:    { bpm: 72,  root: 57, scale: 'minor', drums: false, lead: 'sine' },
    stone:   { bpm: 126, root: 50, scale: 'minor', drums: true, lead: 'triangle' },
    burning: { bpm: 140, root: 52, scale: 'harmonic', drums: true, lead: 'sawtooth' },
    cave:    { bpm: 108, root: 45, scale: 'phrygian', drums: true, lead: 'triangle' },
    void:    { bpm: 150, root: 55, scale: 'phrygian', drums: true, lead: 'square' },
    ice:     { bpm: 118, root: 59, scale: 'dorian', drums: true, lead: 'sine' },
    storm:   { bpm: 146, root: 53, scale: 'minor', drums: true, lead: 'square' },
    blood:   { bpm: 132, root: 48, scale: 'harmonic', drums: true, lead: 'sawtooth' },
    western: { bpm: 116, root: 52, scale: 'dorian', drums: true, lead: 'square' },
    clock:   { bpm: 124, root: 56, scale: 'minor', drums: true, lead: 'triangle' },
    dune:    { bpm: 112, root: 50, scale: 'harmonic', drums: true, lead: 'triangle' },
    forest:  { bpm: 128, root: 54, scale: 'minor', drums: true, lead: 'sine' },
    abyss:   { bpm: 156, root: 47, scale: 'harmonic', drums: true, lead: 'sawtooth' },
  };

  const PROGRESSIONS = [[0, 5, 3, 4], [0, 3, 4, 0], [0, 6, 5, 4], [0, 5, 6, 4], [0, 2, 3, 4]];
  const BASS_PATTERNS = [
    [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0],
    [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
  ];

  function seeded(str) {
    let s = 0;
    for (const ch of str) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function buildTrack(id) {
    const def = TRACKS[id] || TRACKS.stone;
    const rnd = seeded(id);
    const scale = SCALES[def.scale];
    const note = (degree, octave) => {
      const d = ((degree % 7) + 7) % 7;
      return def.root + scale[d] + 12 * (octave + Math.floor(degree / 7));
    };
    const prog = PROGRESSIONS[Math.floor(rnd() * PROGRESSIONS.length)];
    const bass = BASS_PATTERNS[Math.floor(rnd() * BASS_PATTERNS.length)];
    const steps = [];
    for (let bar = 0; bar < 4; bar++) {
      const chord = prog[bar];
      for (let i = 0; i < 16; i++) {
        const s = { bass: null, arp: null, lead: null, kick: false, snare: false, hat: false };
        if (bass[i]) s.bass = note(chord, -2);
        if (i % 2 === 0) s.arp = note(chord + [0, 2, 4, 2][(i / 2) % 4], 0);
        if (rnd() < (i % 4 === 0 ? 0.45 : 0.18)) s.lead = note(chord + [0, 2, 4, 6, 7][Math.floor(rnd() * 5)], 1);
        s.kick = i % 8 === 0 || (i % 8 === 6 && rnd() < 0.4);
        s.snare = i % 8 === 4;
        s.hat = i % 2 === 0;
        steps.push(s);
      }
    }
    return { id, def, steps, stepDur: 60 / def.bpm / 4 };
  }

  class MusicManager {
    constructor(audio) {
      this.audio = audio;
      this.gain = null;
      this.volume = 0.35;
      this.track = null;
      this.step = 0;
      this.nextTime = 0;
      this.intensity = 1;
      this.cache = new Map();
    }

    _ready() {
      const ctx = this.audio.ctx;
      if (!ctx || ctx.state !== 'running') return false;
      if (!this.gain) {
        this.gain = ctx.createGain();
        this.gain.gain.value = this.volume * 0.5;
        this.gain.connect(ctx.destination);
      }
      return true;
    }

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.gain) this.gain.gain.value = this.volume * 0.5;
    }

    play(id) {
      if (this.track && this.track.id === id) return;
      let t = this.cache.get(id);
      if (!t) { t = buildTrack(id); this.cache.set(id, t); }
      this.track = t;
      this.step = 0;
      this.nextTime = 0;
      this.intensity = 1;
    }

    stop() { this.track = null; }

    update() {
      if (!this.track || this.volume <= 0 || !this._ready()) return;
      const ctx = this.audio.ctx;
      if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
      while (this.nextTime < ctx.currentTime + 0.2) {
        this._schedule(this.track.steps[this.step], this.nextTime);
        this.nextTime += this.track.stepDur;
        this.step = (this.step + 1) % this.track.steps.length;
      }
    }

    _schedule(s, t) {
      const def = this.track.def;
      const len = this.track.stepDur;
      const hi = this.intensity >= 2;
      if (s.bass !== null) this._tone('sawtooth', midiToHz(s.bass), t, len * 1.8, 0.09, 500);
      if (s.arp !== null && (def.drums || this.step % 4 === 0)) this._tone('triangle', midiToHz(s.arp), t, len * (def.drums ? 0.9 : 3.5), def.drums ? 0.035 : 0.05, 2400);
      if (s.lead !== null && (hi || !def.drums || this.step % 32 < 16)) this._tone(def.lead, midiToHz(s.lead), t, len * 1.6, 0.03, 3000);
      if (!def.drums) return;
      if (s.kick) this._kick(t);
      if (s.snare) this._noise(t, 0.12, 0.07, 1800);
      if (s.hat || (hi && this.intensity >= 3)) this._noise(t, 0.03, hi ? 0.03 : 0.02, 8000);
      if (hi && !s.hat) this._noise(t, 0.025, 0.015, 9000);
    }

    _tone(type, freq, t, dur, vol, cutoff) {
      const ctx = this.audio.ctx;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.gain);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    _kick(t) {
      const ctx = this.audio.ctx;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(g);
      g.connect(this.gain);
      osc.start(t);
      osc.stop(t + 0.18);
    }

    _noise(t, dur, vol, freq) {
      const ctx = this.audio.ctx;
      if (!this.audio.noiseBuffer) return;
      const src = ctx.createBufferSource();
      src.buffer = this.audio.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.gain);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.02);
    }
  }

  BR.MusicManager = MusicManager;
})();
