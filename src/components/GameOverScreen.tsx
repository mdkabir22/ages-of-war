import { Trophy, Skull, RotateCcw, Home, Star } from 'lucide-react';
import type { GameState } from '../types/game';
import { AGES } from '../game/ages';
import { getAIProfileLabel, getModeLabel } from '../game/presentation';

interface GameOverScreenProps {
  gameState: GameState;
  onRestart: () => void;
  onMainMenu: () => void;
}

export function GameOverScreen({ gameState, onRestart, onMainMenu }: GameOverScreenProps) {
  const isVictory = gameState.isVictory;
  const age = AGES[gameState.playerAge];
  const unitEfficiency = gameState.kills > 0
    ? Math.min(99, Math.round((gameState.kills / Math.max(1, gameState.missions.spawnUnits)) * 100))
    : 0;
  const pressureScore = Math.max(0, Math.min(100, Math.round((gameState.wave / Math.max(1, gameState.time / 45)) * 34)));
  const economyScore = Math.max(
    0,
    Math.min(100, Math.round(42 + gameState.goldMineLevel * 10 + (gameState.premiumPass ? 12 : 0) + (gameState.adFree ? 6 : 0)))
  );

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: isVictory ? 'rgba(0,50,0,0.8)' : 'rgba(50,0,0,0.8)' }}
    >
      <div
        className="glass-panel p-8 rounded-2xl text-center max-w-xl mx-4"
        style={{
          border: `3px solid ${isVictory ? '#4CAF50' : '#F44336'}`,
          boxShadow: `0 0 40px ${isVictory ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'}`,
        }}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: isVictory ? '#4CAF50' : '#F44336',
              boxShadow: `0 0 20px ${isVictory ? 'rgba(76,175,80,0.5)' : 'rgba(244,67,54,0.5)'}`,
            }}
          >
            {isVictory ? (
              <Trophy className="w-10 h-10 text-white" />
            ) : (
              <Skull className="w-10 h-10 text-white" />
            )}
          </div>
        </div>

        {/* Title */}
        <h2
          className="text-4xl font-black mb-2"
          style={{
            color: isVictory ? '#4CAF50' : '#F44336',
            textShadow: `0 0 20px ${isVictory ? 'rgba(76,175,80,0.5)' : 'rgba(244,67,54,0.5)'}`,
          }}
        >
          {isVictory ? 'VICTORY!' : 'DEFEAT!'}
        </h2>

        {/* Subtitle */}
        <p className="text-gray-300 mb-2">
          {isVictory
            ? 'You have conquered the ages and destroyed the enemy fortress!'
            : 'Your fortress has fallen... but the war continues!'}
        </p>
        <p className="text-xs text-white/60 mb-6">Total match time: {Math.floor(gameState.time / 60)}m {Math.floor(gameState.time % 60)}s</p>
        <p className="text-xs text-violet-200 mb-3">
          Streak: {gameState.winStreak}W / {gameState.lossStreak}L | Chests: {gameState.unclaimedChests}
        </p>
        <p className="text-xs text-cyan-200 mb-4">
          Match Grade: {gameState.lastMatchGrade} | Reward: +{gameState.lastMatchBonusGold} Gold, +{gameState.lastMatchBonusGems} Gems
        </p>
        <p className="text-xs text-amber-200 mb-4">
          Season: +{gameState.isVictory ? 'High' : 'Base'} XP | Tokens total: {gameState.seasonalTokens}
        </p>
        <p className="text-xs text-sky-100/90 mb-5">
          Coach Tip: {gameState.lastMatchTip}
        </p>
        <p className="text-xs text-white/70 mb-4">
          Mode: {getModeLabel(gameState.mode)} | Enemy Profile: {getAIProfileLabel(gameState.aiProfile)}
        </p>
        <p className="text-xs text-blue-200 mb-4">
          {gameState.missionDescriptor}
        </p>

        <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left">
          <div className="panel-title mb-2 text-center">Session Performance Summary</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-black/25 p-2">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Unit Efficiency</div>
              <div className="text-base font-extrabold text-emerald-300">{unitEfficiency}%</div>
            </div>
            <div className="rounded-lg bg-black/25 p-2">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Battle Pressure</div>
              <div className="text-base font-extrabold text-orange-300">{pressureScore}%</div>
            </div>
            <div className="rounded-lg bg-black/25 p-2">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Economy Shape</div>
              <div className="text-base font-extrabold text-cyan-300">{economyScore}%</div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-yellow-200/20 bg-yellow-100/5 p-3 text-left">
          <div className="panel-title mb-2 text-center">Mission Reward Summary</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-black/25 p-2">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Objective Gold</div>
              <div className="text-base font-extrabold text-amber-300">+{gameState.matchRewardSummary.objectiveGold}</div>
            </div>
            <div className="rounded-lg bg-black/25 p-2">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Objective Gems</div>
              <div className="text-base font-extrabold text-fuchsia-300">+{gameState.matchRewardSummary.objectiveGems}</div>
            </div>
            <div className="rounded-lg bg-black/25 p-2">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Objective Pass XP</div>
              <div className="text-base font-extrabold text-sky-300">+{gameState.matchRewardSummary.objectiveBattlePassXP}</div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div
            className="p-3 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            <div className="text-xs text-gray-400">AGE REACHED</div>
            <div className="text-lg font-bold" style={{ color: age.themeColor }}>
              {age.name.split(' ')[0]}
            </div>
          </div>
          <div
            className="p-3 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            <div className="text-xs text-gray-400">KILLS</div>
            <div className="text-lg font-bold text-white">{gameState.kills}</div>
          </div>
          <div
            className="p-3 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            <div className="text-xs text-gray-400">XP EARNED</div>
            <div className="text-lg font-bold text-yellow-400">{gameState.playerXP}</div>
          </div>
        </div>

        {/* Stars for victory */}
        {isVictory && (
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3].map((star) => (
              <Star
                key={star}
                className="w-8 h-8"
                style={{
                  color: '#FFD700',
                  fill: '#FFD700',
                  filter: 'drop-shadow(0 0 5px rgba(255,215,0,0.5))',
                }}
              />
            ))}
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onRestart}
            className="ui-action flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white"
            style={{
              backgroundColor: isVictory ? '#4CAF50' : '#FF9800',
              boxShadow: `0 4px 15px ${isVictory ? 'rgba(76,175,80,0.4)' : 'rgba(255,152,0,0.4)'}`,
            }}
          >
            <RotateCcw className="w-5 h-5" />
            PLAY AGAIN
          </button>
          <button
            onClick={onMainMenu}
            className="ui-action flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <Home className="w-5 h-5" />
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
}
