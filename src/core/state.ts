import { create } from 'zustand';
import { AGES, BUILDING_COSTS, getBuildingMaxHp, getDamageMultiplier, getUnitStatsForAge, AGE_ORDER } from './types';
import type { Age, Building, GameState, Position, ProductionQueue, Resource, Unit } from './types';
import { DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH, generateMap, getTileAt, TERRAIN_EFFECTS, TILE_SIZE } from './map';
import { buildMission } from './mission';
import type { MissionType } from './mission';
import { audio } from '../audio/manager';
import { findPath } from './pathfinding';

const FOG_TILE_SIZE = 40;
const INITIAL_TOWN_CENTER_ID = crypto.randomUUID();
const ENEMY_TOWN_CENTER_ID = crypto.randomUUID();
const KEEP_SELECTION_STORAGE_KEY = 'aow.keepSelectionOnTap';
const CAMERA_PAN_SENS_STORAGE_KEY = 'aow.cameraPanSensitivity';
const SFX_VOLUME_STORAGE_KEY = 'aow.sfxVolume';

function readKeepSelectionPreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(KEEP_SELECTION_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeKeepSelectionPreference(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEEP_SELECTION_STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Ignore storage errors; runtime state still works.
  }
}

function clampPanSensitivity(value: number): number {
  return Math.max(0.5, Math.min(2, value));
}

function clampSfxVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function readCameraPanSensitivityPreference(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const raw = window.localStorage.getItem(CAMERA_PAN_SENS_STORAGE_KEY);
    const parsed = raw == null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? clampPanSensitivity(parsed) : 1;
  } catch {
    return 1;
  }
}

function writeCameraPanSensitivityPreference(value: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CAMERA_PAN_SENS_STORAGE_KEY, String(clampPanSensitivity(value)));
  } catch {
    // Ignore storage errors; runtime state still works.
  }
}

function readSfxVolumePreference(): number {
  if (typeof window === 'undefined') return 0.5;
  try {
    const raw = window.localStorage.getItem(SFX_VOLUME_STORAGE_KEY);
    const parsed = raw == null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? clampSfxVolume(parsed) : 0.5;
  } catch {
    return 0.5;
  }
}

function writeSfxVolumePreference(value: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SFX_VOLUME_STORAGE_KEY, String(clampSfxVolume(value)));
  } catch {
    // Ignore storage errors; runtime state still works.
  }
}

function createInitialFogGrid(): GameState['fog'] {
  const width = Math.ceil(DEFAULT_MAP_WIDTH / FOG_TILE_SIZE);
  const height = Math.ceil(DEFAULT_MAP_HEIGHT / FOG_TILE_SIZE);
  return {
    width,
    height,
    tiles: new Uint8Array(width * height),
  };
}

function getUnitCombatStats(age: Age, type: Unit['type']) {
  return getUnitStatsForAge(age, type);
}

