import { useState } from 'react';
import { Pause, Zap, Play, RotateCcw, Home, HelpCircle, ChevronUp, Gem, Rocket, Volume2, VolumeX, Share2 } from 'lucide-react';
import { Slider } from './ui/slider';
import type { BattleStance, BuildingType, GameState, LaneFocus } from '../types/game';
import { LANE_Y_RATIOS } from '../core/map';
import { AGES, XP_THRESHOLDS } from '../game/ages';
import { canActivateFortify, canActivateRally, canUpgradeAge } from '../core/engine';
import { TECH_TREE, canUnlockTech } from '../game/systems/techTree';
import { canActivateSpeedBoost, canBuyGoldMineUpgrade, canClaimStarterPack, canPurchaseStoreOffer, getGoldMineUpgradeCost, getOfferOfTheDay, STORE_OFFERS } from '../game/monetization';
import {
  canOpenRewardChest,
  canClaimDailyChallenge,
  canClaimDailyReward,
  canClaimKillMission,
  canClaimSpawnMission,
  canClaimWeeklyChallenge,
  getBattlePassProgressPercent,
  getBattlePassTier,
} from '../game/progression';
import { getAIEconomyModeLabel, getAIMacroPlanLabel, getAIProfileDescription, getAIProfileLabel, getModeLabel } from '../game/presentation';
import { shareActions } from '../lib/share';
import { remoteGameConfig } from '../lib/remoteConfig';
import { analyticsDashboard } from '../lib/firebaseAnalytics';

function calcDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getPlacementHint(
  buildingType: BuildingType,
  position: { x: number; y: number },
  nodes: GameState['resourceNodes']
): string {
  if (buildingType === 'lumber_camp') {
    const nearbyTrees = nodes.filter((n) => n.type === 'tree' && calcDistance(n.position, position) < 250).length;
    if (nearbyTrees >= 3) return 'Great spot: 3+ trees in range';
    if (nearbyTrees > 0) return `Limited value: only ${nearbyTrees} tree(s) nearby`;
    return 'No trees nearby for Lumber Camp bonus';
  }

  if (buildingType === 'mill') {
    const nearbyBushes = nodes.filter((n) => n.type === 'berry_bush' && calcDistance(n.position, position) < 250).length;
    return nearbyBushes >= 2 ? 'Great spot: berries in range' : 'Find berry bushes for better Mill value';
  }

  return '';
}

interface GameHUDProps {
  gameState: GameState;
  onSpawnUnit: (unitType: number) => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  onUpgradeAge: () => void;
  onBuyGoldMineUpgrade: () => void;
  onActivateBoost: () => void;
  onClaimStarterPack: () => void;
  onClaimDailyReward: () => void;
  onClaimSpawnMissionReward: () => void;
  onClaimKillMissionReward: () => void;
  onPurchaseStoreOffer: (offerId: string) => void;
  onActivateRally: () => void;
  onActivateFortify: () => void;
  onSetBattleStance: (stance: BattleStance) => void;
  onSetLaneFocus: (focus: LaneFocus) => void;
  onApplyCommandPreset: (preset: 'hold_mid' | 'split_push' | 'all_left' | 'all_right') => void;
  onExportDiagnostics: () => void;
  onDownloadDiagnosticsHistory: () => void;
  onBuildStructure: (type: BuildingType) => void;
  onUnlockTech: () => void;
  onClaimDailyChallenge: () => void;
  onClaimWeeklyChallenge: () => void;
  onOpenRewardChest: () => void;
  onDismissTutorial: () => void;
  onSkipTutorial?: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  audioVolumePct: number;
  onAudioVolumePctChange: (value: number) => void;
  tutorialDirective?: {
    title: string;
    message: string;
    progressLabel: string;
    progressPercent: number;
    focusTarget?: 'spawn' | 'tactics' | 'rewards' | 'ageup' | 'intel';
    suggestedTab?: 'economy' | 'challenges' | 'tactics' | 'shop' | 'intel';
  } | null;
}

