# 快速开始指南

## 系统架构概览

射箭赛事积分统计系统已经重构为**三个简洁的功能页面**：

```
┌─────────────────────────────────────────────────┐
│  📱 移动 Web 应用 (Vue 3 + Vite)                 │
├─────────────────────────────────────────────────┤
│                                                   │
│  📅 页面1: 赛事管理                               │
│     ↓ 创建赛事 + 配置参赛信息                     │
│  POST /api/events/with-configs                  │
│                                                   │
│  📊 页面2: 成绩导入                               │
│     ↓ 选择赛事，导入选手成绩                      │
│  POST /api/scores/batch/import                  │
│                                                   │
│  🏆 页面3: 积分排名                               │
│     ↓ 查看年度弓种排名                            │
│  GET /api/scores/annual-ranking/{year}/{bow}   │
│                                                   │
└─────────────────────────────────────────────────┘
         ↓ HTTP/REST API
┌─────────────────────────────────────────────────┐
│  🔧 后端 API 服务 (FastAPI + SQLAlchemy)        │
├─────────────────────────────────────────────────┤
│                                                   │
│  核心业务逻辑:                                    │
│  ├── 赛事和配置管理                               │
│  ├── 成绩导入和查询                               │
│  ├── 动态积分计算                                 │
│  └── 年度排名聚合                                 │
│                                                   │
└─────────────────────────────────────────────────┘
         ↓ SQL
┌─────────────────────────────────────────────────┐
│  💾 数据库 (PostgreSQL)                          │
├─────────────────────────────────────────────────┤
│                                                   │
│  核心表:                                          │
│  ├── events (赛事)                               │
│  ├── event_configurations (赛事配置)              │
│  ├── scores (成绩)                               │
│  └── 字典表 (弓种、距离、赛制)                     │
│                                                   │
└─────────────────────────────────────────────────┘
```

## 环境要求

- **Python 3.8+**
- **Node.js 16+**
- **PostgreSQL 12+**

## 环境变量配置

### 后端 (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/archery_db
DEBUG=True
CORS_ORIGINS=["http://localhost:5173", "http://localhost:3000"]
```

### 前端 (.env.development)
```env
VITE_API_BASE_URL=http://localhost:8000/api
```

## 详细启动步骤

### 第1步：数据库准备

#### 方式A：使用现有脚本（推荐）
```bash
cd /home/msylgj/sin29-champion-points-system

# 创建数据库（如果还不存在）
createdb archery_db

# 运行初始化脚本
psql archery_db < database/init.sql
```

#### 方式B：手动初始化
```bash
# 连接到 PostgreSQL
psql

# 创建数据库
CREATE DATABASE archery_db;

# 连接到新数据库
\c archery_db

# 运行初始化脚本
\i /home/msylgj/sin29-champion-points-system/database/init.sql
```

### 第2步：启动后端服务

```bash
cd /home/msylgj/sin29-champion-points-system/backend

# 安装依赖（首次）
pip3 install -r requirements.txt

# 启动 FastAPI 服务
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**预期输出：**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

### 第3步：启动前端应用

```bash
cd /home/msylgj/sin29-champion-points-system/frontend

# 安装依赖（首次）
npm install

# 启动开发服务器
npm run dev
```

**预期输出：**
```
  VITE v7.1.12  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

## 访问应用

打开浏览器，访问：
```
http://localhost:5173
```

## 功能测试流程

### 📅 步骤1：创建赛事（赛事管理页面）

1. 打开应用，进入 **赛事管理** 页面
2. 输入基本信息：
   - 年度：2024
   - 赛季：Q1
3. 添加配置（点击"+ 添加配置"可添加多个）：
   - **配置1**：
     - 弓种：反曲弓 (recurve)
     - 距离：30m
     - 赛制：排名赛 (ranking)
     - 参赛人数：24
   - **配置2**：
     - 弓种：反曲弓 (recurve)
     - 距离：18m
     - 赛制：排名赛 (ranking)
     - 参赛人数：20
4. 点击 **保存赛事**

**预期结果：** 赛事创建成功提示，自动跳转到成绩导入页面

### 📊 步骤2：导入成绩（成绩导入页面）

1. 进入 **成绩导入** 页面
2. 选择刚才创建的赛事 "2024 Q1"
3. 显示赛事配置信息（应显示刚才创建的两个配置）
4. 选择 **逐条录入** 标签页
5. 逐条添加成绩：

   **第1条成绩：**
   - 姓名：张三
   - 俱乐部：北京俱乐部
   - 弓种：反曲弓
   - 距离：30m
   - 赛制：排名赛
   - 排名：1
   - 点击 "+ 添加成绩"

   **第2条成绩：**
   - 姓名：李四
   - 俱乐部：上海俱乐部
   - 弓种：反曲弓
   - 距离：30m
   - 赛制：排名赛
   - 排名：2
   - 点击 "+ 添加成绩"

   **第3条成绩：**
   - 姓名：张三
   - 俱乐部：北京俱乐部
   - 弓种：反曲弓
   - 距离：18m
   - 赛制：排名赛
   - 排名：2

6. 查看 **待导入成绩** 列表（应显示3条）
7. 点击 **确认导入 (3条)** 提交

**预期结果：** 成绩导入成功提示，自动跳转到积分查看页面

### 🏆 步骤3：查看积分排名（积分查看页面）

1. 进入 **积分排名** 页面
2. 选择条件：
   - 年度：2024
   - 弓种：反曲弓 (recurve)
3. 自动加载排名数据

**预期结果：** 显示排名表，包含：

| 排名 | 姓名 | 俱乐部 | 积分 | 参赛次数 |
|-----|-----|--------|------|---------|
| 1 | 张三 | 北京俱乐部 | 182.0 | 2次 |
| 2 | 李四 | 上海俱乐部 | 101.0 | 1次 |

**说明：**
- 张三的积分 = 30m排名赛第1名积分 (91) + 18m排名赛第2名积分 (91)
- 李四的积分 = 30m排名赛第2名积分 (101)
- 实际积分值取决于参赛人数系数，上方是参考值

**详细信息：** 点击前8名卡片查看每场比赛的分数构成

## API 文档快速参考

### 赛事相关 API

#### 创建赛事（带配置）
```bash
POST /api/events/with-configs
Content-Type: application/json

