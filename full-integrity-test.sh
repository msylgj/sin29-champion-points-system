#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if docker compose version >/dev/null 2>&1; then
  printf '\n==> Docker Compose 配置\n'
  docker compose -f docker-compose.yml config -q
  DOCKERHUB_NAMESPACE="${DOCKERHUB_NAMESPACE:-config-check}" docker compose -f docker-compose.prod.yml config -q
else
  printf '\n跳过 Compose 配置校验：未检测到 Compose v2。\n'
fi

printf '\n==> 后端测试（内存 SQLite）\n'
(
  cd backend
  # 测试会创建和删除表，绝不继承部署环境的数据库 URL。
  DATABASE_URL=sqlite:///:memory: PYTHONDONTWRITEBYTECODE=1 python3 -m pytest tests -q -p no:cacheprovider
)

printf '\n==> 前端检查\n'
(
  cd frontend
  npm run lint
  npm run test:run
  npm run build
)
