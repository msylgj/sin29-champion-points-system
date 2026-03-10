# QUICK START

本指南基于当前代码实现，提供最短路径启动、认证配置、核心功能验收。

## 1. 前置条件

- Docker + Docker Compose（推荐）
- 或 Python 3.11 + Node.js 20 + PostgreSQL 15

## 2. Docker 启动（推荐）

```bash
cd /home/msylgj/sin29-champion-points-system
cp .env.example .env
```

配置管理密码哈希（必须）：

```bash
echo -n '你的管理明文密码' | sha256sum | awk '{print $1}'
# 把输出写入 .env 的 SECRET_KEY
```

启动服务：

```bash
docker-compose up -d --build
```

访问：

- 前端: http://localhost:8080
- 后端: http://localhost:8000
- Swagger: http://localhost:8000/docs

健康检查：

```bash
curl http://localhost:8000/api/health
```

## 3. 本地开发启动

数据库初始化：

```bash
createdb archery_db
psql archery_db < database/init.sql
```

后端：

```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL='postgresql://archery_user:archery_pass@localhost:5432/archery_db'
export SECRET_KEY='你的sha256密文'
python -m uvicorn app.main:app --reload --port 8000
```

前端：

```bash
cd frontend
npm install
npm run dev
```

## 4. 管理认证流程

- 积分页点击“管理”会弹出密码验证框。
- 验证通过后才可进入：
  - `/score-import`
  - `/event-add`
- 直接 URL 访问上述页面也会被拦截并要求认证。
- 管理 API 需要 `Authorization: Bearer <token>`。

登录接口示例：

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"你的管理明文密码"}'
```

## 5. 最小验收清单

1. 打开积分页，能看到年度/弓种筛选与排名。
2. 点击“管理”输入错误密码，提示“密码验证失败”，停留当前页。
3. 输入正确密码后跳转到导入页。
4. 在导入页可看到“赛事配置”折叠面板（默认收起）。
5. 成绩管理区支持：
   - 按弓种 Tab 查看
   - 姓名搜索
   - 已修改高亮
   - 单条保存与当前 Tab 批量保存
6. 赛事配置页按“年度+赛季”可自动回填已存在配置并更新保存。

## 6. API 速查（当前）

公开接口：

- `GET /api/health`
- `GET /api/dictionaries`
- `GET /api/scores/annual-ranking/{year}/{bow_type}`
- `GET /api/scores/event/{event_id}/ranking`
- `POST /api/auth/login`

管理接口（需认证）：

- `GET|POST|PUT|DELETE /api/events...`
- `GET|POST|PUT|DELETE /api/event-configurations...`
- `GET|POST|PUT|DELETE /api/scores...`
- `POST /api/scores/batch/import`

## 7. 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看后端日志
docker-compose logs -f backend

# 重启后端
docker-compose restart backend

# 停止并保留数据
docker-compose down

# 停止并删除数据卷
docker-compose down -v
```

