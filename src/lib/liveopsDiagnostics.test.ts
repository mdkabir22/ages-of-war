import { describe, expect, it } from 'vitest';
import { createInitialState } from '../game/engine';
import {
  appendSnapshotWithLimit,
  buildDiagnosticsApiBatch,
  buildDiagnosticsSnapshot,
  DIAGNOSTICS_SCHEMA_VERSION,
  parseStoredDiagnostics,
} from './liveopsDiagnostics';

describe('liveops diagnostics utils', () => {
  it('builds schema-versioned snapshot from game state', () => {
    const state = createInitialState(1000, 600, 'campaign');
    state.kills = 9;
    state.wave = 4;
    const snapshot = buildDiagnosticsSnapshot(state, 'manual', 123456);

    expect(snapshot.schemaVersion).toBe(DIAGNOSTICS_SCHEMA_VERSION);
    expect(snapshot.source).toBe('manual');
    expect(snapshot.timestamp).toBe(123456);
    expect(snapshot.mode).toBe('campaign');
    expect(snapshot.combat.kills).toBe(9);
    expect(snapshot.objectives.length).toBeGreaterThan(0);
  });

  it('appends diagnostics snapshots with fixed upper bound', () => {
    const initial = [{ timestamp: 1 }, { timestamp: 2 }, { timestamp: 3 }];
    const next = appendSnapshotWithLimit(initial, { timestamp: 4 }, 3);
    expect(next).toEqual([{ timestamp: 2 }, { timestamp: 3 }, { timestamp: 4 }]);
  });

  it('parses stored diagnostics safely', () => {
    const valid = parseStoredDiagnostics('[{"timestamp":1}]');
    const invalid = parseStoredDiagnostics('{bad json');
    expect(valid).toHaveLength(1);
    expect(invalid).toEqual([]);
  });

  it('builds API-ready diagnostics batch summary', () => {
    const a = createInitialState(1000, 600, 'campaign');
    const b = createInitialState(1000, 600, 'endless');
    a.screen = 'gameover';
    a.isVictory = true;
    a.wave = 8;
    a.kills = 21;
    b.screen = 'gameover';
    b.isVictory = false;
    b.wave = 5;
    b.kills = 13;

    const snapshots = [
      buildDiagnosticsSnapshot(a, 'auto_match_end', 100),
      buildDiagnosticsSnapshot(b, 'auto_match_end', 200),
    ];
    const batch = buildDiagnosticsApiBatch(snapshots, 300);

    expect(batch.schemaVersion).toBe(DIAGNOSTICS_SCHEMA_VERSION);
    expect(batch.summary.totalMatches).toBe(2);
    expect(batch.summary.wins).toBe(1);
    expect(batch.summary.losses).toBe(1);
    expect(batch.summary.modeBreakdown.campaign).toBe(1);
    expect(batch.summary.modeBreakdown.endless).toBe(1);
    expect(batch.rows).toHaveLength(2);
  });
});
