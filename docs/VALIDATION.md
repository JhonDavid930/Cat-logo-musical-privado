# Validación y límites de la evidencia

## Actualización: 2026-09-15

La vista principal se comprobó sobre las 210 entidades actuales de PostgreSQL: genera 79 canciones visibles. La auditoría confirmó grupos representativos como ALLI ESTARE —una composición, dos grabaciones y dos ISRC— y BILINGUE —composición, dos grabaciones, vídeo y lanzamiento—; versiones tituladas de forma distinta permanecen separadas. No se modificó ningún dato del catálogo durante esa auditoría.

La suite consolidada pasa 42 pruebas unitarias, TypeScript y Build. Doce pruebas Playwright generales pasan en un servidor DEV aislado, incluyendo búsqueda sin tildes, una sola fila para ALLI ESTARE, acceso a sus dos grabaciones, edición/restauración, accesibilidad automática en ambos temas y responsive en 375/768/1024/1440. Otros cinco recorridos aislados validan subida y lectura de archivos, audio/vídeo, Word, Excel, ZIP, recuperación, géneros, créditos, UPC, PRO y eliminación segura. `npm audit --omit=dev` no detecta vulnerabilidades. El contenedor permanente `catalog-control-app-1` se reconstruyó con la nueva imagen y ambos servicios permanecen saludables. La validación no afirma que títulos realmente distintos pero escritos igual representen siempre la misma obra; por eso las entidades originales siguen separadas y accesibles.

La auditoría visual recorrió dashboard, biblioteca, detalle, registros, archivos, créditos, edición, eliminación y copias de seguridad. Se corrigieron la longitud del dashboard, el contador ambiguo de fichas, la capitalización importada de los títulos, la repetición de créditos en edición y el encabezado estrecho de 375 píxeles. Las capturas de evidencia permanecen en `private/audit-premium-2026-09-15/`, fuera de Git por contener datos del catálogo.

El CRUD completo se verificó con 37 pruebas unitarias y un flujo Playwright aislado: el botón de eliminación permanece deshabilitado hasta escribir el título exacto, elimina una grabación con su registro y relación, y conserva la composición relacionada. El mismo conjunto aislado volvió a comprobar creación/edición de lanzamientos, persistencia, vista móvil y accesibilidad. No se eliminó ninguna ficha del catálogo real durante estas pruebas.

Las diez relaciones `Distributor` de los lanzamientos originales de Notion se resolvieron directamente: ocho corresponden a Amuse y dos a Diskover Co. Se añadió persistencia del campo a la prueba de lanzamientos compartidos. El dato se conserva en SQLite y PostgreSQL y aparece en el editor de lanzamientos relacionados; los 20 lanzamientos procedentes únicamente de Spotify siguen sin distribuidora declarada. La prueba aislada de navegador para lanzamientos, edición, persistencia, móvil y accesibilidad volvió a pasar.

Importados los CSV privados de BMI y SoundExchange en SQLite y PostgreSQL después de crear copias ZIP independientes antes de cada operación. Resultado final: 213 entidades —67 composiciones, 111 grabaciones, cinco vídeos y 30 lanzamientos—, 213 relaciones, 210 registros y 286 créditos. Las copias finales están en `private/backups/final-bmi-soundexchange-*-2026-09-15.zip`.

Ese resultado es el estado inmediatamente posterior a la importación. El propietario eliminó después, mediante el CRUD, las tres grabaciones de estudios para piano ajenas a su catálogo. PostgreSQL quedó en revisión 11 con 210 entidades —67 composiciones, 108 grabaciones, cinco vídeos y 30 lanzamientos—, 213 relaciones, 207 registros, 283 créditos y cero documentos.

BMI: 67 Title Numbers, 154 participantes, 54 estados Reconciled y 13 Pending Society Review. Se probaron encabezado/campos CSV, conciliación, estados, participantes con porcentaje nulo, ISWC repetido y segunda ejecución. SoundExchange: 65 SXID, 17 sin ISRC, 47 grabaciones conciliadas y 18 nuevas; 65 filas declaran Hold No. Se probaron conciliación por ISRC/SXID, filas sin ISRC, reparación de caracteres dañados, crédito profesional de intérprete y segunda ejecución. El propietario confirmó que David Appleton es su nombre artístico como intérprete, Jhon David Valdez Calier su nombre legal y que los títulos de la exportación corresponden a su catálogo.

La suite consolidada contiene 37 pruebas superadas y TypeScript no reporta errores. Los archivos fuente y sus identificadores personales permanecen excluidos de Git.

Importación de Spotify aplicada después de crear copias ZIP completas separadas para SQLite y PostgreSQL. Resultado en ambos almacenamientos: 142 entidades —14 composiciones, 93 grabaciones, cinco vídeos y 30 lanzamientos—, 137 relaciones y 107 registros legales. Se añadieron 76 masters y 20 lanzamientos; 13 masters y dos lanzamientos existentes recibieron fuentes de Spotify. Cuatro UPC contradictorios se conservaron en fichas separadas y no se sobrescribió ninguno.