export function GameHUD({
  gameState,
  onSpawnUnit,
  onPause,
  onResume,
  onRestart,
  onMainMenu,
  onUpgradeAge,
  onBuyGoldMineUpgrade,
  onActivateBoost,
  onClaimStarterPack,
  onClaimDailyReward,
  onClaimSpawnMissionReward,
  onClaimKillMissionReward,
  onPurchaseStoreOffer,
  onActivateRally,
  onActivateFortify,
  onSetBattleStance,
  onSetLaneFocus,
  onApplyCommandPreset,
  onExportDiagnostics,
  onDownloadDiagnosticsHistory,
  onBuildStructure,
  onUnlockTech,
  onClaimDailyChallenge,
  onClaimWeeklyChallenge,
  onOpenRewardChest,
  onDismissTutorial,
  onSkipTutorial,
  audioEnabled,
  onToggleAudio,
  audioVolumePct,
  onAudioVolumePctChange,
  tutorialDirective,
}: GameHUDProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
  const [hudTab, setHudTab] = useState<'economy' | 'challenges' | 'tactics' | 'shop' | 'intel'>('economy');

  const age = AGES[gameState.playerAge];
  const nextAgeXP = gameState.playerAge < AGES.length - 1 ? XP_THRESHOLDS[gameState.playerAge + 1] : Infinity;
  const xpPercent = Math.min(100, (gameState.playerXP / nextAgeXP) * 100);
  const canAgeUp = canUpgradeAge(gameState, true);
  const mineUpgradeCost = getGoldMineUpgradeCost(gameState.goldMineLevel);
  const canBuyMine = canBuyGoldMineUpgrade(gameState);
  const canBoost = canActivateSpeedBoost(gameState, gameState.time);
  const boostRemaining = Math.max(0, Math.ceil(gameState.speedBoostUntil - gameState.time));
  const canStarterPack = canClaimStarterPack(gameState);
  const dailyRewardReady = canClaimDailyReward(gameState);
  const spawnMissionReady = canClaimSpawnMission(gameState);
  const killMissionReady = canClaimKillMission(gameState);
  const battlePassTier = getBattlePassTier(gameState.battlePassXP);
  const battlePassProgress = getBattlePassProgressPercent(gameState.battlePassXP);
  const offerOfDay = getOfferOfTheDay();
  const canDailyChallenge = canClaimDailyChallenge(gameState);
  const canWeeklyChallenge = canClaimWeeklyChallenge(gameState);
  const canOpenChest = canOpenRewardChest(gameState);
  const assistActive = gameState.time < gameState.adaptiveAssistUntil;
  const canRally = canActivateRally(gameState);
  const canFortify = canActivateFortify(gameState);
  const rallyCd = Math.max(0, Math.ceil(gameState.rallyCooldownUntil - gameState.time));
  const fortifyCd = Math.max(0, Math.ceil(gameState.fortifyCooldownUntil - gameState.time));

  const unitColors = ['#FF6B35', '#4CAF50', '#2196F3', '#FF9800'];
  const playerCastlePercent = (gameState.playerCastle.health / gameState.playerCastle.maxHealth) * 100;
  const enemyCastlePercent = (gameState.aiCastle.health / gameState.aiCastle.maxHealth) * 100;
  const gameMinutes = Math.floor(gameState.time / 60);
  const gameSeconds = Math.floor(gameState.time % 60).toString().padStart(2, '0');
  const isBossWave = gameState.wave > 0 && gameState.wave % 5 === 0;
  const modeTimeLeft = gameState.modeTimeLimit > 0 ? Math.max(0, Math.ceil(gameState.modeTimeLimit - gameState.time)) : 0;
  const modeLabel = getModeLabel(gameState.mode);
  const aiProfileLabel = getAIProfileLabel(gameState.aiProfile);
  const raidProgress = gameState.mode === 'raid'
    ? Math.round(((gameState.raidInitialCastleHealth - gameState.aiCastle.health) / gameState.raidInitialCastleHealth) * 100)
    : 0;
  const playerCritical = playerCastlePercent <= 30;
  const enemyCritical = enemyCastlePercent <= 30;
  const focusTarget = tutorialDirective?.focusTarget;
  const focusTab = focusTarget === 'tactics'
    ? 'tactics'
    : focusTarget === 'rewards'
      ? 'challenges'
      : focusTarget === 'intel'
        ? 'intel'
        : null;
  const shouldPulseAgeUp = focusTarget === 'ageup' && canAgeUp;
  const shouldPulseSpawnBar = focusTarget === 'spawn';
  const unlockableTech = TECH_TREE.find((node) => canUnlockTech(gameState.unlockedTechs, node, gameState.playerAge));
  const playerEcoModPct = Math.round((gameState.missionModifiers.playerGoldRateMult - 1) * 100);
  const aiEcoModPct = Math.round((gameState.missionModifiers.aiGoldRateMult - 1) * 100);
  const rewardModPct = Math.round((gameState.missionModifiers.objectiveRewardMult - 1) * 100);
  const fortressModPct = Math.round((gameState.missionModifiers.playerCastleHealthMult - 1) * 100);
  const enemyFortressModPct = Math.round((gameState.missionModifiers.aiCastleHealthMult - 1) * 100);
  const economyStructures = gameState.playerBuildings.filter((b) => b.type === 'farm' || b.type === 'mine').length;
  const remainingObjectives = gameState.objectives.filter((o) => !o.completed).length;
  const campaignRecommendedStrategy = gameState.mode === 'campaign'
    ? gameState.campaignPackId === 'frontier'
      ? economyStructures < 3
        ? 'Prioritize Farm/Mine setup, then age up safely before full push.'
        : 'Economy online. Start sustained lane pressure with mixed units.'
      : gameState.campaignPackId === 'warpath'
        ? gameState.missions.destroyEnemies < 30
          ? 'Focus tactical fights: chain Rally/Fortify and farm enemy kills.'
          : 'Kill objective stable. Transition into siege to finish castle quickly.'
        : gameState.playerCastle.health / Math.max(1, gameState.playerCastle.maxHealth) < 0.45
          ? 'Play defensive survival first, then commit to castle damage windows.'
          : 'Maintain survival tempo and commit siege when enemy frontline breaks.'
    : gameState.mode === 'endless'
      ? 'Preserve cooldowns for spike waves and scale economy every 60-90s.'
      : gameState.mode === 'raid'
        ? 'Optimize burst windows and prioritize direct castle pressure.'
        : gameState.mode === 'defense'
          ? 'Hold center lane and preserve fortress health until timer ends.'
          : 'Balance economy and lane control before committing final siege.';
  const laneAnchors = LANE_Y_RATIOS;
  const battleWidthEstimate = Math.max(1, Math.max(gameState.playerCastle.x, gameState.aiCastle.x) + 80);
  const battleHeightEstimate = Math.max(600, ...gameState.units.map((u) => u.y), gameState.playerBuildings[0]?.y ?? 0, gameState.aiBuildings[0]?.y ?? 0);
  const playerBaseHintPos = {
    x: gameState.playerCastle.x,
    y: gameState.playerBuildings[0]?.y ?? 300,
  };
  const lumberHint = getPlacementHint('lumber_camp', playerBaseHintPos, gameState.resourceNodes);
  const millHint = getPlacementHint('mill', playerBaseHintPos, gameState.resourceNodes);
  const lanePressure = [0, 0, 0];
  for (const unit of gameState.units) {
    if (unit.isDead) continue;
    const nearestLane = laneAnchors.reduce(
      (best, laneY, idx) => {
        const dist = Math.abs(unit.y - laneY * battleHeightEstimate);
        return dist < best.dist ? { idx, dist } : best;
      },
      { idx: 1, dist: Infinity }
    );
    lanePressure[nearestLane.idx] += unit.isPlayer ? 1 : -1;
  }
  const lanePressurePct = lanePressure.map((v) => Math.max(0, Math.min(100, 50 + v * 8)));
  const playerUnitDots = gameState.units.filter((u) => !u.isDead && u.isPlayer).slice(0, 28);
  const enemyUnitDots = gameState.units.filter((u) => !u.isDead && !u.isPlayer).slice(0, 28);
  const completedObjectives = gameState.objectives.filter((o) => o.completed).length;
  const objectiveCompletionPct = gameState.objectives.length > 0
    ? Math.round((completedObjectives / gameState.objectives.length) * 100)
    : 0;
  const aiPressurePct = Math.max(0, Math.min(100, Math.round((gameState.aiDirector.pressureScore + 1) * 40)));
  const skillEstimatePct = Math.max(0, Math.min(100, Math.round(gameState.aiDirector.skillEstimate * 100)));
  const economyDelta = Math.round(gameState.playerGold - gameState.aiGold);
  const killPerMin = gameState.time > 1 ? Number((gameState.kills / (gameState.time / 60)).toFixed(1)) : 0;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top Bar */}
      <div className="pointer-events-auto glass-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 m-3 rounded-2xl">
        {/* Left - Gold */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FFD700' }}>
              <Zap className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="hud-label">Gold</div>
              <div className="hud-value text-yellow-400">{Math.floor(gameState.playerGold)}</div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 rounded-lg px-3 py-1 bg-black/20">
            <div className="text-[11px] text-emerald-200">Food: {Math.floor(gameState.playerResources.food)}</div>
            <div className="text-[11px] text-amber-200">Wood: {Math.floor(gameState.playerResources.wood)}</div>
            <div className="text-[11px] text-slate-200">Stone: {Math.floor(gameState.playerResources.stone)}</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-fuchsia-500/90">
              <Gem className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="hud-label">Gems</div>
              <div className="hud-value text-fuchsia-300">{Math.floor(gameState.playerGems)}</div>
            </div>
          </div>

          {/* XP Bar */}
          <div className="w-32">
            <div className="text-xs text-gray-400 flex justify-between">
              <span className="hud-label">XP</span>
              <span>{gameState.playerXP} / {nextAgeXP === Infinity ? 'MAX' : nextAgeXP}</span>
            </div>
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${xpPercent}%`,
                  backgroundColor: age.themeColor,
                }}
              />
            </div>
          </div>

          {/* Age Display */}
          <div
            className="px-3 py-1 rounded-lg font-bold text-sm"
            style={{
              backgroundColor: age.themeColor + '40',
              border: `1px solid ${age.themeColor}`,
              color: age.themeColor,
            }}
          >
            {age.name}
          </div>

          {/* Age Up Button */}
          {gameState.playerAge < AGES.length - 1 && (
            <button
              onClick={onUpgradeAge}
              disabled={!canAgeUp}
              className="flex items-center gap-1 px-3 py-1 rounded-lg font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                backgroundColor: canAgeUp ? age.themeColor : '#666',
                color: '#fff',
                boxShadow: shouldPulseAgeUp ? `0 0 16px ${age.themeColor}` : undefined,
                animation: shouldPulseAgeUp ? 'pulse 950ms ease-in-out infinite' : undefined,
              }}
            >
              <ChevronUp className="w-4 h-4" />
              AGE UP
            </button>
          )}
        </div>

        {/* Right - Controls */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="hud-label">Match Time</div>
            <div className="text-lg font-bold text-cyan-300">{gameMinutes}:{gameSeconds}</div>
          </div>

          <div className="text-right">
            <div className="hud-label">Kills</div>
            <div className="text-lg font-bold text-white">{gameState.kills}</div>
          </div>

          <div className="text-right">
            <div className="hud-label">Wave</div>
            <div className="text-lg font-bold text-white">{gameState.wave}</div>
          </div>

          <button
            type="button"
            onClick={() => {
              void shareActions.shareVictory(gameState.mode, gameState.kills);
              analyticsDashboard.share('victory');
            }}
            className="ui-action p-2 rounded-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            title="Share"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="ui-action p-2 rounded-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <HelpCircle className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2 rounded-lg px-1 py-0.5" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <button
              type="button"
              onClick={onToggleAudio}
              className="ui-action p-2 rounded-lg shrink-0"
              style={{ backgroundColor: audioEnabled ? 'rgba(59,130,246,0.22)' : 'rgba(255,255,255,0.1)' }}
              title={audioEnabled ? 'Mute' : 'Unmute'}
            >
              {audioEnabled && audioVolumePct > 0 ? (
                <Volume2 className="w-5 h-5 text-cyan-200" />
              ) : (
                <VolumeX className="w-5 h-5 text-white/80" />
              )}
            </button>
            <div className="w-24 pt-1 pr-1">
              <Slider
                value={[audioVolumePct]}
                min={0}
                max={100}
                step={1}
                onValueChange={(v) => onAudioVolumePctChange(v[0] ?? 0)}
                className="[&_[data-slot=slider-track]]:bg-white/20 [&_[data-slot=slider-range]]:bg-cyan-400/90"
              />
            </div>
          </div>

          <button
            onClick={onPause}
            className="ui-action p-2 rounded-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <Pause className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
      {isBossWave && (
        <div
          className="pointer-events-none absolute top-[88px] left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-extrabold tracking-wider text-red-100 border border-red-300/40 bg-red-500/25"
          style={{ boxShadow: '0 0 28px rgba(239,68,68,0.45)', animation: 'pulse 1200ms ease-in-out infinite' }}
        >
          BOSS WAVE ACTIVE
        </div>
      )}
      {(gameState.modeTimeLimit > 0 || gameState.time < gameState.surgeWarningUntil) && (
        <div
          className="pointer-events-none absolute top-[118px] left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold tracking-wide text-white border border-white/30 bg-black/40"
          style={gameState.time < gameState.surgeWarningUntil ? { boxShadow: '0 0 22px rgba(255,120,120,0.45)', animation: 'pulse 900ms ease-in-out infinite' } : undefined}
        >
          {gameState.time < gameState.surgeWarningUntil
            ? 'ENEMY SURGE INCOMING'
            : `${modeLabel.toUpperCase()} TIMER: ${modeTimeLeft}s`}
        </div>
      )}
      {playerCritical && (
        <div className="pointer-events-none absolute top-[148px] left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide text-rose-100 border border-rose-300/40 bg-rose-600/25" style={{ animation: 'pulse 900ms ease-in-out infinite' }}>
          YOUR FORTRESS IS CRITICAL
        </div>
      )}
      {enemyCritical && !playerCritical && (
        <div className="pointer-events-none absolute top-[148px] left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide text-emerald-100 border border-emerald-300/40 bg-emerald-600/25" style={{ animation: 'pulse 1000ms ease-in-out infinite' }}>
          ENEMY FORTRESS BREAKING
        </div>
      )}
      {gameState.time < gameState.objectiveNoticeUntil && gameState.objectiveNotice && (
        <div className="pointer-events-none absolute top-[176px] left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-bold tracking-wide text-sky-100 border border-sky-300/40 bg-sky-600/25">
          {gameState.objectiveNotice}
        </div>
      )}

      <div className="pointer-events-auto absolute left-3 top-44 glass-panel rounded-xl p-3 w-64 space-y-2">
        <div className="grid grid-cols-5 gap-1">
          <button
            onClick={() => setHudTab('economy')}
            className="ui-action rounded-md px-1 py-1 text-[10px] font-bold"
            style={{ backgroundColor: hudTab === 'economy' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)' }}
          >
            ECO
          </button>
          <button
            onClick={() => setHudTab('challenges')}
            className="ui-action rounded-md px-1 py-1 text-[10px] font-bold"
            style={{
              backgroundColor: hudTab === 'challenges' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)',
              boxShadow: focusTab === 'challenges' ? '0 0 16px rgba(125,211,252,0.55)' : undefined,
              animation: focusTab === 'challenges' ? 'pulse 900ms ease-in-out infinite' : undefined,
            }}
          >
            MISS
          </button>
          <button
            onClick={() => setHudTab('tactics')}
            className="ui-action rounded-md px-1 py-1 text-[10px] font-bold"
            style={{
              backgroundColor: hudTab === 'tactics' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)',
              boxShadow: focusTab === 'tactics' ? '0 0 16px rgba(125,211,252,0.55)' : undefined,
              animation: focusTab === 'tactics' ? 'pulse 900ms ease-in-out infinite' : undefined,
            }}
          >
            TAC
          </button>
          <button
            onClick={() => setHudTab('shop')}
            className="ui-action rounded-md px-1 py-1 text-[10px] font-bold"
            style={{ backgroundColor: hudTab === 'shop' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)' }}
          >
            SHOP
          </button>
          <button
            onClick={() => setHudTab('intel')}
            className="ui-action rounded-md px-1 py-1 text-[10px] font-bold"
            style={{
              backgroundColor: hudTab === 'intel' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)',
              boxShadow: focusTab === 'intel' ? '0 0 16px rgba(125,211,252,0.55)' : undefined,
              animation: focusTab === 'intel' ? 'pulse 900ms ease-in-out infinite' : undefined,
            }}
          >
            INTEL
          </button>
        </div>
        {tutorialDirective && (
          <div className="rounded-lg border border-sky-300/25 bg-sky-500/10 p-2 space-y-1">
            <div className="text-[11px] font-bold text-sky-200">{tutorialDirective.title}</div>
            <div className="text-[10px] text-sky-100/90">
              {tutorialDirective.message}
            </div>
            <div className="text-[10px] text-sky-100/80">{tutorialDirective.progressLabel}</div>
            <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
              <div className="h-full bg-sky-300" style={{ width: `${tutorialDirective.progressPercent}%` }} />
            </div>
            {tutorialDirective.suggestedTab && tutorialDirective.suggestedTab !== hudTab && (
              <button
                onClick={() => setHudTab(tutorialDirective.suggestedTab!)}
                className="ui-action w-full rounded-md px-2 py-1 text-[10px] font-semibold"
                style={{ backgroundColor: 'rgba(186,230,253,0.2)', border: '1px solid rgba(186,230,253,0.45)' }}
              >
                Go to {tutorialDirective.suggestedTab.toUpperCase()} tab
              </button>
            )}
            <div className="flex gap-1">
              {remoteGameConfig.isTutorialSkipAvailable() && onSkipTutorial && (
                <button
                  type="button"
                  onClick={onSkipTutorial}
                  className="flex-1 rounded-md px-2 py-1 text-[10px] font-semibold border border-white/25"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                >
                  Skip tutorial
                </button>
              )}
              <button
                type="button"
                onClick={onDismissTutorial}
                className="flex-1 rounded-md px-2 py-1 text-[10px] font-semibold"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
              >
                Hide
              </button>
            </div>
          </div>
        )}
        {assistActive && (
          <div className="rounded-lg border border-emerald-300/25 bg-emerald-500/10 p-2">
            <div className="text-[11px] font-bold text-emerald-200">COMEBACK ASSIST ACTIVE</div>
            <div className="text-[10px] text-emerald-100/90">
              Temporary combat boost: {Math.ceil(gameState.adaptiveAssistUntil - gameState.time)}s
            </div>
          </div>
        )}
        {hudTab === 'economy' && (
          <>
            <div className="text-xs font-bold tracking-widest text-white/70">ECONOMY BOOSTERS</div>
            <button
              onClick={() => onBuildStructure('farm')}
              className="ui-action w-full text-left px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: 'rgba(16,185,129,0.16)', border: '1px solid rgba(16,185,129,0.35)' }}
            >
              Build Farm (Food)
            </button>
            <button
              onClick={() => onBuildStructure('mine')}
              className="ui-action w-full text-left px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: 'rgba(148,163,184,0.16)', border: '1px solid rgba(148,163,184,0.35)' }}
            >
              Build Mine (Gold/Stone)
            </button>
            <button
              onClick={() => onBuildStructure('barracks')}
              className="ui-action w-full text-left px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: 'rgba(239,68,68,0.16)', border: '1px solid rgba(239,68,68,0.35)' }}
            >
              Build Barracks
            </button>
            <button
              onClick={() => onBuildStructure('lumber_camp')}
              className="ui-action w-full text-left px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: 'rgba(20,83,45,0.24)', border: '1px solid rgba(74,222,128,0.35)' }}
            >
              Build Lumber Camp (Wood Bonus)
            </button>
            <div className="text-[10px] text-emerald-100/80">{lumberHint}</div>
            <button
              onClick={() => onBuildStructure('mill')}
              className="ui-action w-full text-left px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: 'rgba(180,83,9,0.22)', border: '1px solid rgba(251,191,36,0.35)' }}
            >
              Build Mill (Food Bonus)
            </button>
            <div className="text-[10px] text-amber-100/80">{millHint}</div>
            <button
              onClick={onUnlockTech}
              disabled={!unlockableTech}
              className="ui-action w-full text-left px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ backgroundColor: 'rgba(56,189,248,0.16)', border: '1px solid rgba(56,189,248,0.35)' }}
            >
              {unlockableTech ? `Unlock Tech: ${unlockableTech.name}` : 'No Tech Available'}
            </button>
            <button
              onClick={onBuyGoldMineUpgrade}
              disabled={!canBuyMine}
              className="ui-action w-full text-left px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ backgroundColor: 'rgba(76,175,80,0.2)', border: '1px solid rgba(76,175,80,0.35)' }}
            >
              Mine Lvl {gameState.goldMineLevel + 1} ({mineUpgradeCost} Gems)
            </button>
            <button
              onClick={onActivateBoost}
              disabled={!canBoost}
              className="ui-action w-full text-left px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 flex items-center justify-between"
              style={{ backgroundColor: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.35)' }}
            >
              <span>2x Gold Boost (5m)</span>
              <Rocket className="w-3 h-3" />
            </button>
            {boostRemaining > 0 && (
              <div className="text-[11px] text-cyan-200">Boost active: {boostRemaining}s</div>
            )}
            <button
              onClick={onClaimStarterPack}
              disabled={!canStarterPack}
              className="ui-action w-full text-left px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ backgroundColor: 'rgba(217,119,6,0.22)', border: '1px solid rgba(217,119,6,0.45)' }}
            >
              Claim Starter Pack (one-time)
            </button>
            <button
              onClick={onClaimDailyReward}
              disabled={!dailyRewardReady}
              className="ui-action w-full text-left px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ backgroundColor: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)' }}
            >
              Daily Reward (+100 Gems + 300 Gold)
            </button>
          </>
        )}

        {hudTab === 'challenges' && (
          <>
            <div className="text-[11px] text-white/70">
              Missions: Spawn {gameState.missions.spawnUnits}/40 | Kills {gameState.missions.destroyEnemies}/30
            </div>
            <button
              onClick={onClaimSpawnMissionReward}
              disabled={!spawnMissionReady}
              className="ui-action w-full text-left px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ backgroundColor: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.45)' }}
            >
              Claim Spawn Mission Reward
            </button>
            <button
              onClick={onClaimKillMissionReward}
              disabled={!killMissionReady}
              className="ui-action w-full text-left px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ backgroundColor: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.45)' }}
            >
              Claim Kill Mission Reward
            </button>
            <div className="mt-1 rounded-lg border border-white/15 bg-white/5 p-2">
              <div className="flex items-center justify-between text-[11px] text-white/80 mb-1">
                <span>Battle Pass Tier {battlePassTier}</span>
                <span>{Math.floor(battlePassProgress)}%</span>
              </div>
              <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400" style={{ width: `${battlePassProgress}%` }} />
              </div>
            </div>
            <div className="mt-2 rounded-lg border border-lime-300/20 bg-lime-500/5 p-2 space-y-1">
              <div className="text-[11px] font-bold text-lime-200">LIVE CHALLENGES</div>
              <div className="text-[10px] text-lime-100/80">
                Daily: {gameState.kills}/{gameState.dailyChallenge.targetKills} Kills, {gameState.missions.spawnUnits}/{gameState.dailyChallenge.targetSpawns} Spawns
              </div>
              <button
                onClick={onClaimDailyChallenge}
                disabled={!canDailyChallenge}
                className="ui-action w-full flex items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
              >
                <span>Claim Daily</span>
                <span>{gameState.dailyChallenge.rewardGems} Gems</span>
              </button>
              <div className="text-[10px] text-lime-100/80">
                Weekly: {gameState.missions.destroyEnemies}/{gameState.weeklyChallenge.targetKills} Kills
              </div>
              <button
                onClick={onClaimWeeklyChallenge}
                disabled={!canWeeklyChallenge}
                className="ui-action w-full flex items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
              >
                <span>Claim Weekly</span>
                <span>{gameState.weeklyChallenge.rewardGems} Gems</span>
              </button>
            </div>
          </>
        )}

        {hudTab === 'tactics' && (
          <>
            <div className="mt-2 rounded-lg border border-cyan-300/20 bg-cyan-500/5 p-2 space-y-1">
              <div className="text-[11px] font-bold text-cyan-200">TACTICS</div>
              <button
                onClick={onActivateRally}
                disabled={!canRally}
                className="ui-action w-full flex items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
              >
                <span>Rally (10s buff)</span>
                <span>{canRally ? 'Ready' : `${rallyCd}s`}</span>
              </button>
              <button
                onClick={onActivateFortify}
                disabled={!canFortify}
                className="ui-action w-full flex items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
              >
                <span>Fortify (+castle/+gold)</span>
                <span>{canFortify ? 'Ready' : `${fortifyCd}s`}</span>
              </button>
              <div className="mt-1 text-[10px] text-cyan-100/75">Formation Stance</div>
              <div className="grid grid-cols-3 gap-1">
                {(['aggressive', 'balanced', 'defensive'] as const).map((stance) => (
                  <button
                    key={stance}
                    onClick={() => onSetBattleStance(stance)}
                    className="ui-action rounded-md px-1 py-1 text-[10px] font-semibold"
                    style={{ backgroundColor: gameState.playerBattleStance === stance ? 'rgba(34,197,94,0.28)' : 'rgba(255,255,255,0.08)' }}
                  >
                    {stance.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[10px] text-cyan-100/75">Lane Focus</div>
              <div className="grid grid-cols-4 gap-1">
                {(['auto', 'left', 'center', 'right'] as const).map((focus) => (
                  <button
                    key={focus}
                    onClick={() => onSetLaneFocus(focus)}
                    className="ui-action rounded-md px-1 py-1 text-[10px] font-semibold"
                    style={{ backgroundColor: gameState.playerLaneFocus === focus ? 'rgba(56,189,248,0.28)' : 'rgba(255,255,255,0.08)' }}
                  >
                    {focus.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-cyan-100/75">Command Matrix</div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => onApplyCommandPreset('hold_mid')}
                  className="ui-action rounded-md px-2 py-1 text-[10px] font-semibold"
                  style={{ backgroundColor: 'rgba(34,197,94,0.18)' }}
                >
                  Hold Mid
                </button>
                <button
                  onClick={() => onApplyCommandPreset('split_push')}
                  className="ui-action rounded-md px-2 py-1 text-[10px] font-semibold"
                  style={{ backgroundColor: 'rgba(59,130,246,0.18)' }}
                >
                  Split Push
                </button>
                <button
                  onClick={() => onApplyCommandPreset('all_left')}
                  className="ui-action rounded-md px-2 py-1 text-[10px] font-semibold"
                  style={{ backgroundColor: 'rgba(249,115,22,0.18)' }}
                >
                  All Left
                </button>
                <button
                  onClick={() => onApplyCommandPreset('all_right')}
                  className="ui-action rounded-md px-2 py-1 text-[10px] font-semibold"
                  style={{ backgroundColor: 'rgba(217,70,239,0.18)' }}
                >
                  All Right
                </button>
              </div>
            </div>
          </>
        )}

        {hudTab === 'shop' && (
          <>
            <div className="mt-2 rounded-lg border border-amber-300/20 bg-amber-500/5 p-2 space-y-1">
              <div className="text-[11px] font-bold text-amber-200">LIVE SHOP</div>
              <div className="text-[10px] text-amber-100/80">Offer of day: {offerOfDay.title} (+bonus loot)</div>
              {STORE_OFFERS.map((offer) => (
                <button
                  key={offer.id}
                  onClick={() => onPurchaseStoreOffer(offer.id)}
                  disabled={!canPurchaseStoreOffer(gameState, offer.id)}
                  className="ui-action w-full flex items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                >
                  <span>{offer.title}</span>
                  <span>${offer.usdPrice.toFixed(2)}</span>
                </button>
              ))}
              <div className="text-[10px] text-amber-100/70">LTV: ${gameState.lifetimeSpendUsd.toFixed(2)}</div>
              <div className="text-[10px] text-amber-100/70">Season Tokens: {gameState.seasonalTokens}</div>
            </div>
          </>
        )}

        {hudTab === 'intel' && (
          <>
            <div className="mt-2 rounded-lg border border-violet-300/20 bg-violet-500/5 p-2 space-y-1">
              <div className="text-[11px] font-bold text-violet-200">STREAK + CHEST</div>
              <div className="text-[10px] text-violet-100/80">
                Win streak: {gameState.winStreak} | Loss streak: {gameState.lossStreak}
              </div>
              <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                <div className="h-full bg-violet-400" style={{ width: `${Math.max(0, Math.min(100, gameState.rewardChestProgress))}%` }} />
              </div>
              <div className="text-[10px] text-violet-100/80">Chests ready: {gameState.unclaimedChests}</div>
              <button
                onClick={onOpenRewardChest}
                disabled={!canOpenChest}
                className="ui-action w-full flex items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
              >
                <span>Open Reward Chest</span>
                <span>{canOpenChest ? 'Open' : 'Locked'}</span>
              </button>
            </div>
            <div className="mt-2 rounded-lg border border-sky-300/20 bg-sky-500/5 p-2 space-y-1">
              <div className="text-[11px] font-bold text-sky-200">ONBOARDING QUEST</div>
              <div className="text-[10px] text-sky-100/80">Spawn unit: {gameState.onboardingSteps.spawnedUnit ? 'Done' : 'Pending'}</div>
              <div className="text-[10px] text-sky-100/80">Use tactic: {gameState.onboardingSteps.usedTactic ? 'Done' : 'Pending'}</div>
              <div className="text-[10px] text-sky-100/80">Claim reward: {gameState.onboardingSteps.claimedReward ? 'Done' : 'Pending'}</div>
            </div>
            <div className="mt-2 rounded-lg border border-white/20 bg-white/5 p-2 space-y-1">
              <div className="text-[11px] font-bold text-white/90">MODE OBJECTIVE</div>
              <div className="text-[10px] text-blue-200/90">{gameState.missionDescriptor}</div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                <span className="rounded-full border border-emerald-300/35 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-100">
                  You Eco {playerEcoModPct >= 0 ? '+' : ''}{playerEcoModPct}%
                </span>
                <span className="rounded-full border border-rose-300/35 bg-rose-500/10 px-1.5 py-0.5 text-[9px] text-rose-100">
                  AI Eco {aiEcoModPct >= 0 ? '+' : ''}{aiEcoModPct}%
                </span>
                <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-100">
                  Objective Reward {rewardModPct >= 0 ? '+' : ''}{rewardModPct}%
                </span>
                <span className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] text-cyan-100">
                  Fortress {fortressModPct >= 0 ? '+' : ''}{fortressModPct}%
                </span>
                <span className="rounded-full border border-fuchsia-300/35 bg-fuchsia-500/10 px-1.5 py-0.5 text-[9px] text-fuchsia-100">
                  Enemy Fortress {enemyFortressModPct >= 0 ? '+' : ''}{enemyFortressModPct}%
                </span>
              </div>
              <div className="text-[10px] text-orange-200/90">Enemy Profile: {aiProfileLabel}</div>
              <div className="text-[10px] text-orange-100/80">{getAIProfileDescription(gameState.aiProfile)}</div>
              <div className="text-[10px] text-cyan-100/90">
                AI Intent: {getAIMacroPlanLabel(gameState.aiDirector.macroPlan)} | {getAIEconomyModeLabel(gameState.aiDirector.economyMode)}
              </div>
              <div className="text-[10px] text-cyan-100/75">
                Planner: {gameState.aiDirector.plannerNotes}
              </div>
              <div className="text-[10px] text-cyan-100/70">
                Adaptive Skill: {Math.round(gameState.aiDirector.skillEstimate * 100)}%
              </div>
              {gameState.mode === 'campaign' && <div className="text-[10px] text-white/75">Complete mission objectives to advance the campaign chain.</div>}
              {gameState.mode === 'assault' && <div className="text-[10px] text-white/75">Destroy enemy castle before yours falls.</div>}
              {gameState.mode === 'defense' && <div className="text-[10px] text-white/75">Survive until timer ends. Keep your fortress alive.</div>}
              {gameState.mode === 'raid' && (
                <div className="text-[10px] text-white/75">
                  Destroy castle before time ends. Raid progress: {Math.max(0, raidProgress)}%
                </div>
              )}
              {gameState.mode === 'endless' && (
                <div className="text-[10px] text-white/75">
                  Endless Siege active: survive as long as possible against scaling waves.
                </div>
              )}
              <div className="mt-1 text-[10px] text-sky-100/90">Objectives:</div>
              {gameState.objectives.map((objective) => (
                <div key={objective.id} className="text-[10px] text-white/75">
                  {objective.completed ? '✓' : '•'} {objective.label} ({Math.min(objective.progress, objective.target)}/{objective.target})
                </div>
              ))}
              <div className="mt-1 text-[10px] text-cyan-100/80">
                Buildings: Farm {gameState.playerBuildings.filter((b) => b.type === 'farm').length} | Mine {gameState.playerBuildings.filter((b) => b.type === 'mine').length} | Barracks {gameState.playerBuildings.filter((b) => b.type === 'barracks').length}
              </div>
              <div className="text-[10px] text-cyan-100/80">
                Techs unlocked: {gameState.unlockedTechs.length}
              </div>
              <div className="text-[10px] text-cyan-100/80">
                Campaign Mission: #{gameState.campaignMissionIndex}
              </div>
              {gameState.mode === 'campaign' && (
                <div className="mt-1 rounded-md border border-indigo-300/20 bg-indigo-500/10 p-2 space-y-1">
                  <div className="text-[10px] font-semibold text-indigo-100">Campaign Pack Preview</div>
                  <div className="text-[10px] text-indigo-100/80">Current: {gameState.campaignPackTitle}</div>
                  <div className="text-[10px] text-indigo-100/80">Next: {gameState.nextCampaignPackTitle}</div>
                  <div className="text-[10px] text-indigo-100/70">{gameState.campaignPackHint}</div>
                </div>
              )}
              {gameState.mode === 'campaign' && (
                <div className="mt-1 rounded-md border border-fuchsia-300/20 bg-fuchsia-500/10 p-2 space-y-1">
                  <div className="text-[10px] font-semibold text-fuchsia-100">Mission Event</div>
                  <div className="text-[10px] text-fuchsia-100/85">{gameState.campaignEventTitle}</div>
                  <div className="text-[10px] text-fuchsia-100/70">{gameState.campaignEventEffect}</div>
                </div>
              )}
              <div className="mt-1 rounded-md border border-emerald-300/20 bg-emerald-500/10 p-2 space-y-1">
                <div className="text-[10px] font-semibold text-emerald-100">Recommended Strategy</div>
                <div className="text-[10px] text-emerald-100/80">{campaignRecommendedStrategy}</div>
                <div className="text-[10px] text-emerald-100/70">
                  Remaining objectives: {remainingObjectives} | Econ structures: {economyStructures}
                </div>
              </div>
              <div className="mt-1 rounded-md border border-amber-300/20 bg-amber-500/10 p-2 space-y-1">
                <div className="text-[10px] font-semibold text-amber-100">Live Ops Diagnostics</div>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-amber-100/85">
                  <span>AI Pressure: {aiPressurePct}%</span>
                  <span>AI Skill: {skillEstimatePct}%</span>
                  <span>Obj Complete: {objectiveCompletionPct}%</span>
                  <span>Kills/min: {killPerMin}</span>
                </div>
                <div className="text-[10px] text-amber-100/75">
                  Economy Delta: {economyDelta >= 0 ? '+' : ''}{economyDelta} gold
                </div>
                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-300/90" style={{ width: `${Math.max(0, Math.min(100, objectiveCompletionPct))}%` }} />
                </div>
                <button
                  onClick={onExportDiagnostics}
                  className="ui-action w-full rounded-md px-2 py-1 text-[10px] font-semibold"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                >
                  Export Diagnostics JSON
                </button>
                <button
                  onClick={onDownloadDiagnosticsHistory}
                  className="ui-action w-full rounded-md px-2 py-1 text-[10px] font-semibold"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                >
                  Download Diagnostics History
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="pointer-events-none absolute top-24 left-3 right-3 flex justify-between gap-3">
        <div className="glass-panel rounded-xl p-2 w-44">
          <div className="hud-label mb-1">Your Fortress</div>
          <div className="h-2 rounded-full bg-black/40 overflow-hidden">
            <div className="h-full bg-emerald-400" style={{ width: `${Math.max(0, playerCastlePercent)}%` }} />
          </div>
          <div className="text-xs mt-1 text-emerald-200">{Math.ceil(gameState.playerCastle.health)} / {gameState.playerCastle.maxHealth}</div>
        </div>
        <div className="glass-panel rounded-xl p-2 w-44 text-right">
          <div className="hud-label mb-1">Enemy Fortress</div>
          <div className="h-2 rounded-full bg-black/40 overflow-hidden">
            <div className="h-full bg-rose-400 ml-auto" style={{ width: `${Math.max(0, enemyCastlePercent)}%` }} />
          </div>
          <div className="text-xs mt-1 text-rose-200">{Math.ceil(gameState.aiCastle.health)} / {gameState.aiCastle.maxHealth}</div>
        </div>
      </div>
      <div className="pointer-events-none absolute top-44 right-3 w-52 glass-panel rounded-xl p-2 space-y-2">
        <div className="text-[10px] font-bold text-white/85 tracking-wide">TACTICAL MINIMAP</div>
        <div className="relative h-20 rounded-lg border border-white/15 bg-black/35 overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-[10%] bg-emerald-500/20 border-r border-emerald-300/25" />
          <div className="absolute inset-y-0 right-0 w-[10%] bg-rose-500/20 border-l border-rose-300/25" />
          {laneAnchors.map((lane, idx) => (
            <div
              key={`lane-line-${idx}`}
              className="absolute left-0 right-0 border-t border-dashed border-white/15"
              style={{ top: `${lane * 100}%` }}
            />
          ))}
          {playerUnitDots.map((u) => (
            <span
              key={`p-${u.id}`}
              className="absolute w-1.5 h-1.5 rounded-full bg-emerald-300"
              style={{ left: `${(u.x / battleWidthEstimate) * 100}%`, top: `${(u.y / battleHeightEstimate) * 100}%` }}
            />
          ))}
          {enemyUnitDots.map((u) => (
            <span
              key={`e-${u.id}`}
              className="absolute w-1.5 h-1.5 rounded-full bg-rose-300"
              style={{ left: `${(u.x / battleWidthEstimate) * 100}%`, top: `${(u.y / battleHeightEstimate) * 100}%` }}
            />
          ))}
        </div>
        <div className="text-[10px] font-bold text-white/80">Lane Pressure</div>
        {(['LEFT', 'CENTER', 'RIGHT'] as const).map((label, idx) => (
          <div key={label} className="space-y-0.5">
            <div className="flex items-center justify-between text-[9px] text-white/70">
              <span>{label}</span>
              <span>{lanePressure[idx] > 0 ? `+${lanePressure[idx]}` : lanePressure[idx]}</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${lanePressurePct[idx]}%`,
                  backgroundColor: lanePressure[idx] >= 0 ? 'rgba(74,222,128,0.9)' : 'rgba(251,113,133,0.9)',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Help Overlay */}
      {showHelp && (
        <div className="pointer-events-auto absolute top-16 left-4 right-4 max-w-lg mx-auto p-6 rounded-xl glass-panel">
          <h3 className="text-xl font-bold text-white mb-3">How to Play</h3>
          <ul className="text-sm text-gray-300 space-y-2">
            <li className="flex items-start gap-2"><span className="text-yellow-400 font-bold">GOLD</span> Generates automatically — use it to spawn units!</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 font-bold">UNITS</span> Click buttons (1-4) or use hotkeys to spawn warriors</li>
            <li className="flex items-start gap-2"><span className="text-green-400 font-bold">COMBAT</span> Units auto-march and attack enemies in range</li>
            <li className="flex items-start gap-2"><span className="text-purple-400 font-bold">XP</span> Earn from kills — unlock new Ages with stronger units!</li>
            <li className="flex items-start gap-2"><span className="text-red-400 font-bold">WIN</span> Destroy the enemy castle before yours falls!</li>
            <li className="flex items-start gap-2"><span className="text-orange-400 font-bold">COUNTER</span> Melee {'>'} Tank {'>'} Ranged {'>'} Melee</li>
          </ul>
          <div className="flex gap-2 mt-4">
            <div className="flex-1 p-2 rounded text-center text-xs" style={{ backgroundColor: 'rgba(255,107,53,0.2)' }}>
              <div className="font-bold text-orange-400">1</div>
              <div className="text-gray-400">Melee</div>
            </div>
            <div className="flex-1 p-2 rounded text-center text-xs" style={{ backgroundColor: 'rgba(76,175,80,0.2)' }}>
              <div className="font-bold text-green-400">2</div>
              <div className="text-gray-400">Ranged</div>
            </div>
            <div className="flex-1 p-2 rounded text-center text-xs" style={{ backgroundColor: 'rgba(33,150,243,0.2)' }}>
              <div className="font-bold text-blue-400">3</div>
              <div className="text-gray-400">Tank</div>
            </div>
            <div className="flex-1 p-2 rounded text-center text-xs" style={{ backgroundColor: 'rgba(255,152,0,0.2)' }}>
              <div className="font-bold text-yellow-400">4</div>
              <div className="text-gray-400">Siege</div>
            </div>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-4 w-full py-2 rounded-lg font-bold text-white transition-all hover:scale-105"
            style={{ backgroundColor: age.themeColor }}
          >
            GOT IT!
          </button>
        </div>
      )}

      {/* Pause Menu */}
      {gameState.screen === 'paused' && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="p-8 rounded-2xl text-center" style={{ backgroundColor: 'rgba(20,20,30,0.95)', border: `2px solid ${age.themeColor}` }}>
            <h2 className="text-4xl font-black text-white mb-6">PAUSED</h2>
            <div className="flex flex-col gap-3 w-56">
              <button
                onClick={onResume}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all hover:scale-105"
                style={{ backgroundColor: '#4CAF50' }}
              >
                <Play className="w-5 h-5" />
                RESUME
              </button>
              <button
                onClick={onRestart}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all hover:scale-105"
                style={{ backgroundColor: '#FF9800' }}
              >
                <RotateCcw className="w-5 h-5" />
                RESTART
              </button>
              <button
                onClick={onMainMenu}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all hover:scale-105"
                style={{ backgroundColor: '#666' }}
              >
                <Home className="w-5 h-5" />
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar - Unit Spawn Buttons */}
      <div
        className="pointer-events-auto glass-panel absolute bottom-3 left-3 right-3 px-4 py-3 rounded-2xl"
        style={{
          boxShadow: shouldPulseSpawnBar ? '0 0 18px rgba(125,211,252,0.45)' : undefined,
          animation: shouldPulseSpawnBar ? 'pulse 1000ms ease-in-out infinite' : undefined,
        }}
      >
        <div className="flex items-center justify-center gap-3 max-w-2xl mx-auto">
          {age.units.map((unit, i) => {
            const canAfford = gameState.playerGold >= unit.cost;
            const isSelected = selectedUnit === i;

            return (
              <button
                key={i}
                onClick={() => {
                  onSpawnUnit(i);
                  setSelectedUnit(i);
                  setTimeout(() => setSelectedUnit(null), 200);
                }}
                disabled={!canAfford}
                className="ui-action group relative flex-1 flex flex-col items-center p-2 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: isSelected ? unitColors[i] + '60' : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${canAfford ? unitColors[i] : '#666'}`,
                  boxShadow: canAfford
                    ? `${isSelected ? '0 0 16px' : '0 0 10px'} ${unitColors[i]}55`
                    : 'none',
                }}
              >
                {/* Hotkey number */}
                <div
                  className="absolute -top-2 -left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: unitColors[i] }}
                >
                  {i + 1}
                </div>

                <img
                  src={unit.image}
                  alt={unit.name}
                  className="w-12 h-12 object-contain mb-1"
                />

                <div className="text-xs font-bold text-white">{unit.name}</div>

                <div className="flex items-center gap-1 mt-1">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs text-yellow-400 font-bold">{unit.cost}</span>
                </div>

                {/* Stats tooltip on hover */}
                <div
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 p-2 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
                >
                  <div className="text-gray-400">DMG: <span className="text-white">{unit.damage}</span></div>
                  <div className="text-gray-400">HP: <span className="text-white">{unit.health}</span></div>
                  <div className="text-gray-400">SPD: <span className="text-white">{unit.speed}</span></div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
