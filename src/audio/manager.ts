type SoundName = 'sword' | 'arrow' | 'build' | 'ageUp' | 'death' | 'gather' | 'uiClick';

const SOUND_PATHS: Record<SoundName, string> = {
  sword: '/assets/sfx/sword.mp3',
  arrow: '/assets/sfx/arrow.mp3',
  build: '/assets/sfx/build.mp3',
  ageUp: '/assets/sfx/ageup.mp3',
  death: '/assets/sfx/death.mp3',
  gather: '/assets/sfx/chop.mp3',
  uiClick: '/assets/sfx/click.mp3',
};

class AudioManager {
  private sounds: Map<SoundName, HTMLAudioElement> = new Map();
  private loaded: Map<SoundName, boolean> = new Map();
  private enabled = true;
  private volume = 0.5;
  private context: AudioContext | null = null;

  async preload(): Promise<void> {
    const tasks = Object.entries(SOUND_PATHS).map(([name, path]) => {
      const key = name as SoundName;
      const audio = new Audio(path);
      audio.volume = this.volume;
      this.sounds.set(key, audio);
      return new Promise<void>((resolve) => {
        audio.addEventListener(
          'canplaythrough',
          () => {
            this.loaded.set(key, true);
            resolve();
          },
          { once: true }
        );
        audio.addEventListener(
          'error',
          () => {
            this.loaded.set(key, false);
            resolve();
          },
          { once: true }
        );
      });
    });
    await Promise.all(tasks);
  }

  play(name: SoundName): void {
    if (!this.enabled) return;
    const sound = this.sounds.get(name);
    const isLoaded = this.loaded.get(name);
    if (sound && isLoaded) {
      const clone = sound.cloneNode() as HTMLAudioElement;
      clone.volume = this.volume;
      void clone.play().catch(() => {
        this.playToneFallback(name);
      });
      return;
    }
    this.playToneFallback(name);
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
  }

  getVolume(): number {
    return this.volume;
  }

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new window.AudioContext();
    }
    return this.context;
  }

  private playTone(freq: number, duration: number, type: OscillatorType): void {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08 * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignore audio failures in unsupported contexts.
    }
  }

  private playToneFallback(name: SoundName): void {
    if (name === 'sword') return this.playTone(420, 0.08, 'sawtooth');
    if (name === 'arrow') return this.playTone(780, 0.05, 'square');
    if (name === 'build') return this.playTone(240, 0.2, 'triangle');
    if (name === 'ageUp') return this.playTone(520, 0.25, 'sine');
    if (name === 'death') return this.playTone(130, 0.3, 'square');
    if (name === 'gather') return this.playTone(300, 0.08, 'triangle');
    this.playTone(600, 0.05, 'sine');
  }
}

export const audio = new AudioManager();