El importador se probó con dos masters de igual título y distinto ISRC, conflicto de UPC, enlace único a composición y segunda ejecución sin duplicados. La suite consolidada contiene 30 pruebas superadas y TypeScript no reporta errores. La comprobación no demuestra titularidad, autoría ni exactitud contractual de los metadatos públicos; esas conclusiones requieren documentación del distribuidor o de la sociedad correspondiente.

Creado el proyecto local permanente `catalog-control` sin detener otros proyectos. `catalog-control-app-1` usa `catalog-control-app:0.1.0` y publica exclusivamente `127.0.0.1:3010`; `catalog-control-db-1` usa `postgres:18-bookworm` sin publicar PostgreSQL. Ambos healthchecks están saludables. La ruta devolvió HTTP 200 y el título esperado de David Appleton.

Se generó un ZIP privado desde SQLite y se restauró mediante la API autenticada en PostgreSQL. El origen contenía 46 entidades, 107 registros y cero binarios; PostgreSQL devolvió los mismos recuentos. La base SQLite no se reemplazó. Chart Intelligence Platform sigue siendo el propietario del puerto 3000. Los secretos y la contraseña inicial permanecen bajo `private/`, excluidos de Git y del Build.

## Actualización: 2026-09-14

Docker Engine 29.5.3 y Compose 5.1.4 operativos. Ejecutado `node scripts/test-docker.mjs` con resultado correcto, proyecto aislado `catalog-check-1a77ef6343`. El script construye la imagen del Dockerfile y utiliza Compose base con override de secretos temporales y único puerto loopback dinámico; no monta datos reales. Verificado:

- Build real Linux Docker y postbuild sin datos privados; PostgreSQL y app saludables.
- Login, cookie Secure/HttpOnly, acceso anónimo rechazado, dos canciones/PRO normalizado, revisión obsoleta 409 y Origin ajeno 403.
- Migraciones 002/003 desde restricción anterior, aplicadas dos veces; IDs conservados, varias sociedades y persistencia de opciones sin registros.
- Subida/lectura/descarga TXT autenticada, usuario node, raíz read-only y volumen de archivos; datos y SHA-256 intactos tras reiniciar app/db.
- Exportación/restauración ZIP real con PostgreSQL, metadatos y binario recuperados.
- pg_dump/pg_restore a restore_check; originales copiados a otro volumen sintético; app recreada usando la base y el volumen recuperados y descarga con el mismo SHA-256.
- Comparación de hashes antes/después: catálogo SQLite, sus archivos auxiliares presentes y .env.local sin cambios.

28 pruebas unitarias/SQLite y TypeScript repetidas y superadas. No se repitieron las pruebas de navegador en esta sesión. Informe y backups sintéticos: `C:\Users\apple\AppData\Local\Temp\catalog-docker-check-LEvyq6`; el informe report.json no contiene secretos, pero el directorio también contiene credenciales desechables y no debe publicarse entero. Los contenedores de ese proyecto quedaron detenidos; volúmenes conservados, sin prune ni borrado.

Este resultado cierra los pendientes de ejecución Docker/PostgreSQL, migraciones, permisos básicos y recuperación local indicados en el registro histórico siguiente. No valida Synology, HTTPS externo/proxy, cargas máximas, corte eléctrico, todos los formatos Office/códecs dentro de Docker ni ARM64. El ensayo emplea HTTP exclusivamente sobre loopback para probar el servidor; Origin y cookie se comprueban, pero no se ensaya un certificado TLS.

## Registro histórico hasta el 12 de septiembre

Revisión documental: 2026-09-12. Se contrastaron fuentes del proyecto sin ejecutar pruebas funcionales nuevas ni leer el catálogo privado. Los resultados siguientes proceden de ejecuciones registradas el 2026-09-10; no certifican el estado actual del equipo, del registro npm o de Docker.

## Último estado comprobado

| Comprobación                        | Evidencia registrada el 10 de septiembre                                                                                         | Límite                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Unitarias e integración SQLite      | 28 pruebas superadas al cerrar sociedades compartidas                                                                            | Sin PostgreSQL real                                                    |
| TypeScript y Build standalone       | Correctos tras la última corrección                                                                                              | No es Build de imagen Docker                                           |
| Empaquetado                         | Postbuild sin datos privados ni archivos de entorno                                                                              | No acredita permisos de volúmenes                                      |
| Suite aislada de navegador          | Cuatro flujos superados en ampliación UPC/PRO; después se repitió el flujo de lanzamientos/PRO con sociedades compartidas y pasó | Los otros tres flujos no se repitieron tras esa última corrección      |
| Autenticación de producción aislada | Login correcto, anónimo/contraseña incorrecta/sesión manipulada rechazados; cookie protegida                                     | Ensayo anterior a última corrección de PRO                             |
| a11y y responsive                   | axe AA sin infracciones detectadas en pantallas ensayadas; 375/768/1024/1440, temas claro/oscuro; revisión visual de capturas    | No equivale a auditoría manual con lector de pantalla ni iPhone físico |
| Barras de progreso                  | Regresión de valores, desconocidos y reduced-motion superada                                                                     | Basada en registros disponibles, no inventario estimado                |
| npm audit producción                | Cero vulnerabilidades reportadas en esa ejecución                                                                                | Resultado histórico, no garantía futura                                |
| Compose base/HTTPS                  | Configuración parseada correctamente                                                                                             | Ningún contenedor arrancado con ello                                   |

