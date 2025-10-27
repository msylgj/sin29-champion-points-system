#!/bin/bash

echo "=========================================="
echo "射箭赛事积分统计系统 - 环境验证脚本"
echo "=========================================="
echo ""

ERRORS=0

# 检查 Docker
echo "🔍 检查 Docker..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo "   ✅ Docker 已安装: $DOCKER_VERSION"
else
    echo "   ❌ Docker 未安装"
    ERRORS=$((ERRORS+1))
fi

# 检查 Docker Compose
echo "🔍 检查 Docker Compose..."
if command -v docker compose &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    echo "   ✅ Docker Compose 已安装: $COMPOSE_VERSION"
else
    echo "   ❌ Docker Compose 未安装"
    ERRORS=$((ERRORS+1))
fi

# 检查项目结构
echo "🔍 检查项目结构..."
REQUIRED_DIRS=("frontend" "backend" "database")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "   ✅ 目录存在: $dir/"
    else
        echo "   ❌ 目录不存在: $dir/"
        ERRORS=$((ERRORS+1))
    fi
done

# 检查关键文件
echo "🔍 检查关键文件..."
REQUIRED_FILES=(
    "docker-compose.yml"
    "frontend/package.json"
    "frontend/Dockerfile"
    "backend/requirements.txt"
    "backend/Dockerfile"
    "backend/app/main.py"
    "database/init.sql"
    "README.md"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ 文件存在: $file"
    else
        echo "   ❌ 文件不存在: $file"
        ERRORS=$((ERRORS+1))
    fi
done

# 验证 Docker Compose 配置
echo "🔍 验证 Docker Compose 配置..."
if docker compose config > /dev/null 2>&1; then
    echo "   ✅ Docker Compose 配置有效"
else
    echo "   ❌ Docker Compose 配置无效"
    ERRORS=$((ERRORS+1))
fi

# 检查 Python 语法
echo "🔍 检查 Python 代码语法..."
if python3 -m py_compile backend/app/main.py 2>/dev/null; then
    echo "   ✅ Python 代码语法正确"
else
    echo "   ❌ Python 代码语法错误"
    ERRORS=$((ERRORS+1))
fi

# 检查前端依赖
echo "🔍 检查前端依赖..."
if [ -f "frontend/package.json" ]; then
    if grep -q "vue" frontend/package.json; then
        echo "   ✅ Vue.js 依赖已配置"
    else
        echo "   ❌ Vue.js 依赖未配置"
        ERRORS=$((ERRORS+1))
    fi
fi

# 检查后端依赖
echo "🔍 检查后端依赖..."
if [ -f "backend/requirements.txt" ]; then
    if grep -q "fastapi" backend/requirements.txt; then
        echo "   ✅ FastAPI 依赖已配置"
    else
        echo "   ❌ FastAPI 依赖未配置"
        ERRORS=$((ERRORS+1))
    fi
fi

# 检查文档
echo "🔍 检查文档..."
DOCS=("README.md" "DEVELOPMENT.md" "CONTRIBUTING.md")
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo "   ✅ 文档存在: $doc"
    else
        echo "   ⚠️  文档不存在: $doc"
    fi
done

echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo "✅ 所有检查通过！项目已正确初始化"
    echo "=========================================="
    echo ""
    echo "下一步操作："
    echo "1. 启动服务: ./start.sh 或 docker compose up -d"
    echo "2. 访问前端: http://localhost:8080"
    echo "3. 访问后端: http://localhost:8000"
    echo "4. 查看 API 文档: http://localhost:8000/docs"
    exit 0
else
    echo "❌ 发现 $ERRORS 个错误！请检查上述问题"
    echo "=========================================="
    exit 1
fi
