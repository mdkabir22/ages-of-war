import type { GameState, GameUnit, GameMode, BuildingType, BattleStance, LaneFocus } from '../types/game';
import { LANE_Y_RATIOS } from '../core/map';
import {
  activateFortify as activateFortifySystem,
  activateRally as activateRallySystem,
  canActivateFortify as canActivateFortifySystem,
  canActivateRally as canActivateRallySystem,
} from './systems/abilities';
import { updateAIDirector } from './systems/aiDirector';
import {
  buildStructure as buildStructureSystem,
  canBuildStructure as canBuildStructureSystem,
} from './systems/construction';
import { canTrainUnit, trainUnit } from './systems/training';
import { TECH_TREE, canUnlockTech } from './systems/techTree';
import { applyCampaignMissionConfig } from './systems/campaignConfig';
import {
  getLaneControl,
  getMostContestedLane,
} from './systems/combatRuntime';
import { addFloatingText } from './systems/effects';
import { canUpgradeAgeRuntime, spawnUnitRuntime, upgradeAgeRuntime } from './systems/unitLifecycle';
import { createInitialStateRuntime } from './systems/initialStateRuntime';
import { runGameUpdateRuntime } from './systems/gameUpdateRuntime';

export { canTrainUnit, trainUnit };
export { addFloatingText };

let unitIdCounter = 0;
let buildingIdCounter = 0;
const LANES = [...LANE_Y_RATIOS];
function generateUnitId(): string {
  return `unit_${++unitIdCounter}_${Math.random().toString(36).substr(2, 5)}`;
}

function generateBuildingId(): string {
  return `building_${++buildingIdCounter}_${Math.random().toString(36).substr(2, 5)}`;
}

export { applyCampaignMissionConfig };

export function createInitialState(canvasWidth: number, _canvasHeight: number, mode: GameMode = 'assault'): GameState {
  unitIdCounter = 0;
  buildingIdCounter = 0;
  return createInitialStateRuntime(canvasWidth, mode, generateBuildingId);
}

export function spawnUnit(state: GameState, unitType: number, isPlayer: boolean, canvasHeight: number): GameUnit | null {
  return spawnUnitRuntime(state, unitType, isPlayer, canvasHeight, generateUnitId);
}


export function canUpgradeAge(state: GameState, isPlayer: boolean): boolean {
  return canUpgradeAgeRuntime(state, isPlayer);
}

export function upgradeAge(state: GameState, isPlayer: boolean): boolean {
  return upgradeAgeRuntime(state, isPlayer);
}

function spawnUnitInLane(
  state: GameState,
  unitType: number,
  isPlayer: boolean,
  canvasHeight: number,
  laneIndex: number
): GameUnit | null {
  const unit = spawnUnit(state, unitType, isPlayer, canvasHeight);
  if (!unit) return null;
  const lane = LANES[Math.max(0, Math.min(LANES.length - 1, laneIndex))];
  const laneY = lane * canvasHeight;
  unit.y = Math.max(70, Math.min(canvasHeight - 170, laneY + (Math.random() - 0.5) * 16));
  return unit;
}



export function updateGame(state: GameState, dt: number, canvasWidth: number, canvasHeight: number): void {
  runGameUpdateRuntime(state, dt, canvasWidth, canvasHeight, LANES);
}

export function canBuildStructure(state: GameState, type: BuildingType, isPlayer: boolean): boolean {
  return canBuildStructureSystem(state, type, isPlayer);
}

export function buildStructure(state: GameState, type: BuildingType, isPlayer: boolean): boolean {
  return buildStructureSystem(state, type, isPlayer, generateBuildingId);
}

export function unlockNextTech(state: GameState): string | null {
  const next = TECH_TREE.find((node) => canUnlockTech(state.unlockedTechs, node, state.playerAge));
  if (!next) return null;
  state.unlockedTechs.push(next.id);
  return next.name;
}

export function canActivateRally(state: GameState): boolean {
  return canActivateRallySystem(state);
}

export function setPlayerBattleStance(state: GameState, stance: BattleStance): void {
  state.playerBattleStance = stance;
}

export function setPlayerLaneFocus(state: GameState, focus: LaneFocus): void {
  state.playerLaneFocus = focus;
}

export function activateRally(state: GameState): boolean {
  return activateRallySystem(state);
}

export function canActivateFortify(state: GameState): boolean {
  return canActivateFortifySystem(state);
}

export function activateFortify(state: GameState): boolean {
  return activateFortifySystem(state);
}

export function updateAI(state: GameState, _dt: number, canvasHeight: number): void {
  updateAIDirector(state, canvasHeight, {
    lanes: LANES,
    getLaneControl,
    getMostContestedLane,
    spawnUnitInLane,
    upgradeAge,
  });
}
