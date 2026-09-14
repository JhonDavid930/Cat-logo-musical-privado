# Guía de instalación y traslado

Actualizada el 2026-09-14: ensayo Docker/PostgreSQL local aislado superado mediante scripts/test-docker.mjs. Los pasos de instalación del propietario/NAS siguen siendo futuros; no se ejecutaron sobre datos reales. Consulta primero [PROJECT_STATUS.md](PROJECT_STATUS.md). No trasladar archivos al NAS ni hacer Deploy hasta validar localmente y obtener aprobación del propietario.

## Qué está preparado y qué falta

Hay una aplicación funcional y dos servicios Docker: aplicación + PostgreSQL propio. No requiere Supabase ni pagar una cuota para exportar datos. La electricidad, discos, copias y conectividad del equipo siguen siendo necesarios. No se ha desplegado en Internet ni en el NAS.

NAS comprobado por su pantalla de información: Synology DS225+, Intel Celeron J4125 x86-64, 2 GB RAM, DSM 7.3.2-86009 Update 4. Container Manager instalado (Package Center muestra Open). No se cambió ninguna configuración. La prueba local de Docker pasó el 14 de septiembre; la incidencia anterior está documentada en DOCKER_LOCAL_ISSUE.md como historial.

## 1. Probar en el ordenador

Instala Node.js 24 de la fuente oficial si hace falta. Abre PowerShell en esta carpeta:

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

Abre http://127.0.0.1:3000. Esta dirección solo sirve en este ordenador. No la expongas mediante un túnel: la vista DEV no pide contraseña. Los contenedores funcionan en modo producción y nunca habilitan esta excepción.

La base local está en `private/catalog.sqlite`. Para una copia portable mientras está abierta, usa el ZIP completo de la interfaz; JSON copia solo metadatos. No copies solo SQLite ignorando su WAL. En una instalación nueva, `private/catalog.json` se carga una vez. El importador `npm run import:notion` lee la exportación privada `private/notion-source.json` y produce ese JSON: no consulta Notion en vivo ni sustituye una base existente. No ejecutarlo como paso rutinario de arranque.

## 2. Preparar las llaves del acceso privado

La contraseña la elige el propietario y no se escribe en el chat. En PowerShell:

```powershell
$catalogPassword = Read-Host 'Contraseña del catálogo, al menos 14 caracteres' -AsSecureString
try {
  $env:CATALOG_SETUP_PASSWORD = [System.Net.NetworkCredential]::new('', $catalogPassword).Password
  node scripts/setup-secrets.mjs
} finally {
  Remove-Item Env:CATALOG_SETUP_PASSWORD -ErrorAction SilentlyContinue
  $catalogPassword.Dispose()
}
```

El script guarda el hash de la contraseña y secretos aleatorios en `private/secrets`. No imprime sus valores y no sobrescribe secretos existentes. En Linux la carpeta usa 0700: solo su propietario puede atravesarla. Los archivos usan 0444 para que los usuarios sin privilegios del contenedor lean su montaje individual. Al trasladarlos, conserva la carpeta privada 0700 y los archivos 0444; en Windows protege la carpeta con ACL. No subas la carpeta a Git. Las llaves de base y sesión se montan como archivos de secretos; no van dentro de la imagen.

## 3. Construir los contenedores

Primero `docker info` debe funcionar. El 14 de septiembre responde correctamente y el ensayo aislado está validado; volver a comprobarlo si se retoma en otro momento. No uses Factory Reset. Si npm run dev sigue abierto en el puerto 3000, detén únicamente ese servidor con Ctrl+C antes de iniciar Compose, que publica el mismo puerto.

```powershell
docker compose config --quiet
docker compose build app
docker compose up -d
docker compose ps
```

La primera puesta en marcha crea una base vacía y un usuario de aplicación sin privilegios de administrador. PostgreSQL no publica el puerto 5432. La app publica solo 127.0.0.1:3000 para un Reverse Proxy del mismo equipo. La inicialización SQL se ejecuta únicamente con un volumen nuevo; cambiar schema.sql no migra por sí solo un volumen existente.

