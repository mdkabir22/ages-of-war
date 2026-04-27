import { useEffect, useState } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { HUD } from './ui/HUD';
import { Minimap } from './ui/Minimap';
import { PauseMenu } from './components/PauseMenu';
import { audio } from './audio/manager';
import { MainMenu } from './components/MainMenu';
import { GameErrorBoundary } from './components/GameErrorBoundary';
import type { GameMode } from './types/game';

type AppScreen = 'menu' | 'playing';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('menu');
  const [selectedMode, setSelectedMode] = useState<GameMode>('campaign');
  const [gameKey, setGameKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isLandscape, setIsLandscape] = useState(() => window.innerWidth >= window.innerHeight);

  useEffect(() => {
    const updateOrientation = () => setIsLandscape(window.innerWidth >= window.innerHeight);
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    updateOrientation();
    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  useEffect(() => {
    if (screen !== 'playing') return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPaused((p) => !p);
      audio.play('uiClick');
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'playing') return;
    const orientation = window.screen.orientation;
    if (!orientation?.lock) return;
    void orientation.lock('landscape').catch(() => {
      // Some devices/browsers block orientation lock without fullscreen.
    });
  }, [screen, gameKey]);

  const startGame = (mode: GameMode) => {
    setSelectedMode(mode);
    setPaused(false);
    setGameKey((k) => k + 1);
    setScreen('playing');
  };

  if (screen === 'menu') {
    return (
      <MainMenu
        onStartGame={startGame}
        onHowToPlay={() =>
          window.alert(
            'How to play:\n- Left click select/place\n- Right click move/rally\n- Shift=House, Alt=Mine\n- Esc = Pause'
          )
        }
      />
    );
  }

  if (!isLandscape) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-white">
        <div className="text-2xl">Rotate Device</div>
        <div className="max-w-sm text-sm text-white/80">
          Is game ko landscape mode me khelna hai. Mobile ko sideways karo, phir game start ho jayega.
        </div>
        <button
          type="button"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold"
          onClick={() => setScreen('menu')}
        >
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-war-night">
      <GameErrorBoundary key={`${gameKey}-${selectedMode}`}>
        <GameCanvas paused={paused} />
        <HUD />
        <Minimap />
        <PauseMenu
          isOpen={paused}
          onResume={() => setPaused(false)}
          onRestart={() => {
            setPaused(false);
            setGameKey((k) => k + 1);
          }}
          onQuit={() => {
            setPaused(false);
            setScreen('menu');
          }}
        />
      </GameErrorBoundary>
    </div>
  );
}
