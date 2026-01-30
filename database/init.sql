-- 创建数据库
-- 注意：此文件在 PostgreSQL Docker 容器启动时自动执行

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 运动员表 (athletes) - 简化版本
-- ============================================================================
CREATE TABLE IF NOT EXISTS athletes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    id_number VARCHAR(50) UNIQUE NOT NULL,
    gender VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female', 'mixed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_athlete_name ON athletes(name);
CREATE INDEX IF NOT EXISTS idx_athlete_phone ON athletes(phone);
CREATE INDEX IF NOT EXISTS idx_athlete_id_number ON athletes(id_number);

-- ============================================================================
-- 积分规则表 (scoring_rules)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scoring_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    rule_config JSONB NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    is_default INTEGER DEFAULT 0 NOT NULL,
    applicable_formats VARCHAR(200),
    applicable_distances VARCHAR(200),
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scoring_rules_name ON scoring_rules(name);
CREATE INDEX IF NOT EXISTS idx_scoring_rules_default ON scoring_rules(is_default);

-- ============================================================================
-- 成绩表 (scores) - 核心表，根据成绩规则进行积分计算
-- ============================================================================
CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    athlete_id INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    season VARCHAR(10) NOT NULL CHECK (season IN ('Q1', 'Q2', 'Q3', 'Q4')),
    distance VARCHAR(10) NOT NULL CHECK (distance IN ('18m', '30m', '50m', '70m')),
    competition_format VARCHAR(50) NOT NULL CHECK (competition_format IN ('ranking', 'elimination', 'team')),
    gender_group VARCHAR(50) NOT NULL,
    bow_type VARCHAR(50),
    raw_score INTEGER NOT NULL,
    rank INTEGER,
    group_rank INTEGER,
    base_points FLOAT DEFAULT 0.0,
    points FLOAT DEFAULT 0.0,
    round INTEGER,
    participant_count INTEGER,
    is_valid INTEGER DEFAULT 1 NOT NULL,
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scores_athlete ON scores(athlete_id);
CREATE INDEX IF NOT EXISTS idx_score_year_season ON scores(year, season);
CREATE INDEX IF NOT EXISTS idx_score_distance_format ON scores(distance, competition_format);
CREATE INDEX IF NOT EXISTS idx_score_gender_bow ON scores(gender_group, bow_type);
CREATE INDEX IF NOT EXISTS idx_score_rank ON scores(rank);
CREATE INDEX IF NOT EXISTS idx_score_valid ON scores(is_valid);

