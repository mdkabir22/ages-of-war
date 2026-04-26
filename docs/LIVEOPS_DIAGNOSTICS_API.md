# Live Ops Diagnostics API Contract

This document defines the expected HTTP contract for diagnostics uploads from the game client.

## Client Configuration

Set endpoint in `.env`:

`VITE_LIVEOPS_DIAGNOSTICS_ENDPOINT=https://your-domain/api/liveops/diagnostics`

If this variable is empty, the client uses the local queue/stub flow.

## Request

- Method: `POST`
- Header: `content-type: application/json`
- Header: `x-aow-diagnostics-schema: aow.liveops.v1`
- Body: `DiagnosticsApiBatch` JSON payload

## DiagnosticsApiBatch Shape

```json
{
  "schemaVersion": "aow.liveops.v1",
  "exportedAt": 1714050000000,
  "appId": "ages-of-war",
  "summary": {
    "totalMatches": 12,
    "wins": 7,
    "losses": 5,
    "avgWave": 8.42,
    "avgKills": 21.75,
    "avgAiPressure": 0.183,
    "modeBreakdown": {
      "campaign": 5,
      "assault": 2,
      "defense": 1,
      "raid": 1,
      "endless": 3
    }
  },
  "rows": [
    {
      "ts": 1714049900000,
      "src": "auto_match_end",
      "mode": "campaign",
      "win": true,
      "wave": 9,
      "kills": 26,
      "aiPressure": 0.22,
      "aiSkill": 0.61,
      "packId": "warpath",
      "event": "Supply Surge",
      "objectiveCompletionPct": 100
    }
  ]
}
```

## Successful Response

- Recommended: `200` or `202`
- Body can be minimal:

```json
{
  "ok": true
}
```

## Error Response

- For temporary failures (retryable): `5xx`
- For validation failures (non-retryable on current payload): `400`

The client currently marks failed uploads with error metadata in queue state.

## Minimal Node Handler (Express-style)

```ts
import type { Request, Response } from 'express';

export async function postLiveopsDiagnostics(req: Request, res: Response) {
  const schema = req.header('x-aow-diagnostics-schema');
  if (schema !== 'aow.liveops.v1') {
    return res.status(400).json({ ok: false, error: 'unsupported_schema' });
  }

  const payload = req.body;
  if (!payload || payload.appId !== 'ages-of-war' || !Array.isArray(payload.rows)) {
    return res.status(400).json({ ok: false, error: 'invalid_payload' });
  }

  // TODO: Persist to data warehouse / analytics store.
  // Example: await diagnosticsStore.insertBatch(payload);

  return res.status(202).json({ ok: true });
}
```

## Deployment Notes

- Add auth at edge/API gateway before public rollout.
- Add rate-limit by IP/user/session for abuse protection.
- Store raw payload + derived metrics for auditability.
- Keep backward compatibility when introducing `aow.liveops.v2`.
