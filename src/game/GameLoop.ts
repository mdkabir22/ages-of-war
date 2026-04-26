export interface GameLoopHandlers {
  onUpdate: (dt: number) => void;
  onRender?: () => void;
}

export class GameLoop {
  private rafId = 0;
  private lastTime = 0;
  private running = false;
  private readonly handlers: GameLoopHandlers;

  constructor(handlers: GameLoopHandlers) {
    this.handlers = handlers;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (time: number): void => {
    if (!this.running) return;
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;
    this.handlers.onUpdate(dt);
    this.handlers.onRender?.();
    this.rafId = requestAnimationFrame(this.tick);
  };
}
