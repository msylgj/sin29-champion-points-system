# API 接口文档

**系统版本**: 1.0.0  
**最后更新**: 2026-01-30  

## 📋 目录

1. [概述](#概述)
2. [运动员管理API](#运动员管理api)
3. [成绩管理API](#成绩管理api)
4. [赛事管理API](#赛事管理api)
5. [统计和排名API](#统计和排名api)
6. [错误处理](#错误处理)
7. [数据类型](#数据类型)

---

## 概述

### 基础信息

- **Base URL**: `http://localhost:8000`
- **API 前缀**: `/api`
- **认证**: 暂无（后续可扩展）
- **响应格式**: JSON
- **文档**: [Swagger UI](http://localhost:8000/docs)

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

---

## 运动员管理API

### 创建运动员

```http
POST /api/athletes
Content-Type: application/json

{
  "name": "张三",
  "phone": "13800138000",
  "id_number": "110101199003011234",
  "gender": "male"
}
```

**响应** (201):
```json
{
  "id": 1,
  "name": "张三",
  "phone": "13800138000",
  "id_number": "110101199003011234",
  "gender": "male",
  "created_at": "2026-01-30T10:00:00+00:00"
}
```

### 获取运动员列表

```http
GET /api/athletes?page=1&page_size=10&search=张三&gender=male
```

**查询参数**:
- `page` (int): 页码，从1开始，默认1
- `page_size` (int): 每页数量，默认10，最多100
- `search` (string, optional): 搜索关键词（支持姓名、手机号、身份证号）
- `gender` (string, optional): 性别筛选 (male/female/mixed)

**响应** (200):
```json
{
  "items": [
    {
      "id": 1,
      "name": "张三",
      "phone": "13800138000",
      "id_number": "110101199003011234",
      "gender": "male",
      "created_at": "2026-01-30T10:00:00+00:00"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 10
}
```

### 获取运动员详情

```http
GET /api/athletes/{athlete_id}
```

**路径参数**:
- `athlete_id` (int): 运动员ID

**响应** (200):
```json
{
  "id": 1,
  "name": "张三",
  "phone": "13800138000",
  "id_number": "110101199003011234",
  "gender": "male",
  "created_at": "2026-01-30T10:00:00+00:00"
}
```

### 更新运动员

```http
PUT /api/athletes/{athlete_id}
Content-Type: application/json

{
  "name": "张三（修改后）",
  "phone": "13900139000",
  "gender": "female"
}
```

**说明**: 只需提供要更新的字段

**响应** (200): 同获取运动员详情

### 删除运动员

```http
DELETE /api/athletes/{athlete_id}
```

**响应** (200):
```json
{
  "message": "运动员已删除"
}
```

### 批量导入运动员

```http
POST /api/athletes/batch/import
Content-Type: application/json

{
  "athletes": [
    {
      "name": "李四",
      "phone": "13800138001",
      "id_number": "110101199003011235",
      "gender": "female"
    },
    {
      "name": "王五",
      "phone": "13800138002",
      "id_number": "110101199003011236",
      "gender": "male"
    }
  ]
}
```

**响应** (200): 返回创建的运动员列表

---

## 成绩管理API

### 录入成绩

```http
POST /api/scores
Content-Type: application/json

{
  "athlete_id": 1,
  "year": 2024,
  "season": "Q1",
  "distance": "30m",
  "competition_format": "ranking",
  "gender_group": "male",
  "bow_type": "recurve",
  "raw_score": 285,
  "rank": 3,
  "participant_count": 20,
  "remark": "优异成绩"
}
```

**必需字段**:
- `athlete_id` (int): 运动员ID
- `year` (int): 年度（2000-2100）
- `season` (string): 季度 (Q1, Q2, Q3, Q4)
- `distance` (string): 距离 (18m, 30m, 50m, 70m)
- `competition_format` (string): 赛制 (ranking, elimination, team)
- `gender_group` (string): 性别分组
- `raw_score` (int): 原始成绩（环数，>=0）

**可选字段**:
- `bow_type` (string): 弓种
- `rank` (int): 排名
- `group_rank` (int): 分组排名
- `round` (int): 轮次（淘汰赛用）
- `participant_count` (int): 参赛人数
- `remark` (string): 备注

**响应** (201):
```json
{
  "id": 1,
  "athlete_id": 1,
  "year": 2024,
  "season": "Q1",
  "distance": "30m",
  "competition_format": "ranking",
  "gender_group": "male",
  "bow_type": "recurve",
  "raw_score": 285,
  "rank": 3,
  "group_rank": null,
  "base_points": 19.0,
  "points": 15.2,
  "round": null,
  "participant_count": 20,
  "is_valid": 1,
  "remark": "优异成绩",
  "created_at": "2026-01-30T10:00:00+00:00",
  "updated_at": "2026-01-30T10:00:00+00:00"
}
```

### 获取成绩列表

```http
GET /api/scores?page=1&page_size=10&athlete_id=1&year=2024&season=Q1&distance=30m&competition_format=ranking
```

**查询参数**:
- `page` (int): 页码
- `page_size` (int): 每页数量
- `athlete_id` (int, optional): 运动员ID
- `year` (int, optional): 年度
- `season` (string, optional): 季度
- `distance` (string, optional): 距离
- `competition_format` (string, optional): 赛制
- `is_valid` (int): 有效性 (默认1，表示有效)

**响应** (200): 成绩列表

### 获取单条成绩

```http
GET /api/scores/{score_id}
```

**响应** (200): 单条成绩详情

### 更新成绩

```http
PUT /api/scores/{score_id}
Content-Type: application/json

{
  "rank": 2,
  "raw_score": 290,
  "participant_count": 22
}
```

**响应** (200): 更新后的成绩

### 删除成绩

```http
DELETE /api/scores/{score_id}
```

**响应** (200):
```json
{
  "message": "成绩已删除"
}
```

### 批量导入成绩

```http
POST /api/scores/batch/import
Content-Type: application/json

{
  "scores": [
    {
      "athlete_id": 1,
      "year": 2024,
      "season": "Q1",
      "distance": "30m",
      "competition_format": "ranking",
      "gender_group": "male",
      "bow_type": "recurve",
      "raw_score": 285,
      "rank": 3,
      "participant_count": 20
    },
    {
      "athlete_id": 2,
      "year": 2024,
      "season": "Q1",
      "distance": "30m",
      "competition_format": "ranking",
      "gender_group": "female",
      "bow_type": "compound",
      "raw_score": 280,
      "rank": 5,
      "participant_count": 20
    }
  ]
}
```

**响应** (200): 导入的成绩列表

### 重新计算所有积分

```http
POST /api/scores/recalculate
```

**说明**: 重新计算系统中所有有效成绩的积分

**响应** (200):
```json
{
  "message": "已重新计算 150 条成绩的积分"
}
```

### 获取运动员成绩

```http
GET /api/scores/athlete/{athlete_id}/scores?year=2024&season=Q1
```

**路径参数**:
- `athlete_id` (int): 运动员ID

**查询参数**:
- `year` (int, optional): 年度
- `season` (string, optional): 季度

**响应** (200): 运动员的所有成绩列表

---

## 赛事管理API

### 创建赛事

```http
POST /api/events
Content-Type: application/json

{
  "name": "2024年全国射箭锦标赛-春季",
  "year": 2024,
  "season": "Q1",
  "start_date": "2024-01-15",
  "end_date": "2024-01-20",
  "location": "北京",
  "distance": "30m",
  "competition_format": "ranking",
  "description": "春季重点赛事"
}
```

**必需字段**:
- `name` (string): 赛事名称
- `year` (int): 年度
- `season` (string): 季度 (Q1, Q2, Q3, Q4)
- `start_date` (date): 开始日期 (YYYY-MM-DD)
- `end_date` (date): 结束日期
- `distance` (enum): 距离
- `competition_format` (enum): 赛制

**可选字段**:
- `location` (string): 地点
- `description` (string): 描述

**响应** (201): 创建的赛事对象

### 获取赛事列表

```http
GET /api/events?page=1&page_size=10&year=2024&season=Q1
```

**查询参数**:
- `page` (int): 页码
- `page_size` (int): 每页数量
- `year` (int, optional): 年度
- `season` (string, optional): 季度

**响应** (200): 赛事列表

### 获取赛事详情

```http
GET /api/events/{event_id}
```

**响应** (200): 赛事详情

### 更新赛事

```http
PUT /api/events/{event_id}
Content-Type: application/json

{
  "name": "2024年全国射箭锦标赛-春季（修改）",
  "status": "ongoing",
  "description": "正在进行中"
}
```

**响应** (200): 更新后的赛事

### 删除赛事

```http
DELETE /api/events/{event_id}
```

**响应** (200):
```json
{
  "message": "赛事已删除"
}
```

---

## 统计和排名API

### 获取排名列表

```http
GET /api/stats/rankings?page=1&page_size=10&year=2024&season=Q1&gender_group=male&bow_type=recurve
```

**查询参数**:
- `page` (int): 页码
- `page_size` (int): 每页数量
- `year` (int, 必需): 年度
- `season` (string, optional): 季度
- `gender_group` (string, optional): 性别分组
- `bow_type` (string, optional): 弓种

**响应** (200):
```json
{
  "items": [
    {
      "rank": 1,
      "athlete_id": 1,
      "athlete_name": "张三",
      "phone": "13800138000",
      "gender": "male",
      "total_points": 145.5,
      "event_count": 5,
      "best_score": 290,
      "average_rank": 2.4
    }
  ],
  "total": 25,
  "page": 1,
  "page_size": 10,
  "year": 2024,
  "season": "Q1",
  "gender_group": "male",
  "bow_type": "recurve"
}
```

### 获取运动员积分汇总

```http
GET /api/stats/athlete/{athlete_id}/aggregate?year=2024&season=Q1
```

**路径参数**:
- `athlete_id` (int): 运动员ID

**查询参数**:
- `year` (int, 必需): 年度
- `season` (string, optional): 季度

**响应** (200):
```json
{
  "athlete_id": 1,
  "year": 2024,
  "season": "Q1",
  "total_points": 145.5,
  "event_count": 5,
  "average_rank": 2.4,
  "best_score": 290
}
```

### 获取绩效最优者

```http
GET /api/stats/top-performers?year=2024&season=Q1&limit=10
```

**查询参数**:
- `year` (int, 必需): 年度
- `season` (string, optional): 季度
- `limit` (int): 返回数量，默认10

**响应** (200):
```json
[
  {
    "athlete_id": 1,
    "athlete_name": "张三",
    "total_points": 145.5,
    "event_count": 5
  },
  {
    "athlete_id": 2,
    "athlete_name": "李四",
    "total_points": 138.2,
    "event_count": 4
  }
]
```

---

## 错误处理

### 错误响应格式

```json
{
  "detail": "错误描述信息"
}
```

### 常见错误

| 场景 | 状态码 | 错误信息 |
|------|--------|---------|
| 运动员不存在 | 404 | 运动员不存在 |
| 身份证号重复 | 400 | 该身份证号已存在 |
| 赛事不存在 | 404 | 赛事不存在 |
| 成绩不存在 | 404 | 成绩不存在 |
| 参数格式错误 | 400 | [字段特定错误] |
| 服务器错误 | 500 | [错误详情] |

---

## 数据类型

### Gender（性别）

枚举值:
- `male` - 男性
- `female` - 女性
- `mixed` - 混合/其他

### Season（季度）

枚举值:
- `Q1` - 第一季度
- `Q2` - 第二季度
- `Q3` - 第三季度
- `Q4` - 第四季度

### Distance（距离）

枚举值:
- `18m` - 18米
- `30m` - 30米
- `50m` - 50米
- `70m` - 70米

### CompetitionFormat（赛制）

枚举值:
- `ranking` - 排名赛
- `elimination` - 淘汰赛
- `team` - 团体赛

### EventStatus（赛事状态）

枚举值:
- `not_started` - 未开始
- `ongoing` - 进行中
- `completed` - 已完成
- `cancelled` - 已取消

---

## 使用示例

### 示例 1: 完整流程（创建运动员 → 录入成绩 → 查看排名）

```bash
# 1. 创建运动员
curl -X POST http://localhost:8000/api/athletes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三",
    "phone": "13800138000",
    "id_number": "110101199003011234",
    "gender": "male"
  }'

# 响应获得 athlete_id = 1

# 2. 录入成绩
curl -X POST http://localhost:8000/api/scores \
  -H "Content-Type: application/json" \
  -d '{
    "athlete_id": 1,
    "year": 2024,
    "season": "Q1",
    "distance": "30m",
    "competition_format": "ranking",
    "gender_group": "male",
    "bow_type": "recurve",
    "raw_score": 285,
    "rank": 3,
    "participant_count": 20
  }'

# 3. 查看排名
curl -X GET "http://localhost:8000/api/stats/rankings?year=2024&season=Q1&page=1"
```

### 示例 2: 批量导入数据

```bash
# 批量导入运动员
curl -X POST http://localhost:8000/api/athletes/batch/import \
  -H "Content-Type: application/json" \
  -d '{
    "athletes": [
      {"name": "李四", "phone": "13800138001", "id_number": "110101199003011235", "gender": "female"},
      {"name": "王五", "phone": "13800138002", "id_number": "110101199003011236", "gender": "male"}
    ]
  }'

# 批量导入成绩
curl -X POST http://localhost:8000/api/scores/batch/import \
  -H "Content-Type: application/json" \
  -d '{
    "scores": [
      {"athlete_id": 1, "year": 2024, "season": "Q1", "distance": "30m", "competition_format": "ranking", "gender_group": "male", "bow_type": "recurve", "raw_score": 285, "rank": 3, "participant_count": 20},
      {"athlete_id": 2, "year": 2024, "season": "Q1", "distance": "30m", "competition_format": "ranking", "gender_group": "female", "bow_type": "compound", "raw_score": 280, "rank": 5, "participant_count": 20}
    ]
  }'
```

---

## 积分计算规则

### 排名赛（Ranking）

基础积分表:
| 排名 | 积分 |
|------|------|
| 1 | 25 |
| 2 | 22 |
| 3 | 19 |
| 4 | 15 |
| 5 | 10 |
| 6 | 8 |
| 7 | 6 |
| 8 | 4 |
| >8 | 1 |

参赛人数与系数:
- 8-15人: 系数 0.6，1-4名获得基础积分
- 16-31人: 系数 0.8，1-8名获得基础积分
- 32-63人: 系数 1.0，1-16名获得基础积分
- 64-127人: 系数 1.2，1-16名获得基础积分
- 128人+: 系数 1.4，1-16名获得基础积分

### 18米特殊规则

所有18米比赛的积分在计算后再乘以 0.5

### 积分计算公式

```
最终积分 = 基础积分 × 系数 × (18米时的 0.5 系数)
```

---

**文档更新日期**: 2026-01-30  
**API 版本**: 1.0.0
