# Historial de cambios

## 2026-09-15 · Catálogos BMI y SoundExchange incorporados

- Añadidos importadores CSV repetibles para BMI Title Number/ISWC y SoundExchange SXID/ISRC, con validación de columnas y conservación de las filas originales.
- BMI aporta 67 composiciones y 154 participantes: 53 obras nuevas, 14 enriquecidas, 54 registros completados y 13 en trámite.
- SoundExchange aporta 65 SXID: 18 grabaciones nuevas, 47 enriquecidas y 65 registros conciliados; 17 filas sin ISRC se conservan por SXID.
- Los porcentajes BMI permanecen en la fuente sin reinterpretarse. LIKE YOU/LIIKE YOU comparten ISWC y se conservan separados.
- El propietario confirmó que David Appleton es su nombre artístico como intérprete y Jhon David Valdez Calier su nombre legal; se retiró la alerta provisional de homónimo y cada asociación Artist se registra bajo el nombre artístico como crédito profesional sin porcentaje de autoría.
- Catálogo final en SQLite y PostgreSQL: 213 entidades, 213 relaciones, 210 registros y 286 créditos. Suite consolidada: 36 pruebas.

## 2026-09-15 · Catálogo de Spotify incorporado

- Añadido un importador repetible que concilia masters por ISRC/Spotify Track ID y lanzamientos por Spotify Album ID/UPC.
- Incorporadas 76 grabaciones y 20 lanzamientos; enriquecidas 13 grabaciones y dos lanzamientos existentes; creadas 88 relaciones.
- Conservados como fichas separadas cuatro títulos con UPC contradictorio. Ningún dato previo ni registro legal fue sobrescrito.
- SQLite y PostgreSQL contienen 142 entidades, 137 relaciones y los 107 registros legales originales. Copias previas y fuentes permanecen excluidas de Git.
- Añadidas dos pruebas de importación; la suite consolidada pasa 30 pruebas y TypeScript.
- La biblioteca abre ahora en «Todo el catálogo» y muestra recuentos por tipo. El dashboard diferencia las 142 fichas totales de las 14 composiciones documentadas para evitar que el usuario interprete ese último número como el catálogo completo.

## 2026-09-15 · Auditoría del catálogo público de Spotify

- Consultado el perfil oficial mediante Spotify Web API y una conexión local existente, sin copiar ni publicar credenciales.
- Recuperados 22 lanzamientos, 89 Track IDs y 69 títulos normalizados para el mercado ES.
- La conciliación preliminar encontró 13 coincidencias por ISRC, una por título, una posible versión, 54 títulos candidatos y 17 lanzamientos candidatos.
- El informe detallado permanece bajo `private/`; no se modificaron fichas ni estados del catálogo.

## 2026-09-15 · Roadmap de integraciones BMI y SoundExchange

- Documentada una primera fase basada en exportación e importación de archivos oficiales, conciliación de identificadores, estados, diferencias y justificantes.
- Queda prohibido almacenar contraseñas o automatizar portales mediante scraping; una API directa requerirá acceso oficial por token.
- Añadidos criterios de cierre: previsualización, fixtures sin datos personales, informe de diferencias, copia previa y confirmación sustentada por evidencia.

## 2026-09-15 · Puerto dedicado y arranque permanente en Docker

- Catalog Control pasa a usar el puerto local 3010 para no interferir con Chart Intelligence Platform, que ocupa el 3000.
- Compose permite cambiar el puerto mediante `CATALOG_PORT`, manteniendo la aplicación y PostgreSQL dentro del grupo estable `catalog-control`.
- Docker Desktop mostrará `catalog-control-app-1` y `catalog-control-db-1`; la imagen propia queda versionada como `catalog-control-app:0.1.0` y la base usa la imagen oficial `postgres:18-bookworm`.
- Se actualizan instrucciones, pruebas E2E y URLs locales para que el acceso correcto sea `http://127.0.0.1:3010`.
- Se crean secretos locales fuera de Git, se levantan ambos contenedores saludables y se recupera en PostgreSQL una copia del catálogo SQLite actual: 46 entidades y 107 registros.
- Chart Intelligence Platform permanece intacto en el puerto 3000; Catalog Control responde correctamente en el 3010.

## 2026-09-14 · Validación Docker/PostgreSQL local · Sin Commit

