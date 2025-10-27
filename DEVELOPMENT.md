# 开发指南

## 开发环境设置

### 1. 前置要求

确保已安装以下软件：
- Docker Desktop >= 20.10
- Docker Compose >= 2.0
- Git

可选（本地开发）：
- Node.js >= 18
- Python >= 3.11
- PostgreSQL >= 15

### 2. 克隆项目

```bash
git clone <repository-url>
cd archery-scoring-system
```

### 3. 启动开发环境

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## 项目架构

### 前端架构（Vue.js 3）

```
frontend/
├── src/
│   ├── api/          # API 调用封装
│   ├── assets/       # 静态资源（图片、样式等）
│   ├── components/   # 可复用组件
│   ├── router/       # Vue Router 路由配置
│   ├── stores/       # Pinia 状态管理
│   ├── views/        # 页面组件
│   ├── App.vue       # 根组件
│   └── main.js       # 应用入口
├── public/           # 公共静态文件
├── index.html        # HTML 模板
└── vite.config.js    # Vite 配置
```

### 后端架构（FastAPI）

```
backend/
├── app/
│   ├── models/       # SQLAlchemy 数据模型
│   ├── routers/      # API 路由处理器
│   ├── services/     # 业务逻辑层
│   ├── utils/        # 工具函数
│   ├── config.py     # 应用配置
│   ├── database.py   # 数据库连接
│   └── main.py       # FastAPI 应用实例
├── Dockerfile
└── requirements.txt
```

## 开发工作流

### 添加新功能

#### 后端开发流程

1. **创建数据模型** (`backend/app/models/`)
   ```python
   from sqlalchemy import Column, Integer, String
   from app.database import Base
   
   class MyModel(Base):
       __tablename__ = "my_table"
       
       id = Column(Integer, primary_key=True, index=True)
       name = Column(String)
   ```

2. **创建 Pydantic 模式** (在同一文件或 schemas.py)
   ```python
   from pydantic import BaseModel
   
   class MyModelBase(BaseModel):
       name: str
   
   class MyModelCreate(MyModelBase):
       pass
   
   class MyModel(MyModelBase):
       id: int
       
       class Config:
           from_attributes = True
   ```

3. **创建服务层** (`backend/app/services/`)
   ```python
   from sqlalchemy.orm import Session
   from app.models import MyModel
   
   def get_items(db: Session):
       return db.query(MyModel).all()
   ```

4. **创建路由** (`backend/app/routers/`)
   ```python
   from fastapi import APIRouter, Depends
   from sqlalchemy.orm import Session
   from app.database import get_db
   from app.services import my_service
   
   router = APIRouter()
   
   @router.get("/items")
   async def read_items(db: Session = Depends(get_db)):
       return my_service.get_items(db)
   ```

5. **注册路由** (`backend/app/main.py`)
   ```python
   from app.routers import my_router
   
   app.include_router(my_router.router, prefix="/api", tags=["My Resource"])
   ```

#### 前端开发流程

1. **创建 API 调用** (`frontend/src/api/`)
   ```javascript
   import api from './index'
   
   export default {
     getItems() {
       return api.get('/items')
     },
     createItem(data) {
       return api.post('/items', data)
     }
   }
   ```

2. **创建 Store**（如需要） (`frontend/src/stores/`)
   ```javascript
   import { defineStore } from 'pinia'
   
   export const useMyStore = defineStore('myStore', {
     state: () => ({
       items: []
     }),
     actions: {
       async fetchItems() {
         // API call
       }
     }
   })
   ```

3. **创建视图组件** (`frontend/src/views/`)
   ```vue
   <template>
     <div>
       <!-- Your template -->
     </div>
   </template>
   
   <script setup>
   import { ref, onMounted } from 'vue'
   
   // Your logic
   </script>
   
   <style scoped>
   /* Your styles */
   </style>
   ```

4. **添加路由** (`frontend/src/router/index.js`)
   ```javascript
   {
     path: '/my-route',
     name: 'MyRoute',
     component: () => import('../views/MyView.vue')
   }
   ```

### 数据库迁移

使用 Alembic 进行数据库迁移：

```bash
# 进入后端容器
docker-compose exec backend bash

# 创建迁移
alembic revision --autogenerate -m "description"

# 应用迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1
```

### 调试

#### 后端调试

1. **查看日志**
   ```bash
   docker-compose logs -f backend
   ```

2. **进入容器**
   ```bash
   docker-compose exec backend bash
   python
   >>> from app.database import engine
   >>> # 测试数据库连接
   ```

3. **使用 FastAPI 交互式文档**
   访问 http://localhost:8000/docs

#### 前端调试

1. **查看日志**
   ```bash
   docker-compose logs -f frontend
   ```

2. **使用 Vue DevTools**
   安装 Chrome/Firefox 扩展

3. **控制台调试**
   浏览器开发者工具 -> Console

