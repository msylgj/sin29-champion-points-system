# 数据库设计文档 - 优化版本

## 架构概述

射箭赛事积分统计系统采用**简化架构**，专注于成绩记录和积分计算：

### 核心特性
- ✅ **最小化数据模型**：只保留必要的表结构
- ✅ **无用户表**：管理入口采用匿名密码认证
- ✅ **简化运动员管理**：仅保留基本信息（姓名、手机、身份证、性别）
- ✅ **成绩驱动型积分**：完全根据成绩表和积分规则进行自动计算
- ✅ **灵活的查询视图**：提供多维度的数据分析视图

---

## 数据库表结构

### 1. athletes（运动员表）- 简化版本

**用途**：存储运动员基本信息

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | SERIAL | PRIMARY KEY | 主键 |
| name | VARCHAR(100) | NOT NULL, INDEX | 运动员姓名 |
| phone | VARCHAR(20) | NOT NULL, INDEX | 手机号 |
| id_number | VARCHAR(50) | NOT NULL, UNIQUE, INDEX | 身份证号 |
| gender | ENUM | NOT NULL | 性别：male/female/mixed |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 创建时间 |

**关键变更**：
- ❌ 移除了：age, birth_date, club, province, city, bow_types, level, updated_at
- ✅ 新增：phone（作为必填项）

**索引**：
- idx_athlete_name
- idx_athlete_phone  
- idx_athlete_id_number

---

### 2. scores（成绩表）- 核心表

**用途**：记录每次比赛成绩，根据积分规则自动计算积分

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | SERIAL | PRIMARY KEY | 主键 |
| athlete_id | INTEGER | NOT NULL, FK, INDEX | 运动员ID |
| year | INTEGER | NOT NULL, INDEX | 比赛年度 |
| season | VARCHAR(10) | NOT NULL, CHECK | 季度：Q1/Q2/Q3/Q4 |
| distance | VARCHAR(10) | NOT NULL, CHECK | 距离：18m/30m/50m/70m |
| competition_format | VARCHAR(50) | NOT NULL, CHECK | 赛制：ranking/elimination/team |
| gender_group | VARCHAR(50) | NOT NULL | 性别分组 |
| bow_type | VARCHAR(50) | NULLABLE | 弓种：recurve/compound/traditional/longbow/barebow |
| raw_score | INTEGER | NOT NULL | 原始成绩（环数） |
| rank | INTEGER | NULLABLE | 比赛排名 |
| group_rank | INTEGER | NULLABLE | 分组排名 |
| base_points | FLOAT | DEFAULT 0.0 | 基础积分（根据排名） |
| points | FLOAT | DEFAULT 0.0 | 最终积分（经过系数调整和18米减半） |
| round | INTEGER | NULLABLE | 轮次（淘汰赛用） |
| participant_count | INTEGER | NULLABLE | 参赛人数（用于系数计算） |
| is_valid | INTEGER | DEFAULT 1, NOT NULL | 是否有效：1=有效，0=无效 |
| remark | TEXT | NULLABLE | 备注 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 更新时间 |

**关键变更**：
- ❌ 移除了：event_id（改为使用 year、season 等维度字段识别赛事）
- ✅ 新增：participant_count（直接存储，无需从 event_participants 查询）

**索引**：
- idx_score_athlete
- idx_score_year_season
- idx_score_distance_format
- idx_score_gender_bow
- idx_score_rank
- idx_score_valid

---

### 3. athlete_aggregate_points（积分汇总表）

**用途**：存储按年季度的积分汇总，用于快速查询排名

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | SERIAL | 主键 |
| athlete_id | INTEGER | 运动员ID（FK） |
| year | INTEGER | 年度 |
| season | VARCHAR(10) | 季度 |
| total_points | FLOAT | 总积分 |
| event_count | INTEGER | 参赛次数 |
| rank | INTEGER | 排名 |
| gender_group | VARCHAR(50) | 性别分组 |
| bow_type | VARCHAR(50) | 弓种 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

