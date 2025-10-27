# 射箭赛事积分统计系统

一个基于 Vue.js 和 FastAPI 的射箭赛事积分统计管理系统，支持运动员管理、赛事管理、积分统计等功能。

## 技术栈

### 前端
- **Vue.js 3** - 渐进式 JavaScript 框架
- **Vite** - 下一代前端构建工具
- **Vue Router** - 官方路由管理器
- **Pinia** - 状态管理库
- **Element Plus** - UI 组件库
- **Axios** - HTTP 客户端

### 后端
- **FastAPI** - 现代、快速的 Web 框架
- **SQLAlchemy** - Python SQL 工具和 ORM
- **PostgreSQL** - 关系型数据库
- **Uvicorn** - ASGI 服务器
- **Python-jose** - JWT 认证
- **Pandas** - 数据处理
- **OpenPyXL** - Excel 文件处理

### 容器化
- **Docker** - 容器化平台
- **Docker Compose** - 多容器应用编排

## 项目结构

```
.
├── frontend/              # Vue.js 前端项目
│   ├── src/
│   │   ├── api/          # API 接口封装
│   │   ├── components/   # 可复用组件
│   │   ├── views/        # 页面组件
│   │   ├── router/       # 路由配置
│   │   ├── stores/       # Pinia 状态管理
│   │   ├── assets/       # 静态资源
│   │   ├── App.vue       # 根组件
│   │   └── main.js       # 入口文件
│   ├── public/           # 公共静态文件
│   ├── Dockerfile        # 前端 Docker 配置
│   ├── nginx.conf        # Nginx 配置
│   └── package.json      # 依赖管理
│
├── backend/              # Python FastAPI 后端项目
│   ├── app/
│   │   ├── models/       # 数据库模型
│   │   ├── routers/      # API 路由
│   │   ├── services/     # 业务逻辑层
│   │   ├── utils/        # 工具函数
│   │   ├── config.py     # 配置管理
│   │   ├── database.py   # 数据库连接
│   │   └── main.py       # 应用入口
│   ├── Dockerfile        # 后端 Docker 配置
│   ├── requirements.txt  # Python 依赖
│   └── .env              # 环境变量
│
├── database/             # 数据库相关
│   └── init.sql          # 数据库初始化脚本
│
├── docker-compose.yml    # Docker Compose 配置
├── .gitignore           # Git 忽略文件
└── README.md            # 项目文档
```

## 环境要求

- **Docker** >= 20.10
- **Docker Compose** >= 2.0

或者本地开发环境：
- **Node.js** >= 18.0
- **Python** >= 3.11
- **PostgreSQL** >= 15

## 快速启动

### 使用 Docker Compose（推荐）

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

2. **启动所有服务**
   ```bash
   docker-compose up -d
   ```

3. **查看服务状态**
   ```bash
   docker-compose ps
   ```

4. **访问应用**
   - 前端应用: http://localhost:8080
   - 后端 API: http://localhost:8000
   - API 文档: http://localhost:8000/docs
   - API 备选文档: http://localhost:8000/redoc

5. **查看日志**
   ```bash
   # 查看所有服务日志
   docker-compose logs -f
   
   # 查看特定服务日志
   docker-compose logs -f frontend
   docker-compose logs -f backend
   docker-compose logs -f database
   ```

6. **停止服务**
   ```bash
   docker-compose down
   ```

7. **停止服务并删除数据卷**
   ```bash
   docker-compose down -v
   ```

### 本地开发

#### 后端开发

1. **进入后端目录**
   ```bash
   cd backend
   ```

2. **创建虚拟环境**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # 或
   venv\Scripts\activate  # Windows
   ```

3. **安装依赖**
   ```bash
   pip install -r requirements.txt
   ```

4. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，配置数据库连接等
   ```

5. **启动后端服务**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

#### 前端开发

