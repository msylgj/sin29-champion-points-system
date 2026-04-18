BEGIN;

ALTER TABLE scores
ADD COLUMN IF NOT EXISTS gender_group VARCHAR(50) DEFAULT NULL;

ALTER TABLE scores
ADD CONSTRAINT ck_scores_gender_group CHECK (gender_group IS NULL OR gender_group IN ('men', 'women', 'mixed'));

COMMIT;