- Confirmada ruta real DavidAppleton: helper de renombrado agotó espera; CatalogControl todavía no existe. No se forzó otro intento.
- Docker operativo. Nuevo scripts/test-docker.mjs para Build y ensayo reproducible con proyecto/puerto/secretos/volúmenes aislados y datos sintéticos.
- Probadas migraciones 002/003 desde esquema anterior, repetición idempotente, sociedades compartidas, concurrencia, Origin, login, archivos, reinicio y recuperación ZIP con SHA-256.
- pg_dump/pg_restore en otra base y copia de originales en otro volumen; app arrancada contra ambos destinos recuperados. Catálogo SQLite y .env.local reales conservados sin cambios.
- 28 pruebas unitarias/SQLite y TypeScript superadas. No nueva auditoría de navegador ni de todos los formatos en Docker. Contenedores sintéticos detenidos; volúmenes/backups conservados. Sin NAS, Deploy externo o Push.

Historial de trabajo local, no de releases publicadas. No se atribuyen Commits/PR a cambios que no los tuvieron. Las cifras de pruebas de cada apartado corresponden a su fase; el último alcance consolidado está en [VALIDATION.md](VALIDATION.md).

## 2026-09-12 · Documentación para retomar el proyecto · Sin Commit

- Nuevo PROJECT_STATUS con propósito, decisiones, estado implementado/verificado/pendiente, cobertura histórica, ubicaciones privadas y próximos pasos con criterios de cierre.
- README enlaza ese punto de reentrada y distingue pruebas aisladas de la suite que escribe sobre su servidor de destino; el arranque conserva .env.local existente.
- TECH_SPEC completa diagrama de componentes, dirección de relaciones, contrato, concurrencia, endpoints y limitación del healthcheck SQLite.
- DEPLOY_GUIDE aclara binarios/JSON/ZIP, configuración efectiva, conflicto del puerto local, restauración de PostgreSQL y migraciones reales 002/003; no existe 001 independiente.
- VALIDATION separa resultados del 10 de septiembre de la revisión documental del 12. Docker se registra como incidencia histórica sin afirmar que hoy persista ni esté reparado.
- Sin cambios funcionales, pruebas de ejecución nuevas, lecturas del catálogo privado, importación, Commit/Push ni Deploy.

## 0.1.0 · 2026-09-10 · Cambios locales sin Commit

- Aplicación Next.js/React/TypeScript con identidad editorial provisional de David Appleton, búsqueda protagonista, navegación en español y temas oscuro/claro.
- Dashboard, catálogo y fichas de composiciones, grabaciones, vídeos y lanzamientos. Edición de letras, metadatos, autores y porcentajes. Vinculación de fichas y documentos HTTPS.
- Estados registrado, en trámite, pendiente, sin comprobar y no aplica; aplicabilidad separada y verificación de evidencia explícita. Porcentajes sin inflar por códigos o campos vacíos.
- Importación real de Notion: 16 composiciones agrupadas provisionalmente en 14, 17 grabaciones, 5 vídeos y 10 lanzamientos propios. Filtrado de artistas ajenos. Paginación agotada en las cuatro bases consultadas. Conservación de registros originales y contradicciones.
- Adaptador SQLite para revisión local y PostgreSQL propio para Docker. SQL relacional híbrido con transacciones, referencias y control de revisión. Exportación/restauración JSON.
- Login del propietario con scrypt, sesión firmada y cookie protegida, validación de origen, límites de entrada, producción cerrada sin secretos.
- Dockerfile multietapa, Compose con PostgreSQL sin puerto público, rol sin superusuario, secretos externos, volumen y healthchecks. HTTPS opcional para VPS. Scripts de backup y restauración en base separada.
- Verificación final local: Build y TypeScript correctos; 18 pruebas de dominio/SQLite/entrada acotada y 10 pruebas de navegador (8 E2E y 2 auditorías automáticas WCAG AA) superadas. Responsive 375/768/1024/1440 en ambos temas sin scroll horizontal. Se prueban autorías con suma inválida, documentos, asociaciones y restauración desde la interfaz. En E2E se detectó y corrigió comparación de Origin local (Next normalizaba request.url a localhost); se conserva comprobación estricta por hostname loopback.
- Prueba aislada de servidor de producción superada: acceso anónimo y contraseña incorrecta rechazados, login correcto, cookie HttpOnly/Secure/SameSite, sesión manipulada rechazada. No usa el catálogo real.
- Revisión del empaquetado: exclusiones explícitas de tracing para impedir que Next standalone copie datos privados. Comprobado que el directorio standalone no contiene private, fuentes Notion, base SQLite ni archivos de entorno. Docker además los excluye del contexto de Build.
- NAS identificado en lectura: Synology DS225+, 2 GB RAM, Celeron J4125, DSM 7.3.2 Update 4, Container Manager instalado. Sin cambios ni despliegue en el NAS.
- Incidencia ajena a la aplicación: Docker Desktop bloqueado al abrir dockerInference; sin borrados, reset o manipulación de volúmenes. No se afirma que el Build/arranque Docker ni restauración PostgreSQL hayan sido probados.

