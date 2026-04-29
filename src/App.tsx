import { lazy, Suspense, useEffect, useState } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { isGameCanvas3DEnabled } from './config/features';

const GameCanvas3D = lazy(() =>
  import('./game/GameCanvas3D').then((m) => ({ default: m.GameCanvas3D }))
);
import { HUD } from './ui/HUD';
import { Minimap } from './ui/Minimap';
import { PauseMenu } from './components/PauseMenu';
import { audio } from './audio/manager';
import { MainMenu } from './components/MainMenu';
import { RotateDevice } from './components/RotateDevice';
import { HowToPlay } from './components/HowToPlay';
import type { GameMode } from './types/game';

type AppScreen = 'menu' | 'playing';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('menu');
  const [selectedMode, setSelectedMode] = useState<GameMode>('campaign');
  const [gameKey, setGameKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);

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
    const orientation = window.screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'portrait' | 'landscape') => Promise<void>;
    };
    if (typeof orientation?.lock !== 'function') return;
    void orientation.lock('landscape').catch(() => {
      // Some devices/browsers block orientation lock without fullscreen.
    });
  }, [screen, gameKey]);

  useEffect(() => {
    if (screen !== 'playing') return;
    const onErr = (e: ErrorEvent) => {
      const msg = [e.message, e.error instanceof Error ? e.error.stack : String(e.error)].filter(Boolean).join('\n');
      setGameError(msg || 'Unknown error');
    };
    const onRej = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const msg = r instanceof Error ? `${r.message}\n${r.stack ?? ''}` : String(r);
      setGameError(msg || 'Unhandled rejection');
    };
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, [screen]);

  const startGame = (mode: GameMode) => {
    setSelectedMode(mode);
    setPaused(false);
    setGameError(null);
    setGameKey((k) => k + 1);
    setScreen('playing');
  };

  if (screen === 'menu') {
    return (
      <>
        <MainMenu onStartGame={startGame} onHowToPlay={() => setShowHowToPlay(true)} />
        {showHowToPlay && <HowToPlay onClose={() => setShowHowToPlay(false)} />}
      </>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900">
      <RotateDevice onBack={() => setScreen('menu')} />

      {gameError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 text-white p-4">
          <div className="bg-red-900/50 border border-red-500 rounded-xl p-6 max-w-md">
            <h2 className="text-xl font-bold text-red-400 mb-2">Game Error</h2>
            <pre className="text-xs text-red-200 whitespace-pre-wrap">{gameError}</pre>
            <button
              type="button"
              onClick={() => setScreen('menu')}
              className="mt-4 px-4 py-2 bg-red-600 rounded-lg font-bold"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}

      <div key={`${gameKey}-${selectedMode}`}>
        {isGameCanvas3DEnabled ? (
          <Suspense fallback={<div className="fixed inset-0 z-0 bg-slate-900" aria-hidden />}>
            <GameCanvas3D paused={paused} />
          </Suspense>
        ) : (
          <GameCanvas paused={paused} />
        )}
        <HUD onPause={() => setPaused(true)} />
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
      </div>
    </div>
  );
}
