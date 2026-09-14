# Estado del proyecto y punto de reentrada

Actualizado: **2026-09-15**. Docker/PostgreSQL están activos localmente como `catalog-control`, con la copia del catálogo disponible en PostgreSQL. Se repitieron las 28 pruebas unitarias/SQLite y TypeScript. Este documento permite retomar el proyecto sin leer la conversación.

Ruta real: `C:\Users\apple\Documents\DavidAppleton`. El nombre de carpeta deseado es CatalogControl, pero el helper del 12 de septiembre agotó sus 30 minutos sin poder renombrar. CatalogControl no existe a fecha de esta revisión. No se ha repetido el movimiento mientras Codex usa la carpeta.

## Qué es y para quién

Archivo privado de un único propietario, David Appleton, para ordenar obras, versiones, lanzamientos, participaciones profesionales y registros musicales. Distingue lo declarado de lo respaldado por evidencia revisada. No es un distribuidor ni un servicio de consulta automática a sociedades. La interfaz en español tiene dirección editorial oscura/clara aprobada; conservarla al continuar.

## Dónde nos quedamos

El último cambio funcional terminado fue el **catálogo compartido de sociedades PRO**: guardar una sociedad propia la hace reutilizable al crear/editar registros de otras canciones y tras reiniciar. Deduplica espacios/mayúsculas, conserva nombres distintos y sobrevive aunque cambie el registro original. «Otra sociedad» vacía o con solo espacios no se guarda ni borra BMI; editar oculta el aviso de guardado anterior.

El 12 de septiembre se revisó exclusivamente documentación. No se añadieron funciones, importaciones ni Deploy. No se crearon Commits ni versiones nuevas: `0.1.0` es la versión de package.json, no una publicación acreditada.

El 14 de septiembre Docker volvió a responder. Se añadió `scripts/test-docker.mjs` y pasó la validación de Build, app autenticada, PostgreSQL, migraciones 002/003 desde esquema anterior, persistencia tras reinicio, ZIP y recuperación de base/originales en destinos separados. Proyecto de prueba `catalog-check-1a77ef6343`, detenido al terminar; volúmenes sintéticos conservados. No se desplegó en el NAS.

El 15 de septiembre se creó el grupo local permanente `catalog-control`. Sus contenedores `catalog-control-app-1` y `catalog-control-db-1` están saludables, la aplicación responde en `http://127.0.0.1:3010` y PostgreSQL contiene una recuperación del catálogo SQLite actual con 46 entidades y 107 registros. El puerto 3000 pertenece a Chart Intelligence Platform y no se modificó. La contraseña local inicial se conserva fuera de Git en `private/LOGIN_PASSWORD_LOCAL.txt`.

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
| Géneros y créditos profesionales/autores | Implementados; procedencia y separación de porcentajes comprobadas. |
| Archivos privados y ZIP | Implementados y probados con archivos sintéticos; no todos los códecs ni tamaños máximos reales. |
| UPC/EAN, tipos y lanzamientos compartidos | Implementados y probados localmente; checksum no acredita asignación. |
| Sociedades PRO compartidas | Pruebas de dos canciones, recarga, SQLite reabierta, deduplicación y copias. |
| PostgreSQL y migraciones | Validados localmente; la instalación permanente contiene 46 entidades y 107 registros recuperados del catálogo actual. |
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
2. **Completar inventario con alcance autorizado.** Criterio: fuentes/recuentos reconciliados y lista de faltantes; no usar la estimación de 70 canciones como denominador de progreso.
3. **Cerrar límites restantes de infraestructura antes del traslado.** El ensayo Docker/PostgreSQL local ya pasó. Pendiente medir carga/tamaños grandes y validar el acceso HTTPS elegido. La prueba no cubre todos los formatos/códecs ni cortes eléctricos ni el hardware del NAS.
4. **Preparar traslado revisable y obtener aprobación.** Criterio: imagen linux/amd64, secretos externos, backup recuperable, consumo medido y plan HTTPS/red. Solo después de aprobación trasladar al NAS y comprobar allí salud/recuperación.

Estos pasos no se ejecutan por leer este documento; cada nueva tarea debe respetar el alcance del propietario.

## Mantener el punto de reentrada

Tras cambios significativos, actualizar fecha, último trabajo, decisiones y pendientes aquí. Detallar arquitectura en TECH_SPEC, operación en DEPLOY_GUIDE, cambios reales en CHANGELOG y evidencia fechada en VALIDATION. No convertir resultados históricos en garantías actuales ni inventar Commits/versiones. Código y configuración actuales prevalecen sobre notas antiguas.
