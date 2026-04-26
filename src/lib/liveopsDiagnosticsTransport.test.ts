import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/engine';
import { buildDiagnosticsApiBatch, buildDiagnosticsSnapshot } from './liveopsDiagnostics';
import {
  appendUploadToQueue,
  createQueuedDiagnosticsUpload,
  flushDiagnosticsQueueHttp,
  flushDiagnosticsQueueStub,
  readDiagnosticsUploadQueue,
} from './liveopsDiagnosticsTransport';

describe('liveops diagnostics transport stub', () => {
  it('queues and bounds upload entries', () => {
    const state = createInitialState(1000, 600, 'campaign');
    const batch = buildDiagnosticsApiBatch([buildDiagnosticsSnapshot(state)], 123);
    const q1 = createQueuedDiagnosticsUpload(batch, 1000);
    const q2 = createQueuedDiagnosticsUpload(batch, 2000);
    const next = appendUploadToQueue([q1], q2, 1);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe(q2.id);
  });

  it('parses queue JSON safely', () => {
    const ok = readDiagnosticsUploadQueue('[{"id":"x","createdAt":1,"status":"queued","target":"dashboard_api_stub","batch":{"schemaVersion":"a","exportedAt":1,"appId":"ages-of-war","summary":{"totalMatches":0,"wins":0,"losses":0,"avgWave":0,"avgKills":0,"avgAiPressure":0,"modeBreakdown":{"campaign":0,"assault":0,"defense":0,"raid":0,"endless":0}},"rows":[]}}]');
    const bad = readDiagnosticsUploadQueue('{oops');
    expect(ok).toHaveLength(1);
    expect(bad).toEqual([]);
  });

  it('flush stub marks queued uploads as sent', async () => {
    const state = createInitialState(1000, 600, 'campaign');
    const batch = buildDiagnosticsApiBatch([buildDiagnosticsSnapshot(state)]);
    const queued = createQueuedDiagnosticsUpload(batch, 1000);
    const flushed = await flushDiagnosticsQueueStub([queued]);
    expect(flushed[0].status).toBe('sent');
  });

  it('flush http falls back to stub when no endpoint', async () => {
    const state = createInitialState(1000, 600, 'campaign');
    const batch = buildDiagnosticsApiBatch([buildDiagnosticsSnapshot(state)]);
    const queued = createQueuedDiagnosticsUpload(batch, 1000);
    const flushed = await flushDiagnosticsQueueHttp([queued], '');
    expect(flushed[0].status).toBe('sent');
  });

  it('flush http marks upload sent on ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const state = createInitialState(1000, 600, 'campaign');
    const batch = buildDiagnosticsApiBatch([buildDiagnosticsSnapshot(state)]);
    const queued = createQueuedDiagnosticsUpload(batch, 1000, 'dashboard_api_http');
    const flushed = await flushDiagnosticsQueueHttp([queued], 'https://example.com/diag');
    expect(flushed[0].status).toBe('sent');
    vi.unstubAllGlobals();
  });

  it('flush http retries transient failures and succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const state = createInitialState(1000, 600, 'campaign');
    const batch = buildDiagnosticsApiBatch([buildDiagnosticsSnapshot(state)]);
    const queued = createQueuedDiagnosticsUpload(batch, 1000, 'dashboard_api_http');
    const flushed = await flushDiagnosticsQueueHttp([queued], 'https://example.com/diag');
    expect(flushed[0].status).toBe('sent');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('flush http does not retry non-transient 4xx errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    vi.stubGlobal('fetch', fetchMock);
    const state = createInitialState(1000, 600, 'campaign');
    const batch = buildDiagnosticsApiBatch([buildDiagnosticsSnapshot(state)]);
    const queued = createQueuedDiagnosticsUpload(batch, 1000, 'dashboard_api_http');
    const flushed = await flushDiagnosticsQueueHttp([queued], 'https://example.com/diag');
    expect(flushed[0].status).toBe('failed');
    expect(flushed[0].lastError).toBe('http_400');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
