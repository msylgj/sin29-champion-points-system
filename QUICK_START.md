# 快速开始指南

本指南涵盖详细的启动步骤、功能测试流程、API参考和常见问题解决方案。

## 📋 目录

- [前置条件](#前置条件)
- [快速启动（Docker）](#快速启动docker)
- [本地开发启动](#本地开发启动)
- [功能测试流程](#功能测试流程)
- [API 文档](#api-文档)
- [常见问题](#常见问题)
- [故障排除](#故障排除)
- [生产部署](#生产部署)

---

## 前置条件

### 要求
- **Docker & Docker Compose**（推荐方式）OR
- **Python 3.8+** + **Node.js 16+** + **PostgreSQL 12+**（本地开发）

### 环境检查
```bash
# 检查版本
python3 --version    # 应该 >= 3.8
node --version       # 应该 >= 16
docker --version     # 应该已安装（可选）
```

---

## 快速启动（Docker）

### 🚀 一键启动（推荐）

```bash
# 1. 进入项目目录
cd ./sin29-champion-points-system

# 2. 复制环境配置
cp .env.example .env

# 3. 启动所有服务
docker-compose up --build

# 4. 等待启动完成，见"预期输出"
```

### 预期输出

```
[+] Building 12.3s (XX/XX)
...
[+] Running XX/XX
 ✓ Container sin29_db       Running                    0.5s
 ✓ Container sin29_backend  Running                    2.3s
 ✓ Container sin29_frontend Running                    1.8s
```

### 访问应用

| 地址 | 说明 |
|-----|------|
| http://localhost:8080 | 前端应用（主应用） |
| http://localhost:8000/docs | 后端API文档（Swagger） |
| http://localhost:8000 | 后端API根地址 |

### 停止服务

```bash
# 原终端按 Ctrl+C，或在新终端运行：
docker-compose down

# 清理所有数据（包括数据库）
docker-compose down -v
```

### 后台运行（生产推荐）

```bash
# 后台启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 只查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f database

# 查看服务状态
docker-compose ps

# 停止
docker-compose down
```

---

## 本地开发启动

如果不使用 Docker，按以下步骤启动。

### 前提条件

1. **创建 PostgreSQL 数据库**
```bash
createdb archery_db
```

2. **初始化数据库**
```bash
psql archery_db < /home/msylgj/sin29-champion-points-system/database/init.sql
```

### 终端1：启动后端服务

```bash
cd /home/msylgj/sin29-champion-points-system/backend

# 首次安装依赖
pip install -r requirements.txt

# 启动服务
python -m uvicorn app.main:app --reload --port 8000
```

**预期输出：**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

✅ 后端就绪，访问 http://localhost:8000/docs

### 终端2：启动前端应用

```bash
cd /home/msylgj/sin29-champion-points-system/frontend

# 首次安装依赖
npm install

# 启动开发服务器
npm run dev
```

**预期输出：**
```
  VITE v7.1.12  ready in 234 ms

  ➜  Local:   http://localhost:8080/
  ➜  press h to show help
```

✅ 前端就绪，访问 http://localhost:8080

---

## 功能测试流程

按照以下步骤完整测试系统功能。

### 📅 第一步：创建赛事

进入应用后，自动显示**积分排名页面**。点击左上角的 **➕ 新增赛事** 按钮，转到赛事管理页面。

1. **填写赛事信息**
   - 年度：`2024`
   - 赛季：`Q1`

2. **添加配置1**（点击 **+ 添加配置**）
   - 弓种：`反曲弓` (recurve)
   - 距离：`30m`
   - 赛制：`排位赛` (ranking)
   - 参赛人数：`24`
   - 点击 **➕ 添加此配置**

3. **添加配置2**（点击 **+ 添加配置**）
   - 弓种：`反曲弓` (recurve)
   - 距离：`18m`
   - 赛制：`排位赛` (ranking)
   - 参赛人数：`20`
   - 点击 **➕ 添加此配置**

4. **提交**
   - 点击 **💾 保存赛事** 按钮

**预期结果：**
- ✅ 弹出"赛事创建成功"提示
- ✅ 自动跳转到**成绩导入页面**
- ✅ 赛事选择框中显示"2024 Q1"
- ✅ 显示两个配置信息

### 📊 第二步：导入成绩

在**成绩导入页面**：

1. **确认赛事已选择**
   - 应显示"2024 Q1"
   - 显示配置表（2个配置）

2. **选择"逐条录入"标签页**

3. **添加成绩1**
   ```
   姓名：张三
   俱乐部：北京俱乐部
   弓种：反曲弓
   距离：30m
   赛制：排位赛
   排名：1
   ```
   - 点击 **+ 添加成绩**

4. **添加成绩2**
   ```
   姓名：李四
   俱乐部：上海俱乐部
   弓种：反曲弓
   距离：30m
   赛制：排位赛
   排名：2
   ```
   - 点击 **+ 添加成绩**

5. **添加成绩3**
   ```
   姓名：张三
   俱乐部：北京俱乐部
   弓种：反曲弓
   距离：18m
   赛制：排位赛
   排名：2
   ```
   - 点击 **+ 添加成绩**

6. **查看待导入成绩列表**
   - 应显示"待导入成绩 (3条)"的表格

7. **确认导入**
   - 点击 **确认导入 (3条)** 按钮

**预期结果：**
- ✅ 弹出"成功导入 3 条成绩"提示
- ✅ 1.5秒后自动跳转到**积分排名页面**

### 🏆 第三步：查看积分排名

在**积分排名页面**（首页）：

1. **查看数据**
   - 年度自动选择为"2024"
   - 弓种自动选择为"反曲弓"
   - 自动显示排名表

2. **预期排名表**

| 排名 | 姓名 | 俱乐部 | 积分 | 参赛次数 |
|-----|-----|--------|------|---------|
| 1️⃣ | 张三 | 北京俱乐部 | 136 | 2次 |
| 2️⃣ | 李四 | 上海俱乐部 | 88 | 1次 |

**注意：** 具体积分值取决于参赛人数系数，上表为参考值。

3. **点击第1名卡片查看详细分数**
   ```
   张三的获奖情况：
   - 2024 Q1 30米排位赛：第1名，基础25分，经系数调整后68分
   - 2024 Q1 18米排位赛：第2名，基础22分，×0.5×系数后为44分
   - 年度总积分：136分
   ```

4. **Excel导出**
   - 点击 **📥 导出为Excel** 按钮
   - 下载包含排名数据的 Excel 文件

**预期结果：**
- ✅ 排名表显示正确数据
- ✅ 前8名高亮显示
- ✅ Excel导出成功

---

## 测试：批量导入功能

### 准备 Excel 文件

创建一个 Excel 文件 `test_scores.xlsx`，包含以下列（列顺序任意）：

| 姓名 | 俱乐部 | 弓种 | 距离 | 赛制 | 排名 |
|-----|--------|------|------|------|------|
| 王五 | 广州俱乐部 | 反曲弓 | 30m | 排位赛 | 3 |
| 赵六 | 深圳俱乐部 | 反曲弓 | 30m | 排位赛 | 4 |
| 孙七 | 杭州俱乐部 | 反曲弓 | 18m | 排位赛 | 3 |
| 周八 | 西安俱乐部 | 反曲弓 | 18m | 排位赛 | 4 |

### 导入步骤

1. 进入**成绩导入页面**，选择赛事"2024 Q1"
2. 选择**"批量导入"标签页**
3. 点击 **选择 Excel 或 CSV 文件** 按钮
4. 选择上面创建的 `test_scores.xlsx` 文件
5. 文件被正确解析，显示"成功解析 4 条成绩"
6. 点击 **确认导入 (4条)**

**预期结果：**
- ✅ 自动识别列标题
- ✅ 显示"成功解析 4 条成绩"
- ✅ 成功导入后自动跳转到积分排名页面
- ✅ 新增的4名选手出现在排名中

---

## API 文档

完整的API文档访问：**http://localhost:8000/docs** (Swagger UI)

### 赛事管理 API

#### 创建赛事（带配置）
```bash
POST /api/events/with-configs
```

**请求示例：**
```json
{
  "year": 2024,
  "season": "Q1",
  "configurations": [
    {
      "bow_type": "recurve",
      "distance": "30m",
      "format": "ranking",
      "participant_count": 24
    },
    {
      "bow_type": "recurve",
      "distance": "18m",
      "format": "ranking",
      "participant_count": 20
    }
  ]
}
```

**响应示例（成功）：**
```json
{
  "id": 1,
  "year": 2024,
  "season": "Q1",
  "configurations": [
    {
      "id": 1,
      "bow_type": "recurve",
      "distance": "30m",
      "format": "ranking",
      "participant_count": 24
    },
    {
      "id": 2,
      "bow_type": "recurve",
      "distance": "18m",
      "format": "ranking",
      "participant_count": 20
    }
  ]
}
```

#### 获取赛事列表
```bash
GET /api/events?page=1&page_size=10
```

#### 获取赛事详情
```bash
GET /api/events/{event_id}
```

### 成绩管理 API

#### 批量导入成绩
```bash
POST /api/scores/batch/import
```

**请求示例：**
```json
{
  "scores": [
    {
      "event_id": 1,
      "name": "张三",
      "club": "北京俱乐部",
      "bow_type": "recurve",
      "distance": "30m",
      "format": "ranking",
      "rank": 1
    },
    {
      "event_id": 1,
      "name": "李四",
      "club": "上海俱乐部",
      "bow_type": "recurve",
      "distance": "30m",
      "format": "ranking",
      "rank": 2
    }
  ]
}
```

#### 获取年度排名（核心API）
```bash
GET /api/scores/annual-ranking/{year}/{bow_type}
```

**示例：**
```bash
GET /api/scores/annual-ranking/2024/recurve
```

**响应示例：**
```json
{
  "year": 2024,
  "bow_type": "recurve",
  "athletes": [
    {
      "ranking": 1,
      "name": "张三",
      "club": "北京俱乐部",
      "total_points": 136.0,
      "highlight": true,
      "scores": [
        {
          "event_id": 1,
          "event_season": "2024 Q1",
          "distance": "30m",
          "format": "ranking",
          "rank": 1,
          "points": 68.0
        },
        {
          "event_id": 1,
          "event_season": "2024 Q1",
          "distance": "18m",
          "format": "ranking",
          "rank": 2,
          "points": 44.0
        }
      ]
    },
    {
      "ranking": 2,
      "name": "李四",
      "club": "上海俱乐部",
      "total_points": 88.0,
      "highlight": false,
      "scores": [
        {
          "event_id": 1,
          "event_season": "2024 Q1",
          "distance": "30m",
          "format": "ranking",
          "rank": 2,
          "points": 88.0
        }
      ]
    }
  ]
}
```

### 字典数据 API

#### 获取所有字典数据
```bash
GET /api/dictionaries
```

**响应示例：**
```json
{
  "bowTypes": [
    {"code": "recurve", "name": "反曲弓"},
    {"code": "compound", "name": "复合弓"},
    {"code": "barebow", "name": "光弓"},
    {"code": "traditional", "name": "传统弓"},
    {"code": "longbow", "name": "美猎弓"}
  ],
  "distances": [
    {"code": "18m", "name": "18米"},
    {"code": "30m", "name": "30米"},
    {"code": "50m", "name": "50米"},
    {"code": "70m", "name": "70米"}
  ],
  "competitionFormats": [
    {"code": "ranking", "name": "排位赛"},
    {"code": "elimination", "name": "淘汰赛"},
    {"code": "mixed_doubles", "name": "混双赛"},
    {"code": "team", "name": "团体赛"}
  ]
}
```

---

## 常见问题

### Q1: Docker 启动后浏览器连接超时
**A:** 这通常是因为服务还在启动中。
```bash
# 查看日志，等待看到 "Application startup complete"
docker-compose logs -f backend

# 查看容器状态
docker-compose ps
```

### Q2: 数据库连接失败（本地开发）
**A:** 检查以下几点：
```bash
# 1. 确认 PostgreSQL 运行中
psql --version

# 2. 确认数据库存在
psql archery_db -c "SELECT 1"

# 3. 检查 env 中的 DATABASE_URL
cat .env | grep DATABASE_URL

# 4. 重新初始化数据库
psql archery_db < database/init.sql
```

### Q3: 导入 Excel 时出现"无法解析文件"
**A:** 检查以下几点（按顺序）：
1. 确认文件格式为 `.xlsx` 或 `.xls`（不支持 `.xlsm` 等其他格式）
2. 确认Excel有表头行（第一行为列标题）
3. 确认列标题包含：姓名、俱乐部、弓种、距离、赛制、排名
4. 查看浏览器开发者工具 Console 标签的错误信息

### Q4: 导入成功但看不到数据
**A:** 检查以下几点：
1. 确认选择了正确的年度和弓种
2. 刷新页面（F5）
3. 打开浏览器开发者工具 Network 标签，查看 API 响应是否正确
4. 查看后端日志：`docker-compose logs backend`

### Q5: 前端显示"API连接失败"
**A:** 根据启动方式处理：

**Docker 方式：**
```bash
# 检查后端容器是否运行
docker-compose ps

# 查看后端日志
docker-compose logs backend
```

**本地开发：**
```bash
# 确认后端运行在 http://localhost:8000
# 检查前端 .env 文件中的 VITE_API_BASE_URL
cat frontend/.env.development
```

### Q6: Excel 导出按钮不工作
**A:** 
1. 确认已成功加载排名数据
2. 确认前端依赖完整（包含 xlsx 库）：
   ```bash
   cd frontend && npm list xlsx
   ```
3. 查看浏览器控制台错误信息

---

## 故障排除

### 清理和重新启动

#### Docker 完全清理
```bash
# 停止所有容器
docker-compose down

# 删除所有数据和镜像
docker-compose down -v
docker-compose down --rmi all

# 重新启动
docker-compose up --build
```

#### 本地开发重置
```bash
# 重建数据库
dropdb archery_db
createdb archery_db
psql archery_db < database/init.sql

# 清理前端缓存
cd frontend && rm -rf node_modules dist && npm install

# 清理后端缓存
cd backend && find . -type d -name __pycache__ -exec rm -r {} + 2>/dev/null; true

# 重新启动
```

### 检查日志

```bash
# Docker 方式
docker-compose logs backend        # 后端日志
docker-compose logs frontend       # 前端日志
docker-compose logs database       # 数据库日志
docker-compose logs -f --tail=100  # 最近100行，持续输出

# 本地开发
# 后端日志会直接在终端显示
# 前端日志也会直接在终端显示，或查看浏览器控制台
```

### 端口占用处理

```bash
# 查看占用 8080 端口的进程
lsof -i :8080

# 修改 .env 文件的端口配置
FRONTEND_PORT=8081
BACKEND_PORT=8001
DB_PORT=5433
```

---

## 生产部署

### Docker Compose 生产部署

```bash
# 使用生产配置文件
docker-compose -f docker-compose.prod.yml up -d --build

# 查看状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

### Systemd 服务（可选）

创建 `/etc/systemd/system/archery-scores.service`：
```ini
[Unit]
Description=Archery Scoring System
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/msylgj/sin29-champion-points-system
ExecStart=/usr/bin/docker-compose up
Restart=always

[Install]
WantedBy=multi-user.target
```

启用和启动：
```bash
sudo systemctl enable archery-scores
sudo systemctl start archery-scores
sudo systemctl status archery-scores
```

### 数据备份

```bash
# 备份数据库
docker-compose exec database pg_dump -U archery_user archery_db > backup.sql

# 恢复数据库
docker-compose exec -T database psql -U archery_user archery_db < backup.sql
```

---

## 常用命令速查

```bash
# 启动
docker-compose up --build
docker-compose up -d --build  # 后台启动

# 停止
docker-compose down
docker-compose down -v        # 删除数据

# 查看状态
docker-compose ps
docker-compose logs -f

# 重启服务
docker-compose restart
docker-compose restart backend

# 进入容器
docker exec -it sin29_backend bash
docker exec -it sin29_frontend bash

# 数据库命令
docker-compose exec database psql -U archery_user archery_db
```

---

## 获取帮助

- 📖 **[README.md](README.md)** - 项目概览和特性说明
- 🗄️ **[DATABASE_DESIGN_V2.md](DATABASE_DESIGN_V2.md)** - 数据库架构和表结构
- 🔗 **http://localhost:8000/docs** - 完整 API 文档（Swagger UI）
- 💻 **浏览器开发者工具** - F12 查看前端日志和网络请求

---

**祝您使用愉快！🎯🏹**
