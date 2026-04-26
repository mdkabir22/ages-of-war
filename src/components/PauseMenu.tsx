import { useMemo, useState } from 'react';
import { audio } from '../audio/manager';

interface PauseMenuProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseMenu({ isOpen, onResume, onRestart, onQuit }: PauseMenuProps) {
  const initialVolume = useMemo(() => Math.round(audio.getVolume() * 100), []);
  const initialEnabled = useMemo(() => audio.isEnabled(), []);
  const [volume, setVolume] = useState(initialVolume);
  const [soundEnabled, setSoundEnabled] = useState(initialEnabled);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[min(92vw,420px)] rounded-xl border border-white/20 bg-slate-900/95 p-5 text-white shadow-2xl">
        <h2 className="text-xl font-bold">Paused</h2>
        <p className="mt-1 text-sm text-white/70">Adjust settings or resume the battle.</p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/85">Volume</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  audio.setVolume(v / 100);
                }}
                className="w-full"
              />
              <span className="w-12 text-right text-sm text-white/80">{volume}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-white/15 bg-white/5 px-3 py-2">
            <span className="text-sm">Sound Effects</span>
            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                audio.setEnabled(next);
              }}
              className="rounded-md border border-white/25 bg-white/10 px-3 py-1 text-sm font-semibold hover:bg-white/20"
            >
              {soundEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button onClick={onResume} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold hover:bg-emerald-500">
            Resume
          </button>
          <button onClick={onRestart} className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold hover:bg-amber-500">
            Restart
          </button>
          <button onClick={onQuit} className="rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold hover:bg-rose-600">
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
