import { useEffect, useState } from 'react';
import { preloadCriticalAssets } from '../lib/assetPreloader';

interface LoadingScreenProps {
  onComplete: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await preloadCriticalAssets((p) => {
          if (!cancelled) setProgress(p);
        });
      } catch {
        /* still continue into app */
      }
      if (!cancelled) {
        window.setTimeout(onComplete, 400);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6"
      style={{
        background: 'linear-gradient(135deg, #1a0a2e 0%, #4a1a6b 45%, #0f172a 100%)',
      }}
    >
      <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-8">Ages of War</h1>
      <div className="w-full max-w-sm h-2 rounded-full overflow-hidden bg-white/15">
        <div
          className="h-full rounded-full bg-amber-400 transition-[width] duration-300 ease-out"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      <p className="text-white/85 mt-4 text-sm">Loading… {Math.floor(progress)}%</p>
    </div>
  );
}