## Qué cubren los escenarios

- Dominio: estados/aplicabilidad/evidencia, porcentajes, integridad de relaciones, búsqueda, revisión concurrente y JSON acotado.
- SQLite: persistencia y reapertura, migración de restricción antigua, sociedades compartidas deduplicadas y conservadas aunque desaparezcan sus registros.
- Archivos: subidas múltiples/notas, manifests y SHA-256, límites/rangos, ZIP de ida/vuelta y binarios, texto escapado, DOCX/XLSX, rechazo de macros.
- Navegador aislado: selector/drag and drop, descarga autenticada, reproducción WAV/WebM, lector PDF/Word/Excel, recuperación ZIP, géneros y roles profesionales.
- Lanzamientos: álbum compartido entre dos canciones, UPC con cero inicial, Single adicional, códigos inválidos rechazados.
- PRO final: sociedad nueva reutilizada en segunda canción y tras recarga; BMI intacto al intentar Otra vacía o solo espacios; aviso de guardado anterior retirado al editar.

Las pruebas usan fixtures temporales cuando se indica aislamiento. La suite antigua tests/e2e escribe sobre el servidor de destino y restaura datos iniciales: no ejecutarla sobre un catálogo de uso real. El runner aislado puede dejar directorios sintéticos en el temporal del sistema; no afirmar que todos los temporales se eliminan automáticamente.

## Cómo reproducir sin usar datos reales

Desde la raíz, con Node 24 y dependencias instaladas:

1. Ejecutar npm test y npm run typecheck.
2. Ejecutar npm run build; incluye scripts/check-build.mjs.
3. Con Chrome instalado y el puerto 3002 libre, ejecutar npx playwright test --config playwright.files.config.ts. Arranca su propio servidor y SQLite temporal. CHROME_PATH permite cambiar el ejecutable.
4. Para repetir solo la última corrección: npx playwright test --config playwright.files.config.ts tests/attachments/releases.spec.ts.
5. La prueba específica de sesión es node scripts/test-production-auth.mjs, con puerto 3001 libre y Build previo.

npm run test:e2e usa TEST_BASE_URL o http://127.0.0.1:3010. Solo emplearlo en una instalación DEV desechable, sin ediciones simultáneas. No ejecutado durante esta revisión documental.

## Pendiente de validar o realizar

- NAS/VPS, HTTPS externo, proxy, consumo de RAM, reinicio y recuperación ante corte eléctrico. No se transfirió ni desplegó el proyecto en NAS.
- Tamaños reales de 512 MiB por archivo u 8 GiB por ZIP, carga y todos los códecs. Se ensayaron límites lógicos, WAV PCM y WebM generado por Chrome.
- Lectores: PDF depende del navegador; Word muestra texto sin maquetación; Excel muestra valores guardados dentro de límites y no calcula fórmulas.
- ARM64, revisión manual completa con lector de pantalla e iPhone físico.
- Cobertura total del catálogo, inventario Drive y verificación externa de certificados/estados.

El almacenamiento binario y la reproducción sí están implementados y ensayados con datos sintéticos; lo pendiente es incorporar y verificar los archivos reales del inventario.

## Evidencia visual e infraestructura histórica

Las capturas privadas de las sesiones anteriores están bajo private/ y excluidas del empaquetado. Ejemplos: pro-organizations-mobile.png, upc-mobile.png y pdf-preview-check.png. No publicarlas automáticamente: pueden contener datos privados.

La incidencia de Docker del 10 de septiembre está en [DOCKER_LOCAL_ISSUE.md](DOCKER_LOCAL_ISSUE.md). Su estado no se reconsultó el 12 de septiembre. Revisar entonces docker info antes de atribuir un bloqueo nuevo a la misma causa.

## Revisión documental del 12 de septiembre

Se verificaron nombres/rutas contra package.json, configuraciones Playwright/Compose, Dockerfile, scripts, schema/migraciones, contrato, almacenamiento y Route Handlers. Se corrigieron afirmaciones antiguas sobre archivos solo enlazados, migración 001 inexistente, resultados acumulados y configuración de arranque. Se comprobaron enlaces locales de documentación. No se ejecutaron Build/tests, servicios, importaciones ni operaciones sobre datos o infraestructura en esta revisión.
