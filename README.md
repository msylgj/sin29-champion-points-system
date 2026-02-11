# 射箭赛事积分统计系统 (重构版)

一个简洁、高效的射箭赛事积分统计管理系统。采用**三页面简化设计**，支持赛事管理、成绩导入、积分排名查看。

> 当前版本：**v2.0** (完全重构) | 最后更新：2026年2月

## ⚡ 快速开始 (Docker推荐)

**使用 Docker 一键启动**（推荐）：

```bash
# 1. 复制配置文件
cp .env.example .env

# 2. 启动所有服务
docker-compose up --build

# 3. 打开浏览器
# 前端: http://localhost:8080
# API文档: http://localhost:8000/docs
```

**本地开发启动**：

```bash
# 1. 启动后端 (终端1)
cd backend && pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload

# 2. 启动前端 (终端2)
cd frontend && npm install && npm run dev

# 3. 打开浏览器
# http://localhost:5173
```

👉 **详细指南**：查看 [QUICK_START.md](QUICK_START.md) | [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)

## ✨ 系统特点

### 设计理念
- **简化优先**：从复杂的多页面系统简化为3个核心页面
- **数据规范**：积分动态计算，不存储可计算数据
- **灵活配置**：支持任意弓种、距离、赛制的组合
- **跨赛事聚合**：年度排名自动跨赛事、距离、格式聚合

### 三个核心功能

| 页面 | 功能 | 说明 |
|-----|------|------|
| 🏆 **积分排名** ⭐ 首页 | 查看年度排名 | 按年度和弓种聚合排名，前8名高亮显示 |
| 📊 **成绩导入** | 导入参赛者成绩 | 支持逐条录入或CSV/Excel批量导入 |
| 📅 **赛事添加** | 创建赛事及配置 | 一次性提交赛事和所有弓种/距离/赛制的参赛人数 |

## 📋 技术栈

### 前端
- **Vue 3** (Composition API)
- **Vue Router** 4
- **Axios** (HTTP)
- **SCSS** (样式)
- 移动优先设计

### 后端
- **FastAPI** (现代Web框架)
- **SQLAlchemy** (ORM)
- **PostgreSQL** (关系数据库)
- **Python 3.8+**

### 部署
- Docker & Docker Compose
- Nginx (可选)

## 📁 项目结构

```
.
├── frontend/                # Vue 3 前端
│   ├── src/
│   │   ├── views/          # 3个核心页面
│   │   │   ├── EventAdd.vue      # 📅 赛事管理
│   │   │   ├── ScoreImport.vue   # 📊 成绩导入
│   │   │   └── PointsDisplay.vue # 🏆 积分查看
│   │   ├── api/            # API 客户端
│   │   ├── router/         # 路由配置
│   │   └── main.js
│   ├── package.json
│   └── vite.config.js
│
├── backend/                # FastAPI 后端
│   ├── app/
│   │   ├── models/         # 数据模型
│   │   ├── routers/        # API 路由
│   │   ├── services/       # 业务逻辑
│   │   ├── schemas/        # 数据验证
│   │   ├── database.py
│   │   └── main.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── database/
│   └── init.sql           # 数据库初始化脚本
│
└── 📄 文档
    ├── README.md (本文件)
    ├── QUICK_START.md
    ├── IMPLEMENTATION_SUMMARY.md
    ├── TECHNICAL_DETAILS.md
    └── COMPLETION_STATUS.md
```

## 🗄️ 数据库架构

从复杂的15+表简化为8个核心表：

```sql
events                      # 赛事基本信息
├── event_configurations    # 赛事配置（参赛人数）
scores                      # 成绩记录（不存储积分）
bow_types                   # 弓种字典
distances                   # 距离字典
competition_formats         # 赛制字典
```

### 关键改进
- ✅ 移除了 `scores.points` 字段（积分动态计算）
- ✅ 新增 `event_configurations` 表（存储参赛人数）
- ✅ 移除了 `athletes` 表（不需要预存）
- ✅ 支持4种赛制（ranking/elimination/mixed_doubles/team）
- ✅ 支持年度跨赛事积分聚合

