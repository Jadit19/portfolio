/**
 * RideSound: the synthesized sound engine for the ride.
 *
 * Every sound is built live with the Web Audio API (oscillators, one shared noise buffer,
 * filters and gain envelopes). There are no audio files and no dependencies. The aim is
 * soft and toy-like rather than loud: all voices go into one bus, then a gentle lowpass,
 * a soft compressor and a modest master gain. Every envelope is ramped, so nothing clicks.
 *
 * Sound is muted by default and the choice persists in localStorage. Every public method
 * is a safe no-op when muted, disposed, or when Web Audio is unavailable (e.g. in tests).
 */

export type ClangKind = "metal" | "wood" | "soft" | "pot";
export type BrewSound = "shot" | "foam" | "pour" | "drip" | "clink";

const STORAGE_KEY = "portfolio:sound";
const MASTER_LEVEL = 0.32;
const MAX_VOICES = 40;
const MAX_CLANG_VOICES = 6;
/** Calls closer together than this are merged into one clang. */
const CLANG_MERGE_S = 0.045;
const SPLASH_GAP_S = 0.16;
/** Smallest value used for exponential ramps (they can't reach 0). */
const FLOOR = 0.0001;

type AudioCtor = typeof AudioContext;

interface Live {
  ctx: AudioContext;
  /** Where every voice connects. */
  bus: AudioNode;
  noise: AudioBuffer;
}

interface EngineVoice {
  saw: OscillatorNode;
  pulse: OscillatorNode;
  filter: BiquadFilterNode;
  lfo: OscillatorNode;
  out: GainNode;
}

function audioCtor(): AudioCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
  );
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function noop(): void {}

/** Percussive envelope: quick linear attack, exponential decay, then a tiny ramp to true 0. */
function pluck(
  ctx: AudioContext,
  dest: AudioNode,
  t: number,
  attack: number,
  peak: number,
  decay: number,
): GainNode {
  const g = ctx.createGain();
  const p = Math.max(FLOOR * 2, peak);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(p, t + attack);
  g.gain.exponentialRampToValueAtTime(FLOOR, t + attack + decay);
  g.gain.linearRampToValueAtTime(0, t + attack + decay + 0.02);
  g.connect(dest);
  return g;
}

/** Sustained envelope: attack, hold at peak, then a smooth release. */
function swell(
  ctx: AudioContext,
  dest: AudioNode,
  t: number,
  attack: number,
  peak: number,
  hold: number,
  release: number,
): GainNode {
  const g = ctx.createGain();
  const p = Math.max(FLOOR * 2, peak);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(p, t + attack);
  g.gain.setValueAtTime(p, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(FLOOR, t + attack + hold + release);
  g.gain.linearRampToValueAtTime(0, t + attack + hold + release + 0.02);
  g.connect(dest);
  return g;
}

function filter(
  ctx: AudioContext,
  dest: AudioNode,
  type: BiquadFilterType,
  freq: number,
  q = 0.7,
): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.connect(dest);
  return f;
}

/** Ramps a gain param from its current value to `to` over `time` seconds. */
function rampParam(param: AudioParam, t: number, to: number, time: number): void {
  param.cancelScheduledValues(t);
  param.setValueAtTime(param.value, t);
  param.linearRampToValueAtTime(to, t + time);
}

export class RideSound {
  private on = false;
  private disposed = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private engineVoice: EngineVoice | null = null;
  private lastEngineAt = -1;
  private watchdog: ReturnType<typeof setInterval> | undefined;
  private suspendTimer: ReturnType<typeof setTimeout> | undefined;
  private voices = 0;
  private clangVoices = 0;
  private lastClangAt = -1;
  private lastClangStrength = 0;
  private lastSplashAt = -1;
  private listening = false;
  private readonly unlock = (): void => {
    this.removeUnlock();
    this.wake();
  };

  constructor() {
    try {
      this.on = localStorage.getItem(STORAGE_KEY) === "on";
    } catch {
      this.on = false;
    }
    // A stored "on" can't start audio without a gesture, so wake on the first one.
    if (this.on && typeof window !== "undefined") {
      try {
        window.addEventListener("pointerdown", this.unlock);
        window.addEventListener("keydown", this.unlock);
        this.listening = true;
      } catch {
        this.listening = false;
      }
    }
  }

