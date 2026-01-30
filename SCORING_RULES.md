# 积分计算规则详细说明

## 概述

本文档详细说明射箭赛事的积分计算规则，包括排名赛、淘汰赛和团体赛的积分计算方法。

## 核心规则

### 1. 基础积分表

#### 排名赛（Individual Ranking）
按排名获得基础积分，超出排名范围的选手获得1分的基础积分。

| 排名 | 基础积分 |
|------|---------|
| 1    | 25      |
| 2    | 22      |
| 3    | 19      |
| 4    | 15      |
| 5    | 10      |
| 6    | 8       |
| 7    | 6       |
| 8    | 4       |
| 9+   | 1       |

#### 淘汰赛（Elimination）
分为两个积分段，9-16名都是15分，17名及以后获得1分。

| 排名  | 基础积分 |
|-------|---------|
| 1     | 45      |
| 2     | 40      |
| 3     | 35      |
| 4     | 30      |
| 5-8   | 20      |
| 9-16  | 15      |
| 17+   | 1       |

#### 团体赛（Team）
每个队员按排名获得相应积分，超出排名范围的队伍成员获得1分。

| 排名 | 每人积分 |
|------|---------|
| 1    | 20      |
| 2    | 15      |
| 3    | 10      |
| 4    | 8       |
| 5    | 5       |
| 6    | 4       |
| 7    | 3       |
| 8    | 2       |
| 9+   | 1       |

### 2. 参赛人数与系数规则

最终积分 = **基础积分 × 系数**

根据参赛人数调整系数，使得同一排名在不同规模赛事中的积分具有可比性。

#### 单项赛（排名赛、淘汰赛）参赛人数系数表

| 参赛人数范围 | 系数 | 获得**原额**基础积分的人数上限 |
|-------------|------|---------------------------------|
| 8-15人      | 0.6  | 前4名                          |
| 16-31人     | 0.8  | 前8名                          |
| 32-63人     | 1.0  | 前16名                         |
| 64-127人    | 1.2  | 前16名                         |
| 128人及以上 | 1.4  | 前16名                         |

**说明**：
- 如果参赛人数不足8人，系数为1.0
- 排名在"获得原额基础积分的人数上限"之外的选手：
  - 按照积分表超出规定排名后获得1分的基础积分
  - 仍需乘以对应的系数
  - 例：20人参赛，排名第10名（超出8名限制），基础积分1×0.8=0.8分

#### 团体赛队伍数系数表

| 队伍数范围 | 系数 | 获得基础积分的队数上限 |
|-----------|------|----------------------|
| 3-4队     | 0.6  | 前2队                |
| 5-7队     | 0.8  | 前4队                |
| 8-10队    | 1.0  | 前8队                |
| 11-14队   | 1.2  | 前8队                |
| 15队及以上| 1.4  | 前8队                |

### 3. 18米特殊规则

**所有18米距离的比赛积分需要在计算结果基础上减半**

`最终积分 = (基础积分 × 系数) × 0.5`

#### 例子

**例1：18米排名赛，排名第1名，20人参赛**
- 基础积分：25分（排名在积分表内）
- 参赛人数系数：20人→系数0.8
- 中间积分：25 × 0.8 = 20分
- 18米减半：20 × 0.5 = **10分**

**例2：30米排名赛，排名第1名，20人参赛**
- 基础积分：25分（排名在积分表内）
- 参赛人数系数：20人→系数0.8
- 中间积分：25 × 0.8 = 20分
- 非18米：20 = **20分**

**例3：30米排名赛，排名第10名，20人参赛**
- 基础积分：1分（排名超出积分表，获得1分）
- 参赛人数系数：20人→系数0.8，原额积分限制前8名
- 排名第10超出限制→使用1分基础积分
- 中间积分：1 × 0.8 = 0.8分
- 非18米：0.8 = **0.8分**

### 4. 计算步骤

#### 步骤1：获取基础积分
根据选手的排名和赛制类型，从对应的基础积分表中查找基础积分。
- 如果排名在积分表范围内（排名1-8等）→获得对应积分
- 如果排名超出积分表范围（排名9+等）→获得1分
- 继续步骤2

#### 步骤2：确定参赛人数系数
根据参赛人数范围确定系数。
- 如果参赛人数不足8人→系数为1.0
- 否则根据人数范围查找系数→继续步骤3

#### 步骤3：检查"原额积分"限制
确定该排名是否在"获得原额基础积分的人数上限"内。
- 如果排名在限制内→使用步骤1获取的积分
- 如果排名在限制外→该选手的基础积分替换为1分
- 继续步骤4

#### 步骤4：计算最终积分
`最终积分 = 基础积分 × 系数`

#### 步骤5：判断是否18米
- 如果是18米距离→最终积分 = 最终积分 × 0.5
- 如果不是18米→最终积分保持不变

## 实现代码

### Python实现

