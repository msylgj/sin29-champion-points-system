# API 测试指南

**版本**: 1.0.0  
**更新时间**: 2026-01-30

## 🚀 快速开始

### 1. 启动服务

```bash
cd /home/msylgj/sin29-champion-points-system
docker compose up -d
```

### 2. 等待服务就绪

```bash
# 检查健康状态
curl http://localhost:8000/api/health

# 如果返回 {"status": "healthy", "database": "healthy"}，说明服务已就绪
```

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 📋 测试场景

### 场景 1: 运动员管理完整流程

#### 1.1 创建运动员

```bash
curl -X POST http://localhost:8000/api/athletes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三",
    "phone": "13800138000",
    "id_number": "110101199003011234",
    "gender": "male"
  }'
```

**预期响应** (201):
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

#### 1.2 获取运动员列表

```bash
curl -X GET "http://localhost:8000/api/athletes?page=1&page_size=10"
```

**预期响应** (200):
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

#### 1.3 搜索运动员

```bash
curl -X GET "http://localhost:8000/api/athletes?search=张三"
```

#### 1.4 按性别筛选

```bash
curl -X GET "http://localhost:8000/api/athletes?gender=male"
```

#### 1.5 获取单个运动员

```bash
curl -X GET "http://localhost:8000/api/athletes/1"
```

#### 1.6 更新运动员

```bash
curl -X PUT http://localhost:8000/api/athletes/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三（修改）",
    "phone": "13900139000"
  }'
```

#### 1.7 删除运动员

```bash
curl -X DELETE "http://localhost:8000/api/athletes/1"
```

### 场景 2: 成绩管理完整流程

#### 2.1 批量创建运动员（便于后续测试）

```bash
curl -X POST http://localhost:8000/api/athletes/batch/import \
  -H "Content-Type: application/json" \
  -d '{
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
      },
      {
        "name": "赵六",
        "phone": "13800138003",
        "id_number": "110101199003011237",
        "gender": "female"
      }
    ]
  }'
```

#### 2.2 录入成绩

```bash
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
```

**预期响应** (201):
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
  "remark": null,
  "created_at": "2026-01-30T10:00:00+00:00",
  "updated_at": "2026-01-30T10:00:00+00:00"
}
```

**验证**:
- `base_points` 应该是 19.0 (排名3的基础积分)
- `points` 应该是 19.0 * 0.8 = 15.2 (20人时系数0.8)

#### 2.3 批量导入成绩

```bash
curl -X POST http://localhost:8000/api/scores/batch/import \
  -H "Content-Type: application/json" \
  -d '{
    "scores": [
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
      },
      {
        "athlete_id": 3,
        "year": 2024,
        "season": "Q1",
        "distance": "30m",
        "competition_format": "ranking",
        "gender_group": "female",
        "bow_type": "recurve",
        "raw_score": 275,
        "rank": 8,
        "participant_count": 20
      },
      {
        "athlete_id": 1,
        "year": 2024,
        "season": "Q1",
        "distance": "18m",
        "competition_format": "ranking",
        "gender_group": "male",
        "bow_type": "recurve",
        "raw_score": 180,
        "rank": 2,
        "participant_count": 15
      }
    ]
  }'
```

**验证**:
- 运动员1的18米成绩：基础积分22 × 系数0.6 × 0.5(18米) = 6.6
- 运动员2的成绩：基础积分10 × 系数0.8 = 8.0
- 运动员3的成绩：基础积分4 × 系数0.8 = 3.2

#### 2.4 查询成绩列表

```bash
curl -X GET "http://localhost:8000/api/scores?page=1&page_size=10&year=2024"
```

#### 2.5 按条件筛选成绩

```bash
# 按运动员筛选
curl -X GET "http://localhost:8000/api/scores?athlete_id=1"

# 按距离筛选
curl -X GET "http://localhost:8000/api/scores?distance=30m"

# 按赛制筛选
curl -X GET "http://localhost:8000/api/scores?competition_format=ranking"

# 组合筛选
curl -X GET "http://localhost:8000/api/scores?year=2024&season=Q1&gender_group=male"
```

#### 2.6 获取运动员的所有成绩

```bash
curl -X GET "http://localhost:8000/api/scores/athlete/1/scores?year=2024"
```

#### 2.7 获取单条成绩

```bash
curl -X GET "http://localhost:8000/api/scores/1"
```

#### 2.8 更新成绩

```bash
curl -X PUT http://localhost:8000/api/scores/1 \
  -H "Content-Type: application/json" \
  -d '{
    "rank": 2,
    "raw_score": 290,
    "participant_count": 22
  }'
