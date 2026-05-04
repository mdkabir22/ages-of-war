import { useEffect, useState } from 'react';
import { useGameStore } from '../core/state';
import { AGES, AGE_ORDER } from '../core/types';
import { getUnitTrainingSpec } from '../core/state';

export function HUD({ onPause }: { onPause: () => void }) {
  const state = useGameStore();
  // First-run controls hint: visible for ~9s on game start so the player
  // knows tap = select, tap-empty = move, long-press = deselect.
  const [showControlsHint, setShowControlsHint] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setShowControlsHint(false), 9000);
    return () => window.clearTimeout(t);
  }, []);

  const currentAge = state.currentAge;
  const nextAgeIndex = AGE_ORDER.indexOf(currentAge) + 1;
  const nextAge = AGE_ORDER[nextAgeIndex];
  const nextAgeCost = nextAge ? AGES[nextAge].cost : null;
  const ageTier = AGE_ORDER.indexOf(currentAge);

  const elapsedMin = Math.floor(state.missionElapsedSec / 60);
  const elapsedSec = state.missionElapsedSec % 60;

  const playerUnits = state.units.filter((u) => u.owner === 'player');
  const enemyUnits = state.units.filter((u) => u.owner === 'enemy');
  const playerUnitCount = playerUnits.length;
  const enemyUnitCount = enemyUnits.length;
  const combatPlayerUnits = playerUnits.filter((u) => u.type !== 'villager').length;
  const movingPlayerUnits = playerUnits.filter((u) => !!u.target).length;

  const populationUsed = playerUnitCount;
  const populationCap = 10 + state.buildings.filter((b) => b.owner === 'player' && b.type === 'house').length * 5;

  const selectedBuilding = state.buildings.find((b) => state.selectedIds.includes(b.id) && b.owner === 'player');
  const selectedQueue = state.productionQueues.find((q) => q.buildingId === selectedBuilding?.id);
  const queueHead = selectedQueue?.queue[0];

  // Selected player villagers — used by the action panel to show jobs and
  // expose a "Stop work" button so the player can rotate workers manually.
  const selectedPlayerVillagers = state.units.filter(
    (u) => state.selectedIds.includes(u.id) && u.owner === 'player' && u.type === 'villager'
  );
  const villagerJobsSummary = (() => {
    if (selectedPlayerVillagers.length === 0) return null;
    const counts: Record<string, number> = { wood: 0, food: 0, stone: 0, gold: 0, idle: 0 };
    for (const v of selectedPlayerVillagers) {
      counts[v.job ?? 'idle'] = (counts[v.job ?? 'idle'] ?? 0) + 1;
    }
    return counts;
  })();

  const canAffordAgeUp = nextAgeCost
    ? Object.entries(nextAgeCost).every(([res, amount]) => state.resources[res as keyof typeof state.resources] >= amount)
    : false;

  const resources = state.resources;

  // Training specs for all unit types
  const villagerSpec = getUnitTrainingSpec(state.currentAge, 'villager');
  const warriorSpec = getUnitTrainingSpec(state.currentAge, 'warrior');
  const archerSpec = getUnitTrainingSpec(state.currentAge, 'archer');
  const spearmanSpec = getUnitTrainingSpec(state.currentAge, 'spearman');
  const cavalrySpec = getUnitTrainingSpec(state.currentAge, 'cavalry');

  const canTrainVillager = state.resources.food >= villagerSpec.foodCost && populationUsed < populationCap;
  const canTrainWarrior = state.resources.food >= warriorSpec.foodCost && state.resources.gold >= warriorSpec.goldCost && populationUsed < populationCap;
  const canTrainArcher = state.resources.food >= archerSpec.foodCost && state.resources.gold >= archerSpec.goldCost && populationUsed < populationCap;
  const canTrainSpearman = state.resources.food >= spearmanSpec.foodCost && state.resources.gold >= spearmanSpec.goldCost && populationUsed < populationCap;
  const canTrainCavalry = state.resources.food >= cavalrySpec.foodCost && state.resources.gold >= cavalrySpec.goldCost && populationUsed < populationCap;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-auto absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-xl bg-black/80 px-4 py-2 text-white border border-white/10">
        <div className="text-yellow-400 font-bold">{AGES[currentAge].name}</div>
        <div className="text-white/60 text-sm">
          {elapsedMin}:{String(elapsedSec).padStart(2, '0')}
        </div>
        {nextAge ? (
          <button
            onClick={() => useGameStore.getState().advanceAge()}
            disabled={!canAffordAgeUp}
            className={`rounded px-3 py-1 text-xs font-bold border ${
              canAffordAgeUp
                ? 'bg-yellow-600 hover:bg-yellow-500 border-yellow-400 text-white'
                : 'bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed'
            }`}
            title={`Cost: F${nextAgeCost?.food ?? 0} W${nextAgeCost?.wood ?? 0} S${nextAgeCost?.stone ?? 0} G${nextAgeCost?.gold ?? 0}`}
          >
            Age Up {'>'} {AGES[nextAge].name}
          </button>
        ) : (
          <span className="text-xs text-gray-400">Max Age</span>
        )}
        <button
          onClick={onPause}
          className="rounded bg-white/10 hover:bg-white/20 px-2 py-1 text-xs border border-white/20"
        >
          Pause
        </button>
      </div>

      {/* On narrow screens the top-center age bar overlaps anything at top-2,
          so push the mission card down below it; on >=sm widths it sits at top-2. */}
      <div className="absolute top-16 sm:top-2 left-2 max-w-[60vw] sm:max-w-xs rounded-xl bg-black/80 p-2.5 sm:p-3 text-white border border-white/10">
        <div className="text-yellow-400 font-bold text-xs sm:text-sm leading-tight truncate">{state.mission.name}</div>
        <div className="text-white/70 text-[10px] sm:text-xs mt-1 capitalize">{state.mission.type} mission</div>
        <div
          className={`text-xs mt-1 font-bold ${
            state.missionStatus === 'active'
              ? 'text-green-400'
              : state.missionStatus === 'success'
                ? 'text-emerald-400'
                : 'text-red-400'
          }`}
        >
          * {state.missionStatus.toUpperCase()}
        </div>
        {state.missionStatus === 'active' && state.mission.objectives[0] && (
          <div className="mt-2 text-xs text-white/80 bg-white/5 rounded px-2 py-1">
            {state.mission.objectives[0].label}
          </div>
        )}
      </div>

      {showControlsHint && (
        <div
          className="pointer-events-auto absolute bottom-32 sm:bottom-24 left-1/2 -translate-x-1/2 max-w-[92vw] rounded-lg bg-black/85 px-3 py-2 text-[11px] sm:text-xs text-white/95 border border-white/20"
          role="status"
        >
          <span className="text-yellow-400 font-bold">Controls:</span>
          <span>Tap unit to select</span>
          <span className="text-white/40">|</span>
          <span>Tap ground to move</span>
          <span className="text-white/40">|</span>
          <span>Long-press to deselect</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setShowControlsHint(false)}
            className="ml-1 px-1.5 text-white/60 hover:text-white"
          >
            x
          </button>
        </div>
      )}

      <div className="absolute top-2 right-2 rounded-lg bg-black/70 px-3 py-2 text-[10px] text-white/60 font-mono border border-white/10">
        <div>P:{playerUnitCount} E:{enemyUnitCount}</div>
        <div>Army:{combatPlayerUnits} Move:{movingPlayerUnits}</div>
        <div>Selected:{state.selectedIds.length}</div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-xl bg-black/85 px-5 py-3 text-white border border-yellow-500/30 pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <span>F</span>
          <span className="text-yellow-300 font-bold text-lg">{Math.floor(resources.food)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>W</span>
          <span className="text-amber-400 font-bold text-lg">{Math.floor(resources.wood)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>S</span>
          <span className="text-gray-300 font-bold text-lg">{Math.floor(resources.stone)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>G</span>
          <span className="text-yellow-400 font-bold text-lg">{Math.floor(resources.gold)}</span>
        </div>
        <div className="border-l border-white/20 pl-3 flex items-center gap-1.5">
          <span>P</span>
          <span className={`font-bold text-lg ${populationUsed >= populationCap ? 'text-red-400' : 'text-white'}`}>
            {populationUsed}/{populationCap}
          </span>
        </div>
      </div>

      {selectedPlayerVillagers.length > 0 && villagerJobsSummary && (
        <div className="pointer-events-auto absolute bottom-20 right-3 sm:bottom-24 sm:right-4 w-52 sm:w-56 rounded-xl bg-black/85 p-3 text-white border border-amber-500/30 shadow-lg">
          <div className="text-xs font-bold text-amber-300 mb-2">
            Villagers ({selectedPlayerVillagers.length})
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px] mb-2">
            <div className="flex justify-between"><span className="text-white/70">Wood</span><span className="text-amber-300 font-bold">{villagerJobsSummary.wood}</span></div>
            <div className="flex justify-between"><span className="text-white/70">Food</span><span className="text-yellow-300 font-bold">{villagerJobsSummary.food}</span></div>
            <div className="flex justify-between"><span className="text-white/70">Stone</span><span className="text-gray-300 font-bold">{villagerJobsSummary.stone}</span></div>
            <div className="flex justify-between"><span className="text-white/70">Gold</span><span className="text-yellow-400 font-bold">{villagerJobsSummary.gold}</span></div>
            <div className="flex justify-between col-span-2"><span className="text-white/70">Idle</span><span className="text-white font-bold">{villagerJobsSummary.idle}</span></div>
          </div>
          <div className="text-[10px] text-white/60 mb-2 leading-snug">
            Tap a forest tile to chop wood, a hill tile to mine.
          </div>
          <button
            type="button"
            onClick={() => useGameStore.getState().clearVillagerJob()}
            className="w-full rounded bg-white/10 hover:bg-white/20 px-2 py-1.5 text-xs font-bold border border-white/20"
          >
            Stop work
          </button>
        </div>
      )}

      {selectedBuilding && (
        <div className="pointer-events-auto absolute bottom-4 right-4 w-80 rounded-xl bg-black/85 p-3 text-white border border-white/10">
          <div className="text-sm font-bold text-blue-300 capitalize mb-2">
            {selectedBuilding.type.replace(/_/g, ' ')}
          </div>

          {selectedQueue && (
            <div className="text-xs text-white/70 mb-2">
              Queue: {selectedQueue.queue.length}
              {queueHead && (
                <span className="text-yellow-300 ml-1">
                  | {Math.floor((queueHead.progress / Math.max(1, queueHead.totalTime)) * 100)}%
                </span>
              )}
            </div>
          )}

          {selectedBuilding.type === 'barracks' || selectedBuilding.type === 'townCenter' ? (
            <div className="space-y-2">
              {/* Villager */}
              <button
                onClick={() => useGameStore.getState().spawnUnit(selectedBuilding.id, 'villager')}
                disabled={!canTrainVillager}
                className="w-full rounded bg-green-700 hover:bg-green-600 disabled:bg-gray-800 disabled:text-gray-500 px-2 py-1.5 text-xs font-bold border border-green-500/30"
                title={`Cost: ${villagerSpec.foodCost}F`}
              >
                👨‍🌾 Villager ({villagerSpec.foodCost}F)
              </button>

              {/* Warrior */}
              <button
                onClick={() => useGameStore.getState().spawnUnit(selectedBuilding.id, 'warrior')}
                disabled={!canTrainWarrior}
                className="w-full rounded bg-red-700 hover:bg-red-600 disabled:bg-gray-800 disabled:text-gray-500 px-2 py-1.5 text-xs font-bold border border-red-500/30"
                title={`Cost: ${warriorSpec.foodCost}F ${warriorSpec.goldCost}G`}
              >
                ⚔️ Warrior ({warriorSpec.foodCost}F {warriorSpec.goldCost}G)
              </button>

              {/* Archer */}
              <button
                onClick={() => useGameStore.getState().spawnUnit(selectedBuilding.id, 'archer')}
                disabled={!canTrainArcher}
                className="w-full rounded bg-amber-700 hover:bg-amber-600 disabled:bg-gray-800 disabled:text-gray-500 px-2 py-1.5 text-xs font-bold border border-amber-500/30"
                title={`Cost: ${archerSpec.foodCost}F ${archerSpec.goldCost}G`}
              >
                🏹 Archer ({archerSpec.foodCost}F {archerSpec.goldCost}G)
              </button>

              {/* Spearman */}
              <button
                onClick={() => useGameStore.getState().spawnUnit(selectedBuilding.id, 'spearman')}
                disabled={!canTrainSpearman}
                className="w-full rounded bg-orange-700 hover:bg-orange-600 disabled:bg-gray-800 disabled:text-gray-500 px-2 py-1.5 text-xs font-bold border border-orange-500/30"
                title={`Cost: ${spearmanSpec.foodCost}F ${spearmanSpec.goldCost}G`}
              >
                🔱 Spearman ({spearmanSpec.foodCost}F {spearmanSpec.goldCost}G)
              </button>

              {/* Cavalry */}
              <button
                onClick={() => useGameStore.getState().spawnUnit(selectedBuilding.id, 'cavalry')}
                disabled={!canTrainCavalry}
                className="w-full rounded bg-purple-700 hover:bg-purple-600 disabled:bg-gray-800 disabled:text-gray-500 px-2 py-1.5 text-xs font-bold border border-purple-500/30"
                title={`Cost: ${cavalrySpec.foodCost}F ${cavalrySpec.goldCost}G`}
              >
                🐴 Cavalry ({cavalrySpec.foodCost}F {cavalrySpec.goldCost}G)
              </button>
            </div>
          ) : null}

          {populationUsed >= populationCap && (
            <div className="mt-2 text-[10px] text-red-400 bg-red-950/50 rounded px-2 py-1">
              Population cap reached. Build houses.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
