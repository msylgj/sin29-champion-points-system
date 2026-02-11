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
    ('recurve', '反曲弓', '最常见的竞技弓'),
    ('compound', '复合弓', '使用定滑轮的现代弓'),
    ('traditional', '传统弓', '传统弓术'),
    ('longbow', '美猎弓', '美国狩猎弓'),
    ('barebow', '光弓', '无瞄准器的弓')
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
    ('18m', '18米'),
    ('30m', '30米'),
    ('50m', '50米'),
    ('70m', '70米')
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
-- 赛事表 (events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    season VARCHAR(10) NOT NULL CHECK (season IN ('Q1', 'Q2', 'Q3', 'Q4')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(year, season)
);

CREATE INDEX IF NOT EXISTS idx_event_year_season ON events(year, season);

-- ============================================================================
-- 赛事配置表 (event_configurations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_configurations (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    bow_type VARCHAR(50) NOT NULL CHECK (bow_type IN ('recurve', 'compound', 'traditional', 'longbow', 'barebow')),
    distance VARCHAR(10) NOT NULL CHECK (distance IN ('18m', '30m', '50m', '70m')),
    format VARCHAR(50) NOT NULL CHECK (format IN ('ranking', 'elimination', 'mixed_doubles', 'team')),
    participant_count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(event_id, bow_type, distance, format)
);

CREATE INDEX IF NOT EXISTS idx_event_config_event ON event_configurations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_config_key ON event_configurations(event_id, bow_type, distance, format);

-- ============================================================================
-- 成绩表 (scores) - 核心表
-- ============================================================================
CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    club VARCHAR(100) NOT NULL,
    bow_type VARCHAR(50) NOT NULL CHECK (bow_type IN ('recurve', 'compound', 'traditional', 'longbow', 'barebow')),
    distance VARCHAR(10) NOT NULL CHECK (distance IN ('18m', '30m', '50m', '70m')),
    format VARCHAR(50) NOT NULL CHECK (format IN ('ranking', 'elimination', 'mixed_doubles', 'team')),
    rank INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_score_event ON scores(event_id);
CREATE INDEX IF NOT EXISTS idx_score_event_name ON scores(event_id, name);
CREATE INDEX IF NOT EXISTS idx_score_event_bow_format ON scores(event_id, bow_type, distance, format);

-- ============================================================================
-- 示例数据：赛事
INSERT INTO events (year, season) VALUES
    (2024, 'Q1'),
    (2024, 'Q2'),
    (2024, 'Q3'),
    (2024, 'Q4')
ON CONFLICT DO NOTHING;

-- 示例数据：赛事配置
INSERT INTO event_configurations (event_id, bow_type, distance, format, participant_count) VALUES
    (1, 'recurve', '18m', 'ranking', 20),
    (1, 'recurve', '30m', 'ranking', 20),
    (1, 'compound', '18m', 'ranking', 15),
    (1, 'compound', '30m', 'ranking', 15),
    (1, 'recurve', '30m', 'elimination', 16),
    (1, 'compound', '30m', 'elimination', 12)
ON CONFLICT DO NOTHING;

-- 示例数据：成绩
INSERT INTO scores (event_id, name, club, bow_type, distance, format, rank) VALUES
    (1, '张三', '射箭俱乐部A', 'recurve', '18m', 'ranking', 1),
    (1, '李四', '射箭俱乐部B', 'recurve', '18m', 'ranking', 2),
    (1, '王五', '射箭俱乐部A', 'recurve', '18m', 'ranking', 3),
    (1, '赵六', '射箭俱乐部C', 'compound', '18m', 'ranking', 1),
    (1, '孙七', '射箭俱乐部B', 'compound', '18m', 'ranking', 2)
ON CONFLICT DO NOTHING;