---

### 4. scoring_rules（积分规则表）

**用途**：存储不同的积分规则配置，支持灵活定制

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | SERIAL | 主键 |
| name | VARCHAR(100) | 规则名称 |
| description | TEXT | 规则描述 |
| rule_config | JSONB | JSON格式的规则配置 |
| rule_type | VARCHAR(50) | 规则类型：rank_based 等 |
| is_default | INTEGER | 是否为默认规则 |
| applicable_formats | VARCHAR(200) | 适用的赛制 |
| applicable_distances | VARCHAR(200) | 适用的距离 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

**rule_config 示例**：
```json
{
  "type": "rank_based",
  "version": "1.0",
  "rules": {
    "ranking": {
      "base_points": {"1": 25, "2": 22, "3": 19, ...},
      "coefficients": {"8-15": [0.6, 4], "16-31": [0.8, 8], ...}
    },
    "elimination": {...},
    "team": {...}
  },
  "special_rules": {
    "18m_discount": 0.5
  }
}
```

---

### 5. operation_logs（操作日志表）

**用途**：记录所有数据修改操作，便于审计

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | SERIAL | 主键 |
| operation_type | VARCHAR(50) | 操作类型：create/update/delete 等 |
| entity_type | VARCHAR(50) | 实体类型：athlete/score 等 |
| entity_id | INTEGER | 实体ID |
| description | TEXT | 描述 |
| old_values | TEXT | 修改前的值 |
| new_values | TEXT | 修改后的值 |
| ip_address | VARCHAR(50) | IP地址 |
| user_agent | VARCHAR(255) | User Agent |
| status | VARCHAR(20) | 操作状态：success/failure |
| error_message | TEXT | 错误信息 |
| created_at | TIMESTAMP | 操作时间 |

**关键变更**：
- ❌ 移除了：user_id（无用户表）

---

## 已删除的表

为了简化架构，以下表已被删除：

### users（用户表）
**原因**：系统不再需要用户管理，管理入口采用简单的匿名密码认证
- **替代方案**：在API层实现一个全局密码认证中间件

### events（赛事表）
**原因**：成绩表已包含所有必要的赛事信息（year、season、distance、competition_format 等）
- **替代方案**：通过成绩表的维度字段组合来识别赛事

### event_participants（赛事参与者表）
**原因**：参赛人数通过 scores 表的 participant_count 字段直接记录
- **替代方案**：从成绩表分组统计参赛人数

---

## 数据库视图

### v_athlete_scores_summary
**用途**：运动员的成绩汇总视图

```sql
SELECT 
    a.id, a.name, a.phone, a.gender,
    s.year, s.season, s.distance, s.competition_format,
    s.raw_score, s.points, s.rank, s.gender_group
FROM athletes a
LEFT JOIN scores s ON a.id = s.athlete_id
WHERE s.is_valid = 1
ORDER BY s.year DESC, s.season DESC, s.rank ASC;
```

### v_score_rankings
**用途**：按年季度、距离、赛制显示成绩排名

```sql
SELECT 
    s.year, s.season, s.distance, s.competition_format,
    s.rank, s.gender_group,
    a.id, a.name, a.phone,
    s.raw_score, s.points
FROM scores s
LEFT JOIN athletes a ON s.athlete_id = a.id
WHERE s.is_valid = 1
ORDER BY s.year DESC, s.season DESC, s.rank ASC;
```

### v_aggregate_rankings
**用途**：显示年季度的积分排名

```sql
SELECT 
    aap.year, aap.season, aap.rank,
    a.id, a.name, a.phone, a.gender,
    aap.total_points, aap.event_count
FROM athlete_aggregate_points aap
LEFT JOIN athletes a ON aap.athlete_id = a.id
ORDER BY aap.year DESC, aap.season DESC, aap.rank ASC;
```

---

## 数据模型关系图

