# 数据库设计文档 (v2.0 - 重构版)

## 概述

经过完整重构，系统数据库架构从原来的 15+ 个表简化为 8 个核心表。主要改进包括：
- ✅ 移除冗余表（athletes, event_participants, aggregate_points）
- ✅ 移除 scores 表的 points 字段（改为动态计算）
- ✅ 新增 event_configurations 表（存储参赛人数）
- ✅ 统一赛制设计（支持4种赛制）

---

## 数据库架构图

```
┌─────────────────────────────────────┐
│          数据库核心表               │
├─────────────────────────────────────┤
│                                     │
│  events (赛事)                      │
│  ├─ id, year, season              │
│  └─ created_at, updated_at         │
│       ↓                             │
│  event_configurations (配置)        │
│  ├─ event_id (PK+FK)              │
│  ├─ bow_type, distance, format    │
│  └─ participant_count              │
│       ↓                             │
│  scores (成绩)                      │
│  ├─ id, event_id (FK)             │
│  ├─ name, club                     │
│  ├─ bow_type, distance, format    │
│  ├─ rank (★ 不存储积分)             │
│  └─ created_at                     │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  字典表（参考数据）                  │
│  ├─ bow_types (弓种)               │
│  ├─ distances (距离)               │
│  └─ competition_formats (赛制)     │
│                                     │
└─────────────────────────────────────┘
```

---

## 详细表结构

### 1. events（赛事表）

**用途**：存储赛事基本信息

```sql
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    season VARCHAR(2) NOT NULL,  -- Q1, Q2, Q3, Q4
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**字段说明**：

| 字段 | 类型 | 说明 |
|-----|-----|------|
| id | SERIAL | 主键，赛事ID |
| year | INTEGER | 赛事年度（2024、2025等） |
| season | VARCHAR(2) | 赛季（Q1-Q4代表四个季度） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

**索引**：
```sql
CREATE INDEX idx_events_year ON events(year);
CREATE INDEX idx_events_year_season ON events(year, season);
```

**示例数据**：
```sql
INSERT INTO events (year, season) VALUES (2024, 'Q1');  -- 2024年第一季度
INSERT INTO events (year, season) VALUES (2024, 'Q2');
INSERT INTO events (year, season) VALUES (2025, 'Q1');
```

---

### 2. event_configurations（赛事配置表）⭐ NEW

**用途**：存储每个赛事的配置信息，特别是参赛人数（用于计算积分系数）

```sql
CREATE TABLE event_configurations (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    bow_type VARCHAR(20) NOT NULL,
    distance VARCHAR(10) NOT NULL,
    format VARCHAR(20) NOT NULL,
    participant_count INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(event_id, bow_type, distance, format)
);
```

**字段说明**：

| 字段 | 类型 | 说明 |
|-----|-----|------|
| id | SERIAL | 主键 |
| event_id | INTEGER | 外键，关联events表 |
| bow_type | VARCHAR(20) | 弓种（recurve、compound、barebow、traditional） |
| distance | VARCHAR(10) | 距离（18m、25m、30m、50m、70m） |
| format | VARCHAR(20) | 赛制（ranking、elimination、mixed_doubles、team） |
| participant_count | INTEGER | 参赛人数（1-999） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

**约束**：
- UNIQUE(event_id, bow_type, distance, format)：每个赛事的每个配置组合唯一
- participant_count >= 1：参赛人数至少1人

**索引**：
```sql
CREATE INDEX idx_event_config_event ON event_configurations(event_id);
CREATE INDEX idx_event_config_lookup ON event_configurations(event_id, bow_type, distance, format);
```

**示例数据**：
```sql
-- 2024 Q1 赛事，反曲弓30米排名赛，24人参赛
INSERT INTO event_configurations 
(event_id, bow_type, distance, format, participant_count) 
VALUES (1, 'recurve', '30m', 'ranking', 24);

-- 2024 Q1 赛事，反曲弓18米排名赛，20人参赛
INSERT INTO event_configurations 
(event_id, bow_type, distance, format, participant_count) 
VALUES (1, 'recurve', '18m', 'ranking', 20);