export function getUnitTrainingSpec(age: Age, type: Unit['type']) {
  const ageTier = AGE_ORDER.indexOf(age);
  if (type === 'villager') {
    return {
      foodCost: 45 + ageTier * 5,
      goldCost: 0,
      totalTime: Math.max(1.7, 2.2 - ageTier * 0.1),
    };
  }
  if (type === 'warrior') {
    return {
      foodCost: 20 + ageTier * 8,
      goldCost: 40 + ageTier * 8,
      totalTime: 3.1 + ageTier * 0.15,
    };
  }
  return {
    foodCost: 60 + ageTier * 10,
    goldCost: 20 + ageTier * 10,
    totalTime: 3.2 + ageTier * 0.2,
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getEffectiveUnitDamage(attacker: Unit, target: Unit): number {
  const mult = getDamageMultiplier(attacker.type, target.type);
  const raw = attacker.damage * mult;
  const capped = Math.min(raw, target.maxHp * 0.35);
  return Math.max(1, capped);
}

function getTerrainMoveSpeedMultiplier(state: GameState, position: Position): number {
  const tile = getTileAt(state.terrain, position.x, position.y);
  if (!tile) return 1;
  return TERRAIN_EFFECTS[tile.type].moveSpeedMultiplier;
}

function getTerrainRangeMultiplier(state: GameState, position: Position): number {
  const tile = getTileAt(state.terrain, position.x, position.y);
  if (!tile) return 1;
  return 1 + TERRAIN_EFFECTS[tile.type].rangeBonus;
}

function getTerrainDefenseMultiplier(state: GameState, position: Position): number {
  const tile = getTileAt(state.terrain, position.x, position.y);
  if (!tile) return 1;
  return Math.max(0.1, 1 - TERRAIN_EFFECTS[tile.type].defenseBonus);
}

function getEffectiveBuildingDamage(attacker: Unit): number {
  return Math.max(1, attacker.damage * 0.8);
}

function grantMissionRewards(state: GameState): Record<Resource, number> {
  return {
    food: state.resources.food + state.mission.rewards.food,
    wood: state.resources.wood + state.mission.rewards.wood,
    stone: state.resources.stone + state.mission.rewards.stone,
    gold: state.resources.gold + state.mission.rewards.gold,
  };
}

function getPopulationUsed(state: GameState): number {
  return state.units.filter((u) => u.owner === 'player').length;
}

function getPopulationCap(state: GameState): number {
  const playerBuildings = state.buildings.filter((b) => b.owner === 'player');
  const base = 10;
  const houses = playerBuildings.filter((b) => b.type === 'house').length;
  return base + houses * 5;
}

function getVillagerGatherBreakdown(state: GameState): {
  foodGatherers: number;
  woodGatherers: number;
  stoneGatherers: number;
  goldGatherers: number;
} {
  const playerVillagers = state.units.filter((u) => u.owner === 'player' && u.type === 'villager').length;
  if (playerVillagers <= 0) {
    return { foodGatherers: 0, woodGatherers: 0, stoneGatherers: 0, goldGatherers: 0 };
  }
  const playerBuildings = state.buildings.filter((b) => b.owner === 'player');
  const hasLumberCamp = playerBuildings.some((b) => b.type === 'lumber_camp');
  const hasMine = playerBuildings.some((b) => b.type === 'mine');
  if (!hasLumberCamp && !hasMine) {
    return {
      foodGatherers: playerVillagers,
      woodGatherers: 0,
      stoneGatherers: 0,
      goldGatherers: 0,
    };
  }
  const woodGatherers = hasLumberCamp ? Math.max(1, Math.floor(playerVillagers * 0.35)) : 0;
  const goldGatherers = hasMine ? Math.max(1, Math.floor(playerVillagers * 0.3)) : 0;
  const stoneGatherers = hasMine ? Math.max(0, Math.floor(playerVillagers * 0.2)) : 0;
  const assigned = woodGatherers + goldGatherers + stoneGatherers;
  const foodGatherers = Math.max(0, playerVillagers - assigned);
  return { foodGatherers, woodGatherers, stoneGatherers, goldGatherers };
}

function getDropOffMultiplier(
  resource: 'wood' | 'food',
  owner: 'player' | 'enemy',
  buildings: GameState['buildings']
): number {
  const dropOffType = resource === 'wood' ? 'lumber_camp' : 'mill';
  const hasDropOff = buildings.some((b) => b.owner === owner && b.type === dropOffType && b.hp > 0);
  return hasDropOff ? 1.5 : 1;
}

type GameStore = GameState & {
  addResource: (r: Resource, amount: number) => void;
  advanceAge: () => void;
  setMission: (type: MissionType) => void;
  tickMissionTime: (seconds: number) => void;
  registerWaveSurvived: () => void;
  evaluateMission: () => void;
  selectUnit: (id: string) => void;
  setSelectedIds: (ids: string[]) => void;
  placeBuilding: (x: number, y: number, type?: Building['type']) => void;
  spawnUnit: (buildingId: string, unitType: Unit['type']) => void;
  setRallyPoint: (buildingId: string, point: Position) => void;
  dealDamage: (attackerId: string, targetId: string) => void;
  commandMoveSelectedUnits: (x: number, y: number) => void;
  moveCamera: (dx: number, dy: number) => void;
  triggerCameraShake: (intensity: number, duration: number) => void;
  tickCameraShake: (dt: number) => void;
  tickEconomy: () => void;
  tickUnitMovement: (dt: number) => void;
  tickProductionQueues: (dt: number) => void;
  tickCombat: () => void;
  tickFogOfWar: () => void;
  toggleKeepSelectionOnTap: () => void;
  setCameraPanSensitivity: (value: number) => void;
  setSfxVolume: (value: number) => void;
};

const initialSfxVolume = readSfxVolumePreference();
audio.setVolume(initialSfxVolume);

export const useGameStore = create<GameStore>((set) => ({
  currentAge: 'stone',
  resources: { food: 150, wood: 150, stone: 50, gold: 50 },
  units: [
    {
      id: crypto.randomUUID(),
      type: 'villager',
      position: { x: 140, y: 120 },
      owner: 'player',
      hp: getUnitCombatStats('stone', 'villager').hp,
      maxHp: getUnitCombatStats('stone', 'villager').hp,
      damage: getUnitCombatStats('stone', 'villager').damage,
      speed: getUnitCombatStats('stone', 'villager').speed,
      range: getUnitCombatStats('stone', 'villager').range,
      attackSpeed: getUnitCombatStats('stone', 'villager').attackSpeed,
      lastAttackTime: 0,
    },
    {
      id: crypto.randomUUID(),
      type: 'villager',
      position: { x: 180, y: 120 },
      owner: 'player',
      hp: getUnitCombatStats('stone', 'villager').hp,
      maxHp: getUnitCombatStats('stone', 'villager').hp,
      damage: getUnitCombatStats('stone', 'villager').damage,
      speed: getUnitCombatStats('stone', 'villager').speed,
      range: getUnitCombatStats('stone', 'villager').range,
      attackSpeed: getUnitCombatStats('stone', 'villager').attackSpeed,
      lastAttackTime: 0,
    },
    {
      id: crypto.randomUUID(),
      type: 'villager',
      position: { x: 160, y: 160 },
      owner: 'player',
      hp: getUnitCombatStats('stone', 'villager').hp,
      maxHp: getUnitCombatStats('stone', 'villager').hp,
      damage: getUnitCombatStats('stone', 'villager').damage,
      speed: getUnitCombatStats('stone', 'villager').speed,
      range: getUnitCombatStats('stone', 'villager').range,
      attackSpeed: getUnitCombatStats('stone', 'villager').attackSpeed,
      lastAttackTime: 0,
    },
  ],
  buildings: [
    {
      id: INITIAL_TOWN_CENTER_ID,
      type: 'townCenter',
      position: { x: 80, y: 80 },
      owner: 'player',
      hp: getBuildingMaxHp('townCenter'),
      maxHp: getBuildingMaxHp('townCenter'),
    },
    {
      id: ENEMY_TOWN_CENTER_ID,
      type: 'townCenter',
      position: { x: DEFAULT_MAP_WIDTH - 160, y: 80 },
      owner: 'enemy',
      hp: getBuildingMaxHp('townCenter'),
      maxHp: getBuildingMaxHp('townCenter'),
    },
  ],
  productionQueues: [{ buildingId: INITIAL_TOWN_CENTER_ID, queue: [], rallyPoint: null }],
  selectedIds: [],
  camera: { x: 0, y: 0 },
  cameraShake: { intensity: 0, duration: 0, timer: 0, offset: { x: 0, y: 0 } },
  terrain: generateMap(Math.ceil(DEFAULT_MAP_WIDTH / TILE_SIZE), Math.ceil(DEFAULT_MAP_HEIGHT / TILE_SIZE)),
  fog: createInitialFogGrid(),
  mission: buildMission('survival'),
  missionStatus: 'active',
  missionElapsedSec: 0,
  wavesSurvived: 0,
  aiPlan: 'boom',
  keepSelectionOnTap: readKeepSelectionPreference(),
  cameraPanSensitivity: readCameraPanSensitivityPreference(),
  sfxVolume: initialSfxVolume,
  enemyEconomy: {
    resources: { food: 130, wood: 130, stone: 80, gold: 120 },
    villagers: 3,
    buildings: ['townCenter'],
  },

  addResource: (r, amount) => set((s) => ({ resources: { ...s.resources, [r]: s.resources[r] + amount } })),

  advanceAge: () =>
    set((s) => {
      const ages: Age[] = AGE_ORDER;
      const nextIndex = ages.indexOf(s.currentAge) + 1;
      if (nextIndex >= ages.length) return s;
      const nextAge = ages[nextIndex];
      const cost = AGES[nextAge].cost;
      for (const [res, amount] of Object.entries(cost)) {
        if (s.resources[res as Resource] < amount) return s;
      }
      const newRes = { ...s.resources };
      for (const [res, amount] of Object.entries(cost)) newRes[res as Resource] -= amount;
      audio.play('ageUp');
      return { currentAge: nextAge, resources: newRes };
    }),

  setMission: (type) => set(() => ({ mission: buildMission(type), missionStatus: 'active', missionElapsedSec: 0, wavesSurvived: 0 })),

  tickMissionTime: (seconds) =>
    set((s) => {
      if (s.missionStatus !== 'active') return s;
      const nextElapsed = s.missionElapsedSec + seconds;
      if (s.mission.type === 'economy' && nextElapsed > 300 && s.resources.gold < 1000) {
        return { missionElapsedSec: nextElapsed, missionStatus: 'failed' };
      }
      return { missionElapsedSec: nextElapsed };
    }),

  registerWaveSurvived: () =>
    set((s) => {
      if (s.missionStatus !== 'active') return s;
      const nextWaves = s.wavesSurvived + 1;
      if (s.mission.type === 'survival' && nextWaves >= 10) {
        return { wavesSurvived: nextWaves, missionStatus: 'success', resources: grantMissionRewards(s) };
      }
      return { wavesSurvived: nextWaves };
    }),

  evaluateMission: () =>
    set((s) => {
      if (s.missionStatus !== 'active') return s;
      if (s.mission.type === 'conquest') {
        const enemyTownCenterAlive = s.buildings.some((b) => b.owner === 'enemy' && b.type === 'townCenter');
        if (!enemyTownCenterAlive) return { missionStatus: 'success', resources: grantMissionRewards(s) };
        return s;
      }
      if (s.mission.type === 'economy' && s.resources.gold >= 1000 && s.missionElapsedSec <= 300) {
        return { missionStatus: 'success', resources: grantMissionRewards(s) };
      }
      return s;
    }),

  selectUnit: (id) => set(() => ({ selectedIds: [id] })),
  setSelectedIds: (ids) => set(() => ({ selectedIds: ids })),
  toggleKeepSelectionOnTap: () =>
    set((s) => {
      const next = !s.keepSelectionOnTap;
      writeKeepSelectionPreference(next);
      return { keepSelectionOnTap: next };
    }),
  setCameraPanSensitivity: (value) =>
    set(() => {
      const next = clampPanSensitivity(value);
      writeCameraPanSensitivityPreference(next);
      return { cameraPanSensitivity: next };
    }),
  setSfxVolume: (value) =>
    set(() => {
      const next = clampSfxVolume(value);
      audio.setVolume(next);
      writeSfxVolumePreference(next);
      return { sfxVolume: next };
    }),

  placeBuilding: (x, y, type = 'farm') =>
    set((s) => {
      const unlocked = new Set<Building['type']>(AGES[s.currentAge].unlocks);
      if (!unlocked.has(type)) return s;
      const tile = getTileAt(s.terrain, x, y);
      if (!tile) return s;
      if (!TERRAIN_EFFECTS[tile.type].canBuild) return s;
      if (s.buildings.some((b) => distance(b.position, { x, y }) < 50)) return s;
      const cost = BUILDING_COSTS[type];
      const canAfford = s.resources.food >= cost.food && s.resources.wood >= cost.wood && s.resources.stone >= cost.stone && s.resources.gold >= cost.gold;
      if (!canAfford) return s;
      const newBuildingId = crypto.randomUUID();
      audio.play(type === 'lumber_camp' || type === 'mill' ? 'gather' : 'build');
      return {
        resources: {
          food: s.resources.food - cost.food,
          wood: s.resources.wood - cost.wood,
          stone: s.resources.stone - cost.stone,
          gold: s.resources.gold - cost.gold,
        },
        buildings: [...s.buildings, { id: newBuildingId, type, position: { x, y }, owner: 'player', hp: getBuildingMaxHp(type), maxHp: getBuildingMaxHp(type) }],
        productionQueues: [...s.productionQueues, { buildingId: newBuildingId, queue: [], rallyPoint: null }],
      };
    }),

  spawnUnit: (buildingId, unitType) =>
    set((s) => {
      const building = s.buildings.find((b) => b.id === buildingId);
      if (!building || building.owner !== 'player') return s;
      const training = getUnitTrainingSpec(s.currentAge, unitType);
      const { foodCost, goldCost } = training;
      if (s.resources.food < foodCost || s.resources.gold < goldCost) return s;
      if (getPopulationUsed(s) >= getPopulationCap(s)) return s;
      const existingQueue = s.productionQueues.find((q) => q.buildingId === buildingId);
      const nextQueue: ProductionQueue = existingQueue
        ? { ...existingQueue, queue: [...existingQueue.queue, { type: unitType, progress: 0, totalTime: training.totalTime }] }
        : { buildingId, queue: [{ type: unitType, progress: 0, totalTime: training.totalTime }], rallyPoint: null };
      return {
        resources: { ...s.resources, food: s.resources.food - foodCost, gold: s.resources.gold - goldCost },
        productionQueues: existingQueue ? s.productionQueues.map((q) => (q.buildingId === buildingId ? nextQueue : q)) : [...s.productionQueues, nextQueue],
      };
    }),

  setRallyPoint: (buildingId, point) =>
    set((s) => {
      const exists = s.productionQueues.some((q) => q.buildingId === buildingId);
      if (exists) {
        return { productionQueues: s.productionQueues.map((q) => (q.buildingId === buildingId ? { ...q, rallyPoint: point } : q)) };
      }
      return { productionQueues: [...s.productionQueues, { buildingId, queue: [], rallyPoint: point }] };
    }),

  dealDamage: (attackerId, targetId) =>
    set((s) => {
      const attacker = s.units.find((u) => u.id === attackerId);
      if (!attacker) return s;
      const now = Date.now();
      if (now - attacker.lastAttackTime < 1000 / Math.max(attacker.attackSpeed, 0.1)) return s;
      const targetUnit = s.units.find((u) => u.id === targetId);
      if (targetUnit) {
        if (targetUnit.owner === attacker.owner) return s;
        const effectiveRange = attacker.range * getTerrainRangeMultiplier(s, attacker.position);
        if (distance(attacker.position, targetUnit.position) > effectiveRange) return s;
        const nextUnits = s.units.map((u) => {
          if (u.id === attacker.id) return { ...u, lastAttackTime: now };
          if (u.id === targetUnit.id) {
            const terrainDefense = getTerrainDefenseMultiplier(s, targetUnit.position);
            return { ...u, hp: u.hp - getEffectiveUnitDamage(attacker, targetUnit) * terrainDefense };
          }
          return u;
        }).filter((u) => u.hp > 0);
        return { units: nextUnits };
      }
      const targetBuilding = s.buildings.find((b) => b.id === targetId);
      if (!targetBuilding || targetBuilding.owner === attacker.owner) return s;
      const buildingCenter = { x: targetBuilding.position.x + 16, y: targetBuilding.position.y + 16 };
      const effectiveRange = attacker.range * getTerrainRangeMultiplier(s, attacker.position);
      if (distance(attacker.position, buildingCenter) > effectiveRange + 10) return s;
      const nextUnits = s.units.map((u) => (u.id === attacker.id ? { ...u, lastAttackTime: now } : u));
      const nextBuildings = s.buildings.map((b) => (b.id === targetBuilding.id ? { ...b, hp: b.hp - getEffectiveBuildingDamage(attacker) } : b)).filter((b) => b.hp > 0);
      const aliveBuildingIds = new Set(nextBuildings.map((b) => b.id));
      return { units: nextUnits, buildings: nextBuildings, productionQueues: s.productionQueues.filter((q) => aliveBuildingIds.has(q.buildingId)) };
    }),

  commandMoveSelectedUnits: (x, y) =>
    set((s) => ({
      units: s.units.map((u) => {
        if (!(s.selectedIds.includes(u.id) && u.owner === 'player')) return u;
        const path = findPath(u.position, { x, y }, s.terrain);
        if (path && path.length > 1) return { ...u, target: { x, y }, path, pathIndex: 1 };
        return { ...u, target: undefined, path: undefined, pathIndex: undefined };
      }),
    })),

  moveCamera: (dx, dy) =>
    set((s) => {
      const pan = clampPanSensitivity(s.cameraPanSensitivity);
      const mapPixelWidth = (s.terrain[0]?.length ?? Math.ceil(DEFAULT_MAP_WIDTH / TILE_SIZE)) * TILE_SIZE;
      const mapPixelHeight = s.terrain.length * TILE_SIZE;
      const maxX = Math.max(0, mapPixelWidth - window.innerWidth);
      const maxY = Math.max(0, mapPixelHeight - window.innerHeight);
      return { camera: { x: Math.max(0, Math.min(s.camera.x + dx * pan, maxX)), y: Math.max(0, Math.min(s.camera.y + dy * pan, maxY)) } };
    }),

  triggerCameraShake: (intensity, duration) => set(() => ({ cameraShake: { intensity, duration, timer: duration, offset: { x: 0, y: 0 } } })),

  tickCameraShake: (dt) =>
    set((s) => {
      if (s.cameraShake.timer <= 0) {
        if (s.cameraShake.offset.x === 0 && s.cameraShake.offset.y === 0) return s;
        return { cameraShake: { ...s.cameraShake, timer: 0, offset: { x: 0, y: 0 } } };
      }
      const timer = Math.max(0, s.cameraShake.timer - dt);
      const decay = s.cameraShake.duration > 0 ? timer / s.cameraShake.duration : 0;
      const jitter = s.cameraShake.intensity * decay;
      return { cameraShake: { ...s.cameraShake, timer, offset: { x: (Math.random() - 0.5) * jitter * 2, y: (Math.random() - 0.5) * jitter * 2 } } };
    }),

  tickEconomy: () =>
    set((s) => {
      const round1 = (value: number) => Math.round(value * 10) / 10;
      const playerBuildings = s.buildings.filter((b) => b.owner === 'player');
      const farmCount = playerBuildings.filter((b) => b.type === 'farm').length;
      const mineCount = playerBuildings.filter((b) => b.type === 'mine').length;
      const farmBonus = Math.min(0.2 * farmCount, 0.6);
      const mineBonus = Math.min(0.15 * mineCount, 0.45);
      const foodDropOffMult = getDropOffMultiplier('food', 'player', s.buildings);
      const woodDropOffMult = getDropOffMultiplier('wood', 'player', s.buildings);
      const villagerGather = getVillagerGatherBreakdown(s);
      const totalUnits = s.units.filter((u) => u.owner === 'player').length;
      const foodUpkeep = totalUnits * 0.5;
      const nextResources = {
        ...s.resources,
        food: Math.max(0, round1(s.resources.food + villagerGather.foodGatherers * 1.5 * (1 + farmBonus) * foodDropOffMult - foodUpkeep)),
        wood: round1(s.resources.wood + villagerGather.woodGatherers * 1.2 * woodDropOffMult),
        stone: round1(s.resources.stone + villagerGather.stoneGatherers * 1.1 * (1 + mineBonus)),
        gold: round1(s.resources.gold + villagerGather.goldGatherers * 1 * (1 + mineBonus)),
      };
      if (s.missionStatus === 'active' && s.mission.type === 'economy' && nextResources.gold >= 1000 && s.missionElapsedSec <= 300) {
        return {
          resources: {
            food: nextResources.food + s.mission.rewards.food,
            wood: nextResources.wood + s.mission.rewards.wood,
            stone: nextResources.stone + s.mission.rewards.stone,
            gold: nextResources.gold + s.mission.rewards.gold,
          },
          missionStatus: 'success',
        };
      }
      return { resources: { ...nextResources } };
    }),

  tickUnitMovement: (dt) =>
    set((s) => ({
      units: s.units.map((u) => {
        let unit = u;
        const moveMult = getTerrainMoveSpeedMultiplier(s, u.position);
        if (u.owner === 'enemy' && !u.target) {
          if (u.type === 'villager') return u;
          const baseSpeed = Math.max(60, u.speed * 12) * moveMult;
          const nextPos = { x: u.position.x - dt * baseSpeed, y: u.position.y };
          const nextTile = getTileAt(s.terrain, nextPos.x, nextPos.y);
          if (nextTile && TERRAIN_EFFECTS[nextTile.type].impassable) return u;
          return { ...u, position: nextPos };
        }
        if (!unit.target) return unit;
        if (!unit.path || unit.path.length < 2 || unit.pathIndex === undefined) {
          const path = findPath(unit.position, unit.target, s.terrain);
          if (path && path.length > 1) unit = { ...unit, path, pathIndex: 1 };
          else return { ...unit, target: undefined, path: undefined, pathIndex: undefined };
        }
        const waypoint = unit.path?.[unit.pathIndex ?? 1];
        if (!waypoint) return { ...unit, target: undefined, path: undefined, pathIndex: undefined };
        const alpha = Math.min(1, unit.speed * moveMult * dt);
        const nx = unit.position.x + (waypoint.x - unit.position.x) * alpha;
        const ny = unit.position.y + (waypoint.y - unit.position.y) * alpha;
        const nextTile = getTileAt(s.terrain, nx, ny);
        if (nextTile && TERRAIN_EFFECTS[nextTile.type].impassable) return { ...unit, target: undefined, path: undefined, pathIndex: undefined };
        const reachedWaypoint = Math.abs(waypoint.x - nx) < 2 && Math.abs(waypoint.y - ny) < 2;
        const nextIndex = (unit.pathIndex ?? 1) + (reachedWaypoint ? 1 : 0);
        const pathDone = !unit.path || nextIndex >= unit.path.length;
        return {
          ...unit,
          position: { x: nx, y: ny },
          pathIndex: reachedWaypoint ? nextIndex : unit.pathIndex,
          target: pathDone ? undefined : unit.target,
          path: pathDone ? undefined : unit.path,
          ...(pathDone ? { pathIndex: undefined } : {}),
        };
      }),
    })),

  tickProductionQueues: (dt) =>
    set((s) => {
      let units = [...s.units];
      let changed = false;
      const nextQueues = s.productionQueues.filter((q) => s.buildings.some((b) => b.id === q.buildingId)).map((q) => {
        if (q.queue.length === 0) return q;
        const head = q.queue[0];
        const progressed = { ...head, progress: head.progress + dt };
        if (progressed.progress < progressed.totalTime) return { ...q, queue: [progressed, ...q.queue.slice(1)] };
        const building = s.buildings.find((b) => b.id === q.buildingId);
        if (!building) return { ...q, queue: q.queue.slice(1) };
        const stats = getUnitCombatStats(s.currentAge, progressed.type);
        const spawnPos = { x: building.position.x + 40, y: building.position.y };
        const target = q.rallyPoint ?? undefined;
        const newUnit: Unit = {
          id: crypto.randomUUID(),
          type: progressed.type,
          position: spawnPos,
          target,
          owner: 'player',
          hp: stats.hp,
          maxHp: stats.hp,
          damage: stats.damage,
          speed: stats.speed,
          range: stats.range,
          attackSpeed: stats.attackSpeed,
          lastAttackTime: 0,
        };
        units = [...units, newUnit];
        changed = true;
        return { ...q, queue: q.queue.slice(1) };
      });
      if (!changed) return { productionQueues: nextQueues };
      return { units, productionQueues: nextQueues };
    }),

  tickCombat: () =>
    set((s) => {
      const now = Date.now();
      let nextUnits = [...s.units];
      let nextBuildings = [...s.buildings];
      let changed = false;
      let landedHits = 0;
      for (let i = 0; i < nextUnits.length; i++) {
        const attacker = nextUnits[i];
        const cooldownMs = 1000 / Math.max(attacker.attackSpeed, 0.1);
        if (now - attacker.lastAttackTime < cooldownMs) continue;
        let bestUnitIndex = -1;
        let bestDist = Number.POSITIVE_INFINITY;
        for (let j = 0; j < nextUnits.length; j++) {
          if (i === j) continue;
          const candidate = nextUnits[j];
          if (candidate.owner === attacker.owner) continue;
          const effectiveRange = attacker.range * getTerrainRangeMultiplier(s, attacker.position);
          const d = distance(attacker.position, candidate.position);
          if (d <= effectiveRange && d < bestDist) {
            bestDist = d;
            bestUnitIndex = j;
          }
        }
        if (bestUnitIndex >= 0) {
          const target = nextUnits[bestUnitIndex];
          nextUnits[i] = { ...attacker, lastAttackTime: now };
          const terrainDefense = getTerrainDefenseMultiplier(s, target.position);
          nextUnits[bestUnitIndex] = { ...target, hp: target.hp - getEffectiveUnitDamage(attacker, target) * terrainDefense };
          landedHits += 1;
          changed = true;
          continue;
        }
        let bestBuildingIndex = -1;
        bestDist = Number.POSITIVE_INFINITY;
        for (let j = 0; j < nextBuildings.length; j++) {
          const b = nextBuildings[j];
          if (b.owner === attacker.owner) continue;
          const effectiveRange = attacker.range * getTerrainRangeMultiplier(s, attacker.position);
          const center = { x: b.position.x + 16, y: b.position.y + 16 };
          const d = distance(attacker.position, center);
          if (d <= effectiveRange + 10 && d < bestDist) {
            bestDist = d;
            bestBuildingIndex = j;
          }
        }
        if (bestBuildingIndex >= 0) {
          const target = nextBuildings[bestBuildingIndex];
          nextUnits[i] = { ...attacker, lastAttackTime: now };
          nextBuildings[bestBuildingIndex] = { ...target, hp: target.hp - getEffectiveBuildingDamage(attacker) };
          landedHits += 1;
          changed = true;
        }
      }
      if (!changed) return s;
      if (landedHits > 0) audio.play('sword');
      nextUnits = nextUnits.filter((u) => u.hp > 0);
      const hadMoreUnits = s.units.length > nextUnits.length;
      if (hadMoreUnits) audio.play('death');
      nextBuildings = nextBuildings.filter((b) => b.hp > 0);
      const hadMoreBuildings = s.buildings.length > nextBuildings.length;
      const nextShake = hadMoreBuildings ? { intensity: 7, duration: 0.25, timer: 0.25, offset: { x: 0, y: 0 } } : s.cameraShake;
      const aliveBuildingIds = new Set(nextBuildings.map((b) => b.id));
      const enemyTownCenterAlive = nextBuildings.some((b) => b.owner === 'enemy' && b.type === 'townCenter');
      const conquestCleared = s.missionStatus === 'active' && s.mission.type === 'conquest' && !enemyTownCenterAlive;
      const nextResources = conquestCleared
        ? { food: s.resources.food + s.mission.rewards.food, wood: s.resources.wood + s.mission.rewards.wood, stone: s.resources.stone + s.mission.rewards.stone, gold: s.resources.gold + s.mission.rewards.gold }
        : s.resources;
      return {
        ...s,
        units: nextUnits,
        buildings: nextBuildings,
        cameraShake: nextShake,
        resources: nextResources,
        missionStatus: conquestCleared ? 'success' : s.missionStatus,
        productionQueues: s.productionQueues.filter((q) => aliveBuildingIds.has(q.buildingId)),
      };
    }),

  tickFogOfWar: () =>
    set((s) => {
      const { width, height } = s.fog;
      const nextTiles = new Uint8Array(s.fog.tiles);
      for (let i = 0; i < nextTiles.length; i++) if (nextTiles[i] === 2) nextTiles[i] = 1;
      const revealRadius = 5;
      const revealSources = [
        ...s.units.filter((u) => u.owner === 'player').map((u) => ({ x: u.position.x, y: u.position.y })),
        ...s.buildings.filter((b) => b.owner === 'player').map((b) => ({ x: b.position.x + 16, y: b.position.y + 16 })),
      ];
      for (const source of revealSources) {
        const cx = Math.floor(source.x / FOG_TILE_SIZE);
        const cy = Math.floor(source.y / FOG_TILE_SIZE);
        for (let dy = -revealRadius; dy <= revealRadius; dy++) {
          for (let dx = -revealRadius; dx <= revealRadius; dx++) {
            if (dx * dx + dy * dy > revealRadius * revealRadius) continue;
            const tx = cx + dx;
            const ty = cy + dy;
            if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
            nextTiles[ty * width + tx] = 2;
          }
        }
      }
      return { fog: { width, height, tiles: nextTiles } };
    }),
}));
