# Full backup of the FlowBoard database (flowboard_express) with pg_dump from the portable
# PostgreSQL in C:\flowboard-pg. Usage (from the flowboard folder):  .\scripts\backup.ps1
param([string]$OutputDirectory = (Join-Path $PSScriptRoot '..\backups'))
$ErrorActionPreference = 'Stop'
$pgBin = 'C:\flowboard-pg\pgsql\bin'
$resolvedRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
if (-not $resolvedOutput.StartsWith($resolvedRoot)) { throw 'Backup output must stay inside the project directory.' }
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$path = Join-Path $resolvedOutput "flowboard-$stamp.sql"
$env:PGPASSWORD = 'flowboard'
# pg_dump writes to stdout and PowerShell saves the file: pg_dump itself can't open paths with
# Hebrew characters (like this project's OneDrive folder).
& "$pgBin\pg_dump.exe" -h 127.0.0.1 -p 5433 -U flowboard --clean --if-exists flowboard_express | Set-Content -Encoding utf8 -LiteralPath $path
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed - is PostgreSQL running (.\start-dev.ps1)?' }
Write-Output "Database backup created: $path"