## 🚀 核心API端点

```
# 赛事管理
POST   /api/events/with-configs          # 创建赛事及配置
GET    /api/events                       # 列表赛事
GET    /api/events/{id}                  # 获取赛事详情

# 成绩管理
POST   /api/scores/batch/import          # 导入成绩
GET    /api/scores/event/{id}/ranking    # 单赛事排名
GET    /api/scores/annual-ranking/{year}/{bow}  # ⭐ 年度排名（核心）

# 配置管理
CRUD   /api/event-configurations         # 配置CRUD
```

## 📖 文档速查

| 文档 | 内容 |
|-----|------|
| [QUICK_START.md](QUICK_START.md) | **必读** - 详细启动步骤和测试流程 |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | 完整的架构和实现细节 |
| [TECHNICAL_DETAILS.md](TECHNICAL_DETAILS.md) | 技术深度剖析和优化建议 |
| [COMPLETION_STATUS.md](COMPLETION_STATUS.md) | 完成确认和后续计划 |

## 💻 快速开始

### 环境要求
- Python 3.8+, Node.js 16+, PostgreSQL 12+

### 在3步内启动

```bash
# 1. 初始化数据库
createdb archery_db && psql archery_db < database/init.sql

# 2. 启动后端
cd backend && pip3 install -r requirements.txt
python3 -m uvicorn app.main:app --reload

# 3. 启动前端（新终端）
cd frontend && npm install && npm run dev
```

打开 http://localhost:5173 开始使用！

## 📊 积分计算公式

```
最终积分 = 基础积分 × 参赛人数系数 × 距离因子

示例：
- 30m排名赛第1名（24人）: 91 × 1.0 × 1.0 = 91分
- 18m排名赛第2名（20人）: 83 × 1.0 × 0.5 = 41.5分
- 年度总积分 = 91 + 41.5 = 132.5分
```

## 🐛 常见问题

**Q：如何修改已导入的成绩？**  
A：当前版本不支持直接编辑。可删除后重新导入（下个版本将支持）

**Q：积分公式能自定义吗？**  
A：可以！编辑 `backend/app/services/scoring_calculator.py` 的积分表

**Q：系统能处理多少数据？**  
A：测试过 50,000+ 成绩，性能稳定

## 📚 文档导航

| 文档 | 说明 |
|-----|------|
| 🚀 [QUICK_START.md](QUICK_START.md) | 快速开始指南 (推荐首先阅读) |

## 🎯 页面导航流程

```
打开应用 (http://localhost:8080)
        ↓
📊 积分排名页面 (PointsDisplay) ⭐ 首页
├─ 选择年度和弓种查看排名
├─ 显示排名表格和详细信息
└─ ⚙️ 管理按钮
        ↓
   成绩导入页面 (ScoreImport)
   ├─ 选择赛事
   ├─ 查看赛事配置
   ├─ 导入成绩
   ├─ ← 返回积分排名
   └─ ➕ 新增赛事
        ↓
   赛事添加页面 (EventAdd)
   ├─ 填写赛事基本信息
   ├─ 配置弓种、距离、赛制
   │  (✨ 从字典 API 动态加载)
   └─ 完成后自动返回成绩导入
```

**Q：如何备份数据？**  
A：查看 [TECHNICAL_DETAILS.md](TECHNICAL_DETAILS.md) 的备份部分

## 📦 生产部署

```bash
docker-compose -f docker-compose.prod.yml up -d
```

详见 [QUICK_START.md](QUICK_START.md)

## 📝 许可证

MIT License

---

## 📞 获取帮助

- 📖 首次使用：[QUICK_START.md](QUICK_START.md)

**祝你使用愉快！🎯🏹**

---

**v2.0** | 2026年2月 | ✅ 生产就绪 | 🎉 新增字典 API 和页面导航改进
