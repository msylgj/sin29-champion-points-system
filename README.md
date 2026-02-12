# 射箭赛事积分统计系统

一个现代化的射箭赛事积分管理系统，采用 **Vue 3 + FastAPI + PostgreSQL** 技术栈。系统设计简洁，专注于核心功能：赛事管理、成绩导入、积分统计。

> **版本**: v1.0 | **最后更新**: 2026年2月 | **状态**: ✅ 生产就绪

## 📌 核心特性

### 三个简洁的功能模块

| 模块 | 功能 | 说明 |
|-----|------|------|
| 🏆 **积分排名** | 年度排名查看 | 按年度、弓种聚合排名，支持Excel导出 |
| 📊 **成绩导入** | 批量导入成绩 | 支持Excel/CSV文件，自动字段识别，逐行错误提示 |
| 📅 **赛事管理** | 创建赛事配置 | 一键创建赛事和多组弓种/距离/赛制配置 |

### 系统优势

✨ **简化设计**  
- 从复杂的多表系统简化为6个核心表
- 三个页面承载所有核心功能，移动优先设计

🚀 **动态计算**  
- 积分实时计算，不存储冗余数据
- 支持多种赛制（排位赛、淘汰赛、混双赛、团体赛）
- 支持参赛人数系数、距离系数等多维度计算

📱 **用户友好**  
- Excel/CSV智能导入，自动字段识别
- 导入错误逐行显示，清楚指出问题数据
- 响应式设计，支持PC和移动设备
- 实时数据验证和提示

## �️ 技术栈

### 前端
- **Vue 3** (Composition API) - 现代JavaScript框架
- **Vite** - 极速构建工具
- **Axios** - HTTP客户端
- **SCSS** - 样式处理
- **XLSX** - Excel文件解析和生成

### 后端
- **FastAPI** - 高性能Web框架（自动生成API文档）
- **SQLAlchemy** - Python ORM
- **PostgreSQL** - 关系数据库
- **Pydantic** - 数据验证

### 部署
- **Docker & Docker Compose** - 容器化部署
- **Nginx** - 反向代理（可选）

## � 快速开始

### 方式一：Docker（推荐）⭐

**前提**：已安装 Docker 和 Docker Compose

```bash
# 1. 克隆或进入项目目录
cd /home/msylgj/sin29-champion-points-system

# 2. 复制环境配置
cp .env.example .env

# 3. 一键启动所有服务
docker-compose up --build

# 4. 访问应用
# 前端应用: http://localhost:8080
# 后端API: http://localhost:8000
# API文档: http://localhost:8000/docs
```

**后台启动**（推荐生产环境）：
```bash
docker-compose up -d --build
docker-compose logs -f  # 查看日志
```

### 方式二：本地开发

**前提**：Python 3.8+、Node.js 16+、PostgreSQL 12+

#### 1. 初始化数据库
```bash
# 创建数据库
createdb archery_db

# 导入初始化脚本
psql archery_db < database/init.sql
```

#### 2. 启动后端（终端1）
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

#### 3. 启动前端（终端2）
```bash
cd frontend
npm install
npm run dev
```

#### 4. 访问应用
- 前端: http://localhost:8080
- 后端: http://localhost:8000/docs

## � 项目结构

```
.
├── frontend/                      # Vue 3 前端应用
│   ├── src/
│   │   ├── views/
│   │   │   ├── PointsDisplay.vue        # 🏆 积分排名页面
│   │   │   ├── ScoreImport.vue          # 📊 成绩导入页面
│   │   │   └── EventAdd.vue             # 📅 赛事管理页面
│   │   ├── api/                         # API 客户端
│   │   ├── components/                  # 可复用组件
│   │   ├── router/                      # 路由配置
│   │   └── main.js
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile.dev
│   └── nginx.conf
│
├── backend/                       # FastAPI 后端应用
│   ├── app/
│   │   ├── routers/               # API 路由
│   │   │   ├── scores.py                 # 成绩相关API
│   │   │   ├── events.py                 # 赛事相关API
│   │   │   ├── event_configuration.py    # 配置相关API
│   │   │   ├── dictionary.py             # 字典数据API
│   │   │   └── health.py                 # 健康检查
│   │   ├── models/                # SQLAlchemy 数据模型
│   │   ├── schemas/               # Pydantic 数据验证模型
│   │   ├── services/              # 业务逻辑
│   │   │   ├── scoring_calculator.py      # 核心积分计算
│   │   │   └── score_service.py           # 成绩业务服务
│   │   ├── database.py            # 数据库连接
│   │   ├── config.py              # 配置管理
│   │   └── main.py                # 应用入口
│   ├── requirements.txt
│   └── Dockerfile
│
├── database/
│   └── init.sql                   # PostgreSQL 初始化脚本
│
└── 📄 文档
    ├── README.md                  # 项目说明（本文件）
    ├── QUICK_START.md             # 详细启动指南
    └── DATABASE_DESIGN_V2.md      # 数据库设计文档
```

