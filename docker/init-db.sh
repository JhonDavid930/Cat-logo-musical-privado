#!/bin/sh
set -eu
app_password=$(cat /run/secrets/db_app_password)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$app_password" <<'SQL'
CREATE ROLE catalog_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE catalog TO catalog_app;
GRANT USAGE, CREATE ON SCHEMA public TO catalog_app;
SET ROLE catalog_app;
\i /opt/catalog/schema.sql
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM catalog_app;
SQL
