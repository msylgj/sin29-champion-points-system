-- 创建数据库
-- 注意：此文件在 PostgreSQL Docker 容器启动时自动执行

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 弓种字典表 (bow_types)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bow_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT INTO bow_types (code, name, description) VALUES
    ('barebow', '光弓', '无瞄准器的弓'),
    ('longbow', '美猎弓', '美国狩猎弓'),
    ('traditional', '传统弓', '传统弓术'),
    ('sightless', '无瞄弓', '不使用瞄具的弓'),
    ('recurve', '反曲弓', '最常见的竞技弓'),
    ('compound', '复合弓', '使用定滑轮的现代弓')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 距离字典表 (distances)
-- ============================================================================
CREATE TABLE IF NOT EXISTS distances (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT INTO distances (code, name) VALUES
    ('70m', '70米'),
    ('50m', '50米'),
    ('30m', '30米'),
    ('18m', '18米'),
    ('10m', '10米')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 比赛类型字典表 (competition_formats)
-- ============================================================================
CREATE TABLE IF NOT EXISTS competition_formats (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT INTO competition_formats (code, name, description) VALUES
    ('ranking', '排位赛', '个人排位比赛'),
    ('elimination', '淘汰赛', '单淘汰比赛'),
    ('mixed_doubles', '混双赛', '混合双打比赛'),
    ('team', '团体赛', '团队比赛')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 比赛性别分组字典表 (competition_gender_groups)
-- ============================================================================
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

-- ============================================================================
-- 比赛组别字典表 (competition_groups)
-- ============================================================================
CREATE TABLE IF NOT EXISTS competition_groups (
    id SERIAL PRIMARY KEY,
    group_code VARCHAR(2) NOT NULL,
    bow_type VARCHAR(50) NOT NULL,
    distance VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(group_code, bow_type, distance)
);

INSERT INTO competition_groups (group_code, bow_type, distance) VALUES
    ('S', 'barebow', '50m'),
    ('A', 'compound', '50m'),
    ('A', 'barebow', '30m'),
    ('A', 'longbow', '30m'),
    ('A', 'traditional', '30m'),
    ('A', 'recurve', '30m'),
    ('B', 'compound', '30m'),
    ('B', 'barebow', '18m'),
    ('B', 'sightless', '18m'),
    ('B', 'longbow', '18m'),
    ('B', 'traditional', '18m'),
    ('B', 'recurve', '18m'),
    ('C', 'compound', '18m'),
    ('C', 'barebow', '10m'),
    ('C', 'sightless', '10m'),
    ('C', 'longbow', '10m'),
    ('C', 'traditional', '10m'),
    ('C', 'recurve', '10m')
ON CONFLICT (group_code, bow_type, distance) DO NOTHING;

-- ============================================================================
-- 赛事表 (events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    season VARCHAR(10) NOT NULL CHECK (season IN ('春季赛', '夏季赛', '秋季赛', '冬季赛')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(year, season)
);

CREATE INDEX IF NOT EXISTS idx_event_year_season ON events(year, season);

-- ============================================================================
-- 赛事报名表 (event_registrations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_registrations (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    season VARCHAR(10) NOT NULL CHECK (season IN ('春季赛', '夏季赛', '秋季赛', '冬季赛')),
    name VARCHAR(100) NOT NULL,
    club VARCHAR(100) NOT NULL,
    distance VARCHAR(10) NOT NULL CHECK (distance IN ('10m', '18m', '30m', '50m', '70m')),
    competition_bow_type VARCHAR(50) NOT NULL CHECK (competition_bow_type IN ('barebow', 'longbow', 'traditional', 'sightless', 'recurve', 'compound')),
    points_bow_type VARCHAR(50) NOT NULL CHECK (points_bow_type IN ('barebow', 'longbow', 'traditional', 'recurve', 'compound')),
    competition_gender_group VARCHAR(50) NOT NULL CHECK (competition_gender_group IN ('men', 'women', 'mixed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(year, season, name, distance, competition_bow_type)
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_year_points_lookup
ON event_registrations(year, points_bow_type, season, name, distance, competition_bow_type);

-- ============================================================================
-- 赛事配置表 (event_configurations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_configurations (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    gender_group VARCHAR(50) NOT NULL CHECK (gender_group IN ('men', 'women', 'mixed')),
    bow_type VARCHAR(50) NOT NULL CHECK (bow_type IN ('barebow', 'longbow', 'traditional', 'sightless', 'recurve', 'compound')),
    distance VARCHAR(10) NOT NULL CHECK (distance IN ('10m', '18m', '30m', '50m', '70m')),
    individual_participant_count INTEGER NOT NULL DEFAULT 0,
    mixed_doubles_team_count INTEGER NOT NULL DEFAULT 0,
    team_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(event_id, gender_group, bow_type, distance)
);

-- ============================================================================
-- 成绩表 (scores) - 核心表
-- ============================================================================
CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    bow_type VARCHAR(50) NOT NULL CHECK (bow_type IN ('barebow', 'longbow', 'traditional', 'sightless', 'recurve', 'compound')),
    distance VARCHAR(10) NOT NULL CHECK (distance IN ('10m', '18m', '30m', '50m', '70m')),
    format VARCHAR(50) NOT NULL CHECK (format IN ('ranking', 'elimination', 'mixed_doubles', 'team')),
    rank INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(event_id, name, distance, bow_type, format)
);

CREATE INDEX IF NOT EXISTS idx_scores_event_created_id
ON scores(event_id, created_at DESC, id DESC);
