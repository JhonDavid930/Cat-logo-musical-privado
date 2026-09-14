param([string]$OutputDirectory = 'private/backups')
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$backupName = 'catalog-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump'
$backupPath = Join-Path (Resolve-Path -LiteralPath $OutputDirectory) $backupName
docker compose exec -T db pg_dump -U catalog_admin -d catalog -Fc -f /tmp/catalog-backup.dump
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la copia PostgreSQL.' }
docker compose cp db:/tmp/catalog-backup.dump $backupPath
if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar la copia al equipo.' }
Get-FileHash -LiteralPath $backupPath -Algorithm SHA256