No hace falta cargar tus datos durante el Build: la imagen contiene código, no tu catálogo. Entra por HTTPS después de configurar el acceso y, en Copias de seguridad, restaura el ZIP completo exportado de tu vista local. Revisa los recuentos antes de seguir.

## 4. Trasladar a tu Synology

Construye la imagen fuera del NAS: sus 2 GB de RAM se comparten con DSM y los paquetes instalados. El tamaño real y el consumo deben medirse después del primer arranque, no se garantizan de antemano.

```powershell
docker buildx build --platform linux/amd64 --load -t david-appleton:0.1.0 .
docker save -o private/david-appleton-0.1.0.tar david-appleton:0.1.0
```

Cuando el propietario autorice desplegar:

1. Crea una carpeta privada del proyecto en el NAS. Copia Compose, `database/`, `docker/` y los secretos por un canal privado. No los publiques.
2. En Container Manager, importa la imagen TAR. El TAR no contiene tu catálogo ni secretos.
3. En una copia NAS de Compose sustituye `build: .` de app por `image: david-appleton:0.1.0`. Mantén el nombre del proyecto y el volumen estables. Usa rutas existentes del NAS para los archivos montados.
4. Crea el proyecto en Container Manager con esa carpeta y YAML. Comprueba que los dos servicios estén healthy.
5. Configura un Reverse Proxy HTTPS de DSM hacia `127.0.0.1:3000` en el mismo NAS. No publiques PostgreSQL ni el panel DSM para acceder al catálogo.
6. Configura `CATALOG_APP_URL` con la dirección HTTPS exacta elegida, sin barra final. Debe coincidir con la dirección que abres; protege los guardados contra peticiones de otros sitios.
7. Accede con la contraseña del catálogo y restaura el ZIP completo. Comprueba una canción, una versión, los créditos, la descarga y reproducción de un archivo y una nueva copia completa.

El acceso mundial requiere una ruta de red deliberada: VPN privada o dominio y HTTPS con Reverse Proxy, según la conexión y el router. La IP 192.168.1.200 es solo local. QuickConnect de DSM no convierte automáticamente cualquier contenedor en una web accesible. No se ha configurado red, DNS, VPN, certificados ni puertos externos en esta entrega.

## 5. Alternativa VPS con HTTPS

El archivo opcional `compose.https.yaml` añade Caddy. Se usa en un VPS con dominio apuntando al servidor; no lo actives sobre puertos 80/443 ya usados por DSM.

```powershell
$env:CATALOG_DOMAIN = 'catalogo.tu-dominio.example'
$env:CATALOG_APP_URL = 'https://catalogo.tu-dominio.example'
docker compose -f compose.yaml -f compose.https.yaml up -d --build
```

Esta acción publica HTTPS y solo debe ejecutarse después de configurar dominio, contraseña y aprobación del propietario. La comunicación app/base permanece en una red Docker privada. Conserva el volumen `tls_data` para los certificados, `catalog_database` para los datos y `catalog_files` para los archivos originales. En otro host Linux las mismas imágenes pueden reconstruirse, pero ARM64 todavía no está probado; para este Synology utiliza linux/amd64.

## 6. Copias de seguridad

La copia JSON contiene fichas, relaciones, letras, créditos, estados, fuentes, sociedades PRO y metadatos de documentos; nunca contiene binarios, sean subidos o enlazados. Para archivos subidos usa el ZIP completo. Ninguna modalidad descarga contenido de enlaces externos de Drive/NAS.

Para una copia solo de la base PostgreSQL desde PowerShell (no incluye los binarios):

```powershell
./scripts/backup-db.ps1
```

El script hace pg_dump en formato custom dentro del contenedor y lo copia al equipo, evitando corromper binarios mediante redirección de PowerShell. Conserva también `private/secrets` cifrado y por separado. Guarda otra copia en un dispositivo distinto y comprueba restauraciones periódicamente; no basta con que exista el archivo.

