# Stops what start-dev.ps1 started: the frontend, the Express API and the local PostgreSQL.
function Stop-Port($port) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Stop-Port 5173
Stop-Port 3000
& "C:\flowboard-pg\pgsql\bin\pg_ctl.exe" stop -D "C:\flowboard-pg\pgdata" -m fast 2>$null
Write-Host "FlowBoard stopped."
