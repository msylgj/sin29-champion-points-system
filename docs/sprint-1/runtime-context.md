# Sprint 1 Runtime Context

## 快照元数据

- 日期：2026-09-28
- 分支：`kixpower/sprint-1-import`
- 基线 HEAD：`98e9760a469912dd0c4606b059cfd387793ba7b4`
- 操作系统：Linux
- Python：3.13.5
- npm：10.9.8
- Docker：29.8.0

## 环境变量 Keys

代码与 Compose 可见的运行时配置包括：

- 后端：`DATABASE_URL`、`SECRET_KEY`、`DEBUG`、`PYTHONUNBUFFERED`。
- 数据库：`DB_USER`、`DB_PASSWORD`、`DB_NAME`、`DB_PORT`、`POSTGRES_DATA_PATH`。
- 端口：`BACKEND_PORT`、`FRONTEND_PORT`。
- 前端开发服务：`VITE_ALLOWED_HOSTS`。
- 镜像：`DOCKERHUB_NAMESPACE`、`IMAGE_TAG`（生产 Compose 使用）。

未读取或记录任何实际密码、token 或用户数据。

## 数据库 Schema 事实

`database/init.sql` 定义以下核心表：

- 字典：`bow_types`、`distances`、`competition_formats`、`competition_gender_groups`、`competition_groups`。
- 业务：`events`、`event_registrations`、`event_configurations`、`scores`。
- 关键约束：赛事、报名、赛事配置和成绩各自具有唯一键；成绩与配置通过 `event_id` 关联赛事并级联删除。

本次只读 SQL 文件，未连接数据库，未执行任何 SQL。

## 服务与依赖

- `database`：PostgreSQL 15 Alpine，默认数据目录绑定 `./data/postgres`。
- `backend`：FastAPI/Uvicorn，依赖数据库健康检查。
- `frontend`：Vue/Vite 开发服务，依赖后端。
- Python 依赖固定版本见 `backend/requirements.txt`。
- Node 依赖与脚本见 `frontend/package.json`。

## 测试资产

- 后端 Pytest 文件：8 个。
- 前端 Vitest 文件：7 个。
- 合计测试文件：15 个。
- 综合入口：`full-integrity-test.sh`。

## 漂移登记

1. `full-integrity-test.sh` 通过 `PROJECT_DIR` 推导大多数路径，但 Python AST 检查块将后端目录写死为 `/home/msylgj/sin29-champion-points-system/backend/app`。这在当前机器可能通过，但复制到其他目录会漏检或失败；待真实 gate 证实后决定是否作为最高优先级修复。
2. README 声明 PostgreSQL 为运行数据库，但综合单元测试默认使用 SQLite。该做法保护用户数据且适合 local gate，不过不能证明 PostgreSQL 方言与初始化链路完全兼容。
3. 仓库存在 `.github/workflows/ci.yml` 与 `.github/workflows/docker.yml`；QA 已确认当前 SHA 对应的 GitHub Actions run `31465749301` 与 `31465867884` 均为 `completed/success`。
4. 源码、测试和主要文档中未发现 `TODO`、`FIXME`、`XXX` 或 `HACK` 标记。

## 数据安全边界

- local gate 显式设置 `DATABASE_URL=sqlite:///./test.db`。
- 不运行 Docker 服务启动命令，只做 Compose 静态配置校验。
- 不触碰 `data/postgres`，不执行 `DROP`、`TRUNCATE` 或 `DELETE`。

## Dev 执行证据

- `docker compose -f docker-compose.yml config -q && docker compose -f docker-compose.prod.yml config -q`：exit 0。
- `cd backend && DATABASE_URL=sqlite:///./test.db python3 -m pytest tests -q`：exit 0，63 passed in 9.41s。
- `cd frontend && npm run lint`：exit 0。
- `cd frontend && npm run test:run`：exit 0，8 files、25 tests。
- `cd frontend && npm run build`：exit 0，96 modules transformed。
- `DATABASE_URL=sqlite:///./test.db ./full-integrity-test.sh`：exit 0，10/10 步通过。

## 缺陷裁决

所有真实门禁通过，未发现明确 P0/P1 缺陷，因此未修改应用代码。脚本 AST 检查的绝对路径不影响当前仓库执行，登记为 P2 可移植性风险；不在本 Sprint 顺手修复。

## 最终环境差异

测试生成物 `backend/test.db` 与 `frontend/dist` 均由现有 ignore 规则排除；未启动服务，未改动 `data/postgres`。
