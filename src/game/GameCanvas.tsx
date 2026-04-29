import { useRef, useEffect } from 'react';
import { useGameStore } from '../core/state';
import { startEnemyAI } from './EnemyAI';
import { audio } from '../audio/manager';
import type { AnimatedUnit } from './systems/animation';
import { startGameCanvasLoop } from './render/gameLoop';
import { setupCanvasInputHandlers } from './render/inputHandlers';

interface GameCanvasProps {
  paused?: boolean;
}

export function GameCanvas({ paused = false }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    void audio.preload();
    const unitAnimations = new Map<string, AnimatedUnit>();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const layoutCanvasSize = () => {
      const vv = window.visualViewport;
      // Use visualViewport if available (handles mobile address bar)
      const w = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
      const h = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const resize = () => layoutCanvasSize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    resize();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      const step = 24;
      const store = useGameStore.getState();
      if (e.key === 'w' || e.key === 'W') store.moveCamera(0, -step);
      if (e.key === 's' || e.key === 'S') store.moveCamera(0, step);
      if (e.key === 'a' || e.key === 'A') store.moveCamera(-step, 0);
      if (e.key === 'd' || e.key === 'D') store.moveCamera(step, 0);
    };
    window.addEventListener('keydown', handleKeyDown);

    const inputController = setupCanvasInputHandlers(canvas, pausedRef);

    const economyId = window.setInterval(() => {
      const state = useGameStore.getState();
      state.tickEconomy();
      state.tickMissionTime(1);
    }, 1000);
    const stopEnemyAI = startEnemyAI(
      () => useGameStore.getState(),
      (updater) => useGameStore.setState((prev) => updater(prev))
    );

    const stopLoop = startGameCanvasLoop(
      canvas,
      ctx,
      pausedRef,
      unitAnimations,
      () => inputController.getSelectionBox(),
      layoutCanvasSize
    );
    return () => {
      stopLoop();
      inputController.cleanup();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      window.clearInterval(economyId);
      stopEnemyAI();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 h-full w-full touch-none"
      style={{ imageRendering: 'auto' }}
    />
  );
}
