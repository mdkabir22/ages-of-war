# Ages of War Master Handoff

Single-page command center for final release execution.

## 1) What This Is

Use this document as the launch sequence index.  
Follow sections in order and use linked docs for details.

## 2) Current Program Status

- In-product implementation: ~96-98% complete
- Remaining: operational execution + telemetry follow-through
- Local constraint: Node.js/npm not available on current machine for local test/build runs

## 3) Source of Truth Docs (Execution Order)

1. `docs/ACTION_PLAN.md`  
   Overall step tracking and completion status.
2. `docs/READY_TO_SHIP_CHECKLIST.md`  
   Structured sign-off template (owner/status/date/evidence).
3. `docs/LIVEOPS_DIAGNOSTICS_API.md`  
   Diagnostics API request/response contract and backend handler template.
4. `docs/BALANCING_DASHBOARD_WORKFLOW.md`  
   Dashboard panels, thresholds, and balancing loop.
5. `docs/GO_LIVE_RUNBOOK.md`  
   T-24h, preflight, deployment sequence, go/no-go, rollback.
6. `docs/DAY0_DAY3_OPERATIONS.md`  
   Post-launch operations for first 72 hours.
7. `docs/RELEASE_EXECUTION_LOG.md`  
   Real execution log and evidence tracker.
8. `docs/DIAGNOSTICS_REPORT_TOOL.md`  
   Local report generator from API batch exports.

## 4) Final Execution Flow

### Phase A: Release Readiness

- Complete all sign-off items in `docs/READY_TO_SHIP_CHECKLIST.md`.
- Confirm diagnostics endpoint compatibility using `docs/LIVEOPS_DIAGNOSTICS_API.md`.
- Validate monitoring and dashboard views from `docs/BALANCING_DASHBOARD_WORKFLOW.md`.

### Phase B: Go-Live

- Execute preflight + deployment steps from `docs/GO_LIVE_RUNBOOK.md`.
- Perform immediate smoke tests (routes, match flow, diagnostics queue flush, Sentry signal).
- Record evidence links for each completed release checkpoint.

### Phase C: First 72 Hours

- Run monitoring cadence and threshold checks from `docs/DAY0_DAY3_OPERATIONS.md`.
- Triage incidents by severity and run escalation flow when needed.
- Decide on first tuning patch only after sufficient live sample size.

## 5) Minimum Ownership Map

- Release Manager: timeline + go/no-go decision owner
- Engineering Owner: deployment and hotfix owner
- QA Owner: functional and smoke verification owner
- Ops Owner: monitoring, incident comms, and telemetry owner

## 6) Done Definition (Program Close)

Mark release close when all are true:

- Sign-off template fully completed with evidence.
- Production deployment completed with stable core gameplay flow.
- Diagnostics transport healthy and observable.
- Day 0-3 operations completed with no unresolved P0/P1 issues.
- Follow-up tuning decision logged (patch needed or baseline accepted).

## 7) Immediate Next Action

Start from `docs/READY_TO_SHIP_CHECKLIST.md` and fill all `pending` items with owners and dates, then execute `docs/GO_LIVE_RUNBOOK.md`.

## 8) Fast Start Commands

- Run preflight:
  - `powershell -ExecutionPolicy Bypass -File .\release-preflight.ps1 -EnvFile ".env.local"`
- Generate diagnostics report from exported batch:
  - `node .\diagnostics-report.js .\aow-liveops-api-batch-<ts>.json`
- Record outputs in:
  - `docs/RELEASE_EXECUTION_LOG.md`
