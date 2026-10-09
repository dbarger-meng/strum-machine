// Web Audio engine. Strings are synthesised with Karplus-Strong plucks, so the app needs no sample files.

import { midiToFreq } from './music.js?v=3';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.cache = new Map();
    this.live = new Set();
    this.volumes = { guitar: 0.8, bass: 0.9, melody: 0.6, click: 0.4 };
    this.noise = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 20;
      comp.ratio.value = 3;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      this.master.connect(comp);
      comp.connect(ctx.destination);
      this.buses = {};
      for (const k of Object.keys(this.volumes)) {
        const g = ctx.createGain();
        g.gain.value = this.volumes[k];
        g.connect(this.master);
        this.buses[k] = g;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setVolume(bus, v) {
    this.volumes[bus] = v;
    if (this.buses) this.buses[bus].gain.value = v;
  }

  stopAll() {
    for (const s of this.live) { try { s.stop(); } catch (e) { /* already stopped */ } }
    this.live.clear();
  }

  track(node) {
    this.live.add(node);
    node.onended = () => this.live.delete(node);
  }

  // Karplus-Strong buffer for one pitch, cached.
  pluck(midi, T, damp) {
    const key = `${midi}|${T}|${damp}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const sr = this.ctx.sampleRate;
    const f = midiToFreq(midi);
    const N = Math.max(2, Math.round(sr / f - 0.5));
    const len = Math.floor(sr * T * 1.05);
    const data = new Float32Array(len);
    let prev = 0;
    for (let i = 0; i <= N && i < len; i++) {
      prev = prev * damp + (Math.random() * 2 - 1) * (1 - damp);
      data[i] = prev;
    }
    const rho = Math.pow(0.02, 1 / (f * T));
    for (let i = N + 1; i < len; i++) data[i] = rho * 0.5 * (data[i - N] + data[i - N - 1]);
    let peak = 0;
    for (let i = 0; i < Math.min(len, 4000); i++) peak = Math.max(peak, Math.abs(data[i]));
    const scale = peak > 0 ? 0.9 / peak : 1;
    for (let i = 0; i < len; i++) data[i] *= scale;
    const buf = this.ctx.createBuffer(1, len, sr);
    buf.copyToChannel(data, 0);
    const entry = { buf, rate: f / (sr / (N + 0.5)) };
    this.cache.set(key, entry);
    return entry;
  }

  playPluck(midi, when, { vel = 0.7, dur = null, bus = 'guitar', T = 1.6, damp = 0.4, release = 0.05 } = {}) {
    const ctx = this.ctx;
    const { buf, rate } = this.pluck(midi, T, damp);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vel, when + 0.002);
    if (dur !== null) {
      const end = when + Math.max(0.02, dur);
      g.gain.setTargetAtTime(0, end, release / 3);
      src.start(when);
      src.stop(end + release * 3);
    } else src.start(when);
    src.connect(g);
    g.connect(this.buses[bus]);
    this.track(src);
  }

  strum(midis, when, { dir = 'down', vel = 0.7, dur = 0.5, spread = 0.01 } = {}) {
    const gain = (vel * 0.9) / Math.sqrt(Math.max(1, midis.length));
    midis.forEach((m, i) => {
      this.playPluck(m, when + i * spread, { vel: gain * (0.9 + 0.1 * Math.sin(i * 2.1)), dur, T: 1.4, damp: dir === 'up' ? 0.3 : 0.4 });
    });
  }

  bass(midi, when, { vel = 0.9, dur = 0.8 } = {}) {
    this.playPluck(midi, when, { vel: vel * 0.7, dur, bus: 'bass', T: 1.8, damp: 0.65, release: 0.12 });
  }

  chop(midis, when, { vel = 0.7 } = {}) {
    const ctx = this.ctx;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.15), ctx.sampleRate);
      const ch = this.noise.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vel * 0.5, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.07);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.buses.guitar);
    src.start(when);
    src.stop(when + 0.1);
    this.track(src);
    midis.forEach((m) => this.playPluck(m, when, { vel: vel * 0.18, dur: 0.045, T: 0.4, damp: 0.5, release: 0.02 }));
  }

  click(when, accent) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = accent ? 1900 : 1300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    osc.connect(g);
    g.connect(this.buses.click);
    osc.start(when);
    osc.stop(when + 0.06);
    this.track(osc);
  }

  melody(midi, when, durSec, vel, inst) {
    const ctx = this.ctx;
    if (inst === 'guitar') {
      this.playPluck(midi, when, { vel: vel * 0.7, dur: Math.max(durSec, 0.25), bus: 'melody', T: 1.3, damp: 0.35, release: 0.1 });
    } else if (inst === 'mandolin') {
      let t = 0;
      let v = vel * 0.6;
      do {
        this.playPluck(midi, when + t, { vel: v, dur: Math.min(0.5, Math.max(0.1, durSec - t)), bus: 'melody', T: 0.7, damp: 0.25, release: 0.04 });
        t += 0.085;
        v *= 0.93;
      } while (t < durSec - 0.05 && t < 3);
    } else {
      // fiddle: two slightly detuned saws, filtered, with delayed vibrato
      const f = midiToFreq(midi);
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = Math.min(5000, 1200 + f * 3);
      lp.Q.value = 0.6;
      const end = when + Math.max(0.08, durSec);
      const level = vel * 0.16;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(level, when + 0.03);
      g.gain.setValueAtTime(level, end);
      g.gain.linearRampToValueAtTime(0, end + 0.08);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0, when);
      lfoGain.gain.linearRampToValueAtTime(f * 0.006, when + 0.3);
      lfo.connect(lfoGain);
      for (const detune of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = detune;
        lfoGain.connect(o.frequency);
        o.connect(lp);
        o.start(when);
        o.stop(end + 0.1);
        this.track(o);
      }
      lp.connect(g);
      g.connect(this.buses.melody);
      lfo.start(when);
      lfo.stop(end + 0.1);
      this.track(lfo);
    }
  }
}