```

**验证**:
- 积分应该自动重新计算
- 排名从3变为2，基础积分从19变为22
- 人数从20变为22，系数不变（都是0.8）

#### 2.9 重新计算所有积分

```bash
curl -X POST http://localhost:8000/api/scores/recalculate
```

**预期响应** (200):
```json
{
  "message": "已重新计算 4 条成绩的积分"
}
```

### 场景 3: 赛事管理

#### 3.1 创建赛事

```bash
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年全国射箭锦标赛-春季",
    "year": 2024,
    "season": "Q1",
    "start_date": "2024-01-15",
    "end_date": "2024-01-20",
    "location": "北京",
    "distance": "30m",
    "competition_format": "ranking",
    "description": "春季重点赛事"
  }'
```

#### 3.2 获取赛事列表

```bash
curl -X GET "http://localhost:8000/api/events?page=1&page_size=10"
```

#### 3.3 按年度和季度筛选

```bash
curl -X GET "http://localhost:8000/api/events?year=2024&season=Q1"
```

#### 3.4 获取赛事详情

```bash
curl -X GET "http://localhost:8000/api/events/1"
```

#### 3.5 更新赛事

```bash
curl -X PUT http://localhost:8000/api/events/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年全国射箭锦标赛-春季（已完成）",
    "status": "completed"
  }'
```

### 场景 4: 统计和排名

#### 4.1 获取排名列表

```bash
curl -X GET "http://localhost:8000/api/stats/rankings?year=2024&page=1&page_size=10"
```

**预期响应** (200):
```json
{
  "items": [
    {
      "rank": 1,
      "athlete_id": 1,
      "athlete_name": "张三",
      "phone": "13800138000",
      "gender": "male",
      "total_points": 21.4,
      "event_count": 2,
      "best_score": 290,
      "average_rank": 2.5
    },
    {
      "rank": 2,
      "athlete_id": 2,
      "athlete_name": "李四",
      "phone": "13800138001",
      "gender": "female",
      "total_points": 8.0,
      "event_count": 1,
      "best_score": 280,
      "average_rank": 5.0
    }
  ],
  "total": 3,
  "page": 1,
  "page_size": 10,
  "year": 2024,
  "season": null,
  "gender_group": null,
  "bow_type": null
}
```

#### 4.2 按季度筛选排名

```bash
curl -X GET "http://localhost:8000/api/stats/rankings?year=2024&season=Q1"
```

#### 4.3 按性别分组排名

```bash
curl -X GET "http://localhost:8000/api/stats/rankings?year=2024&gender_group=male"
```

#### 4.4 按弓种筛选排名

```bash
curl -X GET "http://localhost:8000/api/stats/rankings?year=2024&bow_type=recurve"
```

#### 4.5 获取运动员积分汇总

```bash
curl -X GET "http://localhost:8000/api/stats/athlete/1/aggregate?year=2024"
```

**预期响应** (200):
```json
{
  "athlete_id": 1,
  "year": 2024,
  "season": null,
  "total_points": 21.4,
  "event_count": 2,
  "average_rank": 2.5,
  "best_score": 290
}
```

#### 4.6 获取季度汇总

```bash
curl -X GET "http://localhost:8000/api/stats/athlete/1/aggregate?year=2024&season=Q1"
```

#### 4.7 获取绩效最优者

```bash
curl -X GET "http://localhost:8000/api/stats/top-performers?year=2024"
```

**预期响应** (200):
```json
[
  {
    "athlete_id": 1,
    "athlete_name": "张三",
    "total_points": 21.4,
    "event_count": 2
  },
  {
    "athlete_id": 2,
    "athlete_name": "李四",
    "total_points": 8.0,
    "event_count": 1
  }
]
```

#### 4.8 按季度获取最优者

```bash
curl -X GET "http://localhost:8000/api/stats/top-performers?year=2024&season=Q1"
```

---

## 🧪 积分计算验证

### 验证场景 1: 排名赛 - 基础系数应用

**输入**:
- 赛制: ranking (排名赛)
- 排名: 3
- 距离: 30m
- 参赛人数: 20人

**预期计算**:
- 基础积分: 19.0 (排名3)
- 系数: 0.8 (20人在16-31范围内)
- 最终积分: 19.0 × 0.8 = 15.2

**验证SQL**:
```sql
SELECT * FROM scores WHERE rank = 3 AND distance = '30m' 
AND competition_format = 'ranking' AND participant_count = 20;
```

应该看到 `points = 15.2`

### 验证场景 2: 18米特殊规则

**输入**:
- 赛制: ranking
- 排名: 2
- 距离: 18m
- 参赛人数: 15人

**预期计算**:
- 基础积分: 22.0 (排名2)
- 系数: 0.6 (15人在8-15范围内)
- 中间结果: 22.0 × 0.6 = 13.2
- 最终积分（18米减半）: 13.2 × 0.5 = 6.6

**验证SQL**:
```sql
SELECT * FROM scores WHERE rank = 2 AND distance = '18m' 
AND competition_format = 'ranking' AND participant_count = 15;
```

应该看到 `points = 6.6`

### 验证场景 3: 排名限制（超出基础积分范围）

**输入**:
- 赛制: ranking
- 排名: 10
- 距离: 30m
- 参赛人数: 20人

**预期计算**:
- 基础积分: 1.0 (排名10超出范围，使用1分)
- 系数: 0.8 (20人)
- 最终积分: 1.0 × 0.8 = 0.8

**说明**: 20人时，排名1-8获得基础积分，9以上获得1分

---

## 🔍 数据库验证

### 检查运动员数据

```bash
docker compose exec database psql -U archery_user -d archery_db \
  -c "SELECT id, name, phone, gender, created_at FROM athletes ORDER BY created_at DESC LIMIT 10;"
