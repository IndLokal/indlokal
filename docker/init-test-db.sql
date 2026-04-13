-- Runs once on first container initialisation (empty volume).
-- Creates the isolated test database alongside the dev database.
SELECT 'CREATE DATABASE localpulse_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'localpulse_test')\gexec
