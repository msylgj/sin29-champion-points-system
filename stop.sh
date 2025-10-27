#!/bin/bash

echo "=========================================="
echo "射箭赛事积分统计系统 - 停止脚本"
echo "=========================================="
echo ""

echo "请选择停止方式："
echo "1) 停止服务 (保留数据)"
echo "2) 停止服务并删除数据卷"
read -p "请输入选项 (1 或 2) [默认: 1]: " option
option=${option:-1}

echo ""

if [ "$option" = "2" ]; then
    echo "🛑 停止服务并删除数据卷..."
    docker compose down -v
    echo "⚠️  警告: 所有数据已被删除"
else
    echo "🛑 停止服务..."
    docker compose down
    echo "✅ 数据已保留"
fi

echo ""
echo "=========================================="
echo "✅ 服务已停止"
echo "=========================================="
