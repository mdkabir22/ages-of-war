# Day 0 to Day 3 Operations Guide

This guide covers live operations for the first 72 hours after release.

## Objective

- Detect issues early
- Stabilize crash/error profile
- Validate gameplay balance assumptions
- Prepare first safe tuning update (if needed)

## Time Windows

- Day 0: launch to +24 hours
- Day 1: +24 to +48 hours
- Day 2-3: +48 to +72 hours

## Monitoring Inputs

- Sentry (errors/crashes)
- Diagnostics API ingestion stats
- Dashboard panels from `docs/BALANCING_DASHBOARD_WORKFLOW.md`
- Queue/transport error distribution (`http_4xx`, `http_5xx`, network failures)

## Day 0 (Launch Day)

### Every 30-60 Minutes

- Check Sentry error volume and top exception groups.
- Check diagnostics endpoint success/failure ratio.
- Check app availability and route load health.

### Day 0 Thresholds

- If crash-free sessions drop sharply, trigger incident triage.
- If diagnostics success rate falls below 95%, investigate endpoint and fallback behavior.
- If repeated `http_4xx` appears, verify payload/schema compatibility.

### Day 0 Actions

- Triage top 3 errors by impact.
- Classify each issue:
  - hotfix now
  - defer with mitigation
  - monitor only
- Keep release channel updated with hourly status.

## Day 1

### Balance Validation

- Review win rate by mode.
- Review `aiPressure` distribution by mode.
- Review objective completion percentage by mode and campaign pack.

### Day 1 Thresholds

- Mode win rate outside 45%-58% for sustained samples.
- Objective completion under 45% in a major mode.
- Event/pack outliers with >15% deviation.

### Day 1 Actions

- Propose one low-risk tuning change only (single-variable adjustment).
- Define expected outcome and success metric before rollout.
- Prepare staged rollout plan for tuning patch.

## Day 2 to Day 3

### Stability Confirmation

- Confirm crash trends are flat or improving.
- Confirm diagnostics reliability >=98% (with retry behavior).
- Confirm no major progression blockers reported.

### Tuning Decision

- If metrics are healthy: no patch, continue monitoring.
- If metrics are unhealthy: rollout first balancing patch to limited cohort.
- Compare pre/post 24h deltas before full rollout.

## Incident Severity Model

- P0: service/game unusable, widespread impact
- P1: major gameplay/progression broken for many users
- P2: noticeable issue with workaround
- P3: minor issue, low impact

## Escalation Flow

1. Detect issue from monitoring or player report.
2. Create incident ticket with severity.
3. Assign owner and ETA.
4. Communicate status every 30-60 minutes for P0/P1.
5. Close with root cause + prevention notes.

## Daily Reporting Template

- Date window:
- Active users (if available):
- Crash trend:
- Diagnostics success rate:
- Top 3 issues:
- Balance highlights:
- Actions taken:
- Next 24h plan:

## Exit Criteria (End of Day 3)

- No unresolved P0/P1 issues.
- Diagnostics transport stable and observable.
- Core mode balance within acceptable bands.
- Team decision logged:
  - stable baseline achieved
  - or follow-up tuning cycle required
