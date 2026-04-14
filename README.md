# 射箭赛事积分统计系统

基于 Vue 3 + FastAPI + PostgreSQL 的射箭赛事积分系统，覆盖赛事配置、成绩导入/管理、年度积分排名。

## 概览

- 前端: Vue 3 + Vite + Axios + XLSX（按需动态加载）
- 后端: FastAPI + SQLAlchemy + PostgreSQL
- 部署: Docker Compose
- 核心页面:
  - 积分排名: [frontend/src/views/PointsDisplay.vue](frontend/src/views/PointsDisplay.vue)
  - 导入成绩/成绩管理: [frontend/src/views/ScoreImport.vue](frontend/src/views/ScoreImport.vue)
  - 赛事配置: [frontend/src/views/EventAdd.vue](frontend/src/views/EventAdd.vue)

## 当前功能

- 积分排名
  - 按年度 + 弓种查看年度排名
  - 前 8 名高亮展示
  - 支持 Excel 导出
- 赛事配置
  - 按年度、赛季配置赛事
  - 若该赛事已存在，自动回填并更新配置
- 成绩导入与管理
  - 支持 Excel/CSV 批量导入
  - 支持查看、编辑已存在成绩（不支持手工新增）
  - 支持弓种 Tab、姓名搜索、已修改高亮、批量保存
- 管理认证
  - 管理入口密码认证
  - 直链访问管理页需认证
  - 管理 API 需 Bearer Token

## 快速启动

### Docker（推荐）

```bash
cd /home/msylgj/sin29-champion-points-system
cp .env.example .env

docker-compose up -d --build
```

访问地址:

- 前端: http://localhost:8080
- 后端 API: http://localhost:8000
- Swagger: http://localhost:8000/docs

停止服务:

```bash
docker-compose down
```

### 本地开发

后端:

```bash
cd /home/msylgj/sin29-champion-points-system
cp .env.example .env
# 把 .env 里的 SECRET_KEY 改成你的 sha256 密文

cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

后端会优先读取项目根目录 `.env` 中的 `DATABASE_URL`；如果未提供，则自动用 `DB_USER`、`DB_PASSWORD`、`DB_HOST`、`DB_PORT`、`DB_NAME` 组合出 PostgreSQL 连接串。

前端:

```bash
cd frontend
npm install
npm run dev
```

## 认证说明

系统使用“管理员密码 + JWT”模式保护管理功能。

- 登录接口: `POST /api/auth/login`
- 请求体: `{ "password": "密码" }`
- 成功后返回 `access_token`，前端会自动写入 `localStorage.admin_auth_token`
- 后续管理 API 通过 `Authorization: Bearer <token>` 访问

### SECRET_KEY 配置

`SECRET_KEY` 需配置为“明文密码的 SHA-256 十六进制字符串”。

生成命令:

```bash
echo -n '你的明文密码' | sha256sum | awk '{print $1}'
```

将输出写入 `.env` 的 `SECRET_KEY`。

`DEBUG` 支持 `true/false`、`1/0`、`debug/release` 等常见写法；建议在生产环境使用 `False`。

## API Docs（按当前实现）

### 公开接口

- `GET /`
- `POST /api/auth/login`
- `GET /api/events/years`
- `GET /api/scores/annual-ranking/{year}/{bow_type}`
- `GET /api/dictionaries`

### 需认证接口（管理）

- 赛事
  - `GET /api/events`
  - `GET /api/events/{event_id}`
  - `POST /api/events/with-configs`
- 赛事配置
  - `POST /api/event-configurations`
  - `PUT /api/event-configurations/{config_id}`
  - `DELETE /api/event-configurations/{config_id}`
- 成绩
  - `GET /api/scores`
  - `PUT /api/scores/{score_id}`
  - `DELETE /api/scores/{score_id}`
  - `POST /api/scores/batch/import`

## 项目结构

```text
.
├── frontend/
├── backend/
├── database/
│   └── init.sql
├── README.md
├── QUICK_START.md
└── DATABASE_DESIGN.md
```

## 文档导航

- 快速启动与验收: [QUICK_START.md](QUICK_START.md)
- 数据库结构: [DATABASE_DESIGN.md](DATABASE_DESIGN.md)
- 积分计算实现: [backend/app/services/scoring_calculator.py](backend/app/services/scoring_calculator.py)
