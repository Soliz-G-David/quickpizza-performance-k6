param(
    [ValidateSet('smoke', 'load', 'spike', 'stress')]
    [string]$Profile = 'smoke',
    [string[]]$K6Arguments = @()
)

$ErrorActionPreference = 'Stop'
$repoDir = Split-Path -Parent $PSScriptRoot
$runId = 'quickpizza-{0}-{1}-{2}' -f $Profile, (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'), ([guid]::NewGuid().ToString('N').Substring(0, 8))
$environmentNames = @('K6_PROMETHEUS_RW_SERVER_URL', 'K6_PROMETHEUS_RW_TREND_AS_NATIVE_HISTOGRAM', 'K6_PROMETHEUS_RW_STALE_MARKERS')
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

Push-Location $repoDir
try {
    New-Item -ItemType Directory -Force -Path reports | Out-Null
    if (!$env:K6_PROMETHEUS_RW_SERVER_URL) {
        $env:K6_PROMETHEUS_RW_SERVER_URL = 'http://127.0.0.1:9090/api/v1/write'
    }
    $env:K6_PROMETHEUS_RW_TREND_AS_NATIVE_HISTOGRAM = 'true'
    $env:K6_PROMETHEUS_RW_STALE_MARKERS = 'true'

    Write-Host "Ejecución: $runId"
    & k6 run --out experimental-prometheus-rw `
        --tag "testid=$runId" --tag "profile=$Profile" `
        --summary-export "reports/$runId.json" `
        @K6Arguments "scripts/quickpizza-v5-$Profile.js"
    $exitCode = $LASTEXITCODE
} finally {
    foreach ($name in $environmentNames) {
        [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process')
    }
    Pop-Location
}
exit $exitCode
