import { useEffect, useState, useCallback } from 'react';

export function RotateDevice({ onBack }: { onBack: () => void }) {
  const [isLandscape, setIsLandscape] = useState(true);
  const [bypass, setBypass] = useState(false);

  const checkOrientation = useCallback(() => {
    // Method 1: screen.orientation API
    const type = window.screen.orientation?.type;
    if (type) {
      setIsLandscape(type.includes('landscape'));
      return;
    }

    // Method 2: Compare max/min dimensions (handles address bar issues)
    const w = window.innerWidth;
    const h = window.innerHeight;
    const maxDim = Math.max(w, h);
    const minDim = Math.min(w, h);

    // If aspect ratio > 1.2, it's landscape. < 0.9, portrait. In between = ambiguous.
    const ratio = maxDim / Math.max(1, minDim);
    setIsLandscape(ratio > 1.15);
  }, []);

  useEffect(() => {
    checkOrientation();

    // Multiple events for reliability
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    // iOS Safari specific
    const vv = window.visualViewport;
    vv?.addEventListener('resize', checkOrientation);

    // Check again after a delay (mobile browsers report wrong size initially)
    const timeoutId = setTimeout(checkOrientation, 500);
    const intervalId = setInterval(checkOrientation, 1000);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      vv?.removeEventListener('resize', checkOrientation);
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [checkOrientation]);

  // If landscape OR user chose to bypass, don't show
  if (isLandscape || bypass) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-white p-6">
      <div className="text-4xl mb-4" aria-hidden>
        📱↔️
      </div>
      <h2 className="text-xl font-bold mb-2">Rotate Device</h2>
      <p className="text-center text-white/70 mb-2 max-w-xs">
        This game works best in landscape mode.
      </p>
      <p className="text-center text-white/50 text-xs mb-6">
        Width: {window.innerWidth} × Height: {window.innerHeight}
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={() => {
            // Try to force landscape
            const orientation = window.screen.orientation as ScreenOrientation & {
              lock?: (orientation: 'landscape') => Promise<void>;
            };
            if (orientation?.lock) {
              void orientation.lock('landscape').catch(() => {});
            }
            checkOrientation();
          }}
          className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
        >
          Retry Detection
        </button>

        <button
          type="button"
          onClick={() => setBypass(true)}
          className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold border border-white/20"
        >
          Play Anyway
        </button>

        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2 rounded-lg bg-transparent text-white/60 hover:text-white text-sm"
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}
