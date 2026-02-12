# 数据库设计文档 (v2.0)

一个针对射箭赛事积分统计系统的轻量级数据库架构。系统设计规范、高效，支持多维度积分计算和年度排名聚合。

> **版本**: v2.0 | **最后更新**: 2026年2月 | **核心表**: 6个 | **特点**: 动态计算积分，不存储冗余数据

---

## 📊 核心概念

### 三层数据模型

```
业务数据层          事实数据层          字典数据层
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  events      │  │  scores      │  │ bow_types    │
│ (赛事)       │──│ (成绩)       │──│ (弓种字典)   │
└──────────────┘  └──────────────┘  └──────────────┘
│                  │
├─event_configs   ├─no points field! (动态计算)
│ (参赛人数)      │
└──────────────┘  │                  ┌──────────────┐
                  │                  │ distances   │
                  │                  │ (距离字典)  │
                  │                  └──────────────┘
                  │
                  │                  ┌──────────────┐
                  └──────────────────│ competition  │
                                     │ _formats     │
                                     │ (赛制字典)   │
                                     └──────────────┘
```

### 关键设计理念

| 原则 | 实现 | 优势 |
|-----|-----|------|
| **规范化** | 只存储事实数据 | 避免冗余和不一致 |
| **动态计算** | 积分在响应时计算 | 支持后期调整参数 |
| **灵活扩展** | 字典驱动的设计 | 可动态添加弓种/距离/赛制 |
| **高效查询** | 关键字段建立索引 | 支持百万级数据 |

---

## 🗄️ 数据库表详解

### 1. events（赛事表）

**用途**：存储射箭比赛赛事的基本信息

```sql
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    season VARCHAR(2) NOT NULL,  -- Q1, Q2, Q3, Q4
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, season)
);
```

**字段说明**：

| 字段 | 类型 | 约束 | 说明 |
|-----|-----|------|------|
| id | SERIAL | PRIMARY KEY | 赛事唯一标识 |
| year | INTEGER | NOT NULL | 赛事年份（2024、2025等） |
| season | VARCHAR(2) | NOT NULL | 赛季（Q1-Q4，代表四个季度） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**约束**：
- `UNIQUE(year, season)`：同一年度的同一季度只能创建一个赛事

**索引**：
```sql
CREATE INDEX idx_event_year ON events(year);
CREATE INDEX idx_event_year_season ON events(year, season);
```

**示例数据**：
```sql
INSERT INTO events (year, season) VALUES (2024, 'Q1');  -- 2024年第1季度
INSERT INTO events (year, season) VALUES (2024, 'Q2');  -- 2024年第2季度
INSERT INTO events (year, season) VALUES (2025, 'Q1');  -- 2025年第1季度
```

---

### 2. event_configurations（赛事配置表）⭐ 新增表

**用途**：存储每个赛事的多组比赛配置（弓种/距离/赛制组合），以及该配置的参赛人数

**关键作用**：参赛人数直接影响积分系数计算，需要单独存储

```sql
CREATE TABLE IF NOT EXISTS event_configurations (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    bow_type VARCHAR(50) NOT NULL,
    distance VARCHAR(10) NOT NULL,
    format VARCHAR(50) NOT NULL,
    participant_count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, bow_type, distance, format)
);
```

**字段说明**：

| 字段 | 类型 | 约束 | 说明 |
|-----|-----|------|------|
| id | SERIAL | PRIMARY KEY | 配置ID |
| event_id | INTEGER | NOT NULL, FK | 关联的赛事ID |
| bow_type | VARCHAR(50) | NOT NULL | 弓种代码（recurve、compound等） |
| distance | VARCHAR(10) | NOT NULL | 距离代码（18m、30m、50m、70m） |
| format | VARCHAR(50) | NOT NULL | 赛制代码（ranking、elimination、mixed_doubles、team） |
| participant_count | INTEGER | NOT NULL | 参赛人数（1-999） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**约束**：
- `UNIQUE(event_id, bow_type, distance, format)`：每个赛事的每个配置组合唯一
- `participant_count >= 1`：参赛人数至少1人

