import { create } from 'zustand';

type ScreenState = 'menu' | 'playing' | 'howto';

type AppStore = {
  screen: ScreenState;
  audioEnabled: boolean;
  audioVolumePct: number;
  setScreen: (screen: ScreenState) => void;
  setAudioEnabled: (enabled: boolean) => void;
  toggleAudioEnabled: () => void;
  setAudioVolumePct: (value: number) => void;
};

const getInitialAudioEnabled = () => {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem('aow_audio_enabled') !== '0';
};

const getInitialAudioVolume = () => {
  if (typeof window === 'undefined') return 85;
  const raw = window.localStorage.getItem('aow_audio_volume');
  const n = raw != null ? Number(raw) : 85;
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 85;
};

export const useAppStore = create<AppStore>((set) => ({
  screen: 'menu',
  audioEnabled: getInitialAudioEnabled(),
  audioVolumePct: getInitialAudioVolume(),
  setScreen: (screen) => set({ screen }),
  setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),
  toggleAudioEnabled: () => set((state) => ({ audioEnabled: !state.audioEnabled })),
  setAudioVolumePct: (value) =>
    set({
      audioVolumePct: Math.max(0, Math.min(100, Math.round(value))),
    }),
}));
