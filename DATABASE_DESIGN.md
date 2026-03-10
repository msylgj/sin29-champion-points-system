# DATABASE DESIGN

本文档描述当前项目数据库结构，以 [database/init.sql](database/init.sql) 为准。

## 1. 设计目标

- 赛事、配置、成绩分层管理
- 字典驱动弓种/距离/赛制/组别
- 积分按查询动态计算，避免存储冗余积分字段

## 2. 表清单

当前共 7 张核心表：

- 业务表
  - `events`
  - `event_configurations`
  - `scores`
- 字典表
  - `bow_types`
  - `distances`
  - `competition_formats`
  - `competition_groups`

## 3. 业务表

### 3.1 events

用途：存储赛事主信息。

关键字段：

- `id`
- `year`
- `season`（`春季赛|夏季赛|秋季赛|冬季赛`）
- `created_at`
- `updated_at`

约束：

- `UNIQUE(year, season)`

索引：

- `idx_event_year_season(year, season)`

### 3.2 event_configurations

用途：存储赛事下的弓种+距离配置及人数配置。

关键字段：

- `event_id`
- `bow_type`
- `distance`
- `individual_participant_count`
- `mixed_doubles_team_count`
- `team_count`

约束：

- `UNIQUE(event_id, bow_type, distance)`
- `event_id` 外键关联 `events(id)`，级联删除

索引：

- `idx_event_config_event(event_id)`
- `idx_event_config_key(event_id, bow_type, distance)`

说明：

- 排位赛/淘汰赛共用 `individual_participant_count`
- 混双赛使用 `mixed_doubles_team_count`
- 团体赛使用 `team_count`

### 3.3 scores

用途：存储事实成绩记录。

关键字段：

- `event_id`
- `name`
- `club`
- `bow_type`
- `distance`
- `format`
- `rank`
- `created_at`
- `updated_at`

约束：

- `event_id` 外键关联 `events(id)`，级联删除
- `bow_type`、`distance`、`format` 均有 CHECK 约束

索引：

- `idx_score_event(event_id)`
- `idx_score_event_name(event_id, name)`
- `idx_score_event_bow_format(event_id, bow_type, distance, format)`

说明：

- 表内不存储最终积分，由服务层按规则实时计算。

## 4. 字典表

### 4.1 bow_types

- 字段：`code`, `name`, `description`
- 默认值：barebow、longbow、traditional、recurve、compound

### 4.2 distances

- 字段：`code`, `name`
- 默认值：70m、50m、30m、18m、10m

### 4.3 competition_formats

- 字段：`code`, `name`, `description`
- 默认值：ranking、elimination、mixed_doubles、team

### 4.4 competition_groups

- 字段：`group_code`, `bow_type`, `distance`
- 用于前端按组显示赛事配置映射
- 约束：`UNIQUE(group_code, bow_type, distance)`

## 5. 关系示意

```text
events (1) ---- (N) event_configurations
  |                   |
  |                   +-- bow_type/distance -> 字典约束
  |
  +---- (N) scores
                      +-- bow_type/distance/format -> 字典约束
```

## 6. 初始化数据

初始化脚本包含：

- 4 张字典表的默认数据
- 4 条示例赛事（2024 春夏秋冬）
- 示例赛事配置与示例成绩

位置：

- [database/init.sql](database/init.sql)

## 7. 与接口的对应关系

- 赛事：`/api/events`
- 赛事配置：`/api/event-configurations`
- 成绩：`/api/scores`
- 字典：`/api/dictionaries`

管理接口均受认证保护，公开查询接口用于积分展示。

