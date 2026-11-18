#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
source scripts/compose-common.sh

compose_for_mode "${1:-dev}"
read -r -p '1) 移除容器 2) 同时移除 Compose 管理的卷 [默认: 1] ' option || option=1
case "${option:-1}" in
  1) "${compose[@]}" down ;;
  2) "${compose[@]}" down -v ;;
  *) printf '无效选项。\n' >&2; exit 2 ;;
esac
printf '操作完成。PostgreSQL 宿主机绑定目录不受此操作影响。\n'
