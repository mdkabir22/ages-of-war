import { useGameStore } from '../engine/state';
import { AGES, AGE_ORDER } from '../engine/types';

export function HUD() {
  const {
    resources,
    currentAge,
    selectedIds,
    buildings,
    productionQueues,
    spawnUnit,
    advanceAge,
    mission,
    missionStatus,
    wavesSurvived,
    missionElapsedSec,
  } = useGameStore();
  const selectedBuilding = selectedIds.length > 0
    ? buildings.find((b) => b.id === selectedIds[0])
    : undefined;
  const populationUsed = useGameStore((s) => s.units.filter((u) => u.owner === 'player').length);
  const populationCap = useGameStore(
    (s) => 10 + s.buildings.filter((b) => b.owner === 'player' && b.type === 'house').length * 5
  );
  const selectedQueue = selectedBuilding
    ? productionQueues.find((q) => q.buildingId === selectedBuilding.id)
    : undefined;
  const queueHead = selectedQueue?.queue[0];
  const ageOrder = AGE_ORDER;
  const ageTier = ageOrder.indexOf(currentAge);
  const villagerFoodCost = 45 + ageTier * 5;
  const warriorFoodCost = 60 + ageTier * 10;
  const warriorGoldCost = 20 + ageTier * 10;
  const nextAge = ageOrder[ageOrder.indexOf(currentAge) + 1];
  const canAdvance = nextAge
    ? Object.entries(AGES[nextAge].cost).every(([res, amount]) => resources[res as keyof typeof resources] >= amount)
    : false;
  const enemyTownCenter = buildings.find((b) => b.owner === 'enemy' && b.type === 'townCenter');
  const selectionHasBuilding = Boolean(selectedBuilding);
  const canTrainVillager = resources.food >= villagerFoodCost && populationUsed < populationCap;
  const canTrainWarrior =
    resources.food >= warriorFoodCost &&
    resources.gold >= warriorGoldCost &&
    populationUsed < populationCap;
  const economyProgress = Math.min(1000, resources.gold);
  const timeLeft = Math.max(0, 300 - missionElapsedSec);
  const elapsedMin = Math.floor(missionElapsedSec / 60);
  const elapsedSec = missionElapsedSec % 60;

  let missionProgressText = mission.description;
  if (mission.type === 'survival') {
    missionProgressText = `Waves survived: ${Math.min(wavesSurvived, 10)}/10`;
  } else if (mission.type === 'conquest') {
    const hpPct = enemyTownCenter
      ? Math.max(0, Math.floor((enemyTownCenter.hp / Math.max(1, enemyTownCenter.maxHp)) * 100))
      : 0;
    missionProgressText = enemyTownCenter ? `Enemy TC HP: ${hpPct}%` : 'Enemy Town Center destroyed';
  } else if (mission.type === 'economy') {
    missionProgressText = `Gold: ${economyProgress}/1000 | Time Left: ${timeLeft}s`;
  }

  return (
    <div className="fixed inset-0 z-10 text-white font-mono pointer-events-none text-[13px] leading-tight sm:text-sm">
      <div className="absolute top-2 right-2 bg-black/70 p-2 rounded-lg border border-yellow-500/40 pointer-events-auto text-right w-40">
        <div className="text-yellow-400 text-xs sm:text-sm">{AGES[currentAge].name}</div>
        <div className="text-white/70 text-xs">{elapsedMin}:{String(elapsedSec).padStart(2, '0')}</div>
        {nextAge ? (
          <button
            type="button"
            onClick={advanceAge}
            disabled={!canAdvance}
            className={`mt-2 w-full px-2 py-2 rounded border transition text-xs sm:text-sm ${
              canAdvance
                ? 'bg-emerald-500/25 border-emerald-300/40 shadow-[0_0_16px_rgba(16,185,129,0.45)]'
                : 'bg-zinc-700/30 border-zinc-500/40 opacity-70'
            }`}
          >
            Advance: {AGES[nextAge].name}
          </button>
        ) : (
          <div className="mt-2 text-emerald-300">Max Age Reached</div>
        )}
      </div>

      <div className="absolute top-2 left-2 bg-black/70 p-2 rounded-lg border border-yellow-500/40 w-52 max-w-[58vw]">
        <div>
          <div className="text-yellow-400 font-bold text-sm">{mission.name}</div>
          <div className="text-xs text-white/70 mt-1">{missionProgressText}</div>
          <div
            className={`text-xs mt-1 ${
              missionStatus === 'active'
                ? 'text-green-400'
                : missionStatus === 'success'
                  ? 'text-emerald-400'
                  : 'text-red-400'
            }`}
          >
            * {missionStatus}
          </div>
          {missionStatus === 'active' && (
            <div className="mt-1 text-[10px] text-white/60">
              {mission.objectives[0]?.label ?? 'Complete mission'}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 bg-black/85 p-2 rounded-xl border border-yellow-500/35 flex gap-3 text-xs sm:text-sm pointer-events-auto">
        <div className="flex items-center gap-1">
          <span className="text-white/80">FOOD</span>
          <span className="text-yellow-300 font-bold text-base sm:text-lg">{Math.floor(resources.food)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-white/80">WOOD</span>
          <span className="text-amber-400 font-bold text-base sm:text-lg">{Math.floor(resources.wood)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-white/80">STONE</span>
          <span className="text-gray-300 font-bold text-base sm:text-lg">{Math.floor(resources.stone)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-white/80">GOLD</span>
          <span className="text-yellow-400 font-bold text-base sm:text-lg">{Math.floor(resources.gold)}</span>
        </div>
        <div className="border-l border-white/20 pl-2 flex items-center gap-1">
          <span className="text-white/80">POP</span>
          <span className="text-white font-bold text-base sm:text-lg">{populationUsed}/{populationCap}</span>
        </div>
      </div>

      {selectionHasBuilding && selectedBuilding && (
        <div className="absolute bottom-24 right-2 pointer-events-auto bg-black/85 p-2 rounded border border-war-gold min-w-52 max-w-[56vw]">
          <div className="text-sm mb-2">Building: {selectedBuilding.type}</div>
          {selectedQueue && (
            <div className="text-xs mb-2 text-white/80">
              Queue: {selectedQueue.queue.length}
              {queueHead ? ` | ${Math.floor((queueHead.progress / Math.max(1, queueHead.totalTime)) * 100)}%` : ''}
            </div>
          )}
          <button
            type="button"
            className="w-full px-3 py-2 rounded bg-amber-500/25 border border-amber-300/40 disabled:opacity-50"
            disabled={!canTrainVillager}
            onClick={() => spawnUnit(selectedBuilding.id, 'villager')}
          >
            Spawn Villager ({villagerFoodCost} Food)
          </button>
          <button
            type="button"
            className="mt-2 w-full px-3 py-2 rounded bg-sky-500/25 border border-sky-300/40 disabled:opacity-50"
            disabled={!canTrainWarrior}
            onClick={() => spawnUnit(selectedBuilding.id, 'warrior')}
          >
            Queue Warrior ({warriorFoodCost} Food, {warriorGoldCost} Gold)
          </button>
          {populationUsed >= populationCap && (
            <div className="mt-2 text-xs text-rose-300">Population cap reached. Build houses.</div>
          )}
          {!canTrainWarrior && populationUsed < populationCap && (
            <div className="mt-1 text-xs text-white/70">Need more food/gold for warrior.</div>
          )}
        </div>
      )}
    </div>
  );
}