**索引**：
```sql
CREATE INDEX idx_event_config_event ON event_configurations(event_id);
CREATE INDEX idx_event_config_key ON event_configurations(event_id, bow_type, distance, format);
```

**实际使用示例**：
```sql
-- 2024 Q1 赛事中的多个配置
-- 配置1：反曲弓30米，24人参赛
INSERT INTO event_configurations (event_id, bow_type, distance, format, participant_count)
VALUES (1, 'recurve', '30m', 'ranking', 24);

-- 配置2：反曲弓18米，20人参赛
INSERT INTO event_configurations (event_id, bow_type, distance, format, participant_count)
VALUES (1, 'recurve', '18m', 'ranking', 20);

-- 配置3：复合弓30米，15人参赛
INSERT INTO event_configurations (event_id, bow_type, distance, format, participant_count)
VALUES (1, 'compound', '30m', 'ranking', 15);
```

**为什么需要这张表**：
- 参赛人数决定了积分系数（人数越多系数越高）
- 同一赛事的不同配置的参赛人数可能不同
- 需要在计算积分时查询对应配置的参赛人数
- 支持后期修改参赛人数，动态重新计算所有相关成绩的积分

---

### 3. scores（成绩表）⭐ 关键改进

**用途**：存储参赛者在每个比赛配置中的具体成绩

**关键特性**：⚡ **不存储积分字段**，积分在查询时动态计算

```sql
CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    club VARCHAR(100),
    bow_type VARCHAR(50) NOT NULL,
    distance VARCHAR(10) NOT NULL,
    format VARCHAR(50) NOT NULL,
    rank INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**字段说明**：

| 字段 | 类型 | 约束 | 说明 |
|-----|-----|------|------|
| id | SERIAL | PRIMARY KEY | 成绩ID |
| event_id | INTEGER | NOT NULL, FK | 关联的赛事ID |
| name | VARCHAR(100) | NOT NULL | 参赛者姓名 |
| club | VARCHAR(100) | NULLABLE | 俱乐部名称（可空） |
| bow_type | VARCHAR(50) | NOT NULL | 弓种代码 |
| distance | VARCHAR(10) | NOT NULL | 距离代码 |
| format | VARCHAR(50) | NOT NULL | 赛制代码 |
| rank | INTEGER | NOT NULL | 排名（1、2、3...） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |


**索引**：
```sql
CREATE INDEX idx_scores_event ON scores(event_id);
CREATE INDEX idx_scores_event_bow ON scores(event_id, bow_type);
CREATE INDEX idx_scores_name ON scores(name);
```

**示例数据**：
```sql
-- 张三在2024 Q1赛事中，反曲弓30米排位赛排名第1
INSERT INTO scores (event_id, name, club, bow_type, distance, format, rank)
VALUES (1, '张三', '北京俱乐部', 'recurve', '30m', 'ranking', 1);

-- 李四同赛事排名第2
INSERT INTO scores (event_id, name, club, bow_type, distance, format, rank)
VALUES (1, '李四', '上海俱乐部', 'recurve', '30m', 'ranking', 2);

-- 张三同赛事18m排位赛排名第2
INSERT INTO scores (event_id, name, club, bow_type, distance, format, rank)
VALUES (1, '张三', '北京俱乐部', 'recurve', '18m', 'ranking', 2);
```

**积分计算方式**：
```python
# 伪代码
def get_score_points(score: Score) -> float:
    config = get_configuration(
        event_id=score.event_id,
        bow_type=score.bow_type,
        distance=score.distance,
        format=score.format
    )
    base_points = POINTS_TABLE[score.format][score.rank]
    coefficient = get_coefficient(config.participant_count)
    distance_factor = 0.5 if score.distance == '18m' else 1.0
    return base_points * coefficient * distance_factor
```

---

### 4. bow_types（弓种字典表）

**用途**：维护系统支持的弓种列表

```sql
CREATE TABLE IF NOT EXISTS bow_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

**字段说明**：

| 字段 | 说明 |
|-----|------|
| code | 代码（用于API和数据库） |
| name | 中文显示名称 |
| description | 弓种描述 |

