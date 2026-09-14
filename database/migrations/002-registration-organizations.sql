BEGIN;
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_entity_id_agency_key;
CREATE UNIQUE INDEX IF NOT EXISTS registration_entity_organization ON registrations(entity_id,lower(agency),lower(coalesce(payload->>'organization','')));
COMMIT;
