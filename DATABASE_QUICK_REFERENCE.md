# 数据库模型快速参考

## 表名和字段速查

### users 用户表
```python
User(
    id, username, email, hashed_password, full_name,
    role: 'admin'|'coach'|'viewer',
    is_active, created_at, updated_at
)
```

### athletes 运动员表
```python
Athlete(
    id, name, id_number, 
    gender: 'male'|'female'|'mixed',
    age, birth_date, club, province, city,
    bow_types, level, remark,
    created_at, updated_at
)
```

### events 赛事表
```python
Event(
    id, name, year, season: 'Q1'|'Q2'|'Q3'|'Q4',
    start_date, end_date, location,
    status: 'not_started'|'in_progress'|'completed',
    distance: '18m'|'30m'|'50m'|'70m',
    competition_format: 'ranking'|'elimination'|'team',
    supported_bow_types, supported_genders,
    max_participants, min_score, max_score,
    target_count, arrows_per_round,
    scoring_rule_id (FK), is_official,
    created_at, updated_at
)
```

### scoring_rules 积分规则表
```python
ScoringRule(
    id, name, description,
    rule_config: JSON,  # 灵活的规则配置
    rule_type: 'rank_based'|'score_based'|'custom',
    is_default, applicable_formats, applicable_distances,
    created_at, updated_at
)
```

### event_participants 赛事参与者表
```python
EventParticipant(
    id,
    event_id (FK), athlete_id (FK),
    registration_number, bow_type, gender_group,
    status: 'registered'|'checked_in'|'participated'|'withdrew',
    created_at, updated_at
)
```

### scores 成绩表
```python
Score(
    id,
    athlete_id (FK), event_id (FK),
    score (环数), points (积分),
    rank, group_rank, gender_group, bow_type, round,
    is_valid: 0|1,
    remark,
    created_at, updated_at
)
```

### athlete_aggregate_points 积分汇总表
```python
AthleteAggregatePoints(
    id,
    athlete_id (FK), year, season,
    total_points, event_count, rank,
    gender_group, bow_type,
    created_at, updated_at
)
```

### operation_logs 操作日志表
```python
OperationLog(
    id,
    user_id (FK),
    operation_type: 'create'|'update'|'delete'|'import'|'export'|'calculate',
    entity_type: 'athlete'|'event'|'score'|'user',
    entity_id,
    description, old_values, new_values,
    ip_address, user_agent,
    status: 'success'|'failure',
    error_message,
    created_at
)
```

## 常用查询模式

### 获取运动员的所有成绩
```sql
SELECT s.*, e.name as event_name, e.year, e.season, e.distance
FROM scores s
JOIN events e ON s.event_id = e.id
WHERE s.athlete_id = ?
AND s.is_valid = 1
ORDER BY e.year DESC, e.season DESC;
```

### 获取赛事的排名
```sql
SELECT a.id, a.name, a.club, s.score, s.rank, s.gender_group
FROM scores s
JOIN athletes a ON s.athlete_id = a.id
WHERE s.event_id = ?
AND s.is_valid = 1
ORDER BY s.rank ASC;
```

### 获取运动员年度积分排名
```sql
SELECT aap.*, a.name, a.club
FROM athlete_aggregate_points aap
JOIN athletes a ON aap.athlete_id = a.id
WHERE aap.year = ? AND aap.season = ?
ORDER BY aap.rank ASC;
```

### 获取赛事参与者
```sql
SELECT ep.*, a.name, a.club, a.gender
FROM event_participants ep
JOIN athletes a ON ep.athlete_id = a.id
WHERE ep.event_id = ?
ORDER BY ep.registration_number;
```

## 枚举值映射

| 字段 | 值 | 说明 |
|------|-----|------|
| gender | male | 男 |
| | female | 女 |
| | mixed | 混合 |
| bow_type | recurve | 反曲弓 |
| | compound | 复合弓 |
| | traditional | 传统弓 |
| | longbow | 长弓/美猎弓 |
| | barebow | 光弓 |
| distance | 18m | 18米 |
| | 30m | 30米 |
| | 50m | 50米 |
| | 70m | 70米 |
| competition_format | ranking | 排位赛 |
| | elimination | 淘汰赛 |
| | team | 团体赛 |
| event_status | not_started | 未开始 |
| | in_progress | 进行中 |
| | completed | 已结束 |
| season | Q1 | 第一季度 |
| | Q2 | 第二季度 |
| | Q3 | 第三季度 |
| | Q4 | 第四季度 |
| user_role | admin | 管理员 |
| | coach | 教练 |
| | viewer | 查看者 |

