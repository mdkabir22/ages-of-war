type SfxType =
  | 'click'
  | 'spawn'
  | 'ageup'
  | 'ability'
  | 'reward'
  | 'victory'
  | 'defeat'
  | 'warning';

/** Hit / impact feedback: light melee, heavy exchange, crit burst, fortress strikes. */
export type HitImpactKind = 'light' | 'heavy' | 'crit' | 'building';

let audioCtx: AudioContext | null = null;
let enabled = true;
/** Linear 0–1; UI uses 0–100. */
let masterVolume = 0.85;
let masterGain: GainNode | null = null;
let ambientGain: GainNode | null = null;
let ambientOscA: OscillatorNode | null = null;
let ambientOscB: OscillatorNode | null = null;
let ambientNoise: AudioBufferSourceNode | null = null;
let ambientNoiseGain: GainNode | null = null;
let ambientFilter: BiquadFilterNode | null = null;
let ambientAge = 0;

function getContext(): AudioContext | null {
  if (!enabled) return null;
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    masterGain = null;
  }
  return audioCtx;
}

function getMasterOut(ctx: AudioContext): GainNode {
  if (!masterGain || masterGain.context !== ctx) {
    masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(ctx.destination);
  } else {
    masterGain.gain.value = masterVolume;
  }
  return masterGain;
}

export function setMasterVolume(linear01: number): void {
  masterVolume = Math.max(0, Math.min(1, linear01));
  if (masterGain) {
    masterGain.gain.value = masterVolume;
  }
}

export function getMasterVolume(): number {
  return masterVolume;
}

export function initAudio(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
}

export function setAudioEnabled(next: boolean): void {
  enabled = next;
  if (!enabled) {
    stopAmbientLoop();
  }
}

export function playSfx(type: SfxType): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getMasterOut(ctx));

  let duration = 0.12;
  let startFreq = 260;
  let endFreq = 180;
  let volume = 0.05;
  filter.type = 'lowpass';
  filter.frequency.value = 1800;

  switch (type) {
    case 'click':
      duration = 0.06;
      startFreq = 420;
      endFreq = 280;
      volume = 0.025;
      break;
    case 'spawn':
      duration = 0.1;
      startFreq = 220;
      endFreq = 300;
      volume = 0.035;
      break;
    case 'ageup':
      duration = 0.22;
      startFreq = 380;
      endFreq = 760;
      volume = 0.055;
      break;
    case 'ability':
      duration = 0.12;
      startFreq = 260;
      endFreq = 520;
      volume = 0.04;
      break;
    case 'reward':
      duration = 0.18;
      startFreq = 520;
      endFreq = 780;
      volume = 0.045;
      break;
    case 'warning':
      duration = 0.16;
      startFreq = 210;
      endFreq = 160;
      volume = 0.045;
      filter.type = 'bandpass';
      filter.frequency.value = 900;
      break;
    case 'victory':
      duration = 0.35;
      startFreq = 420;
      endFreq = 880;
      volume = 0.06;
      break;
    case 'defeat':
      duration = 0.35;
      startFreq = 280;
      endFreq = 120;
      volume = 0.06;
      break;
    default:
      break;
  }

  osc.type = type === 'warning' ? 'square' : 'triangle';
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.start(now);
  osc.stop(now + duration);
}

export function playCastleHitSfx(strength: number): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  const clamped = Math.max(0, Math.min(1, strength));
  const duration = 0.1 + clamped * 0.22;
  const startFreq = 120 - clamped * 36;
  const endFreq = 52 - clamped * 14;

  osc.type = clamped > 0.62 ? 'square' : 'triangle';
  filter.type = 'bandpass';
  filter.frequency.value = 380 + clamped * 180;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getMasterOut(ctx));

  osc.frequency.setValueAtTime(Math.max(38, startFreq), now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.03 + clamped * 0.06, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.start(now);
  osc.stop(now + duration);
}

export function playProjectileLaunchSfx(type: 'ranged' | 'tank' | 'siege'): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getMasterOut(ctx));
  filter.type = 'lowpass';

  let duration = 0.08;
  let startFreq = 280;
  let endFreq = 180;
  let volume = 0.02;
  osc.type = 'triangle';

  if (type === 'ranged') {
    duration = 0.065;
    startFreq = 460;
    endFreq = 300;
    volume = 0.018;
    filter.frequency.value = 2100;
  } else if (type === 'tank') {
    duration = 0.12;
    startFreq = 180;
    endFreq = 110;
    volume = 0.024;
    osc.type = 'sawtooth';
    filter.frequency.value = 900;
  } else {
    duration = 0.145;
    startFreq = 240;
    endFreq = 90;
    volume = 0.028;
    osc.type = 'square';
    filter.frequency.value = 820;
  }

  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.start(now);
  osc.stop(now + duration);
}