En NAS/Linux se puede usar el mismo patrón: `docker compose exec -T db pg_dump -U catalog_admin -d catalog -Fc -f /tmp/catalog-backup.dump`, seguido de `docker compose cp db:/tmp/catalog-backup.dump ./catalog-backup.dump`. La programación automática no está activada: decidir ubicación y retención antes.

## 7. Restaurar sin arriesgar la base original

```powershell
./scripts/restore-db.ps1 -BackupFile private/backups/catalog-FECHA.dump -TargetDatabase restore_check
```

Se crea una base nueva cuyo nombre debe comenzar por restore_. Si ya existe, el script se detiene. La base original permanece intacta. Tras validar recuentos y contenido, cambia `services.app.environment.PGDATABASE` en una copia de compose.yaml u override y recrea únicamente app con `docker compose up -d app`. PGDATABASE está fijado en el YAML: cambiar solo una variable del shell no lo sustituye. El script no cambia el destino de la aplicación ni restaura binarios. Para volver al catálogo anterior, restablece el valor anterior y recrea app; conserva ambas bases hasta validar.

Los roles deben existir en el destino antes de restaurar: arranca primero una instancia nueva de Compose para crear catalog_app. Para otro host copia secretos, crea base/roles, restaura, prueba y después cambia la dirección de acceso.

## 8. Actualizar

Haz una copia, revisa cambios SQL, construye la nueva imagen y usa `docker compose up -d --build app`. No uses `docker compose down -v`, `docker volume rm` ni prune de volúmenes. Conservar volúmenes permite cambiar contenedores sin perder datos. Para cambios de versión mayor de PostgreSQL se requiere migración explícita, no cambiar simplemente la etiqueta de la imagen.

## Criterios antes de abrir acceso externo

Login correcto e incorrecto probados, acceso anónimo rechazado, HTTPS válido, base sin puerto público, copia restaurada en base aparte, salud estable de ambos contenedores y consumo de RAM aceptable en el NAS. La prueba real local de contenedores y restauración PostgreSQL pasó el 14 de septiembre. Los criterios de red externa, NAS y consumo bajo carga siguen pendientes.

## Archivos adjuntos y traslado completo

1. Entra en **Copias de seguridad** y pulsa **Descargar copia completa ZIP**. Espera a que termine la descarga.
2. Guarda el ZIP fuera del equipo que contiene el catálogo. Contiene los originales subidos y datos privados; protégelo como proteges tu documentación.
3. En una instalación de prueba vacía, entra con su contraseña. En **Recuperar copia completa ZIP**, selecciona el archivo y confirma la sustitución de las fichas de ese destino.
4. Espera el mensaje de integridad comprobada. Abre una canción, descarga un original y prueba un audio. El máximo de recuperación en navegador es 8 GiB; necesitas espacio libre para la subida y su extracción.
5. Este mismo ZIP sirve para SQLite local y PostgreSQL con Docker. No copies los ficheros sueltos a public ni los metas en la imagen. En Docker los originales viven en el volumen catalog_files, separado de catalog_database. Al cambiar de imagen deben mantenerse ambos volúmenes.

Los ZIP no descargan contenido de enlaces externos ni incluyen contraseñas. Los antiguos JSON solo recuperan metadatos: los binarios referenciados deben existir y coincidir en ese equipo. Para migrar usa el ZIP. Para catálogos mayores de 8 GiB, una copia operativa debe incluir un pg_dump y el volumen catalog_files tomados con las escrituras de app detenidas, y restaurarse ambos juntos en un destino de prueba; no uses backup-db.ps1 como única copia de los archivos.

El Reverse Proxy de DSM también deberá permitir el tamaño y tiempo necesarios para subidas grandes. Esto está documentado para la futura instalación: no se ha modificado el NAS ni se han probado allí los volúmenes, límites de proxy o la recuperación PostgreSQL.

