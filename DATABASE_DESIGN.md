# 数据库设计

本文描述 PostgreSQL 的表结构、关系和初始化职责。业务流程见[项目概览](README.md)，计分口径见[积分与规则](docs/SCORING.md)。

## 1. 数据库定位

数据库承担 4 类职责：

- 字典定义
  - 弓种
  - 距离
  - 比赛类型
  - 比赛性别分组
  - 比赛组别映射

- 赛事主数据
  - 赛事主表
  - 赛事配置

- 报名数据
  - 赛事报名表

- 成绩与积分
  - 成绩事实表
  - 积分规则按版本保存为配置快照
  - 年度积分按赛事适用版本动态计算，不在成绩表内落积分字段

## 2. 表清单

共 10 张表：

### 字典表

- `bow_types`
- `distances`
- `competition_formats`
- `competition_gender_groups`
- `competition_groups`

### 业务表

- `events`
- `event_registrations`
- `event_configurations`
- `scores`
- `scoring_rules`（规则配置快照与适用时间轴）

## 3. 字典表

### 3.1 bow_types

用途：定义系统使用的弓种代码和展示名称。

字段：

- `id`
- `code`
- `name`
- `description`
- `created_at`

默认数据：

- `barebow` / 光弓
- `longbow` / 美猎弓
- `traditional` / 传统弓
- `sightless` / 无瞄弓
- `recurve` / 反曲弓
- `compound` / 复合弓

约束：

- `UNIQUE(code)`

### 3.2 distances

用途：定义比赛距离。

字段：

- `id`
- `code`
- `name`
- `created_at`

默认数据：

- `70m`
- `50m`
- `30m`
- `18m`
- `10m`

约束：

- `UNIQUE(code)`

### 3.3 competition_formats

用途：定义成绩记录中使用的比赛类型。

字段：

- `id`
- `code`
- `name`
- `description`
- `created_at`

默认数据：

- `ranking`
- `elimination`
- `mixed_doubles`
- `team`

约束：

- `UNIQUE(code)`

### 3.4 competition_gender_groups

用途：定义赛事配置和报名中使用的性别分组。

字段：

- `id`
- `code`
- `name`
- `created_at`

默认数据：

- `men`
- `women`
- `mixed`

约束：

- `UNIQUE(code)`

### 3.5 competition_groups

用途：定义“弓种 + 距离”对应的比赛组别。初始规则创建时会快照该映射；历史积分计算使用对应规则版本中的映射，而非每次读取当前字典。

字段：

- `id`
- `group_code`
- `bow_type`
- `distance`
- `created_at`

默认映射包括：

- `S组 barebow/longbow/sightless/traditional/recurve 50m`
- `A组 compound 50m`
- `A组 barebow/longbow/traditional/recurve 30m`
- `B组 compound 30m`
- `B组 barebow/sightless/longbow/traditional/recurve 18m`
- `C组 compound 18m`
- `C组 barebow/sightless/longbow/traditional/recurve 10m`

约束：

- `UNIQUE(group_code, bow_type, distance)`

## 4. 业务表

### 4.1 events

用途：按赛年和赛季标识一个赛事。

字段：

- `id`
- `year`
- `season`
- `created_at`
- `updated_at`

约束：

- `UNIQUE(year, season)`
- `season` 限制为：
  - `春季赛`
  - `夏季赛`
  - `秋季赛`
  - `冬季赛`

索引：

- `idx_event_year_season(year, season)`

说明：

- 报名导入时，如果该赛年赛季还没有赛事，后端会自动创建 `events`
- 手工保存赛事配置时，也会自动创建 `events`

### 4.2 event_registrations

用途：保存赛事报名数据。

字段：

- `id`
- `year`
- `season`
- `name`
- `club`
- `distance`
- `competition_bow_type`
- `points_bow_type`
- `competition_gender_group`
- `created_at`
- `updated_at`

唯一性规则：

- `同年度 + 同赛季 + 同姓名 + 同距离 + 同比赛弓种`

对应约束：

- `UNIQUE(year, season, name, distance, competition_bow_type)`

业务规则：

- 当 `competition_bow_type = sightless` 时：
  - `points_bow_type` 只允许：
    - `barebow`
    - `longbow`
    - `traditional`
- 当 `competition_bow_type != sightless` 时：
  - `points_bow_type` 固定等于 `competition_bow_type`

CHECK 约束：

- `season`
- `distance`
- `competition_bow_type`
- `points_bow_type`
- `competition_gender_group`

索引：

- 查询索引 `idx_event_registrations_year_points_lookup(year, points_bow_type, season, name, distance, competition_bow_type)`
- 唯一约束 `ux_event_registration_key`

说明：

- 报名导入、编辑、删除后，会同步刷新当前赛年赛季对应赛事配置中的个人人数

### 4.3 event_configurations