### 测试

#### 后端测试

```bash
# 进入后端容器
docker-compose exec backend bash

# 运行测试
pytest

# 运行特定测试
pytest tests/test_api.py
```

#### 前端测试

```bash
# 进入前端容器
docker-compose exec frontend sh

# 运行测试
npm run test
```

## 代码规范

### Python 代码规范

- 遵循 PEP 8
- 使用类型提示
- 函数和类都要有 docstring
- 最大行长度：100 字符

```python
from typing import List, Optional

def get_user(user_id: int) -> Optional[User]:
    """
    获取用户信息
    
    Args:
        user_id: 用户 ID
        
    Returns:
        User 对象，如果不存在则返回 None
    """
    pass
```

### JavaScript/Vue 代码规范

- 使用 ES6+ 语法
- 组件名使用 PascalCase
- 优先使用 Composition API
- Props 定义要有类型和默认值

```vue
<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  }
})

const count = ref(0)
const doubleCount = computed(() => count.value * 2)
</script>
```

### Git 提交规范

使用约定式提交（Conventional Commits）：

```
<type>(<scope>): <subject>

<body>

<footer>
```

类型（type）：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

示例：
```
feat(auth): 添加用户登录功能

实现了基于 JWT 的用户认证系统，包括：
- 登录接口
- Token 刷新
- 权限验证中间件

Closes #123
```

## 常用命令

### Docker

```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 重启服务
docker-compose restart <service-name>

# 查看日志
docker-compose logs -f <service-name>

# 进入容器
docker-compose exec <service-name> bash

# 重新构建镜像
docker-compose build --no-cache <service-name>

# 查看服务状态
docker-compose ps
```

### 数据库

```bash
# 连接数据库
docker-compose exec database psql -U archery_user -d archery_db

# 备份数据库
docker-compose exec database pg_dump -U archery_user archery_db > backup.sql

# 恢复数据库
docker-compose exec -T database psql -U archery_user archery_db < backup.sql
```

### 前端

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

### 后端

```bash
# 安装依赖
pip install -r requirements.txt

# 启动开发服务器
uvicorn app.main:app --reload

# 运行测试
pytest

# 代码格式化
black .

# 类型检查
mypy .
```

## 性能优化

### 前端优化

1. **懒加载路由**
   ```javascript
   {
     path: '/heavy',
     component: () => import('./views/Heavy.vue')
   }
   ```

2. **使用虚拟滚动**（大列表）

3. **图片优化**
   - 使用适当的格式（WebP）
   - 压缩图片
   - 使用 CDN

### 后端优化

1. **数据库查询优化**
   - 使用索引
   - 避免 N+1 查询
   - 使用 select_related/joinedload

2. **缓存策略**
   - Redis 缓存
   - 查询结果缓存

3. **异步处理**
   - 使用 Celery 处理耗时任务

## 故障排查

### 常见问题

1. **容器无法启动**
   ```bash
   # 查看详细日志
   docker-compose logs <service-name>
   
   # 检查端口占用
   lsof -i :<port>
   ```

2. **数据库连接失败**
   - 检查数据库容器是否运行
   - 验证连接字符串
   - 检查网络配置

3. **前端无法访问后端**
   - 检查 CORS 配置
   - 验证 API 地址
   - 检查网络连接

4. **依赖安装失败**
   ```bash
   # 清理缓存
   npm cache clean --force
   pip cache purge
   
   # 重新安装
   docker-compose build --no-cache
   ```

## 部署指南

### 开发环境
使用 `docker-compose.yml`

### 生产环境
使用 `docker-compose.prod.yml`

```bash
docker-compose -f docker-compose.prod.yml up -d
```

生产环境注意事项：
1. 修改所有默认密码
2. 设置强 SECRET_KEY
3. 启用 HTTPS
4. 配置日志收集
5. 设置监控告警
6. 定期备份数据库

## 资源链接

### 官方文档
- [Vue.js 3](https://vuejs.org/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [PostgreSQL](https://www.postgresql.org/docs/)
- [Docker](https://docs.docker.com/)

### 相关工具
- [Element Plus](https://element-plus.org/)
- [Pinia](https://pinia.vuejs.org/)
- [SQLAlchemy](https://docs.sqlalchemy.org/)
- [Alembic](https://alembic.sqlalchemy.org/)

## 团队协作

### 分支策略

- `main`: 主分支，保护分支
- `develop`: 开发分支
- `feature/*`: 功能分支
- `bugfix/*`: Bug 修复分支
- `hotfix/*`: 紧急修复分支

### Code Review

提交 PR 时：
1. 提供清晰的描述
2. 关联相关 Issue
3. 通过所有测试
4. 至少一个 Approve

## 支持

如遇问题：
1. 查看本文档
2. 搜索已有 Issue
3. 创建新 Issue
4. 联系团队成员

---

Happy Coding! 🚀
