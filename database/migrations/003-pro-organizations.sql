BEGIN;
CREATE TABLE IF NOT EXISTS pro_organizations (key text PRIMARY KEY, name text NOT NULL);
ALTER TABLE pro_organizations OWNER TO catalog_app;
INSERT INTO pro_organizations(key,name) VALUES('bmi','BMI'),('ascap','ASCAP'),('sgae','SGAE') ON CONFLICT DO NOTHING;
INSERT INTO pro_organizations(key,name)
SELECT DISTINCT ON (lower(clean_name)) lower(clean_name), clean_name FROM (
  SELECT regexp_replace(trim(payload->>'organization'), '\s+', ' ', 'g') AS clean_name
  FROM registrations WHERE agency='PRO'
) names WHERE clean_name IS NOT NULL AND clean_name <> ''
ORDER BY lower(clean_name), clean_name
ON CONFLICT DO NOTHING;
COMMIT;
