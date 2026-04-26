# Diagnostics Report Tool

Use this local tool to convert exported diagnostics API batch JSON into a quick Markdown report.

## File

- `diagnostics-report.js`

## Input

- JSON exported from profile screen `Export API Batch`
- Expected shape: `DiagnosticsApiBatch` (`docs/LIVEOPS_DIAGNOSTICS_API.md`)

## Usage

```powershell
node .\diagnostics-report.js .\aow-liveops-api-batch-123456.json
```

Optional output path:

```powershell
node .\diagnostics-report.js .\aow-liveops-api-batch-123456.json .\report.md
```

Compare two batches (before vs after tuning):

```powershell
node .\diagnostics-report.js --compare .\baseline.json .\candidate.json .\compare-report.md
```

## Output Includes

- Match totals and win rate
- Average wave / kills / AI pressure / objective completion
- Mode breakdown
- Top event frequency
- Quick threshold flags aligned with live-ops targets
- Compare mode deltas (candidate - baseline) for:
  - win rate
  - avg wave
  - avg kills
  - avg AI pressure
  - objective completion
  - mode mix shifts

## Typical Workflow

1. Export API batch from profile diagnostics panel.
2. Run `diagnostics-report.js`.
3. Attach generated report to `docs/RELEASE_EXECUTION_LOG.md` or ops updates.
4. For balancing iterations, run `--compare` and attach delta report.
