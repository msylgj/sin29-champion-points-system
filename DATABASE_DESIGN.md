# DATABASE DESIGN

本文档描述当前项目数据库的实际结构与业务含义。当前初始化脚本以 `database/init.sql` 为准

## 1. 数据库定位

当前数据库承担 4 类职责：

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
  - 年度积分按查询动态计算，不在库内落积分字段

## 2. 表清单

当前共 9 张表：

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

用途：定义“弓种 + 距离”对应的比赛组别，用于积分计算中的组别系数。

字段：

- `id`
- `group_code`
- `bow_type`
- `distance`
- `created_at`

默认映射包括：

- `S组 barebow 50m`
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
  - 当前由报名数据自动同步
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

- `scores` 表当前不包含 `club`

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

说明：

- `gender_group` 用于保存成绩记录对应的分组，供团体赛、混双赛取人数配置时使用
- 成绩导入页前端会先做报名匹配预校验
- 匹配规则：
  - 排位赛、淘汰赛按 `姓名 + 距离 + 弓种` 匹配报名记录
- 未找到对应报名记录时，该条个人赛成绩会在导入页中被标记为异常数据
- 混双赛成绩在前端提交前会将 `gender_group` 强制归一为 `mixed`

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

## 6. 当前前后端对数据库的使用方式

### 6.1 赛事配置页

页面：`frontend/src/views/EventAdd.vue`

行为：

- 先选择 `year + season`
- 若已有赛事，读取 `events` 与 `event_configurations`
- 若先导入报名，后端会自动创建赛事和对应个人人数配置
- 若先手工保存配置，也会自动创建赛事

### 6.2 报名导入页块

页面：`frontend/src/views/EventAdd.vue`

行为：

- 导入 Excel 报名
- 写入 `event_registrations`
- 自动同步 `event_configurations.individual_participant_count`
- 已导入报名支持查看、编辑、删除

### 6.3 成绩导入页

页面：`frontend/src/views/ScoreImport.vue`

行为：

- 先选择赛事
- 再读取该赛事所属赛年赛季的报名表
- 导入页前端会将未匹配报名记录的个人赛成绩标记为异常
- 团体赛、混双赛不做报名匹配预校验
- 成绩写入 `scores`

### 6.4 年度积分页

页面：`frontend/src/views/PointsDisplay.vue`

行为：

- 先从报名表中找到当年 `points_bow_type = 所选弓种` 的人
- 默认按 `年度 + 赛季 + 姓名 + 距离 + 比赛弓种` 匹配并聚合这些人的成绩积分
- 当报名的比赛弓种为 `barebow / longbow / traditional` 时，还会额外匹配同 `年度 + 赛季 + 姓名 + 距离` 下成绩弓种为 `sightless` 的成绩
- 每名选手的成绩明细按 `春季赛 -> 夏季赛 -> 秋季赛 -> 冬季赛` 排列，同赛季内再按 `距离 -> 弓种 -> 赛制` 排列
- 积分计算所需人数来自：
  - 排位赛 / 淘汰赛：报名记录对应性别分组下的赛事配置
  - 团体赛：按成绩记录上的 `gender_group` 取对应配置的 `team_count`
  - 混双赛：先将 `gender_group` 归一为 `mixed`，再取 `mixed_doubles_team_count`

## 7. 当前索引状态

按项目当前实现，高频业务表使用以下业务索引或唯一约束：

- `events`
  - `idx_event_year_season(year, season)`

- `event_registrations`
  - `idx_event_registrations_year_points_lookup(year, points_bow_type, season, name, distance, competition_bow_type)`
  - `ux_event_registration_key(year, season, name, distance, competition_bow_type)`

- `event_configurations`
  - `(event_id, gender_group, bow_type, distance)` 唯一约束

- `scores`
  - `idx_scores_event_created_id(event_id, created_at desc, id desc)`
  - `uq_score_event_name_distance_bow_format(event_id, name, distance, bow_type, format)`

以及各表主键索引 `..._pkey`