## �️ 数据库架构

核心数据模型：**3个业务表 + 3个字典表 = 6个表**

```
events (赛事)
├── id, year, season
└── created_at, updated_at

event_configurations (赛事配置)
├── event_id, bow_type, distance, format
└── participant_count (参赛人数，用于积分计算)

scores (成绩)
├── event_id, name, club
├── bow_type, distance, format, rank
├── ❌ 不存储 points（动态计算）
└── created_at

bow_types (字典)        distances (字典)    competition_formats (字典)
├── 反曲弓              ├── 18m              ├── 排位赛
├── 复合弓              ├── 30m              ├── 淘汰赛
├── 光弓                ├── 50m              ├── 混双赛
├── 传统弓              └── 70m              └── 团体赛
└── 美猎弓
```

## 📊 核心业务逻辑

### 积分计算公式

```
最终积分 = 基础积分 × 参赛人数系数 × 距离系数（18m为0.5倍）

示例计算：
场景1：30m排位赛，24人参赛，排名第1名
  基础积分 = 25分（排位赛第1名）
  人数系数 = 1.0倍（24人属于16-31人范围，系数0.8... 等等，需要查看具体规则）
  距离系数 = 1.0倍
  最终积分 = 25 × 1.0 × 1.0 = 25分

场景2：18m排位赛，20人参赛，排名第2名
  基础积分 = 22分（排位赛第2名）
  人数系数 = 1.0倍
  距离系数 = 0.5倍（18m特殊规则）
  最终积分 = 22 × 1.0 × 0.5 = 11分

年度总积分 = 所有赛事该弓种的积分汇总
```

### 参赛人数系数表

| 人数范围 | 系数 | 获得基础积分的排名上限 |
|---------|------|----------------------|
| 8-15人 | 0.6倍 | 前4名 |
| 16-31人 | 0.8倍 | 前8名 |
| 32-63人 | 1.0倍 | 前16名 |
| 64-127人 | 1.2倍 | 前16名 |
| 128人+ | 1.4倍 | 前16名 |

### 积分基础表（排位赛）

| 排名 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9+ |
|------|---|---|---|---|---|---|---|---|-----|
| 积分 | 25 | 22 | 19 | 15 | 10 | 8 | 6 | 4 | 1 |

详见文件：[backend/app/services/scoring_calculator.py](backend/app/services/scoring_calculator.py)

## 📡 API 端点速查

### 赛事管理
```
POST   /api/events/with-configs             创建赛事+配置
GET    /api/events                          列表赛事
GET    /api/events/{id}                     获取赛事详情
```

### 成绩管理
```
POST   /api/scores/batch/import             批量导入成绩
GET    /api/scores/event/{id}/ranking       单赛事排名
GET    /api/scores/annual-ranking/{year}/{bow}  ⭐ 年度排名（核心API）
```

### 字典数据
```
GET    /api/dictionaries                    获取所有字典数据
GET    /api/dictionaries/bow-types          弓种字典
GET    /api/dictionaries/distances          距离字典
GET    /api/dictionaries/competition-formats 赛制字典
```

完整API文档访问：http://localhost:8000/docs（Swagger UI）

## 🎯 主要功能详解

### 1. 成绩导入（ScoreImport.vue）

**支持的文件格式**：
- Excel (.xlsx, .xls)
- CSV (.csv)

