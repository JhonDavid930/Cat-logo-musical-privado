# Estado del proyecto y punto de reentrada

Actualizado: **2026-09-15**. Docker/PostgreSQL están activos localmente como `catalog-control`, con la copia del catálogo disponible en PostgreSQL. Se repitieron las 28 pruebas unitarias/SQLite y TypeScript. Este documento permite retomar el proyecto sin leer la conversación.

Ruta real: `C:\Users\apple\Documents\DavidAppleton`. El nombre de carpeta deseado es CatalogControl, pero el helper del 12 de septiembre agotó sus 30 minutos sin poder renombrar. CatalogControl no existe a fecha de esta revisión. No se ha repetido el movimiento mientras Codex usa la carpeta.

## Qué es y para quién

Archivo privado de un único propietario: Jhon David Valdez Calier, cuyo nombre artístico como intérprete es David Appleton. Sirve para ordenar obras, versiones, lanzamientos, participaciones profesionales y registros musicales. Distingue lo declarado de lo respaldado por evidencia revisada. No es un distribuidor ni un servicio de consulta automática a sociedades. La interfaz en español tiene dirección editorial oscura/clara aprobada; conservarla al continuar.

## Dónde nos quedamos

El último cambio funcional terminado fue el **catálogo compartido de sociedades PRO**: guardar una sociedad propia la hace reutilizable al crear/editar registros de otras canciones y tras reiniciar. Deduplica espacios/mayúsculas, conserva nombres distintos y sobrevive aunque cambie el registro original. «Otra sociedad» vacía o con solo espacios no se guarda ni borra BMI; editar oculta el aviso de guardado anterior.

El 12 de septiembre se revisó exclusivamente documentación. No se añadieron funciones, importaciones ni Deploy. No se crearon Commits ni versiones nuevas: `0.1.0` es la versión de package.json, no una publicación acreditada.

El 14 de septiembre Docker volvió a responder. Se añadió `scripts/test-docker.mjs` y pasó la validación de Build, app autenticada, PostgreSQL, migraciones 002/003 desde esquema anterior, persistencia tras reinicio, ZIP y recuperación de base/originales en destinos separados. Proyecto de prueba `catalog-check-1a77ef6343`, detenido al terminar; volúmenes sintéticos conservados. No se desplegó en el NAS.

El 15 de septiembre se creó el grupo local permanente `catalog-control`. Sus contenedores `catalog-control-app-1` y `catalog-control-db-1` están saludables, la aplicación responde en `http://127.0.0.1:3010` y PostgreSQL contiene el catálogo conciliado actual con 213 entidades y 210 registros. El puerto 3000 pertenece a Chart Intelligence Platform y no se modificó. La contraseña local inicial se conserva fuera de Git en `private/LOGIN_PASSWORD_LOCAL.txt`.