**初始数据**：
```sql
INSERT INTO bow_types (code, name, description) VALUES
    ('recurve', '反曲弓', '最常见的竞技弓'),
    ('compound', '复合弓', '使用定滑轮的现代弓'),
    ('traditional', '传统弓', '传统弓术'),
    ('longbow', '美猎弓', '美国狩猎弓'),
    ('barebow', '光弓', '无瞄准器的弓');
```

---

### 5. distances（距离字典表）

**用途**：维护系统支持的射箭距离列表

```sql
CREATE TABLE IF NOT EXISTS distances (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

**初始数据**：
```sql
INSERT INTO distances (code, name) VALUES
    ('18m', '18米'),
    ('30m', '30米'),
    ('50m', '50米'),
    ('70m', '70米');
```

**特殊处理**：18米距离的成绩积分自动减半（×0.5）

---

### 6. competition_formats（赛制字典表）

**用途**：维护系统支持的比赛赛制列表

```sql
CREATE TABLE IF NOT EXISTS competition_formats (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

**初始数据**：
```sql
INSERT INTO competition_formats (code, name, description) VALUES
    ('ranking', '排位赛', '个人排位比赛'),
    ('elimination', '淘汰赛', '单淘汰比赛'),
    ('mixed_doubles', '混双赛', '混合双打比赛'),
    ('team', '团体赛', '团队比赛');
```

**赛制说明**：

| 赛制 | 积分表 | 说明 |
|-----|--------|------|
| ranking | RANKING_POINTS | 排位赛第1-8名分别25、22、19、15、10、8、6、4分 |
| elimination | ELIMINATION_POINTS | 淘汰赛第1-16名有分数，其余为1分 |
| mixed_doubles | TOURNAMENT_POINTS | 与淘汰赛相同的积分表 |
| team | TOURNAMENT_POINTS | 与淘汰赛相同的积分表 |

---
-- 张三在2024 Q1赛事中，反曲弓30米排位赛排名第1
INSERT INTO scores (event_id, name, club, bow_type, distance, format, rank)
VALUES (1, '张三', '俱乐部A', 'recurve', '30m', 'ranking', 1);

-- 李四同赛事排名第2
INSERT INTO scores (event_id, name, club, bow_type, distance, format, rank)
VALUES (1, '李四', '俱乐部B', 'recurve', '30m', 'ranking', 2);

-- 张三同赛事18m排位赛排名第2
INSERT INTO scores (event_id, name, club, bow_type, distance, format, rank)
VALUES (1, '张三', '俱乐部A', 'recurve', '18m', 'ranking', 2);
```

---

### 4. bow_types（弓种字典表）

**用途**：维护有效的弓种列表

```sql
CREATE TABLE bow_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    description TEXT
);
```

**初始数据**：
```sql
INSERT INTO bow_types (name, display_name, description) VALUES
('recurve', '反曲弓', '最常见的竞技弓种'),
('compound', '复合弓', '利用滑轮系统的现代弓'),
('barebow', '光弓', '没有瞄准器和稳定杆的弓'),
('traditional', '传统弓', '直弓、长弓等传统弓种');
```

---

### 5. distances（距离字典表）

**用途**：维护有效的射箭距离列表

```sql
CREATE TABLE distances (
    id SERIAL PRIMARY KEY,
    name VARCHAR(10) UNIQUE NOT NULL,
    display_name VARCHAR(20) NOT NULL,
    meters INTEGER
);
```

**初始数据**：
```sql
INSERT INTO distances (name, display_name, meters) VALUES
('18m', '18米', 18),
('25m', '25米', 25),
('30m', '30米', 30),
('50m', '50米', 50),
('70m', '70米', 70);
```

---

### 6. competition_formats（赛制字典表）

**用途**：维护有效的竞赛格式列表

```sql
CREATE TABLE competition_formats (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    description TEXT
);
```

**初始数据**：
```sql
INSERT INTO competition_formats (name, display_name, description) VALUES
('ranking', '排位赛', '参与者根据成绩排名，排名应分即为积分'),
('elimination', '淘汰赛', '逐轮淘汰赛制，最后赢家排名第1'),
('mixed_doubles', '混双赛', '两人一队，混性别组队，计分同淘汰赛'),
('team', '团体赛', '多人一队团体竞赛，计分同淘汰赛');
```

---

## 数据流和关系

```
┌──────────────────────────────────────────────────────────┐
│  赛事创建流程                                             │
├──────────────────────────────────────────────────────────┤

