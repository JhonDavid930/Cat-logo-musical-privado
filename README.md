# David Appleton · Archivo privado

**Para retomar el proyecto, empieza por [Estado y próximos pasos](docs/PROJECT_STATUS.md).** Estado actualizado: 14 de septiembre de 2026. La carpeta real sigue siendo DavidAppleton; el renombrado a CatalogControl está pendiente.

Primera versión funcional del catálogo personal: canciones, grabaciones, vídeos, lanzamientos, letras, autores, registros y documentos. Interfaz editorial en español, móvil y escritorio, con modos oscuro y claro. Identidad visual provisional propia de David Appleton.

## Abrir en este ordenador

Necesitas Node.js 24. Desde esta carpeta:

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

Abre http://127.0.0.1:3000. El modo DEV está limitado a este ordenador. Usa SQLite local en `private/catalog.sqlite`; Docker usa PostgreSQL propio. Si existe `private/catalog.json`, la base local nueva lo importa una sola vez. No hay dependencia de Supabase alojado ni pagos integrados.

## Lo que puedes hacer

- Buscar por título, autor, letra, género o código, incluyendo grabaciones relacionadas.
- Crear y editar fichas, letra, autores y porcentajes; vincular versiones sin duplicar obras.
- Registrar estados por entidad, sociedad PRO concreta, aplicabilidad y evidencia revisada por separado.
- Crear/asociar lanzamientos compartidos y editar su UPC/EAN y tipo Single, EP o Álbum desde cada canción.
- Subir varios documentos, audios y vídeos por canción; leer PDF, texto, Word/Excel y reproducir medios compatibles. También guardar notas sin archivo o enlaces opcionales.
- Elegir géneros de la base original de Notion y consultar su procedencia por versión.
- Asignar personas y roles profesionales sin confundirlos con porcentajes de autoría.
- Exportar y recuperar un ZIP completo con catálogo y binarios, o un JSON solo de metadatos.

La importación revisada el 10 de septiembre incorporó 16 fichas de composición de Notion agrupadas provisionalmente en 14 obras por ISWC idéntico, 17 grabaciones, 5 vídeos y 10 lanzamientos propios. Son recuentos históricos, no un inventario en vivo ni cobertura de las aproximadamente 70 canciones estimadas. Drive no se ha inventariado y no se verificaron registros externamente.

## Verificación

```powershell
npm run test
npm run typecheck
npm run build
# Pruebas de archivos/créditos/lanzamientos/PRO con catálogo aislado:
npx playwright test --config playwright.files.config.ts
```

La suite aislada arranca su servidor en el puerto 3002 después del Build y usa datos sintéticos. Requiere Chrome; `CHROME_PATH` permite indicar el ejecutable. La suite alternativa `npm run test:e2e` usa `TEST_BASE_URL` o el puerto 3000 y contiene escrituras/restauraciones: ejecutarla exclusivamente sobre un catálogo DEV desechable, sin ediciones simultáneas. Alcance y resultados en [VALIDATION](docs/VALIDATION.md).

## Documentación

- [Arquitectura y modelo](docs/TECH_SPEC.md)
- [Docker, Synology, VPS y copias de seguridad](docs/DEPLOY_GUIDE.md)
- [Cambios y verificación](docs/CHANGELOG.md)
- [Resultados de pruebas y revisión manual](docs/VALIDATION.md)
- [Dirección visual](design-system/MASTER.md)
- [Incidencia local de Docker](docs/DOCKER_LOCAL_ISSUE.md)

No se ha publicado el catálogo ni realizado Commit o Push durante el trabajo documentado. Docker/PostgreSQL superaron el ensayo local aislado el 14 de septiembre. Antes de trasladar archivos o hacer Deploy al NAS, siguen siendo necesarias la revisión y aprobación del propietario; consulta los límites en VALIDATION.

Para repetir el ensayo Docker con datos sintéticos: `node scripts/test-docker.mjs`. Crea un proyecto separado, secretos temporales y volúmenes propios; al terminar detiene sus contenedores y conserva esos volúmenes/backups para diagnóstico. No usa el catálogo real. Requiere Docker operativo y espacio para Build e imágenes.

Las sociedades PRO nuevas se guardan en una lista compartida: al guardar «Otra sociedad», podrás elegirla al crear o editar registros de cualquier canción, también después de reiniciar. BMI, ASCAP y SGAE vienen como opciones; elegirlas no confirma ningún registro.