  /** Muted by default; the choice persists in localStorage key "portfolio:sound". */
  get enabled(): boolean {
    return this.on;
  }

  /** Call from a user gesture. Creates/resumes the context on enable; fades out on mute. */
  setEnabled(on: boolean): void {
    try {
      if (this.disposed) return;
      this.on = on;
      try {
        localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
      } catch {
        // Storage unavailable (private mode etc.): the choice just won't persist.
      }
      if (on) {
        this.wake();
        return;
      }
      this.removeUnlock();
      const ctx = this.ctx;
      const master = this.master;
      if (!ctx || !master) return;
      const t = ctx.currentTime;
      rampParam(master.gain, t, 0, 0.2);
      if (this.engineVoice) rampParam(this.engineVoice.out.gain, t, 0, 0.2);
      if (this.suspendTimer !== undefined) clearTimeout(this.suspendTimer);
      this.suspendTimer = setTimeout(() => {
        this.suspendTimer = undefined;
        try {
          if (!this.on && ctx.state === "running") ctx.suspend().catch(noop);
        } catch {
          // ignore
        }
      }, 260);
    } catch {
      // never throw
    }
  }

  /** Per-frame engine update while riding. speed/top in m/s, throttle 0–1. */
  engine(throttle: number, speed: number, top: number, dt: number): void {
    try {
      const live = this.live();
      const v = this.engineVoice;
      if (!live || !v) return;
      const ratio = clamp01(top > 0 ? Math.abs(speed) / top : 0);
      const th = clamp01(throttle);
      const t = live.ctx.currentTime;
      // Smoothing time constant; slightly longer on slow frames so pitch never steps.
      const k = 0.06 + Math.min(0.1, Math.max(0, Number.isFinite(dt) ? dt : 0));
      // Single-cylinder thumper: firing rate ~9 Hz at idle up to ~43 Hz flat out.
      const fire = 9 + ratio * 30 + th * 4;
      const note = 46 + ratio * 64 + th * 8;
      v.saw.frequency.setTargetAtTime(note, t, k);
      // Pulse an octave down, a hair detuned, for a round sub "thump".
      v.pulse.frequency.setTargetAtTime(note * 0.502, t, k);
      v.lfo.frequency.setTargetAtTime(fire, t, k);
      v.filter.frequency.setTargetAtTime(200 + th * 750 + ratio * 450, t, k * 1.5);
      v.out.gain.setTargetAtTime(0.045 + th * 0.045 + ratio * 0.035, t, 0.09);
      this.lastEngineAt = t;
    } catch {
      // never throw
    }
  }

  /** Two-tone bike horn, ~0.45 s: a friendly "ba-dum". */
  horn(): void {
    try {
      const live = this.live();
      if (!live || !this.room(6)) return;
      const { ctx } = live;
      const t = ctx.currentTime + 0.01;
      const notes: ReadonlyArray<readonly [number, number, number]> = [
        [0, 0.19, 587.33], // D5
        [0.22, 0.21, 466.16], // Bb4
      ];
      for (const [at, len, f] of notes) {
        const start = t + at;
        const env = swell(ctx, live.bus, start, 0.018, 0.1, len - 0.07, 0.05);
        const lp = filter(ctx, env, "lowpass", 1700, 1.2);
        // Square + a quieter triangle a major third up gives a horn-like dyad.
        this.osc(ctx, "square", f, start, start + len + 0.05, lp, [env, lp], 0.55);
        this.osc(ctx, "triangle", f * 1.26, start, start + len + 0.05, lp, [], 0.45);
      }
    } catch {
      // never throw
    }
  }