1. 创建赛事
   INSERT INTO events (year, season) 
   VALUES (2024, 'Q1')
   → event_id = 1

2. 添加配置（一个赛事可多个配置）
   INSERT INTO event_configurations (event_id, bow_type, distance, format, participant_count)
   VALUES (1, 'recurve', '30m', 'ranking', 24)

3. 导入成绩
   INSERT INTO scores (event_id, name, club, bow_type, distance, format, rank)
   VALUES (1, '张三', '俱乐部A', 'recurve', '30m', 'ranking', 1)

4. 查询排名时动态计算积分
   SELECT score.*, 
          ec.participant_count,
          calculate_points(score.rank, score.format, score.distance, ec.participant_count) as points
   FROM scores score
   JOIN event_configurations ec ON ...
   WHERE score.event_id = 1 AND score.bow_type = 'recurve'
```

---

## 关键设计决策

### 为什么移除 scores.points？

**原因：**
- 积分是可计算的数据，不应该存储
- 每条成绩涉及多维度（弓种、距离、赛制、参赛人数）
- 参赛人数可能后期调整，需要自动更新积分

**优势：**
- 数据规范化：只存储事实，不存储推导值
- 灵活性：修改参赛人数自动重新计算历史成绩的积分
- 一致性：避免数据不一致（如修改了参赛人数但忘记更新积分）

### 为什么新增 event_configurations？

**原因：**
- 需要记录每个赛事配置的参赛人数
- 参赛人数直接影响积分系数计算
- 同一赛事的不同配置可能参赛人数不同

**使用场景：**
```
2024年Q1赛事：
  - recurve + 30m + ranking: 24人 → 系数1.0
  - recurve + 18m + ranking: 20人 → 系数1.0
  - compound + 30m + ranking: 15人 → 系数0.9
```

---

## 性能优化

### 重要索引

```sql
-- 事件查询
CREATE INDEX idx_events_year ON events(year);

-- 配置查询（关键）
CREATE INDEX idx_event_config_lookup ON event_configurations
(event_id, bow_type, distance, format);

-- 成绩查询
CREATE INDEX idx_scores_event_bow ON scores(event_id, bow_type);
CREATE INDEX idx_scores_name ON scores(name);
```

### 查询优化

**年度聚合查询（重要）：**
```sql
SELECT 
    s.name, 
    s.club,
    SUM(
        calculate_points(s.rank, s.format, s.distance, ec.participant_count)
    ) as total_points
FROM scores s
JOIN event_configurations ec ON 
    s.event_id = ec.event_id 
    AND s.bow_type = ec.bow_type
    AND s.distance = ec.distance
    AND s.format = ec.format
JOIN events e ON s.event_id = e.id
WHERE e.year = 2024 AND s.bow_type = 'recurve'
GROUP BY s.name, s.club
ORDER BY total_points DESC;
```

---

## 数据容量规划

| 数据维度 | 建议上限 | 说明 |
|---------|---------|------|
| 赛事数量 | 无限制 | 系统可支持任意多个赛事 |
| 单赛事配置数 | 100+ | 一个赛事最多100种配置组合 |
| 单配置参赛人数 | 999 | 最多999人参赛 |
| 成绩总数 | 1,000,000+ | 百万级成绩记录 |
| 参赛人数 | 100,000+ | 十万级参赛者 |

---

## 相关文档

- [README.md](README.md) - 项目概览
- [QUICK_START.md](QUICK_START.md) - 快速启动指南
- [backend/app/services/scoring_calculator.py](backend/app/services/scoring_calculator.py) - 积分计算逻辑

---

**数据库版本**：v2.0  
**创建日期**：2026年2月  
**维护状态**：✅ 生产就绪