用途：保存某赛事下每个 `性别分组 + 弓种 + 距离` 的人数配置。

字段：

- `id`
- `event_id`
- `gender_group`
- `bow_type`
- `distance`
- `individual_participant_count`
- `mixed_doubles_team_count`
- `team_count`
- `created_at`
- `updated_at`

唯一性规则：

- `同赛事 + 同性别分组 + 同弓种 + 同距离`

对应约束：

- `UNIQUE(event_id, gender_group, bow_type, distance)`

CHECK 约束：

- `gender_group`
- `bow_type`
- `distance`

索引：

- `(event_id, gender_group, bow_type, distance)` 唯一约束

说明：

- `individual_participant_count`
  - 由报名数据自动同步
  - 前端页面只读显示
- `team_count`
  - 支持 `男子组 / 女子组 / 混合组`
  - 由页面手工编辑
- `mixed_doubles_team_count`
  - 仅使用 `mixed`
  - 由页面手工编辑

### 4.4 scores

用途：保存事实成绩记录。

字段：

- `id`
- `event_id`
- `name`
- `bow_type`
- `distance`
- `format`
- `gender_group`
- `rank`
- `created_at`
- `updated_at`

注意：

- `scores` 不保存 `club`；俱乐部来自报名记录。

唯一性规则：

- `同赛事 + 同姓名 + 同距离 + 同弓种 + 同赛制`

对应约束：

- `UNIQUE(event_id, name, distance, bow_type, format)`

CHECK 约束：

- `bow_type`
- `distance`
- `format`
- `gender_group`

索引：

- 查询索引 `idx_scores_event_created_id(event_id, created_at desc, id desc)`
- 唯一约束 `uq_score_event_name_distance_bow_format`

`gender_group` 保存成绩对应的分组，与赛事、弓种和距离一起用于匹配计分所需的赛事配置。网页导入混双成绩时使用 `mixed`。

### 4.5 scoring_rules

用途：保存不可变的计分配置快照及按年度、赛季排列的适用区间。成绩仍存排名事实，积分查询时计算，不把新规则覆盖到整年度。

字段：

- id：规则版本主键。
- name：管理员指定的规则名称。
- source_rule_id：所继承的前一版本外键；初始版本为空。唯一约束保证一个版本只能有一个后继，避免分支。
- start_key：适用起始季，唯一且非空；0 表示初始版本覆盖无限过去。其余值为 年度×4＋赛季序号（春1、夏2、秋3、冬4）。
- end_key：适用截止季，包含该季；NULL 表示当前最新版本延续到未来。
- config：JSON 完整快照，保存排名基础分列表、个人人数和队伍数连续系数段、排名上限、S/A/B/C 组别系数、弓种距离组别映射、兜底分及缺失人数默认值，固定分项精度1位与四舍五入方式。团体、混双共用团体基础分和队伍系数表。
- created_at：创建时间。

时间轴约束：

- 只允许在最新版本后发布，前版截止键和后继起始键相邻。结束前版和创建后继在同一事务完成。
- 只允许删除无后继的非初始最新版本，删除及将前版的 `end_key` 恢复为 `NULL` 在同一事务完成。发布和删除按一致顺序锁记录并检查版本。
- 规则选择依据赛事年度和赛季；积分明细返回 `scoring_rule_id` 和 `scoring_rule_name`。组别映射随快照保存，不受字典后续修改影响。

## 5. 表关系

### 5.1 events 与 event_configurations

- `events.id -> event_configurations.event_id`
- 一个赛事对应多条赛事配置

### 5.2 events 与 scores

- `events.id -> scores.event_id`
- 一个赛事对应多条成绩

### 5.3 event_registrations 与 events

- 没有物理外键
- 通过 `year + season` 关联逻辑上的赛事

### 5.4 event_registrations 与 event_configurations

- 没有物理外键
- 通过：
  - `year + season -> event`
  - `competition_gender_group + competition_bow_type + distance -> event_configuration`

### 5.5 scoring_rules 自引用

- `scoring_rules.id -> scoring_rules.source_rule_id`
- `source_rule_id` 唯一：每个规则最多有一个后继；初始规则没有前版。
- `start_key` 唯一：同一赛季不能开始两个规则版本。

## 6. 初始化

- [PostgreSQL 初始化脚本](database/init.sql)创建表、约束、索引并填充字典。Compose 仅在 PostgreSQL 数据目录首次初始化时自动执行脚本。
- [后端启动引导](backend/app/bootstrap.py)增建缺失表，在没有 `start_key = 0` 的初始版本时创建初始快照，不负责更新已有表结构或填充字典。PostgreSQL 的建表检查及首版快照使用同一事务级锁。
- 初始映射存在不同组别的重复项时，引导失败并终止启动；空映射会告警，未匹配项目的组别系数为 0。旧部署的升级步骤单独记录在[变更记录](CHANGELOG.md)。
