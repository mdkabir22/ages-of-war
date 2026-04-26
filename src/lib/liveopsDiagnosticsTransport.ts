import type { DiagnosticsApiBatch } from './liveopsDiagnostics';

export const DIAGNOSTICS_UPLOAD_QUEUE_KEY = 'aow_liveops_upload_queue_v1';
const HTTP_MAX_RETRIES = 2;

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export interface QueuedDiagnosticsUpload {
  id: string;
  createdAt: number;
  status: 'queued' | 'sent' | 'failed';
  target: 'dashboard_api_stub' | 'dashboard_api_http';
  batch: DiagnosticsApiBatch;
  lastError?: string;
}

export function readDiagnosticsUploadQueue(raw: string | null): QueuedDiagnosticsUpload[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as QueuedDiagnosticsUpload[];
  } catch {
    return [];
  }
}

export function createQueuedDiagnosticsUpload(
  batch: DiagnosticsApiBatch,
  now = Date.now(),
  target: QueuedDiagnosticsUpload['target'] = 'dashboard_api_stub'
): QueuedDiagnosticsUpload {
  return {
    id: `diag_${now}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    status: 'queued',
    target,
    batch,
  };
}

export function appendUploadToQueue(
  queue: QueuedDiagnosticsUpload[],
  upload: QueuedDiagnosticsUpload,
  limit = 40
): QueuedDiagnosticsUpload[] {
  return [...queue, upload].slice(-Math.max(1, limit));
}

export async function flushDiagnosticsQueueStub(
  queue: QueuedDiagnosticsUpload[]
): Promise<QueuedDiagnosticsUpload[]> {
  // Stub transport: marks queued uploads as sent.
  return queue.map((item) =>
    item.status === 'queued'
      ? { ...item, status: 'sent', lastError: undefined }
      : item
  );
}

export async function flushDiagnosticsQueueHttp(
  queue: QueuedDiagnosticsUpload[],
  endpoint: string | undefined
): Promise<QueuedDiagnosticsUpload[]> {
  if (!endpoint) {
    return flushDiagnosticsQueueStub(queue);
  }

  const trimmed = endpoint.trim();
  if (!trimmed) {
    return flushDiagnosticsQueueStub(queue);
  }

  const next = [...queue];
  for (let i = 0; i < next.length; i++) {
    const item = next[i];
    if (item.status !== 'queued') continue;
    let delivered = false;
    let lastError: string | undefined;
    for (let attempt = 0; attempt <= HTTP_MAX_RETRIES; attempt++) {
      try {
        const resp = await fetch(trimmed, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-aow-diagnostics-schema': item.batch.schemaVersion,
          },
          body: JSON.stringify(item.batch),
        });
        if (resp.ok) {
          delivered = true;
          break;
        }

        lastError = `http_${resp.status}`;
        if (!shouldRetryStatus(resp.status) || attempt >= HTTP_MAX_RETRIES) {
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'network_error';
        if (attempt >= HTTP_MAX_RETRIES) {
          break;
        }
      }
    }

    next[i] = delivered
      ? { ...item, status: 'sent', lastError: undefined }
      : { ...item, status: 'failed', lastError: lastError ?? 'network_error' };
  }
  return next;
}