function synthesizeImpactVariant(variant: 1 | 2 | 3 | 4): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getMasterOut(ctx));

  osc.type = variant >= 3 ? 'square' : 'triangle';
  filter.type = 'bandpass';

  if (variant === 1) {
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.08);
    filter.frequency.value = 700;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.02, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
    return;
  }

  if (variant === 2) {
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.11);
    filter.frequency.value = 950;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.03, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    osc.start(now);
    osc.stop(now + 0.11);
    return;
  }

  if (variant === 3) {
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.16);
    filter.frequency.value = 520;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.start(now);
    osc.stop(now + 0.16);
    return;
  }

  osc.frequency.setValueAtTime(90, now);
  osc.frequency.exponentialRampToValueAtTime(42, now + 0.22);
  filter.frequency.value = 360;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  osc.start(now);
  osc.stop(now + 0.22);
}

/** Named combat impacts: use `'building'` for fortress hits (uses strength 0–1). */
export function playHitImpactSfx(kind: HitImpactKind, opts?: { buildingStrength?: number }): void {
  if (kind === 'building') {
    playCastleHitSfx(opts?.buildingStrength ?? 0.45);
    return;
  }
  if (kind === 'light') synthesizeImpactVariant(1);
  else if (kind === 'heavy') synthesizeImpactVariant(2);
  else synthesizeImpactVariant(3);
}

function createNoiseSource(ctx: AudioContext): AudioBufferSourceNode {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 1.5));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.22;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  return noise;
}

export function setAmbientAge(age: number): void {
  ambientAge = Math.max(0, Math.min(3, age));
  if (!ambientOscA || !ambientOscB || !audioCtx || !ambientFilter) return;
  const now = audioCtx.currentTime;
  const baseFrequencies = [72, 86, 98, 112];
  const drone = baseFrequencies[ambientAge];
  ambientOscA.frequency.cancelScheduledValues(now);
  ambientOscB.frequency.cancelScheduledValues(now);
  ambientOscA.frequency.setTargetAtTime(drone, now, 0.35);
  ambientOscB.frequency.setTargetAtTime(drone * 1.5, now, 0.35);

  const lpCut = [680, 820, 1020, 1280][ambientAge] ?? 760;
  const q = [0.35, 0.42, 0.55, 0.62][ambientAge] ?? 0.4;
  ambientFilter.frequency.cancelScheduledValues(now);
  ambientFilter.Q.cancelScheduledValues(now);
  ambientFilter.frequency.setTargetAtTime(lpCut, now, 0.45);
  ambientFilter.Q.setTargetAtTime(q, now, 0.5);

  if (ambientNoiseGain) {
    const noiseMix = [0.12, 0.16, 0.2, 0.26][ambientAge] ?? 0.14;
    ambientNoiseGain.gain.cancelScheduledValues(now);
    ambientNoiseGain.gain.setTargetAtTime(noiseMix, now, 0.4);
  }
}

export function startAmbientLoop(): void {
  const ctx = getContext();
  if (!ctx || ambientGain) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  ambientGain = ctx.createGain();
  ambientGain.gain.value = 0.0001;

  ambientFilter = ctx.createBiquadFilter();
  ambientFilter.type = 'lowpass';
  ambientFilter.frequency.value = 760;
  ambientFilter.Q.value = 0.4;

  ambientOscA = ctx.createOscillator();
  ambientOscB = ctx.createOscillator();
  ambientOscA.type = 'sine';
  ambientOscB.type = 'triangle';

  ambientNoise = createNoiseSource(ctx);
  ambientNoiseGain = ctx.createGain();
  ambientNoiseGain.gain.value = 0.14;

  ambientOscA.connect(ambientFilter);
  ambientOscB.connect(ambientFilter);
  ambientNoise.connect(ambientNoiseGain);
  ambientNoiseGain.connect(ambientFilter);
  ambientFilter.connect(ambientGain);
  ambientGain.connect(getMasterOut(ctx));

  setAmbientAge(ambientAge);
  ambientOscA.start();
  ambientOscB.start();
  ambientNoise.start();

  const now = ctx.currentTime;
  ambientGain.gain.setValueAtTime(0.0001, now);
  ambientGain.gain.exponentialRampToValueAtTime(0.018, now + 0.8);
}

export function stopAmbientLoop(): void {
  if (!audioCtx) return;
  const ctx = audioCtx;
  const now = ctx.currentTime;
  if (ambientGain) {
    ambientGain.gain.cancelScheduledValues(now);
    ambientGain.gain.setValueAtTime(Math.max(0.0001, ambientGain.gain.value), now);
    ambientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  }

  const stopAt = now + 0.28;
  if (ambientOscA) ambientOscA.stop(stopAt);
  if (ambientOscB) ambientOscB.stop(stopAt);
  if (ambientNoise) ambientNoise.stop(stopAt);

  ambientOscA = null;
  ambientOscB = null;
  ambientNoise = null;
  ambientNoiseGain = null;
  ambientFilter = null;
  ambientGain = null;
}
