param([Parameter(Mandatory=$true)][string]$BackupFile,[Parameter(Mandatory=$true)][string]$TargetDatabase)
$ErrorActionPreference = 'Stop'
if ($TargetDatabase -notmatch '^restore_[a-z0-9_]+$') { throw 'Usa una base nueva con nombre restore_ seguido de letras, números o guiones bajos.' }
$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
docker compose cp $resolvedBackup db:/tmp/catalog-restore.dump
if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar el archivo.' }
docker compose exec -T db createdb -U catalog_admin -O catalog_app $TargetDatabase
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base nueva; no se sobrescribe ninguna existente.' }
docker compose exec -T db pg_restore -U catalog_admin --exit-on-error -d $TargetDatabase /tmp/catalog-restore.dump
if ($LASTEXITCODE -ne 0) { throw 'La restauración ha fallado. La base original sigue intacta.' }
Write-Output "Copia restaurada en $TargetDatabase. La aplicación sigue usando su base original."