-- 2024 Q1 赛事，复合弓30米排名赛，15人参赛
INSERT INTO event_configurations 
(event_id, bow_type, distance, format, participant_count) 
VALUES (1, 'compound', '30m', 'ranking', 15);
```

**关键特点**：
- 允许同一赛事的不同配置有不同的参赛人数
- 参赛人数用于计算积分系数（18人以上为1.0倍，15-17人为0.9倍，10-14人为0.8倍）
- 配置信息允许后期修改（例如调整参赛人数），动态重新计算积分

---

### 3. scores（成绩表）

**用途**：存储参赛者的比赛成绩

```sql
CREATE TABLE scores (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    club VARCHAR(100),
    bow_type VARCHAR(20) NOT NULL,
    distance VARCHAR(10) NOT NULL,
    format VARCHAR(20) NOT NULL,
    rank INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**字段说明**：

| 字段 | 类型 | 说明 |
|-----|-----|------|
| id | SERIAL | 主键 |
| event_id | INTEGER | 外键，关联events表 |
| name | VARCHAR(100) | 参赛者姓名 |
| club | VARCHAR(100) | 俱乐部名称（可空） |
| bow_type | VARCHAR(20) | 弓种 |
| distance | VARCHAR(10) | 距离 |
| format | VARCHAR(20) | 赛制 |
| rank | INTEGER | 排名（1、2、3...） |
| created_at | TIMESTAMP | 创建时间 |

**关键变更**：
- ❌ **移除了 points 字段**：积分现在在查询时动态计算
- 只存储客观事实（排名），不存储计算结果（积分）

**索引**：
```sql
CREATE INDEX idx_scores_event ON scores(event_id);
CREATE INDEX idx_scores_event_bow ON scores(event_id, bow_type);
CREATE INDEX idx_scores_name ON scores(name);
CREATE INDEX idx_scores_year_bow ON scores(SELECT EXTRACT(YEAR FROM e.created_at) FROM events e WHERE e.id = scores.event_id, bow_type);
```

**示例数据**：
```sql
-- 张三在2024 Q1赛事中，反曲弓30米排名赛排名第1
INSERT INTO scores (event_id, name, club, bow_type, distance, format, rank)
VALUES (1, '张三', '俱乐部A', 'recurve', '30m', 'ranking', 1);

-- 李四同赛事排名第2
INSERT INTO scores (event_id, name, club, bow_type, distance, format, rank)
VALUES (1, '李四', '俱乐部B', 'recurve', '30m', 'ranking', 2);

-- 张三同赛事18m排名赛排名第2
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
('ranking', '排名赛', '参与者根据成绩排名，排名应分即为积分'),
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

### 为什么支持4种赛制但 mixed_doubles 和 team 共用计分？

**原因：**
- 淘汰赛的几个变体（淘汰赛、混双、团体）本质上是相同的逻辑
- 都是固定队伍在轮次中竞争
- 为了简化系统而保留用户可区分的赛制类型

**实现：**
```python
def get_competition_points(format, rank):
    if format in ['elimination', 'mixed_doubles', 'team']:
        return ELIMINATION_POINTS[rank]
    else:  # ranking
        return RANKING_POINTS[rank]
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

## 数据迁移（从v1到v2）

如果从旧版本升级，需要：

```sql
-- 1. 创建新表
-- (见上面的CREATE TABLE语句)

-- 2. 迁移数据
INSERT INTO events (year, season)
SELECT DISTINCT year, season FROM old_events;

-- 3. 迁移成绩（移除points字段）
INSERT INTO scores (event_id, name, club, bow_type, distance, format, rank)
SELECT event_id, name, club, bow_type, distance, format, rank 
FROM old_scores;

-- 4. 从old_scores中恢复points字段
-- 查询出每条old_score的points，反推participant_count
-- 在event_configurations中插入参赛人数
-- （需要手动核对或恢复原始数据）
```

---

## 扩展建议

### 可能的未来扩展

1. **用户和权限表**：
   ```sql
   CREATE TABLE users (
       id SERIAL PRIMARY KEY,
       username VARCHAR(50) UNIQUE,
       password_hash VARCHAR(255),
       role VARCHAR(20)  -- admin, scorer, viewer
   );
   ```

2. **积分调整记录表**：
   ```sql
   CREATE TABLE score_adjustments (
       id SERIAL PRIMARY KEY,
       score_id INTEGER REFERENCES scores(id),
       old_points FLOAT,
       new_points FLOAT,
       reason TEXT,
       adjusted_by INTEGER REFERENCES users(id),
       adjusted_at TIMESTAMP
   );
   ```

3. **赛事参赛人统计**：
   ```sql
   CREATE TABLE event_participant_stats (
       id SERIAL PRIMARY KEY,
       event_id INTEGER REFERENCES events(id),
       bow_type VARCHAR(20),
       total_participants INTEGER,
       statistics JSON
   );
   ```

---

## 相关文档

- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - 系统架构总体设计
- [TECHNICAL_DETAILS.md](TECHNICAL_DETAILS.md) - 技术深度讨论
- [QUICK_START.md](QUICK_START.md) - 快速开始指南

---

## 总结

v2.0 数据库设计的核心改进：

✅ **简化**：从 15+ 表减至 8 个核心表  
✅ **规范化**：移除冗余和推导数据  
✅ **灵活**：支持动态计算和后期调整  
✅ **高效**：关键查询的良好索引支持  
✅ **可维护**：清晰的表关系和设计逻辑

---

**数据库版本**：v2.0  
**最后更新**：2026年2月  
**维护者**：系统开发团队