  /** Something knocked over. Rate-limited and voice-capped so piles don't roar. */
  clang(strength: number, kind: ClangKind): void {
    try {
      const live = this.live();
      if (!live) return;
      const s = clamp01(strength);
      if (s < 0.02) return;
      const t = live.ctx.currentTime;
      // Merge near-simultaneous hits unless the new one is clearly harder.
      if (t - this.lastClangAt < CLANG_MERGE_S && s <= this.lastClangStrength + 0.2) return;
      if (this.clangVoices >= MAX_CLANG_VOICES || !this.room(6)) return;
      this.lastClangAt = t;
      this.lastClangStrength = s;
      const start = t + 0.005;
      let tail: AudioScheduledSourceNode;
      switch (kind) {
        case "metal":
          tail = this.metal(live, start, s);
          break;
        case "wood":
          tail = this.wood(live, start, s);
          break;
        case "soft":
          tail = this.soft(live, start, s);
          break;
        case "pot":
          tail = this.pot(live, start, s);
          break;
      }
      this.clangVoices++;
      tail.addEventListener("ended", () => {
        this.clangVoices = Math.max(0, this.clangVoices - 1);
      });
    } catch {
      // never throw
    }
  }

  /** A burst of bird chirps as a flock takes off, ~1.2 s. */
  birds(): void {
    try {
      const live = this.live();
      if (!live || !this.room(14)) return;
      const { ctx, bus } = live;
      const t = ctx.currentTime + 0.01;
      // Soft wing flaps first: short bandpassed noise puffs.
      for (let i = 0; i < 3; i++) {
        const at = t + i * 0.075 + rand(0, 0.02);
        const env = pluck(ctx, bus, at, 0.008, 0.035, 0.06);
        const bp = filter(ctx, env, "bandpass", rand(600, 900), 0.9);
        this.noise(live, at, at + 0.1, bp, [env, bp]);
      }
      // Chirps: fast upward sine sweeps, some with a falling second syllable.
      const count = 4 + Math.floor(rand(0, 3));
      for (let i = 0; i < count; i++) {
        const at = t + 0.12 + (i / count) * 0.95 + rand(0, 0.07);
        const f0 = rand(2500, 3400);
        this.chirp(ctx, bus, at, f0, f0 * rand(1.2, 1.5), 0.065, rand(0.022, 0.034));
        if (Math.random() < 0.5) {
          this.chirp(ctx, bus, at + 0.085, f0 * 1.35, f0 * 1.05, 0.05, 0.02);
        }
      }
    } catch {
      // never throw
    }
  }

  /** A soft, friendly elephant trumpet, ~1 s. */
  trumpet(): void {
    try {
      const live = this.live();
      if (!live || !this.room(6)) return;
      const { ctx, bus } = live;
      const t = ctx.currentTime + 0.01;
      const end = t + 1.05;
      const env = swell(ctx, bus, t, 0.09, 0.065, 0.62, 0.3);
      // Resonant lowpass with a moving cutoff makes the nasal "trunk" vowel.
      const lp = filter(ctx, env, "lowpass", 700, 3.2);
      lp.frequency.setValueAtTime(700, t);
      lp.frequency.linearRampToValueAtTime(1500, t + 0.2);
      lp.frequency.linearRampToValueAtTime(950, t + 1.0);
      // Gentle vibrato shared by both oscillators.
      const vib = ctx.createOscillator();
      vib.frequency.value = 5.5;
      const vibDepth = ctx.createGain();
      vibDepth.gain.value = 7;
      vib.connect(vibDepth);
      const pitch = rand(0.95, 1.06);
      for (const detune of [-9, 9]) {
        const o = this.osc(ctx, "sawtooth", 260 * pitch, t, end, lp, [], 0.5);
        o.detune.value = detune;
        // Swoop up, sag, then droop at the end: playful rather than alarming.
        o.frequency.setValueAtTime(260 * pitch, t);
        o.frequency.exponentialRampToValueAtTime(430 * pitch, t + 0.17);
        o.frequency.linearRampToValueAtTime(405 * pitch, t + 0.7);
        o.frequency.exponentialRampToValueAtTime(330 * pitch, t + 1.0);
        vibDepth.connect(o.frequency);
      }
      this.track(vib, [vibDepth, env, lp]);
      vib.start(t);
      vib.stop(end);
      // A little breath on top.
      const breath = swell(ctx, bus, t, 0.08, 0.01, 0.6, 0.25);
      const bp = filter(ctx, breath, "bandpass", 1300, 0.8);
      this.noise(live, t, end, bp, [breath, bp]);
    } catch {
      // never throw
    }
  }

