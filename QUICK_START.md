# 快速开始

本文说明环境配置、启动和基础验收。业务功能见[项目概览](README.md)，既有安装的版本升级见[变更记录](CHANGELOG.md)。

## 1. 环境配置

容器运行需要 Docker 和 Compose v2；本地开发需要 Python 3.11、Node.js 20.19+（20.x）或 22.12+、PostgreSQL 15。Compose 从项目根目录的环境读取以下配置，示例见 [.env.example](.env.example)：

| 变量 | 用途 |
| --- | --- |
| `DB_USER`、`DB_PASSWORD`、`DB_NAME` | PostgreSQL 账号、密码、库名 |
| `POSTGRES_DATA_PATH` | PostgreSQL 的宿主机数据目录，默认 `./data/postgres` |
| `DB_PORT`、`BACKEND_PORT`、`FRONTEND_PORT` | 宿主机端口，默认 5432、8000、8080 |
| `SECRET_KEY` | 管理口令的 SHA-256 十六进制值，同时用于管理 JWT 签名及校验 |
| `DEBUG`、`VITE_ALLOWED_HOSTS` | 开发模式后端调试选项及 Vite 主机白名单 |
| `DOCKERHUB_NAMESPACE`、`IMAGE_TAG` | 生产镜像的命名空间和实际已发布标签；请显式设置两者 |

复制示例后填写实际值；为数据库和管理功能分别设置强口令，不使用示例值。以下方式可生成管理口令哈希，避免把明文写进命令历史：

```bash
cp .env.example .env
read -rsp '管理口令: ' admin_password; printf '\n'
printf '%s' "$admin_password" | sha256sum | cut -d ' ' -f 1
unset admin_password
```

将输出的哈希填入 `SECRET_KEY` 并妥善保管。网页验证时输入原始管理口令，非哈希。后端验证成功签发默认有效期 30 分钟的 JWT。

## 2. 容器部署

在项目根目录配置好环境后，二选一。生产模式只拉取镜像，不构建本地源码；请设置实际已发布的 `IMAGE_TAG`，虽然 Compose 在标签为空时回退到 `latest`，本项目的发布工作流不推送该标签。示例中的 `1.5` 是旧版标签，不包含本次未发布的规则管理功能；要验证本地代码，请使用开发模式。不要同时用同一个 PostgreSQL 数据目录运行两套环境。

```bash
# 开发：本地构建，代码热重载
docker compose up -d --build
# 生产：预构建镜像，指定发布标签便于复现
docker compose -f docker-compose.prod.yml up -d
```

默认前端入口为 `http://localhost:8080/points-display`，后端为 `http://localhost:8000`，OpenAPI 为 `http://localhost:8000/docs`。实际端口以环境配置为准。部署时在外部代理启用 HTTPS，并限制数据库和后端端口的访问范围。

查看状态、日志、停止时使用同一个 Compose 文件：

```bash
docker compose ps
docker compose logs -f backend
docker compose down
# 生产模式在 compose 后添加 -f docker-compose.prod.yml
```

也可用 [启动脚本](start.sh)和[停止脚本](stop.sh)，传入 `dev` 或 `prod` 选择相同部署模式。停止或移除容器不会清空宿主机数据目录。`down -v` 删除 Compose 管理的卷（开发模式包含前端匿名依赖卷），**不会**删除绑定的 PostgreSQL 数据目录。

## 3. 本地开发

1. 在 PostgreSQL 中创建有数据库访问权限的应用角色和由其拥有的数据库。仅对**空数据库**，使用有权限的账号运行 [初始化脚本](database/init.sql)，确保字典已经填充后再启动后端。示例：

   ```bash
   psql -h 127.0.0.1 -U archery_user -d archery_db -v ON_ERROR_STOP=1 -f database/init.sql
   ```

2. 在一个终端中启动 FastAPI。后端直接从进程环境读取配置；请按实际账号、口令、地址和数据库设置连接串。排位记分纸生成需要中文 TrueType 字体；Debian/Ubuntu 可安装 `fonts-droid-fallback`（容器镜像已安装）。

   ```bash
   cd backend
   python -m pip install -r requirements.txt
   export DATABASE_URL='postgresql://archery_user:YOUR_DB_PASSWORD@127.0.0.1:5432/archery_db'
   export SECRET_KEY='YOUR_ADMIN_PASSWORD_SHA256'
   python -m uvicorn app.main:app --reload --port 8000
   ```

3. 在另一个终端中启动前端，将同源 `/api` 请求代理到本地后端。Compose 开发模式仍使用容器内的 `http://backend:8000`。

   ```bash
   cd frontend
   npm ci
   VITE_API_PROXY_TARGET=http://127.0.0.1:8000 npm run dev
   ```

## 4. 验收与测试

- 访问积分首页并选择年度、弓种；确认排名及年度/赛季导出可用。
- 点击「管理」验证口令，检查赛事清单、报名与成绩统计，以及所选赛事的配置和导入入口。确认常规保存后回到清单，向导完成后回到积分排名；会话失效后重新验证，确认可回到原管理页。
- 在测试环境准备报名和成绩 Excel，检查报名同步、个人赛报名预校验和积分明细。发布和删除规则可改变已有赛事的积分结果，应使用测试赛季验证。

本地安装后端依赖及 `pytest`、前端执行 `npm ci` 后，可运行 [完整性检查脚本](full-integrity-test.sh)。脚本只使用内存 SQLite 做后端测试，不读取部署数据库连接配置，并用 Compose 配置校验、前端 lint、测试和构建覆盖另外的入口；没有 Compose v2 时只跳过配置校验。真实 PostgreSQL 的部署验收应使用隔离的测试环境。
