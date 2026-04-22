-- Runs once on first container initialisation (empty volume).
-- Creates the isolated test database alongside the dev database.
SELECT 'CREATE DATABASE indlokal_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'indlokal_test')\gexec