  /**
   * The toy train's whistle, quieter the further it is (`near` 0–1): a short
   * toot then a long one, two reedy notes a minor third apart.
   */
  whistle(near = 1): void {
    try {
      const live = this.live();
      if (!live || near < 0.05 || !this.room(6)) return;
      const { ctx } = live;
      const t = ctx.currentTime + 0.01;
      for (const [at, len] of [
        [0, 0.28],
        [0.4, 0.95],
      ] as const) {
        const start = t + at;
        const env = swell(ctx, live.bus, start, 0.04, 0.09 * near, len - 0.12, 0.12);
        const bp = filter(ctx, env, "bandpass", 1500, 2.5);
        this.osc(ctx, "sawtooth", 740, start, start + len + 0.1, bp, [env, bp], 0.5);
        this.osc(ctx, "sawtooth", 880, start, start + len + 0.1, bp, [], 0.5);
      }
    } catch {
      // never throw
    }
  }

  /** Gaur herd: a pair of soft, low moos. */
  low(): void {
    try {
      const live = this.live();
      if (!live || !this.room(6)) return;
      const t = live.ctx.currentTime + 0.01;
      this.moo(live, t, rand(92, 106), 0.95, 0.1);
      this.moo(live, t + rand(0.3, 0.45), rand(74, 84), 0.8, 0.065);
    } catch {
      // never throw
    }
  }

  /** Café sounds for the brew animation, ~1–3 s each. */
  brew(kind: BrewSound): void {
    try {
      const live = this.live();
      if (!live || !this.room(10)) return;
      const t = live.ctx.currentTime + 0.01;
      switch (kind) {
        case "shot":
          this.shot(live, t);
          break;
        case "foam":
          this.foam(live, t);
          break;
        case "pour":
          this.pour(live, t);
          break;
        case "drip":
          for (const at of [0, 0.7, 1.45, 2.25]) {
            this.drip(live.ctx, live.bus, t + at + rand(0, 0.08), rand(850, 1250), 0.045);
          }
          break;
        case "clink":
          this.clink(live, t);
          break;
      }
    } catch {
      // never throw
    }
  }

  /** Splash through water, strength 0–1, rate-limited. */
  splash(strength: number): void {
    try {
      const live = this.live();
      if (!live) return;
      const s = clamp01(strength);
      if (s < 0.03) return;
      const { ctx, bus } = live;
      const t = ctx.currentTime;
      if (t - this.lastSplashAt < SPLASH_GAP_S || !this.room(6)) return;
      this.lastSplashAt = t;
      const start = t + 0.005;
      const decay = 0.3 + s * 0.25;
      const env = pluck(ctx, bus, start, 0.012, 0.04 + s * 0.08, decay);
      // Lowpass sweeping down turns noise into a "shhh-plsh".
      const lp = filter(ctx, env, "lowpass", 1800 + s * 2400, 0.9);
      lp.frequency.setValueAtTime(1800 + s * 2400, start);
      lp.frequency.exponentialRampToValueAtTime(380, start + decay);
      this.noise(live, start, start + decay + 0.05, lp, [env, lp]);
      const bloops = 1 + Math.round(s * 2);
      for (let i = 0; i < bloops; i++) {
        this.drip(ctx, bus, start + rand(0.05, 0.3), rand(480, 900), 0.02 + s * 0.015);
      }
    } catch {
      // never throw
    }
  }

  /** Stops everything and closes the context. */
  dispose(): void {
    try {
      this.disposed = true;
      this.on = false;
      this.removeUnlock();
      if (this.watchdog !== undefined) clearInterval(this.watchdog);
      if (this.suspendTimer !== undefined) clearTimeout(this.suspendTimer);
      this.watchdog = undefined;
      this.suspendTimer = undefined;
      const v = this.engineVoice;
      if (v) {
        for (const o of [v.saw, v.pulse, v.lfo]) {
          try {
            o.stop();
          } catch {
            // already stopped
          }
        }
      }
      const ctx = this.ctx;
      this.engineVoice = null;
      this.ctx = null;
      this.master = null;
      this.bus = null;
      this.noiseBuf = null;
      if (ctx && ctx.state !== "closed") ctx.close().catch(noop);
    } catch {
      // never throw
    }
  }

