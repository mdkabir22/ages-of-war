import type { GameState } from '../types/game';

export const DIAGNOSTICS_SCHEMA_VERSION = 'aow.liveops.v1';
export const DIAGNOSTICS_SESSION_STORAGE_KEY = 'aow_liveops_session_summaries_v1';

export type DiagnosticsSnapshotSource = 'manual' | 'auto_match_end';

export interface DiagnosticsSnapshot {
  schemaVersion: string;
  source: DiagnosticsSnapshotSource;
  timestamp: number;
  mode: GameState['mode'];
  campaignMissionIndex: number;
  campaignPackId: GameState['campaignPackId'];
  campaignEventTitle: string;
  aiProfile: GameState['aiProfile'];
  aiMacroPlan: GameState['aiDirector']['macroPlan'];
  aiEconomyMode: GameState['aiDirector']['economyMode'];
  aiPressureScore: number;
  aiSkillEstimate: number;
  resources: {
    playerGold: number;
    aiGold: number;
    playerFood: number;
    playerWood: number;
    playerStone: number;
  };
  combat: {
    wave: number;
    kills: number;
    playerUnitsAlive: number;
    aiUnitsAlive: number;
    playerCastleHealth: number;
    aiCastleHealth: number;
  };
  tacticalControls: {
    battleStance: GameState['playerBattleStance'];
    laneFocus: GameState['playerLaneFocus'];
  };
  win: boolean | null;
  objectives: Array<{
    id: string;
    progress: number;
    target: number;
    completed: boolean;
  }>;
  rewards: {
    objectiveGold: number;
    objectiveGems: number;
    objectiveBattlePassXP: number;
  };
}

export interface DiagnosticsApiBatch {
  schemaVersion: string;
  exportedAt: number;
  appId: 'ages-of-war';
  summary: {
    totalMatches: number;
    wins: number;
    losses: number;
    avgWave: number;
    avgKills: number;
    avgAiPressure: number;
    modeBreakdown: Record<GameState['mode'], number>;
  };
  rows: Array<{
    ts: number;
    src: DiagnosticsSnapshotSource;
    mode: GameState['mode'];
    win: boolean | null;
    wave: number;
    kills: number;
    aiPressure: number;
    aiSkill: number;
    packId: GameState['campaignPackId'];
    event: string;
    objectiveCompletionPct: number;
  }>;
}

export function buildDiagnosticsSnapshot(
  state: GameState,
  source: DiagnosticsSnapshotSource = 'manual',
  now = Date.now()
): DiagnosticsSnapshot {
  return {
    schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
    source,
    timestamp: now,
    mode: state.mode,
    campaignMissionIndex: state.campaignMissionIndex,
    campaignPackId: state.campaignPackId,
    campaignEventTitle: state.campaignEventTitle,
    aiProfile: state.aiProfile,
    aiMacroPlan: state.aiDirector.macroPlan,
    aiEconomyMode: state.aiDirector.economyMode,
    aiPressureScore: Number(state.aiDirector.pressureScore.toFixed(3)),
    aiSkillEstimate: Number(state.aiDirector.skillEstimate.toFixed(3)),
    resources: {
      playerGold: Math.floor(state.playerGold),
      aiGold: Math.floor(state.aiGold),
      playerFood: Math.floor(state.playerResources.food),
      playerWood: Math.floor(state.playerResources.wood),
      playerStone: Math.floor(state.playerResources.stone),
    },
    combat: {
      wave: state.wave,
      kills: state.kills,
      playerUnitsAlive: state.units.filter((u) => u.isPlayer && !u.isDead).length,
      aiUnitsAlive: state.units.filter((u) => !u.isPlayer && !u.isDead).length,
      playerCastleHealth: Math.round(state.playerCastle.health),
      aiCastleHealth: Math.round(state.aiCastle.health),
    },
    tacticalControls: {
      battleStance: state.playerBattleStance,
      laneFocus: state.playerLaneFocus,
    },
    win: state.screen === 'gameover' ? state.isVictory : null,
    objectives: state.objectives.map((o) => ({
      id: o.id,
      progress: o.progress,
      target: o.target,
      completed: o.completed,
    })),
    rewards: {
      objectiveGold: state.matchRewardSummary.objectiveGold,
      objectiveGems: state.matchRewardSummary.objectiveGems,
      objectiveBattlePassXP: state.matchRewardSummary.objectiveBattlePassXP,
    },
  };
}

export function appendSnapshotWithLimit<T>(items: T[], item: T, limit: number): T[] {
  const boundedLimit = Math.max(1, limit);
  return [...items, item].slice(-boundedLimit);
}

export function parseStoredDiagnostics(raw: string | null): DiagnosticsSnapshot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as DiagnosticsSnapshot[];
  } catch {
    return [];
  }
}

export function buildDiagnosticsApiBatch(
  snapshots: DiagnosticsSnapshot[],
  exportedAt = Date.now()
): DiagnosticsApiBatch {
  const modeBreakdown: Record<GameState['mode'], number> = {
    campaign: 0,
    assault: 0,
    defense: 0,
    raid: 0,
    endless: 0,
  };
  let wins = 0;
  let losses = 0;
  let totalWave = 0;
  let totalKills = 0;
  let totalPressure = 0;

  for (const s of snapshots) {
    modeBreakdown[s.mode] += 1;
    if (s.win === true) wins += 1;
    if (s.win === false) losses += 1;
    totalWave += s.combat.wave;
    totalKills += s.combat.kills;
    totalPressure += s.aiPressureScore;
  }

  const count = Math.max(1, snapshots.length);
  const rows = snapshots.map((s) => ({
    ts: s.timestamp,
    src: s.source,
    mode: s.mode,
    win: s.win,
    wave: s.combat.wave,
    kills: s.combat.kills,
    aiPressure: s.aiPressureScore,
    aiSkill: s.aiSkillEstimate,
    packId: s.campaignPackId,
    event: s.campaignEventTitle,
    objectiveCompletionPct: s.objectives.length
      ? Math.round((s.objectives.filter((o) => o.completed).length / s.objectives.length) * 100)
      : 0,
  }));

  return {
    schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
    exportedAt,
    appId: 'ages-of-war',
    summary: {
      totalMatches: snapshots.length,
      wins,
      losses,
      avgWave: Number((totalWave / count).toFixed(2)),
      avgKills: Number((totalKills / count).toFixed(2)),
      avgAiPressure: Number((totalPressure / count).toFixed(3)),
      modeBreakdown,
    },
    rows,
  };
}
