import { useEffect, useState } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { HUD } from './ui/HUD';
import { Minimap } from './ui/Minimap';
import { PauseMenu } from './components/PauseMenu';
import { audio } from './audio/manager';
import { MainMenu } from './components/MainMenu';
import type { GameMode } from './types/game';

type AppScreen = 'menu' | 'playing';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('menu');
  const [selectedMode, setSelectedMode] = useState<GameMode>('campaign');
  const [gameKey, setGameKey] = useState(0);
  const [paused, setPaused] = useState(false);

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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-war-night">
      <GameCanvas key={`${gameKey}-${selectedMode}`} paused={paused} />
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
    </div>
  );
}