```python
from app.services.scoring_calculator import ScoringCalculator

# 计算积分
points = ScoringCalculator.calculate_points(
    rank=3,                    # 排名：第3名
    competition_format="ranking",  # 赛制：排名赛
    distance="30m",            # 距离：30米
    participant_count=20       # 参赛人数：20人
)
# 结果：19 × 0.8 = 15.2分

# 如果是18米
points_18m = ScoringCalculator.calculate_points(
    rank=3,
    competition_format="ranking",
    distance="18m",
    participant_count=20
)
# 结果：15.2 × 0.5 = 7.6分
```

### SQL查询示例

获取某个赛事的所有成绩并计算积分：

```sql
-- 获取赛事的所有成绩
SELECT 
    s.id,
    s.athlete_id,
    a.name as athlete_name,
    s.rank,
    s.raw_score,
    s.distance,
    s.competition_format,
    COUNT(*) OVER (PARTITION BY s.gender_group) as participant_count,
    s.points
FROM scores s
JOIN athletes a ON s.athlete_id = a.id
WHERE s.event_id = ?
AND s.is_valid = 1
ORDER BY s.rank ASC;
```

## 数据库字段说明

在`scores`表中存储积分相关信息：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| raw_score | INTEGER | 原始成绩（环数），用于排序 |
| rank | INTEGER | 计算后的排名 |
| base_points | FLOAT | 基础积分（根据排名） |
| points | FLOAT | 最终积分（考虑系数和18米减半） |
| distance | VARCHAR | 距离：18m, 30m, 50m, 70m |
| competition_format | VARCHAR | 赛制：ranking, elimination, team |
| participant_count | INTEGER | 参赛人数（用于查询系数） |
| gender_group | VARCHAR | 性别分组 |
| bow_type | VARCHAR | 弓种 |
| year | INTEGER | 比赛年度 |
| season | VARCHAR | 季度 |

## 积分计算流程图

```
开始
  ↓
获取选手排名 → 查找基础积分表
  ↓
有基础积分？ → 否 → 积分=0 → 结束
  ↓ 是
获取参赛人数 → 查找系数表
  ↓
排名在"可获得积分范围"内？ → 否 → 积分=0 → 结束
  ↓ 是
中间积分 = 基础积分 × 系数
  ↓
是否18米距离？ → 是 → 最终积分 = 中间积分 × 0.5
  ↓ 否                ↓
最终积分 = 中间积分 ←
  ↓
保存到数据库
  ↓
结束
```

## 特殊情况处理

### 1. 参赛人数不足
- 如果参赛人数 < 8人：
  - 系数固定为1.0
  - 所有参赛者都可获得基础积分（不限制排名）

### 2. 弃权或无效成绩
- 在`is_valid`字段标记为0
- 在排名计算中应该排除
- 不计入积分汇总

### 3. 同分排名
- 如果多个选手成绩相同，应该：
  - 赋予相同排名
  - 下一个不同成绩的排名跳过相应数量
  - 例如：两个选手都是第3名，下一个是第5名

## 积分规则配置

积分规则存储在`scoring_rules`表，JSON格式：

```json
{
  "type": "rank_based",
  "version": "1.0",
  "description": "射箭比赛积分规则",
  "rules": {
    "ranking": {
      "base_points": {
        "1": 25, "2": 22, "3": 19, ...
      },
      "coefficients": {
        "8-15": {"coeff": 0.6, "cutoff": 4},
        "16-31": {"coeff": 0.8, "cutoff": 8},
        ...
      }
    },
    "elimination": {...},
    "team": {...}
  },
  "special_rules": {
    "18m_discount": 0.5
  }
}
```

## 修改规则的步骤

如果需要修改积分规则：

1. **修改服务代码**：编辑`backend/app/services/scoring_calculator.py`
   - 更新`RANKING_POINTS`等常量
   - 更新系数表
   - 更新计算逻辑

2. **生成新的规则配置**：
   ```python
   rule_config = ScoringCalculator.build_scoring_rule_config()
   ```

3. **插入数据库**：
   ```sql
   INSERT INTO scoring_rules 
   (name, description, rule_config, rule_type, is_default)
   VALUES ('新规则名称', '描述', '...'::JSONB, 'rank_based', 0);
   ```

4. **在赛事中应用新规则**：
   ```sql
   UPDATE events SET scoring_rule_id = ? WHERE id = ?;
   ```

5. **重新计算已有的成绩**（如果需要）：
   ```python
   # 遍历scores表，调用ScoringCalculator重新计算
   for score in db.query(Score).filter(Score.event_id == event_id):
       score.base_points = ScoringCalculator.calculate_base_points(...)
       score.points = ScoringCalculator.calculate_points(...)
   db.commit()
   ```

## 测试覆盖

已为积分计算逻辑编写详细的单元测试，覆盖场景包括：

- ✅ 各赛制的基础积分计算
- ✅ 不同参赛人数的系数应用
- ✅ 18米减半规则
- ✅ 超出排名范围的处理
- ✅ 积分汇总和排名计算

运行测试：
```bash
pytest backend/tests/test_scoring_calculator.py -v
```

---

**最后更新**：2026-01-29  
**版本**：1.0