```

### 检查成绩数据

```bash
docker compose exec database psql -U archery_user -d archery_db \
  -c "SELECT id, athlete_id, year, season, distance, rank, base_points, points FROM scores ORDER BY created_at DESC LIMIT 10;"
```

### 检查排名数据

```bash
docker compose exec database psql -U archery_user -d archery_db \
  -c "SELECT athlete_id, year, season, 
           SUM(points) as total_points, 
           COUNT(*) as event_count 
      FROM scores 
      WHERE is_valid = 1 
      GROUP BY athlete_id, year, season 
      ORDER BY total_points DESC LIMIT 10;"
```

---

## 📊 性能测试

### 测试批量导入性能

```bash
# 生成100条成绩记录进行导入
time curl -X POST http://localhost:8000/api/scores/batch/import \
  -H "Content-Type: application/json" \
  -d '{
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
        "rank": '$(( RANDOM % 10 + 1 ))',
        "participant_count": 20
      }
    ]
  }'
```

### 测试查询性能

```bash
# 测试排名查询的响应时间
time curl -X GET "http://localhost:8000/api/stats/rankings?year=2024&page=1&page_size=50"
```

---

## 🐛 错误处理验证

### 错误 1: 创建重复的运动员（身份证号重复）

```bash
curl -X POST http://localhost:8000/api/athletes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "另一个张三",
    "phone": "13999999999",
    "id_number": "110101199003011234",
    "gender": "male"
  }'
```

**预期响应** (400):
```json
{
  "detail": "该身份证号已存在"
}
```

### 错误 2: 录入成绩时运动员不存在

```bash
curl -X POST http://localhost:8000/api/scores \
  -H "Content-Type: application/json" \
  -d '{
    "athlete_id": 9999,
    "year": 2024,
    "season": "Q1",
    "distance": "30m",
    "competition_format": "ranking",
    "gender_group": "male",
    "bow_type": "recurve",
    "raw_score": 285,
    "rank": 3
  }'
```

**预期响应** (400):
```json
{
  "detail": "运动员 ID 9999 不存在"
}
```

### 错误 3: 获取不存在的运动员

```bash
curl -X GET http://localhost:8000/api/athletes/9999
```

**预期响应** (404):
```json
{
  "detail": "运动员不存在"
}
```

### 错误 4: 无效的季度值

```bash
curl -X POST http://localhost:8000/api/scores \
  -H "Content-Type: application/json" \
  -d '{
    "athlete_id": 1,
    "year": 2024,
    "season": "Q5",
    "distance": "30m",
    "competition_format": "ranking",
    "gender_group": "male",
    "bow_type": "recurve",
    "raw_score": 285,
    "rank": 3
  }'
```

**预期响应** (400):
```json
{
  "detail": "Input should be 'Q1', 'Q2', 'Q3' or 'Q4' [type=enum, input_value='Q5', input_type=str]"
}
```

---

## 📋 测试清单

- [ ] 运动员CRUD全流程
- [ ] 成绩CRUD全流程
- [ ] 赛事CRUD全流程
- [ ] 批量导入成功
- [ ] 排名统计正确
- [ ] 积分计算验证
- [ ] 18米规则应用
- [ ] 错误处理生效
- [ ] 数据库数据一致
- [ ] API性能可接受

---

**文档更新**: 2026-01-30  
**测试版本**: 1.0.0
