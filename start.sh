#!/bin/bash

echo "=========================================="
echo "射箭赛事积分统计系统 - 快速启动脚本"
echo "=========================================="
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker compose &> /dev/null; then
    echo "❌ 错误: Docker Compose 未安装"
    echo "请先安装 Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker 环境检查通过"
echo ""

# 提示用户选择模式
echo "请选择启动模式："
echo "1) 开发模式 (支持热重载)"
echo "2) 生产模式 (优化性能)"
read -p "请输入选项 (1 或 2) [默认: 1]: " mode
mode=${mode:-1}

echo ""

if [ "$mode" = "2" ]; then
    echo "🚀 启动生产模式..."
    docker compose -f docker-compose.prod.yml up -d
else
    echo "🚀 启动开发模式..."
    docker compose up -d
fi

echo ""
echo "⏳ 等待服务启动..."
sleep 5

echo ""
echo "=========================================="
echo "✅ 服务启动成功！"
echo "=========================================="
echo ""
echo "📱 前端应用: http://localhost:8080"
echo "🔧 后端 API: http://localhost:8000"
echo "📚 API 文档: http://localhost:8000/docs"
echo "🗄️  数据库: localhost:5432"
echo ""
echo "查看日志: docker compose logs -f"
echo "停止服务: docker compose down"
echo ""
echo "=========================================="
