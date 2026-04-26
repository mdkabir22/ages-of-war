Param(
  [string]$EnvFile = ".env.local",
  [string]$DiagnosticsHealthUrl = "",
  [switch]$SkipEndpointCheck
)

$ErrorActionPreference = "Stop"

function Write-Status($label, $value) {
  Write-Host ("[{0}] {1}" -f $label, $value)
}

function Load-EnvFile($path) {
  $map = @{}
  if (-not (Test-Path $path)) {
    return $map
  }
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    $map[$key] = $val
  }
  return $map
}

$requiredEnvKeys = @(
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_MEASUREMENT_ID",
  "VITE_SENTRY_DSN",
  "VITE_LIVEOPS_DIAGNOSTICS_ENDPOINT"
)

Write-Host "== Ages of War Release Preflight =="
Write-Status "INFO" ("Working directory: " + (Get-Location).Path)
Write-Status "INFO" ("Env file: " + $EnvFile)

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue

if ($nodeCmd) { Write-Status "OK" ("node found: " + $nodeCmd.Source) } else { Write-Status "FAIL" "node not found in PATH" }
if ($npmCmd) { Write-Status "OK" ("npm found: " + $npmCmd.Source) } else { Write-Status "FAIL" "npm not found in PATH" }

$envMap = Load-EnvFile $EnvFile
$missing = @()
foreach ($key in $requiredEnvKeys) {
  $val = $envMap[$key]
  if ([string]::IsNullOrWhiteSpace($val)) {
    $missing += $key
    Write-Status "MISSING" $key
  } else {
    Write-Status "OK" ($key + " set")
  }
}

if (-not $SkipEndpointCheck) {
  $endpoint = $DiagnosticsHealthUrl
  if ([string]::IsNullOrWhiteSpace($endpoint)) {
    $endpoint = $envMap["VITE_LIVEOPS_DIAGNOSTICS_ENDPOINT"]
  }
  if ([string]::IsNullOrWhiteSpace($endpoint)) {
    Write-Status "WARN" "No diagnostics endpoint available for health check"
  } else {
    try {
      $resp = Invoke-WebRequest -Uri $endpoint -Method Head -TimeoutSec 10
      Write-Status "OK" ("Diagnostics endpoint reachable: HTTP " + $resp.StatusCode)
    } catch {
      Write-Status "WARN" ("Diagnostics endpoint health check failed: " + $_.Exception.Message)
    }
  }
}

$docs = @(
  "docs/MASTER_HANDOFF.md",
  "docs/READY_TO_SHIP_CHECKLIST.md",
  "docs/GO_LIVE_RUNBOOK.md",
  "docs/DAY0_DAY3_OPERATIONS.md",
  "docs/LIVEOPS_DIAGNOSTICS_API.md"
)

foreach ($doc in $docs) {
  if (Test-Path $doc) { Write-Status "OK" ($doc + " found") } else { Write-Status "MISSING" ($doc + " not found") }
}

Write-Host ""
if ($missing.Count -gt 0 -or -not $nodeCmd -or -not $npmCmd) {
  Write-Host "Preflight result: NOT READY"
  exit 1
}

Write-Host "Preflight result: READY"
exit 0
