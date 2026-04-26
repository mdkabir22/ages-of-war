# Ages of War Release Sign-Off Template

Use this template as the final release gate. Fill all fields and attach proof links.

## Release Metadata

- Release version: `<vX.Y.Z>`
- Target environment: `<production/staging>`
- Planned release date: `<YYYY-MM-DD>`
- Release manager: `<name>`
- Overall sign-off status: `<pending/approved/blocked>`

## Status Values

Use one of these values for each item:

- `pending`
- `in_progress`
- `blocked`
- `done`
- `waived` (requires reason)

## Sign-Off Items

### 1) Environment and Secrets

- Item: Production `.env` created from `.env.example`
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<PR link / screenshot / secret manager reference>`
- Item: Firebase keys (`VITE_FIREBASE_*`) configured for production project
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<link>`
- Item: `VITE_SENTRY_DSN` set to live DSN
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<link>`
- Item: `VITE_LIVEOPS_DIAGNOSTICS_ENDPOINT` set to live API URL
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<link>`
- Item: Secret scan confirmed (no secrets committed)
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<scan output link>`

### 2) Live Ops Diagnostics

- Item: API accepts `POST` with `x-aow-diagnostics-schema: aow.liveops.v1`
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<API test result>`
- Item: Success responses return `200` or `202`
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<logs/link>`
- Item: Failure responses mark queue items as `failed`
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<screenshot/log>`
- Item: Retry flow validated (re-queue + flush)
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<test run link>`
- Item: Contract reviewed in `docs/LIVEOPS_DIAGNOSTICS_API.md`
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<approval note>`

### 3) Functional QA Pass

- Item: All modes tested (`campaign`, `skirmish`, `endless`, `assault`, `defense`, `raid`)
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<QA report>`
- Item: Economy, buildings, and tech unlock flow validated
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<report>`
- Item: Tactics controls validated (stance, lane focus, command presets)
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<report/video>`
- Item: Campaign objective rotation and event cards validated
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<report>`
- Item: Profile diagnostics actions validated (export/batch/queue/flush/clear)
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<report>`

### 4) Stability and Errors

- Item: Error Boundary fallback verified under forced runtime error
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<screenshot>`
- Item: Sentry receives production test error event
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<Sentry event link>`
- Item: No crash loops observed in 10+ minute session
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<session log>`

### 5) Performance

- Item: Production build chunking verified
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<build output>`
- Item: Bundle analyzer reviewed for large chunks
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<analyzer snapshot>`
- Item: Low-end performance smoke test completed
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<FPS/latency notes>`

### 6) Tests and Build

- Item: Unit tests pass (`npm test`)
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<CI run link>`
- Item: Production build passes (`npm run build`)
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<CI/build log>`
- Item: Preview smoke test completed (`npm run preview`)
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<test notes>`

### 7) PWA and Offline

- Item: Service worker registration confirmed in production build
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<browser screenshot>`
- Item: Install prompt appears on supported platforms
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<screenshot>`
- Item: Offline startup confirmed with cached app shell
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<offline test notes>`

### 8) Capacitor Mobile Readiness

- Item: `npx cap sync` run after final build
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<terminal output>`
- Item: Splash/status bar behavior validated on Android and iOS
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<device screenshots>`
- Item: Keyboard/status bar overlap issues checked on target screens
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<QA notes>`

### 9) Release and Rollout

- Item: Version tag and release notes prepared
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<tag/changelog link>`
- Item: Staged rollout configured
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<rollout config>`
- Item: Monitoring plan active for first 24 hours (Sentry + diagnostics)
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<dashboard links>`
- Item: Rollback plan validated
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<rollback runbook>`

### 10) Post-Launch (First 72 Hours)

- Item: Win-rate and mode distribution reviewed from diagnostics batches
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<report link>`
- Item: Queue/transport failure reasons reviewed and triaged
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<issue tracker link>`
- Item: First balancing patch decision made using live sample size
  - Owner: `<name>`
  - Status: `<status>`
  - Completed date: `<YYYY-MM-DD>`
  - Evidence: `<design note>`

## Final Approvals

- Engineering lead approval: `<name/date/status>`
- QA lead approval: `<name/date/status>`
- Product owner approval: `<name/date/status>`
- Release decision: `<go/no-go>`
