# 供根目录的启动和停止脚本引用。
compose_for_mode() {
  case "$1" in
    1|dev) compose=(docker compose -f docker-compose.yml) ;;
    2|prod) compose=(docker compose -f docker-compose.prod.yml) ;;
    *) printf '未知模式：%s（请使用 dev 或 prod）\n' "$1" >&2; return 2 ;;
  esac
  if ! docker compose version >/dev/null 2>&1; then
    printf '需要 Docker 和 Docker Compose v2。\n' >&2
    return 1
  fi
}
