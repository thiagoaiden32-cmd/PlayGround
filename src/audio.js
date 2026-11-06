export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambientStarted = false;
    this.stepTimer = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.42;
    this.master.connect(this.ctx.destination);
    this.startAmbience();
  }

  startAmbience() {
    if (!this.ctx || this.ambientStarted) return;
    this.ambientStarted = true;
    const ctx = this.ctx;

    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.055;
    bedGain.connect(this.master);

    for (const [freq, detune, gain] of [[41, 0, 0.52], [61.5, 4, 0.28], [82.5, -3, 0.16]]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      g.gain.value = gain;
      osc.connect(g).connect(bedGain);
      osc.start();

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.035 + Math.random() * 0.04;
      lfoGain.gain.value = gain * 0.55;
      lfo.connect(lfoGain).connect(g.gain);
      lfo.start();
    }

    // Distant air-handler noise.
    const len = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      data[i] = last * 1.8;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 190;
    const g = ctx.createGain();
    g.gain.value = 0.16;
    src.connect(filter).connect(g).connect(this.master);
    src.start();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.42, this.ctx.currentTime, 0.03);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  tone(freq, duration = 0.2, type = 'sine', gain = 0.08, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.now() + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  noise(duration = 0.2, gain = 0.08, type = 'bandpass', freq = 900, q = 0.8, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.now() + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.35), t0 + duration);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
  }

  click() {
    this.tone(700, 0.055, 'square', 0.025, 430);
  }

  portal() {
    this.noise(0.34, 0.12, 'bandpass', 1600, 1.4);
    this.tone(180, 0.28, 'sawtooth', 0.055, 680);
    this.tone(920, 0.18, 'sine', 0.04, 1320, 0.05);
  }

  placeDenied() {
    this.tone(130, 0.12, 'square', 0.035, 90);
  }

  recall() {
    this.noise(0.2, 0.06, 'highpass', 1500, 0.8);
    this.tone(700, 0.2, 'sine', 0.04, 220);
  }

  teleport() {
    this.noise(0.5, 0.14, 'bandpass', 2200, 1.2);
    this.tone(120, 0.42, 'sine', 0.07, 780);
    this.tone(560, 0.24, 'triangle', 0.04, 1100, 0.04);
    this.tone(280, 0.3, 'sine', 0.035, 160, 0.1);
  }

  pickup() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone(f, 0.35, 'sine', 0.055 - i * 0.006, f * 1.01, i * 0.055));
    this.noise(0.22, 0.04, 'highpass', 3200, 0.6);
  }

  unlock() {
    const chord = [196, 246.94, 293.66, 392, 493.88];
    chord.forEach((f, i) => this.tone(f, 0.85, 'triangle', 0.03, f * 1.005, i * 0.035));
    this.tone(98, 0.9, 'sine', 0.045, 72);
    this.noise(0.7, 0.05, 'lowpass', 900, 0.5);
  }

  fail() {
    this.tone(110, 0.5, 'sawtooth', 0.06, 58);
    this.noise(0.4, 0.08, 'lowpass', 500, 0.6);
  }

  success() {
    [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((f, i) => {
      this.tone(f, 1.1, 'sine', 0.035, f, i * 0.09);
    });
    this.noise(1.2, 0.035, 'highpass', 2400, 0.4);
  }

  step(amount = 1) {
    if (!this.ctx || this.muted) return;
    const now = this.now();
    if (now - this.stepTimer < 0.34) return;
    this.stepTimer = now;
    this.noise(0.07, 0.018 * amount, 'lowpass', 420, 1.2);
    this.tone(82, 0.055, 'sine', 0.018 * amount, 55);
  }
}