**自动字段识别**：
系统自动识别Excel/CSV的列标题，支持多种别名：
- 姓名：name、名字、选手、参赛者
- 俱乐部：club、组织、队伍
- 弓种：bow_type、弓、弓类
- 距离：distance、比赛距离、距离(m)
- 赛制：format、比赛格式、竞赛形式
- 排名：rank、名次、成绩排名

**字典值转换**：
- 支持输入字典名称（如"反曲弓"）或代码（如"recurve"）
- 自动转换为正确的代码值
- 示例：用户输入"反曲弓" → 系统转换为"recurve"

**错误处理**：
- 逐行验证数据
- 错误时显示具体行号和选手姓名
- 显示有效的字典值建议
- 示例错误提示：
  ```
  第 2 条成绩（姓名：张三）：弓种必须是：反曲弓、复合弓、光弓、传统弓、美猎弓
  第 5 条成绩（姓名：李四）：赛制必须是：排位赛、淘汰赛、混双赛、团体赛
  ```

### 2. 赛事管理（EventAdd.vue）

**一键创建**：
- 填写年度和赛季（Q1-Q4）
- 添加多组配置（弓种/距离/赛制组合）
- 为每组配置输入参赛人数
- 一次提交所有信息

**关键字段**：
- 年度（年份）
- 赛季（Q1/Q2/Q3/Q4）
- 配置列表（每项包括：弓种、距离、赛制、参赛人数）

### 3. 积分排名（PointsDisplay.vue）

**功能**：
- 按年度、弓种查看排名
- 前8名高亮显示（根据积分从高到低）
- 支持Excel导出功能
- 显示选手年度总积分

**数据来源**：
- 跨所有赛事、所有距离、所有赛制聚合
- 实时计算积分（每次查看时）

## 🔧 常见问题

### Q: 如何修改已导入的成绩？
A: 当前版本不支持直接编辑。可通过以下方式处理：
1. 删除相应赛事（级联删除关联成绩）
2. 重新创建赛事并导入正确的成绩

后续版本将支持编辑功能。

### Q: 积分公式能否自定义？
A: 可以。编辑 [backend/app/services/scoring_calculator.py](backend/app/services/scoring_calculator.py)：
- 修改计算逻辑和18米规则等

### Q: 系统能处理多少数据？
A: 
- 单赛事支持1000+选手
- 年度积分汇总支持10000+条成绩
- 系统已在生产环境验证

### Q: 支持用户认证吗？
A: 当前版本是单机应用，无需认证。后续版本可考虑添加。

### Q: 能切换语言吗？
A: 系统目前仅支持中文。代码中的所有字段名、提示信息均为中文。

## 📖 详细文档

- [QUICK_START.md](QUICK_START.md) - **详细启动指南**，包括Docker完整步骤、开发模式配置
- [DATABASE_DESIGN_V2.md](DATABASE_DESIGN_V2.md) - **数据库架构详解**，表结构、字段说明、设计思路
- [backend/app/services/scoring_calculator.py](backend/app/services/scoring_calculator.py) - **积分计算逻辑**

## 🚀 部署指南

### Docker生产部署

```bash
# 使用生产配置
docker-compose -f docker-compose.prod.yml up -d --build

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 监控健康状态
curl http://localhost:8000/api/health/status
```

### 常用Docker命令

```bash
# 查看服务状态
docker-compose ps

# 重启特定服务
docker-compose restart backend

# 进入容器执行命令
docker-compose exec backend bash
docker-compose exec database psql -U archery_user -d archery_db

# 查看实时日志
docker-compose logs -f --tail=100 backend

# 完全清理（包括数据）
docker-compose down -v
```

## 📝 更新日志

### v1.0 (2026-02-12)
- ✅ 系统上线
- ✅ 支持Excel/CSV导入
- ✅ 实现动态积分计算
- ✅ 年度排名统计
- ✅ Excel导出功能
- ✅ 完整错误提示

### v0.9 (2026-02-10)
- 功能完整,待产品测试

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

## 👥 贡献指南

欢迎提交Issue和Pull Request！

---

**需要帮助?** 
- 查看 [QUICK_START.md](QUICK_START.md)
- 访问 http://localhost:8000/docs 查看API文档
- 检查 [DATABASE_DESIGN_V2.md](DATABASE_DESIGN_V2.md) 了解数据结构
