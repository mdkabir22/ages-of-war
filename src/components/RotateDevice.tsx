import { useEffect, useState } from 'react';

export function RotateDevice({ onBack }: { onBack: () => void }) {
  const [isLandscape, setIsLandscape] = useState(true);

  useEffect(() => {
    const checkOrientation = () => {
      // Method 1: screen.orientation (most reliable on mobile)
      const type = window.screen.orientation?.type;
      if (type) {
        setIsLandscape(type.includes('landscape'));
        return;
      }
      // Method 2: viewport dimensions (fallback). Use innerWidth/innerHeight directly — max/min would always be ≥1 and break portrait detection.
      const iw = window.innerWidth;
      const ih = window.innerHeight;
      setIsLandscape(iw / ih > 0.9);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    window.screen.orientation?.addEventListener?.('change', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      window.screen.orientation?.removeEventListener?.('change', checkOrientation);
    };
  }, []);

  if (isLandscape) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-white p-6">
      <div className="text-4xl mb-4" aria-hidden>
        📱↔️
      </div>
      <h2 className="text-xl font-bold mb-2">Rotate Device</h2>
      <p className="text-center text-white/70 mb-6 max-w-xs">
        This game requires landscape mode.
        <br />
        Please turn your device sideways.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
      >
        Back to Menu
      </button>
    </div>
  );
}
