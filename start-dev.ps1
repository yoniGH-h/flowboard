# Starts the FlowBoard dev stack, WITHOUT Docker:
#   1. a local PostgreSQL (portable build in C:\flowboard-pg) on port 5433
#   2. the Express API (backend-express) on port 3000, using its own database flowboard_express
#   3. the React frontend on port 5173
#
# Usage (from this folder):   .\start-dev.ps1        (add -Seed to reload the demo data)
# Stop everything with:       .\stop-dev.ps1
param([switch]$Seed)

$root = $PSScriptRoot
$api = Join-Path $root "backend-express"
$pgBin = "C:\flowboard-pg\pgsql\bin"
$pgData = "C:\flowboard-pg\pgdata"
$logs = Join-Path $env:TEMP "flowboard-logs"
New-Item -ItemType Directory -Force $logs | Out-Null

function Test-Port($port) { (Test-NetConnection 127.0.0.1 -Port $port -WarningAction SilentlyContinue).TcpTestSucceeded }

# 1. PostgreSQL
if (-not (Test-Path "$pgBin\pg_ctl.exe")) { throw "Portable PostgreSQL not found in C:\flowboard-pg" }
if (-not (Test-Port 5433)) {
    Write-Host "Starting PostgreSQL on 5433..."
    Start-Process "$pgBin\pg_ctl.exe" -ArgumentList @("start", "-D", "`"$pgData`"", "-o", "`"-p 5433`"", "-l", "`"$logs\postgres.log`"") -WindowStyle Hidden
    for ($i = 0; $i -lt 30 -and -not (Test-Port 5433); $i++) { Start-Sleep 1 }
}
if (-not (Test-Port 5433)) { throw "PostgreSQL did not start - see $logs\postgres.log" }

# 2. Express API: install, create the database if needed, apply migrations, (seed), start
if (-not (Test-Path "$api\.env")) { Copy-Item "$api\.env.example" "$api\.env" }
if (-not (Test-Path "$api\node_modules")) { npm install --prefix $api }

$env:PGPASSWORD = "flowboard"
$exists = & "$pgBin\psql.exe" -w -h 127.0.0.1 -p 5433 -U flowboard -d flowboard -tAc "SELECT 1 FROM pg_database WHERE datname = 'flowboard_express'"
if ($exists -ne "1") {
    Write-Host "Creating database flowboard_express..."
    & "$pgBin\psql.exe" -w -h 127.0.0.1 -p 5433 -U flowboard -d flowboard -c "CREATE DATABASE flowboard_express" | Out-Null
    $Seed = $true # a brand-new database needs the demo data
}

Push-Location $api
npx prisma migrate deploy
if ($Seed) { Write-Host "Loading demo data..."; node prisma/seed.js | Out-Null }
Pop-Location

if (-not (Test-Port 3000)) {
    Write-Host "Starting the Express API on 3000..."
    Start-Process node -ArgumentList @("src/server.js") -WorkingDirectory $api `
        -RedirectStandardOutput "$logs\api-express.out.log" -RedirectStandardError "$logs\api-express.err.log" -WindowStyle Hidden
    for ($i = 0; $i -lt 30 -and -not (Test-Port 3000); $i++) { Start-Sleep 1 }
}
if (-not (Test-Port 3000)) { throw "The API did not start - see $logs\api-express.err.log" }

# 3. Frontend
if (-not (Test-Port 5173)) {
    Write-Host "Starting the frontend on 5173..."
    if (-not (Test-Path "$root\frontend\node_modules")) { npm install --prefix "$root\frontend" }
    Start-Process cmd.exe -ArgumentList @("/c", "npm run dev -- --port 5173") -WorkingDirectory "$root\frontend" `
        -RedirectStandardOutput "$logs\frontend.out.log" -RedirectStandardError "$logs\frontend.err.log" -WindowStyle Hidden
    for ($i = 0; $i -lt 30 -and -not (Test-Port 5173); $i++) { Start-Sleep 1 }
}
if (-not (Test-Port 5173)) { throw "The frontend did not start - see $logs\frontend.out.log" }

Write-Host ""
Write-Host "FlowBoard is running:             http://127.0.0.1:5173"
Write-Host "Demo login:                      daniel.cho@nimbusdigital.io / password123"
Write-Host "API health check:                http://localhost:3000/api/health"
Write-Host "Logs:                            $logs"
Start-Process "http://127.0.0.1:5173"
