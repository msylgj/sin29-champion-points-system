-- 创建数据库（如果不存在）
-- 注意：此文件在 PostgreSQL Docker 容器启动时自动执行

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建示例表（后续可通过 Alembic 迁移管理）
-- 这里只是初始化数据库结构的示例

-- 运动员表
CREATE TABLE IF NOT EXISTS athletes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    gender VARCHAR(10),
    age INTEGER,
    club VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 赛事表
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    event_date DATE NOT NULL,
    location VARCHAR(200),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 积分记录表
CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    athlete_id INTEGER REFERENCES athletes(id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    rank INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_athletes_name ON athletes(name);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_scores_athlete ON scores(athlete_id);
CREATE INDEX IF NOT EXISTS idx_scores_event ON scores(event_id);

-- 插入示例数据
INSERT INTO athletes (name, gender, age, club) VALUES
    ('张三', '男', 25, '北京射箭俱乐部'),
    ('李四', '女', 23, '上海射箭队'),
    ('王五', '男', 28, '广州射箭协会')
ON CONFLICT DO NOTHING;

INSERT INTO events (name, event_date, location, description) VALUES
    ('2024年春季射箭锦标赛', '2024-03-15', '北京', '年度重要赛事'),
    ('全国射箭公开赛', '2024-05-20', '上海', '全国性比赛')
ON CONFLICT DO NOTHING;

INSERT INTO scores (athlete_id, event_id, score, rank) VALUES
    (1, 1, 680, 1),
    (2, 1, 675, 2),
    (3, 1, 670, 3),
    (1, 2, 685, 1),
    (2, 2, 682, 2)
ON CONFLICT DO NOTHING;
