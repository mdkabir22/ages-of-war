# Live Ops Balancing Dashboard Workflow

This workflow defines the minimum dashboard views needed for first production balancing decisions.

## Data Source

- Ingest `DiagnosticsApiBatch` payloads described in `docs/LIVEOPS_DIAGNOSTICS_API.md`.
- Store both:
  - raw batch payloads (audit/debug)
  - flattened row-level table for analytics

## Required Dashboard Panels

## 1) Match Outcomes

- Win rate by mode (`campaign`, `assault`, `defense`, `raid`, `endless`).
- Median wave and kills by mode.
- 24h trend of wins/losses.

## 2) AI Pressure and Difficulty

- Distribution of `aiPressure` per mode.
- Correlation: `aiPressure` vs `win`.
- Alert when average `aiPressure` changes more than +/-20% day-over-day.

## 3) Objective Completion

- Average `objectiveCompletionPct` by mode and campaign pack.
- Completion funnel for campaign cohorts.
- Alert if completion drops below 45% in any mode.

## 4) Campaign Content Health

- Performance split by `packId` and `event`.
- Win rate and avg wave per campaign pack.
- Event-level outliers (events with >15% deviation from pack baseline).

## 5) Transport Reliability

- Queue flush success ratio.
- Count of `http_4xx`, `http_5xx`, and network failures.
- Endpoint latency p50/p95 if backend instrumentation is available.

## Weekly Live Ops Loop

1. Export last 7 days by mode + pack.
2. Identify one overperforming and one underperforming segment.
3. Propose one safe tuning change (single variable).
4. Roll out to small cohort first.
5. Compare 24h and 72h deltas before full rollout.

## Initial Success Targets

- Global win rate target: 45% to 58% (mode-normalized).
- Campaign mission completion target: >=60% for early pack, >=45% for late pack.
- Diagnostics upload success target: >=98% within 2 retry attempts.
