# Supabase delivery schedules backup script
$ErrorActionPreference = 'Stop'

$SUPABASE_URL = "https://gideypynmhpjucgszyce.supabase.co"
$SUPABASE_ANON_KEY = "sb_publishable_pLF_neZMUjj3G7PsiH_tuw_rfRuu8eP"

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $PSScriptRoot "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
}

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "Supabase Delivery Schedules Backup Starting: $timestamp" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

$headers = @{
    "apikey" = $SUPABASE_ANON_KEY
    "Authorization" = "Bearer $SUPABASE_ANON_KEY"
    "Accept" = "application/json"
}

try {
    Write-Host "Fetching data from Supabase..." -ForegroundColor Yellow
    $url = "$SUPABASE_URL/rest/v1/delivery_schedules?select=*"
    $response = Invoke-RestMethod -Uri $url -Method Get -Headers $headers

    $recordCount = $response.Count
    Write-Host "Received $recordCount records from Supabase." -ForegroundColor Green

    # 1. JSON Backup
    $jsonPath = Join-Path $backupDir "delivery_schedules_$timestamp.json"
    $response | ConvertTo-Json -Depth 10 | Set-Content -Path $jsonPath -Encoding UTF8
    Write-Host "JSON Backup saved: $jsonPath" -ForegroundColor Green

    # 2. CSV Backup
    $csvPath = Join-Path $backupDir "delivery_schedules_$timestamp.csv"
    $response | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
    Write-Host "CSV Backup saved:  $csvPath" -ForegroundColor Green

    Write-Host "Backup completed successfully!" -ForegroundColor Cyan
} catch {
    Write-Error "Backup failed: $_"
}