  // ---------------------------------------------------------------------------
  // Context plumbing

  private removeUnlock(): void {
    if (!this.listening) return;
    this.listening = false;
    try {
      window.removeEventListener("pointerdown", this.unlock);
      window.removeEventListener("keydown", this.unlock);
    } catch {
      // ignore
    }
  }

  /** Creates (if needed) and resumes the context, then fades the master in. */
  private wake(): void {
    try {
      if (!this.on || this.disposed) return;
      const ctx = this.ensure();
      const master = this.master;
      if (!ctx || !master) return;
      if (this.suspendTimer !== undefined) clearTimeout(this.suspendTimer);
      this.suspendTimer = undefined;
      if (ctx.state === "suspended") ctx.resume().catch(noop);
      rampParam(master.gain, ctx.currentTime, MASTER_LEVEL, 0.15);
    } catch {
      // never throw
    }
  }

  private ensure(): AudioContext | null {
    if (this.disposed) return null;
    if (this.ctx) return this.ctx.state === "closed" ? null : this.ctx;
    const Ctor = audioCtor();
    if (!Ctor) return null;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0;
    // Gentle glue: low ratio, soft knee. Catches pile-ups without pumping.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 14;
    comp.ratio.value = 3;
    comp.attack.value = 0.006;
    comp.release.value = 0.25;
    // A soft top-end rolloff keeps everything rounded.
    const bus = ctx.createGain();
    const soften = filter(ctx, comp, "lowpass", 9000, 0.5);
    bus.connect(soften);
    comp.connect(master);
    master.connect(ctx.destination);

    // One 2 s white-noise buffer, reused by every noisy sound (random start offsets).
    const len = Math.floor(ctx.sampleRate * 2);
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.ctx = ctx;
    this.master = master;
    this.bus = bus;
    this.noiseBuf = noise;
    this.engineVoice = this.buildEngine(ctx, bus);
    this.startWatchdog();
    return ctx;
  }

  /** The live context, or null when muted / unavailable. */
  private live(): Live | null {
    if (!this.on || this.disposed) return null;
    const ctx = this.ensure();
    const bus = this.bus;
    const noise = this.noiseBuf;
    if (!ctx || !bus || !noise) return null;
    if (ctx.state === "suspended") ctx.resume().catch(noop);
    return { ctx, bus, noise };
  }

  /** True when there's room for `n` more sources under the global voice cap. */
  private room(n: number): boolean {
    return this.voices + n <= MAX_VOICES;
  }

  /** Counts a source as a voice and disconnects it (and its helpers) when it ends. */
  private track(src: AudioScheduledSourceNode, extra: AudioNode[]): void {
    this.voices++;
    src.addEventListener("ended", () => {
      this.voices = Math.max(0, this.voices - 1);
      try {
        src.disconnect();
        for (const n of extra) n.disconnect();
      } catch {
        // ignore
      }
    });
  }

  private osc(
    ctx: AudioContext,
    type: OscillatorType,
    freq: number,
    start: number,
    end: number,
    dest: AudioNode,
    extra: AudioNode[],
    level = 1,
  ): OscillatorNode {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    if (level !== 1) {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(dest);
      o.connect(g);
      extra.push(g);
    } else {
      o.connect(dest);
    }
    this.track(o, extra);
    o.start(start);
    o.stop(end);
    return o;
  }

  private noise(
    live: Live,
    start: number,
    end: number,
    dest: AudioNode,
    extra: AudioNode[],
  ): AudioBufferSourceNode {
    const src = live.ctx.createBufferSource();
    src.buffer = live.noise;
    src.loop = true;
    src.connect(dest);
    this.track(src, extra);
    src.start(start, rand(0, live.noise.duration - 0.1));
    src.stop(end);
    return src;
  }

  // ---------------------------------------------------------------------------
  // Engine

