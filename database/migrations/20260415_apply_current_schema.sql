BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

INSERT INTO bow_types (code, name, description) VALUES
    ('sightless', '无瞄弓', '不使用瞄具的弓')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS competition_gender_groups (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT INTO competition_gender_groups (code, name) VALUES
    ('men', '男子组'),
    ('women', '女子组'),
    ('mixed', '混合组')
ON CONFLICT (code) DO NOTHING;

INSERT INTO competition_groups (group_code, bow_type, distance) VALUES
    ('B', 'sightless', '18m'),
    ('C', 'sightless', '10m')
ON CONFLICT (group_code, bow_type, distance) DO NOTHING;

CREATE TABLE IF NOT EXISTS event_registrations (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    season VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    club VARCHAR(100) NOT NULL,
    distance VARCHAR(10) NOT NULL,
    competition_bow_type VARCHAR(50) NOT NULL,
    points_bow_type VARCHAR(50) NOT NULL,
    competition_gender_group VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_event_registration_season CHECK (season IN ('春季赛', '夏季赛', '秋季赛', '冬季赛')),
    CONSTRAINT ck_event_registration_distance CHECK (distance IN ('10m', '18m', '30m', '50m', '70m')),
    CONSTRAINT ck_event_registration_competition_bow_type CHECK (competition_bow_type IN ('barebow', 'longbow', 'traditional', 'sightless', 'recurve', 'compound')),
    CONSTRAINT ck_event_registration_points_bow_type CHECK (points_bow_type IN ('barebow', 'longbow', 'traditional', 'recurve', 'compound')),
    CONSTRAINT ck_event_registration_gender_group CHECK (competition_gender_group IN ('men', 'women', 'mixed')),
    CONSTRAINT ux_event_registration_key UNIQUE (year, season, name, distance, competition_bow_type)
);

ALTER TABLE event_registrations
    DROP CONSTRAINT IF EXISTS ux_event_registration_key;

DROP INDEX IF EXISTS ux_event_registration_key;
DROP INDEX IF EXISTS idx_event_registration_event;
DROP INDEX IF EXISTS idx_event_registration_athlete;
DROP INDEX IF EXISTS ix_event_registrations_id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_event_registration_key
ON event_registrations (year, season, name, distance, competition_bow_type);

ALTER TABLE event_configurations
    ADD COLUMN IF NOT EXISTS gender_group VARCHAR(50);

UPDATE event_configurations
SET gender_group = 'mixed'
WHERE gender_group IS NULL OR btrim(gender_group) = '';

ALTER TABLE event_configurations
    ALTER COLUMN gender_group SET DEFAULT 'mixed';

ALTER TABLE event_configurations
    ALTER COLUMN gender_group SET NOT NULL;

ALTER TABLE event_configurations
    DROP CONSTRAINT IF EXISTS event_configurations_bow_type_check;

ALTER TABLE event_configurations
    DROP CONSTRAINT IF EXISTS event_configurations_distance_check;

ALTER TABLE event_configurations
    DROP CONSTRAINT IF EXISTS event_configurations_gender_group_check;

ALTER TABLE event_configurations
    DROP CONSTRAINT IF EXISTS event_configurations_event_id_bow_type_distance_key;

ALTER TABLE event_configurations
    DROP CONSTRAINT IF EXISTS event_configurations_event_id_gender_group_bow_type_distance_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'event_configurations_gender_group_check'
    ) THEN
        ALTER TABLE event_configurations
            ADD CONSTRAINT event_configurations_gender_group_check
            CHECK (gender_group IN ('men', 'women', 'mixed'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'event_configurations_bow_type_check'
    ) THEN
        ALTER TABLE event_configurations
            ADD CONSTRAINT event_configurations_bow_type_check
            CHECK (bow_type IN ('barebow', 'longbow', 'traditional', 'sightless', 'recurve', 'compound'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'event_configurations_distance_check'
    ) THEN
        ALTER TABLE event_configurations
            ADD CONSTRAINT event_configurations_distance_check
            CHECK (distance IN ('10m', '18m', '30m', '50m', '70m'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'event_configurations_event_id_gender_group_bow_type_distance_key'
    ) THEN
        ALTER TABLE event_configurations
            ADD CONSTRAINT event_configurations_event_id_gender_group_bow_type_distance_key
            UNIQUE (event_id, gender_group, bow_type, distance);
    END IF;
END $$;

ALTER TABLE event_configurations
    ALTER COLUMN gender_group DROP DEFAULT;

DROP INDEX IF EXISTS idx_event_config_event;
DROP INDEX IF EXISTS idx_event_config_key;

ALTER TABLE scores
    DROP CONSTRAINT IF EXISTS scores_bow_type_check;

ALTER TABLE scores
    DROP COLUMN IF EXISTS club;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'scores_bow_type_check'
    ) THEN
        ALTER TABLE scores
            ADD CONSTRAINT scores_bow_type_check
            CHECK (bow_type IN ('barebow', 'longbow', 'traditional', 'sightless', 'recurve', 'compound'));
    END IF;
END $$;

DROP INDEX IF EXISTS idx_score_event;
DROP INDEX IF EXISTS idx_score_event_name;
DROP INDEX IF EXISTS idx_score_event_bow_format;

ALTER TABLE scores
    DROP CONSTRAINT IF EXISTS uq_score_event_name_distance_bow_format;

ALTER TABLE scores
    DROP CONSTRAINT IF EXISTS scores_event_id_name_distance_bow_type_format_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_score_event_name_distance_bow_format'
    ) THEN
        ALTER TABLE scores
            ADD CONSTRAINT uq_score_event_name_distance_bow_format
            UNIQUE (event_id, name, distance, bow_type, format);
    END IF;
END $$;

COMMIT;
