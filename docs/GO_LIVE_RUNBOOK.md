# Ages of War Go-Live Runbook

This runbook is the execution guide for production release.

## Scope

- Web app release (Vite/PWA build)
- Diagnostics endpoint activation
- Monitoring readiness (Sentry + live ops diagnostics)
- Rollback safety

## Preconditions (Must Be True)

- `docs/READY_TO_SHIP_CHECKLIST.md` is fully signed off.
- Production env values are prepared and validated.
- Diagnostics API contract support is confirmed (`docs/LIVEOPS_DIAGNOSTICS_API.md`).
- Stakeholders are aligned on release window and rollback owner.

## Release Roles

- Release manager: owns timeline and go/no-go call.
- Engineering owner: owns technical deployment.
- QA owner: owns final smoke verification.
- Ops owner: owns monitoring and incident triage.

## T-24h Checklist

- Confirm release tag/version.
- Confirm all required env vars for production:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_FIREBASE_MEASUREMENT_ID`
  - `VITE_SENTRY_DSN`
  - `VITE_LIVEOPS_DIAGNOSTICS_ENDPOINT`
- Ensure diagnostics endpoint health check is green.
- Ensure release and rollback contacts are available.

## T-60m Preflight

- Freeze non-critical merges.
- Confirm latest commit hash planned for release.
- Re-check deployment target environment (prod, not staging).
- Re-check feature flags and maintenance mode state.
- Confirm monitoring dashboards are open and shared with team.

## Deployment Sequence

1. Build and deploy web production artifact.
2. Verify app routes load (`/`, `/menu`, `/game`, `/settings`, `/profile`).
3. Verify service worker registration in production.
4. Trigger one test match and ensure:
   - match end summary is generated
   - API batch queue can be flushed
5. Verify diagnostics endpoint receives payload successfully.
6. Verify Sentry receives at least one controlled test event.

## Immediate Smoke Tests (Post Deploy)

- Start match in `assault` and complete quickly.
- Start match in `campaign` and verify mission descriptor + event card.
- Use tactical controls (stance + lane focus + preset command).
- Open profile and execute:
  - export stored summaries
  - export API batch
  - queue API batch
  - flush queue
- Confirm no severe console/runtime errors.

## Go/No-Go Criteria

Go if all are true:

- Core routes and match flow stable.
- Diagnostics upload success rate is healthy.
- No P0/P1 gameplay regressions.
- Monitoring is clean (no severe crash spike).

No-Go if any are true:

- Match cannot complete reliably.
- Diagnostics endpoint consistently fails.
- Severe crash loop or major progression corruption.

## Rollback Plan

- Roll back to last known stable build artifact.
- Optionally disable diagnostics HTTP by clearing `VITE_LIVEOPS_DIAGNOSTICS_ENDPOINT`.
- Announce rollback in release channel with cause and next ETA.
- Keep incident log with timeline and impact scope.

## Communication Template

- Release start: "Production deployment started at <time>, owner <name>."
- Release complete: "Deployment complete at <time>, monitoring active."
- Rollback: "Rollback initiated at <time> due to <reason>. Investigating."

## Evidence to Capture

- Release commit hash/tag
- Deployment log link
- Smoke test evidence links
- Diagnostics endpoint success sample
- Sentry verification link
- Final go/no-go decision note