  private buildEngine(ctx: AudioContext, bus: AudioNode): EngineVoice {
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(bus);
    // Amplitude flutter: a sine LFO at firing frequency swings this gain 0.1–1.0,
    // which turns a steady tone into a "thup-thup-thup".
    const flutter = ctx.createGain();
    flutter.gain.value = 0.55;
    flutter.connect(out);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.45;
    lfo.connect(lfoDepth);
    lfoDepth.connect(flutter.gain);
    const lp = filter(ctx, flutter, "lowpass", 260, 0.8);
    const saw = ctx.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.value = 46;
    const sawGain = ctx.createGain();
    sawGain.gain.value = 0.55;
    saw.connect(sawGain);
    sawGain.connect(lp);
    const pulse = ctx.createOscillator();
    pulse.type = "square";
    pulse.frequency.value = 23;
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0.45;
    pulse.connect(pulseGain);
    pulseGain.connect(lp);
    saw.start();
    pulse.start();
    lfo.start();
    return { saw, pulse, filter: lp, lfo, out };
  }

  /** Fades the engine out when engine() stops being called (e.g. off the bike). */
  private startWatchdog(): void {
    if (this.watchdog !== undefined) return;
    this.watchdog = setInterval(() => {
      try {
        const ctx = this.ctx;
        const v = this.engineVoice;
        if (!ctx || !v || ctx.state !== "running") return;
        if (ctx.currentTime - this.lastEngineAt > 0.25) {
          v.out.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
        }
      } catch {
        // ignore
      }
    }, 150);
  }

  // ---------------------------------------------------------------------------
  // Clangs

  /** Milk can / tumbler: inharmonic sine partials (struck-bar ratios), ringing out. */
  private metal(live: Live, t: number, s: number): AudioScheduledSourceNode {
    const { ctx, bus } = live;
    const base = rand(540, 720);
    const ratios = [1, 2.76, 5.4, 8.93];
    const amps = [1, 0.5, 0.25, 0.12];
    const decays = [0.9, 0.5, 0.3, 0.18];
    const peak = 0.075 * (0.35 + 0.65 * s);
    const ring = 0.6 + 0.4 * s;
    // Harder hits excite more of the upper partials (= brighter).
    const partials = Math.min(ratios.length, 2 + Math.round(s * 2));
    let longest: AudioScheduledSourceNode | null = null;
    for (let i = 0; i < partials; i++) {
      const r = ratios[i] ?? 1;
      const d = (decays[i] ?? 0.2) * ring;
      const env = pluck(ctx, bus, t, 0.003, peak * (amps[i] ?? 0.1), d);
      const o = this.osc(ctx, "sine", base * r * rand(0.995, 1.005), t, t + d + 0.05, env, [env]);
      longest ??= o;
    }
    const tick = pluck(ctx, bus, t, 0.001, peak * 0.4 * s, 0.015);
    const hp = filter(ctx, tick, "highpass", 3000);
    const n = this.noise(live, t, t + 0.04, hp, [tick, hp]);
    return longest ?? n;
  }