Al cierre de esa primera fase estaban pendientes el inventario completo, Drive/WAV/certificados, agrupaciones/vínculos de vídeos y la validación de infraestructura. La subida binaria se añadió en la ampliación siguiente; la sincronización automática no está implementada. Para pendientes vigentes, consultar PROJECT_STATUS.

### Mejora de progreso solicitada tras la revisión inicial

- Se conserva íntegra la dirección visual y los porcentajes. Nuevas barras con divisiones finas y marcador en los indicadores generales, cada entidad y la ficha de canción.
- Declarado y evidencia revisada tienen etiquetas separadas. Sin aplicabilidad confirmada se representa con una línea discontinua vacía, nunca con progreso inventado. No se calcula avance sobre el recuento aproximado de 70 canciones.
- Valores accesibles, contraste, diseño móvil y movimiento reducido comprobados. Prueba específica de barras y ambas auditorías de accesibilidad superadas; Build actualizado correcto. 11 escenarios únicos de navegador verificados en total.

### Ampliación local: archivos, géneros y créditos · 2026-09-10

- Adjuntos privados múltiples por categoría, selector/drag and drop, enlaces opcionales y notas sin archivo. Componentes compartidos para todo el catálogo y fichas nuevas.
- Descarga original autenticada, lectura PDF/texto/DOCX/XLSX y reproducción de audio/vídeo compatibles, con fallback explícito. Control de rutas, tamaño, contenido, manifests y procesos de lectura acotados.
- Exportación y recuperación ZIP completa con binarios y verificación SHA-256. Volumen Docker independiente catalog_files, documentación de portabilidad y recuperación actualizada.
- Selector de género buscable con las 37 opciones distintas de Genre en Notion y entrada de valores propios. Géneros de versiones visibles con procedencia, sin sobrescribir composición ni grabaciones.
- Créditos profesionales estructurados y separados de porcentajes de autoría; múltiples personas/roles y contexto de entidad. Migración aditiva de 53 participaciones con fuente, sin alterar autorías existentes.
- Ningún cambio en NAS, Deploy, Commit ni Push. Docker sigue pendiente de motor operativo.

- Verificación de ampliación: 23 pruebas de lógica/almacenamiento, 3 flujos completos aislados de navegador y 3 auditorías/regresiones de accesibilidad/progreso superadas; Build, autenticación de producción, audit y configuración Compose correctos. Visor PDF comprobado visualmente tras corregir el bloqueo de la directiva sandbox.

### UPC, tipos de lanzamiento y sociedades PRO

- Panel de lanzamientos con UPC/EAN editable, creación y asociación desde canción; mantiene relación muchos a muchos y ceros iniciales. Comprueba formato/control y señala valores de origen irregulares sin descartarlos.
- Tipos Single, EP, Álbum y sin especificar, recuperados de los 10 lanzamientos originales; ninguna clasificación por número de canciones.
- Sociedad PRO visible/editable en registros, dashboard y filtros. Sin asignaciones inferidas a partir de ISWC o afiliación del autor. Estados/evidencias conservados al especificar sociedad.
- Migración SQLite transaccional de la unicidad y script PostgreSQL preparado para varias sociedades; no se cuenta PRO genérico junto a sociedades concretas.

### Corrección local: sociedades reutilizables

- Lista compartida persistente de sociedades PRO en SQLite/PostgreSQL, con migración de nombres existentes y copias JSON/ZIP compatibles con versiones anteriores.
- Selector compartido al crear/editar registros; deduplicación por espacios/mayúsculas conservando nombres distintos.
- Otra sociedad exige un nombre no vacío. Editar un formulario oculta el aviso anterior de Cambios guardados para distinguir el borrador.