-- ============================================================================
-- 运动员积分汇总表 (athlete_aggregate_points)
-- ============================================================================
CREATE TABLE IF NOT EXISTS athlete_aggregate_points (
    id SERIAL PRIMARY KEY,
    athlete_id INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    season VARCHAR(10),
    total_points FLOAT DEFAULT 0.0 NOT NULL,
    event_count INTEGER DEFAULT 0 NOT NULL,
    rank INTEGER,
    gender_group VARCHAR(50),
    bow_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agg_athlete_year_season ON athlete_aggregate_points(athlete_id, year, season);
CREATE INDEX IF NOT EXISTS idx_agg_year_season_rank ON athlete_aggregate_points(year, season, rank);
CREATE INDEX IF NOT EXISTS idx_agg_athlete ON athlete_aggregate_points(athlete_id);

-- ============================================================================
-- 操作日志表 (operation_logs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS operation_logs (
    id SERIAL PRIMARY KEY,
    operation_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    description TEXT,
    old_values TEXT,
    new_values TEXT,
    ip_address VARCHAR(50),
    user_agent VARCHAR(255),
    status VARCHAR(20) DEFAULT 'success' NOT NULL CHECK (status IN ('success', 'failure')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_log_entity ON operation_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_log_created ON operation_logs(created_at);

-- ============================================================================
-- 插入示例数据
-- ============================================================================

-- 运动员数据
INSERT INTO athletes (name, phone, id_number, gender) VALUES
    ('张三', '13800000001', '110101199001011234', 'male'),
    ('李四', '13800000002', '110101199201012345', 'female'),
    ('王五', '13800000003', '110101199301013456', 'male'),
    ('赵六', '13800000004', '110101199401014567', 'female')
ON CONFLICT (id_number) DO NOTHING;

-- 积分规则数据
INSERT INTO scoring_rules (name, description, rule_config, rule_type, is_default) VALUES
    ('2024年射箭积分规则', '排名赛、淘汰赛、团体赛的标准积分计算规则',
     '{"type":"rank_based","version":"1.0","rules":{"ranking":{"base_points":{"1":25,"2":22,"3":19,"4":15,"5":10,"6":8,"7":6,"8":4,"9":1},"coefficients":{"8-15":[0.6,4],"16-31":[0.8,8],"32-63":[1.0,16],"64-127":[1.2,16],"128+":[1.4,16]}},"elimination":{"base_points":{"1":45,"2":40,"3":35,"4":30,"5-8":20,"9-16":15,"17":1},"coefficients":{"8-15":[0.6,4],"16-31":[0.8,8],"32-63":[1.0,16],"64-127":[1.2,16],"128+":[1.4,16]}},"team":{"base_points":{"1":20,"2":15,"3":10,"4":8,"5":5,"6":4,"7":3,"8":2,"9":1},"coefficients":{"3-4":[0.6,2],"5-7":[0.8,4],"8-10":[1.0,8],"11-14":[1.2,8],"15+":[1.4,8]}}},"special_rules":{"18m_discount":0.5}}',
     'rank_based', 1)
ON CONFLICT (name) DO NOTHING;

-- 成绩数据示例
INSERT INTO scores (athlete_id, year, season, distance, competition_format, gender_group, bow_type, raw_score, rank, base_points, points, participant_count, is_valid) VALUES
    (1, 2024, 'Q1', '18m', 'ranking', 'male', 'recurve', 285, 1, 25.0, 12.5, 20, 1),
    (2, 2024, 'Q1', '18m', 'ranking', 'female', 'compound', 280, 1, 25.0, 12.5, 18, 1),
    (3, 2024, 'Q1', '18m', 'ranking', 'male', 'recurve', 275, 2, 22.0, 11.0, 20, 1),
    (1, 2024, 'Q1', '30m', 'ranking', 'male', 'recurve', 290, 2, 22.0, 17.6, 25, 1),
    (4, 2024, 'Q1', '30m', 'ranking', 'female', 'traditional', 288, 3, 19.0, 15.2, 25, 1)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 创建视图 (可选，用于简化查询)
-- ============================================================================

-- 运动员成绩汇总视图
CREATE OR REPLACE VIEW v_athlete_scores_summary AS
SELECT 
    a.id as athlete_id,
    a.name as athlete_name,
    a.phone,
    a.gender,
    s.year,
    s.season,
    s.distance,
    s.competition_format,
    s.raw_score,
    s.points,
    s.rank,
    s.gender_group,
    s.bow_type
FROM athletes a
LEFT JOIN scores s ON a.id = s.athlete_id
WHERE s.is_valid = 1
ORDER BY s.year DESC, s.season DESC, s.rank ASC;

-- 成绩排名视图
CREATE OR REPLACE VIEW v_score_rankings AS
SELECT 
    s.year,
    s.season,
    s.distance,
    s.competition_format,
    s.rank,
    s.gender_group,
    a.id as athlete_id,
    a.name as athlete_name,
    a.phone,
    a.gender,
    s.raw_score,
    s.points,
    s.bow_type
FROM scores s
LEFT JOIN athletes a ON s.athlete_id = a.id
WHERE s.is_valid = 1
ORDER BY s.year DESC, s.season DESC, s.distance, s.competition_format, s.rank ASC;

-- 积分汇总视图（按年季度统计）
CREATE OR REPLACE VIEW v_aggregate_rankings AS
SELECT 
    aap.year,
    aap.season,
    aap.rank,
    a.id as athlete_id,
    a.name as athlete_name,
    a.phone,
    a.gender,
    aap.total_points,
    aap.event_count
FROM athlete_aggregate_points aap
LEFT JOIN athletes a ON aap.athlete_id = a.id
ORDER BY aap.year DESC, aap.season DESC, aap.rank ASC;
