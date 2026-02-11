#!/bin/bash

# 启动前检查和初始化脚本
set -e

echo "=========================================="
echo "项目启动前检查"
echo "=========================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "⚠️  未找到 .env 文件，正在复制 .env.example..."
    cp .env.example .env
    echo "✓ .env 文件已创建，请根据需要编辑环境变量"
else
    echo "✓ .env 文件已存在"
fi

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    exit 1
fi
echo "✓ Docker 已安装: $(docker --version)"

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装"
    exit 1
fi
echo "✓ Docker Compose 已安装: $(docker-compose --version)"

# 检查端口占用（可选）
echo ""
echo "检查端口占用情况..."
if [ -f /proc/net/tcp ]; then
    # Linux 系统
    BACKEND_PORT=$(grep -o 'BACKEND_PORT=[0-9]*' .env | cut -d= -f2 || echo "8000")
    FRONTEND_PORT=$(grep -o 'FRONTEND_PORT=[0-9]*' .env | cut -d= -f2 || echo "8080")
    
    echo "- 后端端口: $BACKEND_PORT"
    echo "- 前端端口: $FRONTEND_PORT"
fi

echo ""
echo "=========================================="
echo "现在可以启动应用！"
echo "=========================================="
echo ""
echo "开发环境启动:"
echo "  docker-compose up --build"
echo ""
echo "后台启动:"
echo "  docker-compose up -d --build"
echo ""
echo "查看日志:"
echo "  docker-compose logs -f"
echo ""
echo "停止应用:"
echo "  docker-compose down"
echo ""