## Actualización de sociedades PRO en una base PostgreSQL anterior

No existe un archivo de migración 001 en este proyecto. La base inicial es `database/schema.sql`, ejecutada por `docker/init-db.sh` solo con volumen nuevo. Las migraciones incrementales reales son 002 (unicidad) y 003 (lista compartida). No inventar ni ejecutar un supuesto 001.

Solo si ya existe una instalación con la restricción antigua: conserva primero una copia completa, detén las escrituras de la aplicación y aplica `database/migrations/002-registration-organizations.sql` en la base destino mediante psql con el administrador. El script sustituye la unicidad por canción/categoría por canción/categoría/sociedad, dentro de una transacción. Conserva filas e identificadores. Después inicia la versión nueva y prueba dos sociedades en una ficha de prueba. Una instalación nueva usa directamente schema.sql actualizado. El SQL se ensayó en Docker local con datos sintéticos el 14 de septiembre; no se ejecutó en el NAS.

### Lista compartida de sociedades

Para una base PostgreSQL existente, después de la migración 002 aplica database/migrations/003-pro-organizations.sql con el administrador, con copia previa y escrituras detenidas. Crea la lista, añade BMI/ASCAP/SGAE y recupera nombres de registros existentes. Las instalaciones nuevas ya incluyen la tabla. SQLite lo hace automáticamente al abrir. Las copias JSON/ZIP incluyen la lista y conservan compatibilidad con copias antiguas; restaurar añade sus opciones a las conocidas. La ejecución local de ambas migraciones ya se comprobó el 14 de septiembre, incluyendo repetición idempotente.

Procedimiento previsto para una base anterior llamada catalog, con copia recuperable y Docker ya validado: detener app (`docker compose stop app`); copiar cada SQL con `docker compose cp database/migrations/002-registration-organizations.sql db:/tmp/002.sql` y su equivalente 003; ejecutar en orden `docker compose exec -T db psql -U catalog_admin -d catalog -v ON_ERROR_STOP=1 -f /tmp/002.sql` y su equivalente 003. Si una orden falla, no continuar ni iniciar la nueva app hasta revisar el error. Después construir/recrear app y comprobar sociedades y registros de prueba. Adaptar explícitamente el destino si se está ensayando en una base restore_. El script de ensayo del 14 de septiembre aplicó estos mismos archivos SQL a PostgreSQL real mediante stdin de psql; la secuencia manual de copia indicada aquí no se ejecutó como tal.

## Configuración de referencia

| Variable | Uso actual |
|---|---|
| CATALOG_LOCAL_PREVIEW | true solo admite excepción de sesión en DEV loopback |
| CATALOG_STORAGE | postgres selecciona pg; los demás valores usan SQLite |
| CATALOG_DATA_DIR | Directorio SQLite/semilla; por defecto private |
| CATALOG_FILES_DIR | Originales; por defecto CATALOG_DATA_DIR/files o private/files |
| CATALOG_APP_URL | Origin exacto para escrituras; en Compose debe ser el HTTPS elegido |
| CATALOG_PASSWORD_HASH / CATALOG_SESSION_SECRET | Valores de autenticación fuera de Docker; nunca publicar |
| CATALOG_PASSWORD_HASH_FILE / CATALOG_SESSION_SECRET_FILE | Leídos por docker/start.mjs al arrancar el contenedor; npm run dev/start no carga estos archivos automáticamente |
| PGHOST / PGPORT / PGDATABASE / PGUSER | Conexión PostgreSQL; Compose fija host db, base catalog y usuario catalog_app |
| PGPASSWORD_FILE / PGPASSWORD | pg admite archivo secreto preferente o valor de entorno |

compose.yaml usa por defecto CATALOG_APP_URL=https://localhost; no basta para acceso remoto ni configura por sí mismo un certificado. Definir la URL real antes de recrear app. Las instrucciones no autorizan publicar ni cambiar la configuración del NAS.

