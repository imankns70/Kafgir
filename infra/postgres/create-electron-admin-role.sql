\set ON_ERROR_STOP on
\prompt 'Password for kafgir_electron_admin: ' electron_admin_password

SELECT format(
  'CREATE ROLE kafgir_electron_admin LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'electron_admin_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kafgir_electron_admin')
\gexec

SELECT format(
  'ALTER ROLE kafgir_electron_admin PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'electron_admin_password'
)
\gexec

GRANT CONNECT ON DATABASE :"DBNAME" TO kafgir_electron_admin;
GRANT USAGE ON SCHEMA public TO kafgir_electron_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kafgir_electron_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kafgir_electron_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kafgir_electron_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kafgir_electron_admin;