```
athletes (1) ──────────→ (N) scores
           ├──────────→ (N) athlete_aggregate_points
           └──────────→ (N) operation_logs

scoring_rules (独立表)
```

**简化说明**：
- **无事件表**：所有赛事信息分散在成绩表的维度字段中
- **无参与者表**：参赛人数在成绩记录时直接指定
- **无用户表**：认证由系统统一处理

---

## 数据库初始化

### 创建脚本位置
```
database/init.sql
```

### 主要表创建顺序
1. athletes（运动员表）
2. scores（成绩表）
3. scoring_rules（积分规则表）
4. athlete_aggregate_points（积分汇总表）
5. operation_logs（操作日志表）

### 运行方式
```bash
# 使用 Docker Compose 自动执行
docker-compose up -d

# PostgreSQL 容器启动时自动执行 init.sql
```

---

## 常见查询示例

### 查询特定运动员的所有成绩
```sql
SELECT s.* FROM scores s
JOIN athletes a ON s.athlete_id = a.id
WHERE a.name = '张三' AND s.is_valid = 1
ORDER BY s.year DESC, s.season DESC;
```

### 查询年度排名
```sql
SELECT * FROM v_aggregate_rankings
WHERE year = 2024
ORDER BY rank ASC;
```

### 查询某赛制的前10名
```sql
SELECT s.*, a.name FROM scores s
JOIN athletes a ON s.athlete_id = a.id
WHERE s.year = 2024 AND s.competition_format = 'ranking'
AND s.is_valid = 1
ORDER BY s.rank ASC
LIMIT 10;
```

### 查询某季度的男性运动员排名
```sql
SELECT * FROM v_score_rankings
WHERE year = 2024 AND season = 'Q1' AND gender_group = 'male'
ORDER BY rank ASC;
```

---

## 数据库性能优化

### 索引策略

| 表名 | 索引 | 用途 |
|------|------|------|
| athletes | id_number | 快速查找运动员 |
| athletes | phone | 手机号查询 |
| scores | year, season | 年季度统计 |
| scores | distance, format | 赛制统计 |
| scores | gender, bow_type | 性别弓种统计 |
| scores | rank | 排名查询 |
| aggregate_points | athlete_id, year, season | 积分查询 |
| aggregate_points | year, season, rank | 排名查询 |

### 查询优化建议
1. 总是使用索引字段进行WHERE条件过滤
2. 使用视图进行复杂查询而不是频繁JOIN
3. athlete_aggregate_points 应定期更新以加快排名查询

---

## 迁移指南

如果从旧版本升级，需要进行以下迁移：

### 1. 转换运动员数据
```sql
INSERT INTO athletes (name, phone, id_number, gender)
SELECT name, phone_number, identity_card, gender
FROM old_athletes;
```

### 2. 转换成绩数据
```sql
INSERT INTO scores (
    athlete_id, year, season, distance, competition_format,
    gender_group, bow_type, raw_score, rank, base_points,
    points, participant_count, is_valid
)
SELECT 
    athlete_id, 
    extract(year from event_date),
    'Q' || ceil(extract(month from event_date)/3),
    distance, format, gender, bow_type,
    raw_score, rank, base_points, points, 
    participant_count, is_valid
FROM old_scores;
```

### 3. 重新计算积分
```bash
python backend/scripts/recalculate_points.py
```

---

## 监控和维护

### 定期任务

**每日**：
- 验证scores表的数据完整性
- 检查是否有未处理的无效记录

**每周**：
- 更新athlete_aggregate_points表
- 验证积分计算的准确性

**每月**：
- 备份数据库
- 清理过期的操作日志

### 关键SQL
```sql
-- 检查数据库大小
SELECT datname, pg_size_pretty(pg_database_size(datname))
FROM pg_database WHERE datname = 'archery_system';

-- 检查表大小
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

**最后更新**：2026-01-29  
**版本**：2.0 - 优化版本