  /** Crate / fence / firewood: short dropping sine knock plus a bandpassed noise tap. */
  private wood(live: Live, t: number, s: number): AudioScheduledSourceNode {
    const { ctx, bus } = live;
    const f = rand(170, 240);
    const peak = 0.14 * (0.35 + 0.65 * s);
    const env = pluck(ctx, bus, t, 0.002, peak, 0.13);
    const body = this.osc(ctx, "sine", f, t, t + 0.18, env, [env]);
    body.frequency.setValueAtTime(f, t);
    body.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.08);
    const env2 = pluck(ctx, bus, t, 0.002, peak * 0.35, 0.06);
    this.osc(ctx, "triangle", f * 2.3, t, t + 0.1, env2, [env2]);
    const tap = pluck(ctx, bus, t, 0.001, peak * (0.3 + 0.4 * s), 0.05);
    const bp = filter(ctx, tap, "bandpass", 900 + s * 700, 1.2);
    this.noise(live, t, t + 0.08, bp, [tap, bp]);
    return body;
  }

  /** Jute sack: lowpassed noise "thff" over a falling sub thump. */
  private soft(live: Live, t: number, s: number): AudioScheduledSourceNode {
    const { ctx, bus } = live;
    const peak = 0.16 * (0.35 + 0.65 * s);
    const env = pluck(ctx, bus, t, 0.008, peak, 0.2);
    const lp = filter(ctx, env, "lowpass", 300 + s * 350, 0.6);
    const n = this.noise(live, t, t + 0.25, lp, [env, lp]);
    const thump = pluck(ctx, bus, t, 0.006, peak * 0.8, 0.17);
    const o = this.osc(ctx, "sine", 90, t, t + 0.22, thump, [thump]);
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.15);
    return n;
  }

  /** Terracotta pot: hollow "clonk" (non-integer partial) plus a resonant noise knock. */
  private pot(live: Live, t: number, s: number): AudioScheduledSourceNode {
    const { ctx, bus } = live;
    const f = rand(280, 340);
    const peak = 0.11 * (0.35 + 0.65 * s);
    const env = pluck(ctx, bus, t, 0.002, peak, 0.28);
    const body = this.osc(ctx, "sine", f, t, t + 0.33, env, [env]);
    body.frequency.setValueAtTime(f * 1.04, t);
    body.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    const env2 = pluck(ctx, bus, t, 0.002, peak * 0.4, 0.14);
    this.osc(ctx, "sine", f * 2.12, t, t + 0.18, env2, [env2]);
    const knock = pluck(ctx, bus, t, 0.001, peak * (0.3 + 0.3 * s), 0.12);
    const bp = filter(ctx, knock, "bandpass", f * 2, 4);
    this.noise(live, t, t + 0.15, bp, [knock, bp]);
    return body;
  }

  // ---------------------------------------------------------------------------
  // Animals

  private chirp(
    ctx: AudioContext,
    bus: AudioNode,
    t: number,
    f0: number,
    f1: number,
    len: number,
    peak: number,
  ): void {
    const env = pluck(ctx, bus, t, 0.008, peak, len);
    const o = this.osc(ctx, "sine", f0, t, t + len + 0.04, env, [env]);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + len);
  }

  /** One moo: sawtooth with a pitch arc through a resonant lowpass that opens ("ooo-mm"). */
  private moo(live: Live, t: number, base: number, dur: number, peak: number): void {
    const { ctx, bus } = live;
    const end = t + dur + 0.05;
    const env = swell(ctx, bus, t, 0.14, peak, Math.max(0.1, dur - 0.44), 0.3);
    const lp = filter(ctx, env, "lowpass", 200, 2);
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.linearRampToValueAtTime(520, t + dur * 0.38);
    lp.frequency.linearRampToValueAtTime(230, t + dur);
    const o = this.osc(ctx, "sawtooth", base * 0.9, t, end, lp, [env, lp]);
    o.frequency.setValueAtTime(base * 0.9, t);
    o.frequency.linearRampToValueAtTime(base * 1.1, t + dur * 0.33);
    o.frequency.linearRampToValueAtTime(base * 0.85, t + dur);
    // Sub sine for warmth.
    const sub = swell(ctx, bus, t, 0.14, peak * 0.4, Math.max(0.1, dur - 0.44), 0.3);
    this.osc(ctx, "sine", base * 0.5, t, end, sub, [sub]);
  }

  // ---------------------------------------------------------------------------
  // Café

  /** A water drop: tiny sine with a fast upward pitch sweep ("bloop"). */
  private drip(ctx: AudioContext, bus: AudioNode, t: number, f: number, peak: number): void {
    const env = pluck(ctx, bus, t, 0.003, peak, 0.06);
    const o = this.osc(ctx, "sine", f, t, t + 0.1, env, [env]);
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.035);
  }

  /** Espresso: high pressure hiss, a soft 50 Hz pump hum, and accelerating drips. */
  private shot(live: Live, t: number): void {
    const { ctx, bus } = live;
    const hiss = swell(ctx, bus, t, 0.15, 0.022, 1.2, 0.4);
    const bp = filter(ctx, hiss, "bandpass", 4200, 0.8);
    this.noise(live, t, t + 1.8, bp, [hiss, bp]);
    const hum = swell(ctx, bus, t, 0.1, 0.03, 1.3, 0.3);
    const lp = filter(ctx, hum, "lowpass", 180, 0.7);
    this.osc(ctx, "sawtooth", 50, t, t + 1.75, lp, [hum, lp]);
    for (const at of [0.45, 0.8, 1.08, 1.32, 1.52, 1.68, 1.82]) {
      this.drip(ctx, bus, t + at, rand(900, 1300), 0.035);
    }
  }

  /** Steam wand: wobbling bandpassed hiss over a low milk gurgle. */
  private foam(live: Live, t: number): void {
    const { ctx, bus } = live;
    const end = t + 2.7;
    const steam = swell(ctx, bus, t, 0.25, 0.028, 2.0, 0.35);
    const bp = filter(ctx, steam, "bandpass", 3200, 1.2);
    // The hiss drops in pitch as the milk stretches.
    bp.frequency.setValueAtTime(3200, t);
    bp.frequency.linearRampToValueAtTime(2200, t + 2.3);
    const wob = ctx.createOscillator();
    wob.frequency.value = 0.7;
    const wobDepth = ctx.createGain();
    wobDepth.gain.value = 220;
    wob.connect(wobDepth);
    wobDepth.connect(bp.frequency);
    this.track(wob, [wobDepth]);
    wob.start(t);
    wob.stop(end);
    this.noise(live, t, end, bp, [steam, bp]);
    // Gurgle: lowpassed noise amplitude-modulated at ~9 Hz.
    const gurgle = swell(ctx, bus, t + 0.3, 0.3, 0.03, 1.6, 0.35);
    const am = ctx.createGain();
    am.gain.value = 0.6;
    am.connect(gurgle);
    const lp = filter(ctx, am, "lowpass", 480, 1);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.4;
    lfo.connect(lfoDepth);
    lfoDepth.connect(am.gain);
    this.track(lfo, [lfoDepth]);
    lfo.start(t);
    lfo.stop(end);
    this.noise(live, t + 0.3, end, lp, [gurgle, am, lp]);
  }

  /** Pour: resonant bandpassed noise whose pitch rises as the cup fills, gently burbling. */
  private pour(live: Live, t: number): void {
    const { ctx, bus } = live;
    const end = t + 2.0;
    const env = swell(ctx, bus, t, 0.12, 0.05, 1.4, 0.35);
    const am = ctx.createGain();
    am.gain.value = 0.7;
    am.connect(env);
    const bp = filter(ctx, am, "bandpass", 350, 3);
    bp.frequency.setValueAtTime(350, t);
    bp.frequency.exponentialRampToValueAtTime(1100, t + 1.8);
    // Two detuned LFOs on the gain give an irregular liquid burble.
    for (const [rate, depth] of [
      [11, 0.18],
      [17, 0.12],
    ] as const) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rate;
      const d = ctx.createGain();
      d.gain.value = depth;
      lfo.connect(d);
      d.connect(am.gain);
      this.track(lfo, [d]);
      lfo.start(t);
      lfo.stop(end);
    }
    this.noise(live, t, end, bp, [env, am, bp]);
    for (let i = 0; i < 3; i++) {
      this.drip(ctx, bus, t + rand(0.2, 1.5), rand(500, 800), 0.015);
    }
  }

  /** Cup on saucer: bright inharmonic ceramic partials, then a softer settling tap. */
  private clink(live: Live, t: number): void {
    const { ctx, bus } = live;
    const freqs = [2350, 3720, 5280];
    const amps = [1, 0.6, 0.35];
    const decays = [0.35, 0.22, 0.15];
    for (const [hit, level, shift] of [
      [0, 1, 1],
      [0.085, 0.4, 1.012],
    ] as const) {
      const at = t + hit;
      for (let i = 0; i < freqs.length; i++) {
        const d = decays[i] ?? 0.2;
        const env = pluck(ctx, bus, at, 0.002, 0.045 * level * (amps[i] ?? 0.3), d);
        this.osc(ctx, "sine", (freqs[i] ?? 2000) * shift, at, at + d + 0.05, env, [env]);
      }
      const tick = pluck(ctx, bus, at, 0.001, 0.015 * level, 0.012);
      const hp = filter(ctx, tick, "highpass", 4000);
      this.noise(live, at, at + 0.03, hp, [tick, hp]);
    }
  }
}
