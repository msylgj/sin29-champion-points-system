BEGIN;

CREATE INDEX IF NOT EXISTS idx_scores_event_created_id
ON scores (event_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_event_registrations_year_points_lookup
ON event_registrations (year, points_bow_type, season, name, distance, competition_bow_type);

COMMIT;