1. **进入前端目录**
   ```bash
   cd frontend
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **构建生产版本**
   ```bash
   npm run build
   ```

## 功能特性

### 当前功能
- ✅ 系统健康检查
- ✅ 数据库连接
- ✅ API 文档自动生成
- ✅ 前后端分离架构
- ✅ 容器化部署

### 规划功能
- 🔄 运动员管理（增删改查）
- 🔄 赛事管理
- 🔄 积分统计与排名
- 🔄 用户认证与授权
- 🔄 Excel 数据导入导出
- 🔄 数据可视化报表
- 🔄 赛事通知提醒

## API 文档

启动后端服务后，访问以下地址查看完整的 API 文档：

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### 主要 API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/` | 系统信息 |
| GET | `/api/health` | 健康检查 |

## 数据库

### 数据库信息
- **数据库类型**: PostgreSQL 15
- **默认数据库名**: archery_db
- **默认用户**: archery_user
- **默认密码**: archery_pass
- **端口**: 5432

### 数据库连接

使用 Docker Compose 启动后，可以通过以下方式连接数据库：

```bash
# 使用 psql 客户端
docker-compose exec database psql -U archery_user -d archery_db

# 或使用数据库管理工具
Host: localhost
Port: 5432
Database: archery_db
Username: archery_user
Password: archery_pass
```

### 数据库表结构

系统包含以下主要数据表：

- **athletes**: 运动员信息
- **events**: 赛事信息
- **scores**: 积分记录

详细表结构请查看 `database/init.sql` 文件。

## 开发指南

### 代码规范

#### Python 后端
- 遵循 PEP 8 代码风格
- 使用类型注解
- 编写 docstring 文档

#### JavaScript 前端
- 使用 ES6+ 语法
- 遵循 Vue 3 Composition API 风格
- 组件使用 PascalCase 命名

### 提交规范

使用语义化提交信息：

```
feat: 添加新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具链更新
```

### 添加新功能

#### 添加后端 API

1. 在 `backend/app/models/` 创建数据模型
2. 在 `backend/app/routers/` 创建路由
3. 在 `backend/app/services/` 实现业务逻辑
4. 在 `backend/app/main.py` 注册路由

#### 添加前端页面

1. 在 `frontend/src/views/` 创建页面组件
2. 在 `frontend/src/router/index.js` 添加路由
3. 在 `frontend/src/api/` 封装 API 调用
4. 如需状态管理，在 `frontend/src/stores/` 创建 store

## 故障排查

### 常见问题

**1. 端口被占用**
```bash
# 检查端口占用
lsof -i :8080  # 前端端口
lsof -i :8000  # 后端端口
lsof -i :5432  # 数据库端口

# 或修改 docker-compose.yml 中的端口映射
```

**2. 数据库连接失败**
```bash
# 检查数据库容器状态
docker-compose ps database

# 查看数据库日志
docker-compose logs database

# 重启数据库服务
docker-compose restart database
```

**3. 前端无法连接后端**
- 检查后端服务是否正常运行
- 检查 CORS 配置
- 检查 Nginx 代理配置（生产环境）
- 检查防火墙设置

**4. 依赖安装失败**
```bash
# 清理 npm 缓存
npm cache clean --force

# 清理 pip 缓存
pip cache purge

# 重新构建容器
docker-compose build --no-cache
```

## 生产部署

生产环境部署建议：

1. **修改默认密码和密钥**
   - 数据库密码
   - JWT Secret Key

2. **配置环境变量**
   ```bash
   # backend/.env
   DEBUG=False
   DATABASE_URL=postgresql://user:pass@host:5432/db
   SECRET_KEY=<strong-random-key>
   ```

3. **使用生产级别的服务器**
   - Gunicorn + Uvicorn workers (后端)
   - Nginx (前端静态文件服务)

4. **配置 HTTPS**
   - 使用 Let's Encrypt 或其他 SSL 证书
   - 更新 Nginx 配置

5. **设置日志和监控**
   - 配置日志收集
   - 设置应用监控
   - 配置告警机制

6. **数据备份**
   - 定期备份 PostgreSQL 数据库
   - 备份重要配置文件

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件

---

**祝开发愉快！** 🎯
