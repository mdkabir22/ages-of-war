interface HowToPlayProps {
  onClose: () => void;
}

export function HowToPlay({ onClose }: HowToPlayProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 pointer-events-auto">
      <div className="bg-gray-900 rounded-xl p-6 max-w-sm w-full border border-white/20">
        <h2 className="text-xl font-bold text-yellow-400 mb-4">How to Play</h2>
        <ul className="text-white/80 text-sm space-y-2 mb-6 list-none">
          <li>• Left click: Select / Shift+House, Alt+Mine build</li>
          <li>• Right click: Move units / Rally (building selected)</li>
          <li>• WASD: Move camera</li>
          <li>• Esc: Pause</li>
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold"
        >
          OK
        </button>
      </div>
    </div>
  );
}
