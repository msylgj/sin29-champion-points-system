#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# 使用独立测试数据库，避免污染本地开发数据
export DATABASE_URL="${DATABASE_URL:-sqlite:///./test.db}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TOTAL_STEPS=0
PASSED_STEPS=0

step() {
  TOTAL_STEPS=$((TOTAL_STEPS + 1))
  echo -e "\n${BLUE}[$TOTAL_STEPS] $1${NC}"
}

ok() {
  PASSED_STEPS=$((PASSED_STEPS + 1))
  echo -e "${GREEN}✓ $1${NC}"
}

warn() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

fail() {
  echo -e "${RED}✗ $1${NC}"
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "未找到命令: $cmd"
}

echo "=========================================="
echo "项目完整性测试脚本"
echo "=========================================="
echo "项目目录: $PROJECT_DIR"
echo "测试数据库: $DATABASE_URL"

step "检查基础命令"
require_cmd python3
require_cmd npm
ok "基础命令可用 (python3, npm)"

step "检查项目结构"
for p in \
  "$PROJECT_DIR/backend/app/main.py" \
  "$PROJECT_DIR/backend/requirements.txt" \
  "$PROJECT_DIR/backend/tests" \
  "$PROJECT_DIR/frontend/package.json" \
  "$PROJECT_DIR/frontend/vite.config.js" \
  "$PROJECT_DIR/docker-compose.yml" \
  "$PROJECT_DIR/docker-compose.prod.yml"; do
  [[ -e "$p" ]] || fail "缺少必要文件/目录: $p"
done
ok "项目关键结构完整"

step "校验 Docker Compose 配置"
if command -v docker >/dev/null 2>&1; then
  docker compose -f "$PROJECT_DIR/docker-compose.yml" config -q
  docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" config -q
  ok "Docker Compose 配置有效"
else
  warn "未检测到 docker，跳过 compose 配置校验"
  PASSED_STEPS=$((PASSED_STEPS + 1))
fi

step "后端 Python 语法检查（只读）"
python3 - <<'PY'
import ast
from pathlib import Path

root = Path("/home/msylgj/sin29-champion-points-system/backend/app")
failed = []

for py_file in root.rglob("*.py"):
  try:
    source = py_file.read_text(encoding="utf-8")
    ast.parse(source, filename=str(py_file))
  except Exception as exc:
    failed.append((py_file, exc))

if failed:
  for file_path, err in failed:
    print(f"syntax error: {file_path}: {err}")
  raise SystemExit(1)

print("python syntax check ok")
PY
ok "后端语法检查通过"

step "后端单元测试"
(
  cd "$BACKEND_DIR"
  DATABASE_URL="$DATABASE_URL" python3 -m pytest tests -q
)
ok "后端测试通过"

step "后端 API 冒烟测试"
(
  cd "$BACKEND_DIR"
  DATABASE_URL="$DATABASE_URL" python3 - <<'PY'
import asyncio
from fastapi import HTTPException

from app.main import root
from app.routers.auth import admin_login, AdminLoginRequest
from app.routers.dictionary import get_all_dictionaries
from app.database import Base, SessionLocal, engine
import app.models  # noqa: F401  # 确保模型注册到 metadata

Base.metadata.create_all(bind=engine)

payload = asyncio.run(root())
assert "message" in payload and "docs" in payload

db = SessionLocal()
try:
  dictionaries = get_all_dictionaries(db)
  assert dictionaries.get("success") is True
  assert "data" in dictionaries
finally:
  db.close()

try:
  admin_login(AdminLoginRequest(password="wrong-password"))
  raise AssertionError("admin_login should fail for wrong password")
except HTTPException as exc:
  assert exc.status_code == 401

print("backend smoke test ok")
PY
)
ok "后端 API 冒烟测试通过"

step "前端依赖检查"
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  warn "检测到 node_modules 缺失，正在执行 npm install"
  (
    cd "$FRONTEND_DIR"
    npm install
  )
fi
ok "前端依赖已就绪"

step "前端构建测试"
(
  cd "$FRONTEND_DIR"
  npm run build
)
ok "前端构建通过"

echo -e "\n=========================================="
echo -e "${GREEN}完整性测试完成: $PASSED_STEPS/$TOTAL_STEPS 步通过${NC}"
echo "=========================================="