## 积分规则配置示例

### 排名积分规则
```json
{
  "type": "rank_based",
  "ranking_points": {
    "1": 100,
    "2": 90,
    "3": 80,
    "4": 70,
    "5": 60,
    "6": 50,
    "7": 40,
    "8": 30,
    "9": 20,
    "10": 10
  }
}
```

### 成绩系数规则
```json
{
  "type": "score_based",
  "coefficient": 1.5,
  "base_score": 50,
  "max_score": 1000
}
```

### 自定义规则
```json
{
  "type": "custom",
  "algorithm": "custom_calculation",
  "params": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

## SQLAlchemy 模型导入

```python
from app.models import (
    # 枚举
    BowType, Gender, Distance, CompetitionFormat,
    EventStatus, Season, UserRole,
    # 模型
    User, Athlete, Event, Score, ScoringRule,
    EventParticipant, AthleteAggregatePoints, OperationLog
)

# 使用示例
from app.database import SessionLocal
from app.models import Athlete, Gender

db = SessionLocal()
athletes = db.query(Athlete).filter(
    Athlete.gender == Gender.MALE.value,
    Athlete.club == "北京射箭俱乐部"
).all()
```

## 数据库操作最佳实践

### 创建运动员
```python
athlete = Athlete(
    name="张三",
    gender=Gender.MALE.value,
    club="北京射箭俱乐部",
    bow_types="recurve,compound",
    level="一级"
)
db.add(athlete)
db.commit()
```

### 记录操作日志
```python
log = OperationLog(
    user_id=current_user.id,
    operation_type="create",
    entity_type="athlete",
    entity_id=athlete.id,
    description=f"创建运动员: {athlete.name}",
    status="success"
)
db.add(log)
db.commit()
```

### 查询with关系
```python
from sqlalchemy.orm import joinedload

event = db.query(Event).options(
    joinedload(Event.scoring_rule)
).filter(Event.id == event_id).first()

participants = db.query(EventParticipant).options(
    joinedload(EventParticipant.athlete)
).filter(EventParticipant.event_id == event_id).all()
```

### 批量导入
```python
athletes_list = [
    Athlete(name="张三", gender="male", club="ABC"),
    Athlete(name="李四", gender="female", club="XYZ"),
    # ...
]
db.bulk_insert_mappings(Athlete, athletes_list)
db.commit()
```

## 常见数据库操作

### 计算赛事积分
```python
from sqlalchemy import func

# 获取赛事的所有成绩，按分数排序并计算排名
scores = db.query(Score).filter(
    Score.event_id == event_id,
    Score.is_valid == 1
).order_by(Score.score.desc()).all()

# 应用积分规则进行积分计算
for rank, score in enumerate(scores, 1):
    score.rank = rank
    # 根据scoring_rule计算points
    score.points = calculate_points(rank, rule_config)

db.commit()
```

### 更新积分汇总
```python
# 删除旧的汇总数据
db.query(AthleteAggregatePoints).filter(
    AthleteAggregatePoints.year == 2024,
    AthleteAggregatePoints.season == "Q1"
).delete()

# 重新计算和插入新的汇总数据
aggregates = []
for athlete_id, points in calculate_aggregates(...):
    agg = AthleteAggregatePoints(
        athlete_id=athlete_id,
        year=2024,
        season="Q1",
        total_points=points,
        event_count=event_count
    )
    aggregates.append(agg)

db.bulk_save_objects(aggregates)
db.commit()
```

## 性能优化建议

1. **使用eager loading避免N+1查询**:
   ```python
   athletes = db.query(Athlete).options(
       joinedload(Athlete.scores)
   ).all()
   ```

2. **批量操作而不是逐个插入**:
   ```python
   db.bulk_insert_mappings(Score, scores_list)
   ```

3. **使用分页处理大数据集**:
   ```python
   page = db.query(Score).filter(...).limit(100).offset(0).all()
   ```

4. **索引关键查询字段**:
   - athlete_id (在scores表中)
   - event_id (在scores表中)
   - year, season (在events表中)
   - rank (在scores表中)

5. **定期更新统计表**:
   ```python
   # 定时任务：每周更新athlete_aggregate_points
   # 减少实时计算的负担
   ```

---

**最后更新**: 2026-01-29