El mismo día se auditó e importó el [perfil oficial de Spotify](https://open.spotify.com/artist/7KagVdHIz2wTVYXlQqb6jY) mediante una conexión API ya existente en el equipo, sin copiar sus credenciales. En mercado ES se conciliaron 22 lanzamientos y 89 Track IDs por Spotify ID, ISRC y UPC. Se añadieron 76 grabaciones y 20 lanzamientos, se enriquecieron 13 grabaciones y dos lanzamientos existentes, y se crearon 88 relaciones. El catálogo resultante contiene 142 entidades: 14 composiciones, 93 grabaciones, cinco vídeos y 30 lanzamientos. SQLite quedó en revisión 30 y PostgreSQL en revisión 2, con 107 registros legales intactos. Los informes y la extracción permanecen bajo `private/`, excluidos de Git.

La importación no convierte datos de Spotify en composición, autoría, afiliación o registro legal. Cuatro títulos tenían un UPC distinto al ya guardado —El inicio del fin, LA VIDA ES UNA, Mujer y No Te Quiero Ver— y se conservaron como lanzamientos separados para revisión. I Get the Cash se clasificó como EP por sus seis pistas. Antes de aplicar los cambios se guardaron copias recuperables independientes de SQLite y PostgreSQL en `private/backups/`.

Después se importaron los CSV entregados por el propietario. BMI contiene 67 Title Numbers y 154 filas de participantes: se añadieron 53 composiciones, se enriquecieron 14, se añadieron 53 registros BMI y se actualizaron 14. El estado final es 54 BMI registrados y 13 en trámite. Los porcentajes originales permanecen en `sourceRecords`; no se copiaron a autorías porque varias obras totalizan 200 en el formato de BMI. El ISWC `T9324330429` aparece en los Title Numbers de LIKE YOU y LIIKE YOU; ambas fichas se conservan separadas y señaladas.

SoundExchange contiene 65 SXID: se añadieron 18 grabaciones, se enriquecieron 47, se añadieron 50 registros y se actualizaron 15. Las 17 filas sin ISRC se conservan por SXID. El propietario confirmó que David Appleton es su nombre artístico como intérprete y Jhon David Valdez Calier su nombre legal; cada asociación Artist se refleja como crédito profesional bajo el nombre artístico, nunca como autoría. Los tres estudios para piano de la exportación se conservan como grabaciones propias. La biblioteca inicia en «Todo el catálogo (213)» y permite filtrar Composiciones (67), Grabaciones (111), Vídeos (5) y Lanzamientos (30).

Notion conservaba una relación `Distributor` en los diez lanzamientos originales. El 15 de septiembre se resolvieron las dos fichas relacionadas mediante la conexión autorizada: ocho lanzamientos indican Amuse y dos indican Diskover Co. El dato vive en la ficha de lanzamiento y se muestra también al abrir cualquier composición o grabación relacionada. Los otros veinte lanzamientos importados desde Spotify permanecen sin distribuidora hasta contar con una fuente del distribuidor; el campo `Label` de Spotify no se interpreta como distribuidora.

## Decisiones que hay que conservar

| Decisión | Razón y consecuencia |
|---|---|
| SQLite local; PostgreSQL propio preparado para Docker | Usar/revisar sin depender de Docker. Supabase alojado se descartó por decisión del propietario. |
| Next.js/React, servidor Node standalone | API privada, almacenamiento persistente y lectura Office en servidor. No hay Deploy Vercel configurado. |
| Propietario único con sesión privada | Sin registro público ni equipos; colaboración requeriría autorización por propietario. |
| Composición/grabación/vídeo/lanzamiento separados | Álbumes compartidos y varias versiones por obra; no fusionar arbitrariamente por códigos. |
| Estado declarado y evidencia revisada separados | ISWC/ISRC/UPC y afiliación personal no demuestran registro de una obra. |
| Profesionales separados de autorías | Un rol no concede porcentaje; valores desconocidos permanecen nulos. |
| Fuentes originales conservadas | Permite revisar agrupaciones y contradicciones sin modificar Notion. |
| Originales fuera de public y de la imagen | Acceso autenticado y traslado completo por ZIP. |

## Implementado, comprobado y pendiente

| Área | Estado al cierre |
|---|---|
| Fichas, relaciones, búsqueda, letras, estados y métricas | Implementadas; pruebas locales registradas. |
| CRUD y eliminación | Crear, consultar y editar estaban operativos; eliminar exige título exacto y limpia dependencias directas conservando entidades relacionadas. |
| Géneros y créditos profesionales/autores | Implementados; procedencia y separación de porcentajes comprobadas. |
| Archivos privados y ZIP | Implementados y probados con archivos sintéticos; no todos los códecs ni tamaños máximos reales. |
| UPC/EAN, tipos y lanzamientos compartidos | Implementados y probados localmente; checksum no acredita asignación. |
| Distribuidoras | Campo editable por lanzamiento; diez relaciones de Notion recuperadas: ocho Amuse y dos Diskover Co. |
| Sociedades PRO compartidas | Pruebas de dos canciones, recarga, SQLite reabierta, deduplicación y copias. |
| PostgreSQL y migraciones | Validados localmente; la instalación permanente contiene 213 entidades, 213 relaciones, 210 registros y 286 créditos tras conciliar Spotify, BMI y SoundExchange. |
| Docker y volúmenes | Grupo `catalog-control` activo y saludable en el puerto 3010; Build/arranque, escritura, reinicio y recuperación superados. |
| NAS, HTTPS externo y acceso remoto | No desplegados ni configurados por este trabajo. |

Consulta [VALIDATION](VALIDATION.md) para fechas y alcance; «implementado» no significa «validado en producción».

## Cobertura parcial

La revisión del 10 de septiembre documentó 16 filas de composición de Notion agrupadas provisionalmente en 14 obras por ISWC idéntico, 17 grabaciones, 5 vídeos y 10 lanzamientos propios (cuatro ajenos excluidos). Se conservaron 14 autorías y se añadieron 53 participaciones profesionales con fuente. Se recuperaron ocho Single y dos Album. Son recuentos históricos: no se reabrió la base privada para certificarlos el 12 de septiembre.

No están cubiertas las aproximadamente 70 canciones estimadas. Falta inventariar Drive y comprobar evidencia externa. Las relaciones anómalas de vídeos y agrupaciones provisionales requieren revisión del propietario; no resolverlas por coincidencia de título. No se importaron automáticamente binarios de Drive. Las fuentes privadas no deben copiarse a documentación pública.

## Datos y arranque

- Código: `src/components` para UI; `src/lib` para contrato/almacenamiento; `src/app/api` para endpoints.
- Base predeterminada: `private/catalog.sqlite`, con posible WAL. No copiar solo ese archivo mientras esté abierta.
- Originales/manifests: `private/files`, salvo configuración de `CATALOG_FILES_DIR` o `CATALOG_DATA_DIR`; conservarlos juntos.
- Fuentes/semilla: `private/notion-source.json` y `private/catalog.json`; no se reimportan automáticamente sobre una base existente.
- Configuración: `.env.local`; secretos, si se han creado: `private/secrets`. No publicar valores.
- Backups PostgreSQL del script: `private/backups`. Descargas JSON/ZIP: destino elegido en el navegador. No hay backup programado activo.
- Docker local: grupo `catalog-control`, contenedores `catalog-control-app-1` y `catalog-control-db-1`, volúmenes `catalog-control_catalog_database` y `catalog-control_catalog_files`; TLS tiene volúmenes propios en la variante HTTPS.

Para abrir, sigue [README](../README.md): Node 24, `npm ci`, conservar .env.local y `npm run dev`. Abrir [loopback local](http://127.0.0.1:3010); el puerto 3010 está reservado para Catalog Control porque otro proyecto usa el 3000. Esto no implica que el servidor siga activo desde la sesión anterior. Antes de modificar datos, obtener una copia ZIP y probar su recuperación en otro catálogo. JSON solo contiene metadatos: necesita los originales disponibles para recuperar referencias binarias.

## Bloqueos históricos y autorización

Docker Desktop falló el 10 de septiembre al inicializar dockerInference; [detalle](DOCKER_LOCAL_ISSUE.md). El 14 de septiembre responde con Engine 29.5.3 y Compose 5.1.4 y ejecuta correctamente el ensayo. No se conoce qué cambio externo resolvió la incidencia; no se hizo reset ni reparación durante esta tarea.

NAS identificado: Synology DS225+, 2 GB RAM, Container Manager instalado. Solo inspeccionado. **El propietario exige validación local y aprobación antes de trasladar archivos o hacer Deploy al NAS.** No hay autorización para Factory Reset ni para borrar volúmenes.

## Próximos pasos priorizados

1. **Revisión del propietario y copia recuperable.** Criterio: confirmar agrupaciones/versiones y recuperar ZIP en catálogo de prueba conservando relaciones y originales; no marcar evidencia sin revisarla.
2. **Revisar con el propietario la conciliación de Spotify.** Comprobar las nuevas grabaciones y lanzamientos, sobre todo los cuatro conflictos de UPC y las versiones con títulos parecidos. Cada master conserva su ISRC y cada lanzamiento su Spotify Album ID/UPC; no fusionarlos solo por nombre. Criterio: cada discrepancia queda confirmada, corregida o descartada con motivo y documento del distribuidor cuando exista.
3. **Revisar las excepciones de BMI y SoundExchange.** Confirmar el ISWC compartido de LIKE YOU/LIIKE YOU y completar, cuando exista, el ISRC de las 17 filas SoundExchange que solo tienen SXID. La identidad artística David Appleton ya fue confirmada por el propietario. Criterio: cada excepción queda confirmada o corregida con motivo; ningún porcentaje se reinterpreta sin documentación del proveedor.
4. **Cerrar límites restantes de infraestructura antes del traslado.** El ensayo Docker/PostgreSQL local ya pasó. Pendiente medir carga/tamaños grandes y validar el acceso HTTPS elegido. La prueba no cubre todos los formatos/códecs ni cortes eléctricos ni el hardware del NAS.
5. **Preparar traslado revisable y obtener aprobación.** Criterio: imagen linux/amd64, secretos externos, backup recuperable, consumo medido y plan HTTPS/red. Solo después de aprobación trasladar al NAS y comprobar allí salud/recuperación.

Estos pasos no se ejecutan por leer este documento; cada nueva tarea debe respetar el alcance del propietario.

## Mantener el punto de reentrada

Tras cambios significativos, actualizar fecha, último trabajo, decisiones y pendientes aquí. Detallar arquitectura en TECH_SPEC, operación en DEPLOY_GUIDE, cambios reales en CHANGELOG y evidencia fechada en VALIDATION. No convertir resultados históricos en garantías actuales ni inventar Commits/versiones. Código y configuración actuales prevalecen sobre notas antiguas.
