import type { GameMode } from '../types/game';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Swords, BookOpen, Sparkles } from 'lucide-react';
import { drawMenuBackground } from '../game/renderer';
import { AGES } from '../game/ages';
import { getModeTagline } from '../game/presentation';

interface MainMenuProps {
  onStartGame: (mode: GameMode) => void;
  onHowToPlay: () => void;
}

export function MainMenu({ onStartGame, onHowToPlay }: MainMenuProps) {
  const { t, i18n } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const setLang = (lng: string) => {
    void i18n.changeLanguage(lng);
    localStorage.setItem('aow_language', lng);
    document.documentElement.dir = lng === 'ur' ? 'rtl' : 'ltr';
  };

  useEffect(() => {
    document.documentElement.dir = i18n.language?.startsWith('ur') ? 'rtl' : 'ltr';
  }, [i18n.language]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const animate = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      drawMenuBackground(ctx, canvas.width, canvas.height);
      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
        <div className="glass-panel rounded-3xl px-6 py-8 md:px-12 md:py-10 w-full max-w-4xl">
          {/* Title */}
          <div className="mb-2 text-center">
          <h1
            className="text-6xl md:text-8xl font-black tracking-tighter"
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FF6B35 30%, #FF4444 60%, #9B59B6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 40px rgba(255, 215, 0, 0.3)',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
            }}
          >
            AGES OF WAR
          </h1>
          <p
            className="text-xl md:text-2xl font-bold tracking-widest mt-2"
            style={{
              color: '#FFD700',
              textShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
            }}
          >
            CHRONICLES OF ETERNITY
          </p>
          <p className="mt-4 text-sm md:text-base text-blue-100/80 max-w-2xl mx-auto">
            Build your war machine, evolve across four ages, and crush the enemy fortress in a cinematic real-time battle.
          </p>
        </div>

        {/* Age Preview */}
        <div className="flex justify-center gap-3 md:gap-4 my-6 flex-wrap">
          {AGES.map((age, i) => (
            <div
              key={i}
              className="w-16 h-16 md:w-20 md:h-20 rounded-lg border-2 overflow-hidden relative"
              style={{
                borderColor: age.themeColor,
                boxShadow: `0 0 15px ${age.themeColor}40`,
              }}
            >
              <img
                src={age.castleImage}
                alt={age.name}
                className="w-full h-full object-cover"
              />
              <div
                className="absolute bottom-0 left-0 right-0 text-center text-[8px] md:text-[10px] font-bold py-0.5"
                style={{
                  backgroundColor: age.themeColor + 'CC',
                  color: '#fff',
                }}
              >
                {age.name.split(' ')[0]}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/90">Auto Combat</span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/90">AI Counter Strategy</span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/90">4 Eras Progression</span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/90">Castle Siege</span>
        </div>

        {/* Menu Buttons */}
        <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
          <button
            onClick={() => onStartGame('campaign')}
            className="ui-action group relative flex flex-col items-center justify-center gap-1 px-8 py-3 rounded-xl font-bold text-lg text-white"
            style={{
              background: 'linear-gradient(135deg, #FF6B35 0%, #FF4444 100%)',
              boxShadow: '0 4px 20px rgba(255, 107, 53, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <div className="flex items-center gap-3">
              <Swords className="w-6 h-6 group-hover:rotate-12 transition-transform" />
              <span>CAMPAIGN</span>
            </div>
            <span className="text-[11px] font-medium text-white/90">{getModeTagline('campaign')}</span>
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onStartGame('defense')}
              className="ui-action group flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)' }}
            >
              <span>DEFENSE</span>
              <span className="text-[10px] font-medium text-white/85 text-center leading-tight">{getModeTagline('defense')}</span>
            </button>
            <button
              onClick={() => onStartGame('raid')}
              className="ui-action group flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #C62828 0%, #8E0000 100%)' }}
            >
              <span>RAID</span>
              <span className="text-[10px] font-medium text-white/85 text-center leading-tight">{getModeTagline('raid')}</span>
            </button>
            <button
              onClick={() => onStartGame('endless')}
              className="ui-action group flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6D28D9 0%, #4C1D95 100%)' }}
            >
              <span>ENDLESS</span>
              <span className="text-[10px] font-medium text-white/85 text-center leading-tight">{getModeTagline('endless')}</span>
            </button>
          </div>

          <button
            onClick={onHowToPlay}
            className="ui-action group flex items-center justify-center gap-3 px-8 py-3 rounded-xl font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #4A7FB5 0%, #2C5F8A 100%)',
              boxShadow: '0 4px 15px rgba(74, 127, 181, 0.3)',
            }}
          >
            <BookOpen className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span>HOW TO PLAY</span>
          </button>
        </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-2 px-4">
          <label className="flex items-center gap-2 text-white/70 text-xs">
            <span>{t('language')}</span>
            <select
              value={i18n.language?.startsWith('ur') ? 'ur' : 'en'}
              onChange={(e) => setLang(e.target.value)}
              className="rounded-md bg-black/40 border border-white/20 text-white text-xs px-2 py-1"
            >
              <option value="en">English</option>
              <option value="ur">اردو</option>
            </select>
          </label>
          <p className="text-white/60 text-xs text-center flex items-center gap-2">
            <Sparkles className="w-3 h-3" /> Hotkeys: `1-4` spawn units, `U` age up, `Esc` pause
          </p>
        </div>
      </div>
    </div>
  );
}
