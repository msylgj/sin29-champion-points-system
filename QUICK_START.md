# QUICK START

本文档说明当前项目的启动方式、运行依赖、认证方式和基础验收路径。

## 1. 运行依赖

### Docker 方式

- Docker
- Docker Compose

### 本地开发方式

- Python 3.11+
- Node.js 20+
- PostgreSQL 15

## 2. 环境变量

项目根目录需要 `.env` 文件，当前代码会读取以下变量：

- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_PORT`
- `POSTGRES_DATA_PATH`
- `BACKEND_PORT`
- `FRONTEND_PORT`
- `VITE_ALLOWED_HOSTS`
- `SECRET_KEY`

说明：

- `SECRET_KEY` 不是随机字符串，而是“管理员明文密码的 SHA-256 十六进制字符串”
- `backend/app/security.py` 会用用户输入的明文密码做 SHA-256 后与 `SECRET_KEY` 比对

生成密码哈希示例：

```bash
echo -n '你的管理密码' | sha256sum | awk '{print $1}'
```

## 3. Docker 启动

在项目根目录执行：

```bash
cd sin29-champion-points-system
docker-compose up -d --build
```

启动后访问：

- 前端：`http://localhost:8080`
- 后端：`http://localhost:8000`
- OpenAPI：`http://localhost:8000/docs`

停止服务：

```bash
docker-compose down
```

删除容器和数据卷：

```bash
docker-compose down -v
```

查看服务状态：

```bash
docker-compose ps
```

查看后端日志：

```bash
docker-compose logs -f backend
```

## 4. 本地开发启动

### 4.1 初始化数据库

```bash
cd sin29-champion-points-system
createdb archery_db
psql archery_db < database/init.sql
```

### 4.2 启动后端

```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL='postgresql://archery_user:archery_pass@localhost:5432/archery_db'
export SECRET_KEY='replace_with_sha256_hex'
python -m uvicorn app.main:app --reload --port 8000
```

### 4.3 启动前端

```bash
cd frontend
npm install
npm run dev
```

## 5. 当前页面入口

- `http://localhost:8080/points-display`
  - 年度积分排名
- `http://localhost:8080/event-add`
  - 赛事配置、报名导入、报名管理
  - 需要管理员认证
- `http://localhost:8080/score-import`
  - 成绩导入、成绩管理
  - 需要管理员认证

根路径 `/` 会自动跳转到 `/points-display`。

## 6. 管理认证流程

当前管理认证流程如下：

1. 从积分页点击“管理”进入管理功能
2. 若本地没有 `admin_auth_token`，会弹出密码输入框
3. 前端调用：

```text
POST /api/auth/login
```

4. 登录成功后，token 保存到：

```text
localStorage.admin_auth_token
```

5. 后续所有管理接口自动带 `Authorization: Bearer <token>`

## 7. 当前接口清单

### 公开接口

- `GET /`
- `POST /api/auth/login`
- `GET /api/events/years`
- `GET /api/dictionaries`
- `GET /api/scores/annual-ranking/{year}/{bow_type}`

### 管理接口

赛事：

- `GET /api/events`
- `GET /api/events/{event_id}`
- `POST /api/events/with-configs`

赛事配置：

- `POST /api/event-configurations`
- `PUT /api/event-configurations/{config_id}`
- `DELETE /api/event-configurations/{config_id}`

赛事报名：

- `GET /api/event-registrations`
- `POST /api/event-registrations/batch/import`
- `PUT /api/event-registrations/{registration_id}`
- `DELETE /api/event-registrations/{registration_id}`

成绩：

- `GET /api/scores`
- `POST /api/scores/batch/import`
- `PUT /api/scores/{score_id}`
- `DELETE /api/scores/{score_id}`

## 8. 当前导入能力

### 报名导入

- 页面：`/event-add`
- 文件格式：仅支持 Excel（`.xlsx`、`.xls`）
- 必需列：
  - `姓名`
  - `俱乐部`
  - `距离`
  - `比赛弓种`
  - `积分弓种`
  - `分组`

### 成绩导入

- 页面：`/score-import`
- 文件格式：仅支持 Excel（`.xlsx`、`.xls`）
- 必需列：
  - `姓名`
  - `弓种`
  - `距离`
  - `赛制`
  - `排名`

说明：

- 成绩导入会按 `姓名 + 距离 + 弓种` 到当前赛事报名表中匹配记录
- 未找到报名记录的成绩会被标记为异常

## 9. 当前最小验收路径

### 9.1 基础访问

1. 打开积分页
2. 能看到年度、弓种、姓名、俱乐部筛选
3. 能查看年度积分排名

### 9.2 管理认证

1. 点击“管理”
2. 输入错误密码，提示认证失败
3. 输入正确密码，能进入管理页面

### 9.3 赛事配置与报名

1. 进入 `/event-add`
2. 选择赛年、赛季
3. 导入报名 Excel
4. 页面出现“已导入报名”列表
5. 赛事配置中的个人人数会按报名自动统计
6. 保存赛事配置后，赛事存在且配置持久化

### 9.4 成绩导入与管理

1. 进入 `/score-import`
2. 选择赛事
3. 导入成绩 Excel
4. 若成绩没有对应报名记录，页面应提示异常
5. 导入成功后，成绩管理区能看到当前赛事成绩
6. 可编辑、保存、删除成绩
