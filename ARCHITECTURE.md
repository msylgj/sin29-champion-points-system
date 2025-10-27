# 系统架构文档

## 概述

射箭赛事积分统计系统采用现代化的微服务架构，使用 Docker 容器化部署，前后端分离设计。

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         用户浏览器                            │
│                     http://localhost:8080                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP/HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Vue.js 3)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • Vite (构建工具)                                     │  │
│  │  • Vue Router (路由管理)                               │  │
│  │  • Pinia (状态管理)                                    │  │
│  │  • Element Plus (UI 组件库)                            │  │
│  │  • Axios (HTTP 客户端)                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                Port: 8080 (Nginx/Dev Server)                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ REST API
                         │ /api/*
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Layer                                            │  │
│  │  ├── routers/     (API 路由处理)                       │  │
│  │  ├── services/    (业务逻辑层)                         │  │
│  │  ├── models/      (数据模型)                           │  │
│  │  └── utils/       (工具函数)                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Features                                             │  │
│  │  • FastAPI 框架                                        │  │
│  │  • SQLAlchemy ORM                                     │  │
│  │  • JWT 认证                                            │  │
│  │  • 自动 API 文档                                       │  │
│  │  • 数据验证 (Pydantic)                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                Port: 8000 (Uvicorn)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ SQL
                         │ PostgreSQL Protocol
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                Database (PostgreSQL 15)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tables:                                              │  │
│  │  ├── athletes   (运动员信息)                          │  │
│  │  ├── events     (赛事信息)                            │  │
│  │  └── scores     (积分记录)                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  • 数据持久化存储                                           │
│  • 关系型数据管理                                           │
│  • 事务支持                                                 │
│                Port: 5432                                    │
└─────────────────────────────────────────────────────────────┘
```

## 技术栈

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue.js | 3.x | 渐进式 JavaScript 框架 |
| Vite | 5.x | 下一代前端构建工具 |
| Vue Router | 4.x | 单页应用路由管理 |
| Pinia | 2.x | 轻量级状态管理 |
| Element Plus | 2.x | 企业级 UI 组件库 |
| Axios | 1.x | HTTP 请求库 |
| Node.js | 20 | JavaScript 运行环境 |
| Nginx | Alpine | 生产环境 Web 服务器 |

### 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.11 | 编程语言 |
| FastAPI | 0.115+ | 现代化 Web 框架 |
| Uvicorn | 0.34+ | ASGI 服务器 |
| SQLAlchemy | 2.0+ | Python ORM |
| Pydantic | 2.x | 数据验证 |
| psycopg2 | 2.9+ | PostgreSQL 驱动 |
| Python-jose | 3.3+ | JWT 处理 |
| Passlib | 1.7+ | 密码加密 |
| Pandas | 2.2+ | 数据处理 |
| OpenPyXL | 3.1+ | Excel 处理 |
| Alembic | 1.14+ | 数据库迁移 |

### 数据库

| 技术 | 版本 | 用途 |
|------|------|------|
| PostgreSQL | 15 | 关系型数据库 |

### DevOps

| 技术 | 版本 | 用途 |
|------|------|------|
| Docker | 20.10+ | 容器化平台 |
| Docker Compose | 2.0+ | 容器编排 |

## 数据流

### 用户请求流程

```
1. 用户在浏览器访问前端应用
   ↓
2. Vue.js 渲染页面
   ↓
3. 用户操作触发 API 调用
   ↓
4. Axios 发送 HTTP 请求到后端
   ↓
5. FastAPI 路由处理请求
   ↓
6. 服务层执行业务逻辑
   ↓
7. SQLAlchemy 查询数据库
   ↓
8. PostgreSQL 返回数据
   ↓
9. 后端处理并返回 JSON
   ↓
10. 前端更新 UI 显示
```

### 数据模型

```
athletes (运动员)
├── id: SERIAL PRIMARY KEY
├── name: VARCHAR(100)
├── gender: VARCHAR(10)
├── age: INTEGER
├── club: VARCHAR(100)
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

events (赛事)
├── id: SERIAL PRIMARY KEY
├── name: VARCHAR(200)
├── event_date: DATE
├── location: VARCHAR(200)
├── description: TEXT
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

scores (积分记录)
├── id: SERIAL PRIMARY KEY
├── athlete_id: INTEGER (FK → athletes.id)
├── event_id: INTEGER (FK → events.id)
├── score: INTEGER
├── rank: INTEGER
├── notes: TEXT
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP
```

## 容器架构

### Docker 网络

```
archery_network (bridge)
├── database   (archery_db)
├── backend    (archery_backend)
└── frontend   (archery_frontend)
```

### 容器通信

- **frontend → backend**: HTTP (通过容器名 `backend:8000`)
- **backend → database**: PostgreSQL Protocol (通过容器名 `database:5432`)
- **外部 → frontend**: HTTP (localhost:8080)
- **外部 → backend**: HTTP (localhost:8000)
- **外部 → database**: PostgreSQL (localhost:5432)

### 数据持久化

```
volumes:
  postgres_data → /var/lib/postgresql/data
    ├── 数据库文件
    └── WAL 日志
```

## API 设计

### RESTful API 规范

```
基础路径: http://localhost:8000/api

GET    /health                # 健康检查
GET    /athletes              # 获取运动员列表
POST   /athletes              # 创建运动员
GET    /athletes/{id}         # 获取运动员详情
PUT    /athletes/{id}         # 更新运动员
DELETE /athletes/{id}         # 删除运动员

GET    /events                # 获取赛事列表
POST   /events                # 创建赛事
GET    /events/{id}           # 获取赛事详情
PUT    /events/{id}           # 更新赛事
DELETE /events/{id}           # 删除赛事

GET    /scores                # 获取积分记录
POST   /scores                # 创建积分记录
GET    /scores/{id}           # 获取积分详情
PUT    /scores/{id}           # 更新积分
DELETE /scores/{id}           # 删除积分

POST   /auth/login            # 用户登录
POST   /auth/logout           # 用户登出
GET    /auth/me               # 获取当前用户
```

### 响应格式

**成功响应:**
```json
{
  "data": { ... },
  "message": "操作成功"
}
```

**错误响应:**
```json
{
  "detail": "错误信息",
  "code": "ERROR_CODE"
}
```

## 安全设计

### 认证与授权

- **JWT Token**: 使用 JSON Web Token 进行用户认证
- **Token 存储**: LocalStorage (前端)
- **Token 传递**: Authorization Header (`Bearer <token>`)
- **密码加密**: Bcrypt 算法

### CORS 配置

- 开发环境：允许所有来源
- 生产环境：限制特定域名

### 环境变量

敏感信息通过环境变量配置：
- 数据库密码
- JWT Secret Key
- API Keys

## 部署架构

### 开发环境

```
docker-compose.yml
├── 使用开发镜像
├── 挂载源代码目录
├── 启用热重载
└── 暴露所有端口
```

### 生产环境

```
docker-compose.prod.yml
├── 使用优化镜像
├── 多进程部署
├── 环境变量配置
└── 限制端口暴露
```

## 性能优化

### 前端优化

- **代码分割**: 路由懒加载
- **资源压缩**: Vite 构建优化
- **缓存策略**: 静态资源长期缓存
- **CDN**: 静态资源 CDN 分发

### 后端优化

- **数据库连接池**: SQLAlchemy 连接池
- **查询优化**: 使用索引和 JOIN
- **异步处理**: FastAPI 异步路由
- **缓存**: Redis 缓存热点数据

### 数据库优化

- **索引**: 主要查询字段建立索引
- **分页**: 大数据量分页查询
- **备份**: 定期数据库备份

## 扩展性

### 水平扩展

- **前端**: Nginx 负载均衡
- **后端**: 多实例 + 负载均衡
- **数据库**: 主从复制 + 读写分离

### 垂直扩展

- 增加容器资源限制
- 优化数据库配置
- 升级硬件配置

## 监控与日志

### 日志管理

- **应用日志**: 标准输出
- **访问日志**: Nginx access.log
- **错误日志**: Nginx error.log
- **数据库日志**: PostgreSQL logs

### 监控指标

- 容器健康状态
- API 响应时间
- 数据库连接数
- 系统资源使用

## 开发流程

### 本地开发

1. 启动 Docker Compose
2. 前端热重载开发
3. 后端 uvicorn --reload
4. 数据库实时同步

### 测试流程

1. 单元测试 (pytest)
2. 集成测试
3. E2E 测试
4. 性能测试

### 部署流程

1. 代码审查
2. 自动化测试
3. 构建 Docker 镜像
4. 部署到生产环境
5. 健康检查

## 技术决策

### 为什么选择 Vue.js 3?

- 渐进式框架，易于学习
- Composition API 更好的代码组织
- 优秀的生态系统
- 强大的响应式系统

### 为什么选择 FastAPI?

- 高性能（基于 Starlette 和 Pydantic）
- 自动 API 文档
- 类型提示支持
- 异步支持
- 易于学习和使用

### 为什么选择 PostgreSQL?

- 强大的关系型数据库
- 支持复杂查询
- ACID 事务支持
- 成熟稳定
- 开源免费

### 为什么选择 Docker?

- 环境一致性
- 快速部署
- 易于扩展
- 隔离性好
- 跨平台支持

## 未来规划

### 短期目标

- [ ] 完善用户认证系统
- [ ] 实现完整的 CRUD 操作
- [ ] 添加数据导入导出功能
- [ ] 实现数据可视化

### 长期目标

- [ ] 微服务拆分
- [ ] 引入消息队列
- [ ] 实现实时通知
- [ ] 移动端支持
- [ ] 国际化支持

## 参考资料

- [Vue.js 官方文档](https://vuejs.org/)
- [FastAPI 官方文档](https://fastapi.tiangolo.com/)
- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [Docker 官方文档](https://docs.docker.com/)

---

**文档版本**: 1.0.0  
**最后更新**: 2024-01-01  
**维护者**: 开发团队
