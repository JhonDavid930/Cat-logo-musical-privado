# Incidencia Docker Desktop local · 2026-09-10

**Estado comprobado el 2026-09-14:** Docker vuelve a funcionar (Engine 29.5.3, Compose 5.1.4). Build, app/PostgreSQL, migraciones, persistencia y recuperación aisladas superados mediante scripts/test-docker.mjs. No se realizó Factory Reset ni reparación en esta tarea y no se conoce la causa del cambio. El diagnóstico siguiente queda como historial, no como bloqueo activo.

Nota de revisión documental (2026-09-12): este documento conserva el último diagnóstico conocido. No se ejecutó docker info, arrancó Docker ni consultó nuevamente su estado en esta revisión; no se confirma que el mismo fallo continúe. Antes de retomar infraestructura, comprobar disponibilidad sin reiniciar ni modificar servicios automáticamente.

Desktop 4.79.0.230596, CLI 29.5.3; Windows build 26200. El arranque falla antes de levantar Linux engine:

`initializing Inference manager ... dockerInference ... The file cannot be accessed by the system ... filename, directory name, or volume label syntax is incorrect`

El objeto `%LOCALAPPDATA%/Docker/run/dockerInference` tiene longitud cero y atributo ReparsePoint. Los logs confirman parada del motor durante el arranque. Intento reversible de renombrar exclusivamente ese objeto: denegado por Windows; no cambió nada. No se ejecutó Factory Reset, prune, borrado de volúmenes, cambios de configuración ni carga manual de diagnósticos a terceros.

Context7 de Compose no cubría esta avería. Se consultaron las fuentes de Docker: [incidencia coincidente #460](https://github.com/docker/desktop-feedback/issues/460), [#625](https://github.com/docker/desktop-feedback/issues/625) y [ajustes de Model Runner](https://docs.docker.com/enterprise/security/hardened-desktop/settings-management/settings-reference/). Los reportes indican sockets AF_UNIX retenidos por Windows y que desactivar enableInference no evita siempre el listener. Son reportes de usuarios, no garantía oficial de reparación.

Siguiente paso para el propietario: guardar el trabajo abierto y reiniciar Windows cuando resulte conveniente; después comprobar `docker info`. No reiniciar automáticamente el equipo. Si persiste, revisar actualización de Docker y soporte oficial conservando los volúmenes. La aplicación local funciona sin ese motor, pero no se debe afirmar que los contenedores se han probado hasta que arranquen correctamente.
