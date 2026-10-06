# Restores a backup made by backup.ps1 into the FlowBoard database (flowboard_express).
# Usage (from the flowboard folder):  .\scripts\restore.ps1 -BackupFile .\backups\flowboard-....sql
param([Parameter(Mandatory = $true)][string]$BackupFile)
$ErrorActionPreference = 'Stop'
$pgBin = 'C:\flowboard-pg\pgsql\bin'
$resolvedRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
if (-not $resolvedBackup.StartsWith($resolvedRoot)) { throw 'Backup file must be inside the project directory.' }
$env:PGPASSWORD = 'flowboard'
# Piped through stdin: psql can't open paths with Hebrew characters itself.
Get-Content -Raw -Encoding utf8 -LiteralPath $resolvedBackup | & "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U flowboard -v ON_ERROR_STOP=1 -q flowboard_express
if ($LASTEXITCODE -ne 0) { throw 'Restore failed.' }
Write-Output 'Database restore completed.'
