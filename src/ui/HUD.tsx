import { useEffect, useState } from 'react';
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

  const villagerFoodCost = 45 + ageTier * 5;
  const warriorFoodCost = 60 + ageTier * 10;
  const warriorGoldCost = 20 + ageTier * 10;
  const canTrainWarrior =
    state.resources.food >= warriorFoodCost &&
    state.resources.gold >= warriorGoldCost &&
    populationUsed < populationCap;

  const resources = state.resources;
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
