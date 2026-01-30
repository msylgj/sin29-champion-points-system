# 快速参考指南

**版本**: 1.0.0  
**最后更新**: 2026-01-30

## 🚀 5分钟快速开始

### 1. 启动服务
```bash
cd /home/msylgj/sin29-champion-points-system
docker compose up -d
```

### 2. 验证服务状态
```bash
curl http://localhost:8000/api/health
```

### 3. 访问API文档
```
http://localhost:8000/docs    (Swagger UI)
http://localhost:8000/redoc   (ReDoc)
```

---

## 📚 常见操作

### 创建运动员
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

### 录入成绩
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

### 获取排名
```bash
curl http://localhost:8000/api/stats/rankings?year=2024&season=Q1
```

---

## 🔧 项目结构

```
backend/app/
├── schemas/        # Pydantic数据模型
│   ├── athlete.py
│   ├── score.py
│   ├── event.py
│   └── aggregate_points.py
├── routers/        # FastAPI路由
│   ├── athletes.py
│   ├── scores.py
│   ├── events.py
│   ├── stats.py
│   └── health.py
├── services/       # 业务逻辑
│   ├── athlete_service.py
│   ├── score_service.py
│   └── scoring_calculator.py
└── models/         # SQLAlchemy模型
    ├── athlete.py
    ├── score.py
    ├── event.py
    ├── event_participant.py
    ├── aggregate_points.py
    ├── scoring_rule.py
    └── operation_log.py
```

---

## 📝 API端点速览

### 运动员 API
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/athletes` | 创建 |
| GET | `/api/athletes` | 列表 |
| GET | `/api/athletes/{id}` | 详情 |
| PUT | `/api/athletes/{id}` | 更新 |
| DELETE | `/api/athletes/{id}` | 删除 |
| POST | `/api/athletes/batch/import` | 批量导入 |

### 成绩 API
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/scores` | 录入 |
| GET | `/api/scores` | 查询 |
| GET | `/api/scores/{id}` | 详情 |
| PUT | `/api/scores/{id}` | 更新 |
| DELETE | `/api/scores/{id}` | 删除 |
| POST | `/api/scores/batch/import` | 批量导入 |
| POST | `/api/scores/recalculate` | 重新计算 |
| GET | `/api/scores/athlete/{id}/scores` | 运动员成绩 |

### 赛事 API
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/events` | 创建 |
| GET | `/api/events` | 列表 |
| GET | `/api/events/{id}` | 详情 |
| PUT | `/api/events/{id}` | 更新 |
| DELETE | `/api/events/{id}` | 删除 |

### 统计 API
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/stats/rankings` | 排名列表 |
| GET | `/api/stats/athlete/{id}/aggregate` | 积分汇总 |
| GET | `/api/stats/top-performers` | 最优者 |

---

## 🎯 常见查询参数

### 分页参数
```
?page=1&page_size=10
```

### 筛选参数 (成绩)
```
?year=2024&season=Q1&distance=30m&competition_format=ranking
```

### 筛选参数 (排名)
```
?year=2024&season=Q1&gender_group=male&bow_type=recurve
```

### 搜索参数 (运动员)
```
?search=张三&gender=male
```

---

## 💾 数据验证规则

### Gender (性别)
- `male` - 男性
- `female` - 女性
- `mixed` - 混合

### Season (季度)
- `Q1`, `Q2`, `Q3`, `Q4`

### Distance (距离)
- `18m`, `30m`, `50m`, `70m`

### CompetitionFormat (赛制)
- `ranking` - 排名赛
- `elimination` - 淘汰赛
- `team` - 团体赛

---

## 📊 积分规则速览

### 排名赛基础积分
```
1名: 25分   2名: 22分   3名: 19分   4名: 15分
5名: 10分   6名: 8分    7名: 6分    8名: 4分
9名+: 1分
```

### 参赛人数系数
```
8-15人   → 系数0.6 (1-4名获得基础积分)
16-31人  → 系数0.8 (1-8名获得基础积分)
32-63人  → 系数1.0 (1-16名获得基础积分)
64-127人 → 系数1.2 (1-16名获得基础积分)
128人+   → 系数1.4 (1-16名获得基础积分)
```

### 特殊规则
```
18米比赛: 最终积分 × 0.5
```

### 计算公式
```
最终积分 = 基础积分 × 系数 × (距离系数)
```

---

## 🧪 快速测试

### 检查API健康状态
```bash
curl http://localhost:8000/api/health
```

### 列出所有运动员
```bash
curl http://localhost:8000/api/athletes
```

### 列出所有成绩
```bash
curl http://localhost:8000/api/scores
```

### 获取排名
```bash
curl "http://localhost:8000/api/stats/rankings?year=2024&page=1"
```

---

## 📖 详细文档

| 文档 | 内容 |
|------|------|
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | 完整API文档 |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | 详细测试指南 |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | 实现计划 |
| [PHASE1_SUMMARY.md](PHASE1_SUMMARY.md) | Phase 1总结 |

---

## 🐛 常见错误及解决

### 错误: "运动员不存在"
```
原因: athlete_id 不存在
解决: 先创建运动员，再录入成绩
```

### 错误: "身份证号已存在"
```
原因: 身份证号重复
解决: 使用不同的身份证号
```

### 错误: "该季度必须是 Q1, Q2, Q3, Q4"
```
原因: season 值无效
解决: 只能使用 Q1, Q2, Q3, Q4
```

### 积分计算异常
```
原因: rank 或 participant_count 为 null
解决: 确保 rank 和 participant_count 有值
```

---

## 🔄 数据库操作

### 查看运动员
```bash
docker compose exec database psql -U archery_user -d archery_db \
  -c "SELECT * FROM athletes LIMIT 10;"
```

### 查看成绩
```bash
docker compose exec database psql -U archery_user -d archery_db \
  -c "SELECT * FROM scores ORDER BY created_at DESC LIMIT 10;"
```

### 查看排名
```bash
docker compose exec database psql -U archery_user -d archery_db \
  -c "SELECT athlete_id, SUM(points) as total_points, COUNT(*) as event_count 
      FROM scores WHERE is_valid = 1 
      GROUP BY athlete_id ORDER BY total_points DESC LIMIT 10;"
```

### 重置数据库
```bash
docker compose down -v
docker compose up -d
```

---

## 📞 获取帮助

1. 查看 Swagger 文档：http://localhost:8000/docs
2. 查看详细 API 文档：[API_DOCUMENTATION.md](API_DOCUMENTATION.md)
3. 查看测试指南：[TESTING_GUIDE.md](TESTING_GUIDE.md)
4. 检查日志：`docker compose logs backend`

---

## ✅ 验收清单

开发完成后必须验证：

- [ ] API 所有端点都能访问
- [ ] 数据库初始化成功
- [ ] Swagger 文档显示正常
- [ ] 积分计算结果正确
- [ ] 排名统计正确
- [ ] 批量导入成功
- [ ] 错误处理正确
- [ ] 性能测试通过

---

**快速参考版本**: 1.0.0  
**最后更新**: 2026-01-30  
**维护者**: 开发团队