{
  "year": 2024,
  "season": "Q1",
  "configurations": [
    {
      "bow_type": "recurve",
      "distance": "30m",
      "format": "ranking",
      "participant_count": 24
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
GET /api/events/1
```

### 成绩相关 API

#### 批量导入成绩
```bash
POST /api/scores/batch/import
Content-Type: application/json

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
    }
  ]
}
```

#### 获取单个赛事排名（单弓种单距离）
```bash
GET /api/scores/event/1/ranking?bow_type=recurve&distance=30m&format=ranking
```

#### 获取年度弓种排名（跨赛事聚合）
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
      "total_points": 182.0,
      "highlight": true,
      "scores": [
        {
          "event_id": 1,
          "event_season": "2024 Q1",
          "distance": "30m",
          "format": "ranking",
          "rank": 1,
          "points": 91.0
        },
        {
          "event_id": 1,
          "event_season": "2024 Q1",
          "distance": "18m",
          "format": "ranking",
          "rank": 2,
          "points": 91.0
        }
      ]
    }
  ]
}
```

## 常见问题和解决方案

### Q1: 后端启动失败，显示 "ModuleNotFoundError"
**解决方案：** 确保安装了所有依赖
```bash
cd backend
pip3 install -r requirements.txt
```

### Q2: 数据库连接失败
**解决方案：**
1. 确认 PostgreSQL 正在运行
2. 检查 `.env` 中的 `DATABASE_URL` 是否正确
3. 确认数据库已创建：`psql archery_db`

### Q3: 前端空白页面
**解决方案：**
1. 打开浏览器开发者工具（F12）
2. 检查 Console 标签中的错误信息
3. 确认 API_BASE_URL 配置正确

### Q4: 成绩导入后看不到数据
**解决方案：**
1. 确认已选择正确的年度和弓种
2. 检查浏览器开发者工具中是否有 API 错误
3. 查看后端日志是否有错误信息

## 性能测试数据

系统支持的规模：
- **赛事数量**：无限制
- **单个赛事配置数**：建议 100 以内
- **成绩记录**：单赛事建议 10,000 以内
- **参赛人数**：单配置 1-999 人

## 数据导出

### 导出年度排名 CSV

在积分查看页面，查看完排名后，点击 **📥 导出为CSV**，将下载包含以下列的 CSV 文件：

```csv
排名,姓名,俱乐部,积分,参赛次数
1,张三,北京俱乐部,182.0,2
2,李四,上海俱乐部,101.0,1
```

## 生产环境部署

### 使用 Docker Compose（推荐）

```bash
cd /home/msylgj/sin29-champion-points-system

# 启动所有服务
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 手动部署

1. **后端**：使用 Gunicorn + Nginx
   ```bash
   pip install gunicorn
   gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
   ```

2. **前端**：构建静态资源
   ```bash
   npm run build
   # 使用 Nginx 或其他 Web 服务器提供 dist/ 目录
   ```

3. **数据库**：使用生产级 PostgreSQL 实例

## 常用命令速查表

```bash
# 后端相关
cd backend && python3 -m uvicorn app.main:app --reload

# 前端相关
cd frontend && npm run dev

# 数据库相关
psql archery_db < database/init.sql        # 初始化数据库
psql archery_db -c "SELECT COUNT(*) FROM scores;"  # 查询成绩数量

# 开发相关
cd backend && python3 -m pytest tests/       # 运行测试（如配置）
cd frontend && npm run lint                 # 代码检查
```

## 获取帮助

- 📖 查看完整实现文档：`IMPLEMENTATION_SUMMARY.md`
- 🗄️ 数据库设计文档：`DATA_BASE_DESIGN_V2.md`
- 📋 架构设计文档：`ARCHITECTURE.md`
- 🛠️ 检查后端日志：`backend/logs/`

---

祝您使用愉快！如有任何问题，欢迎反馈。
