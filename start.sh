#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
source scripts/compose-common.sh

mode=${1:-}
if [[ -z "$mode" ]]; then
  read -r -p '选择启动模式：1) 开发 2) 生产 [默认: 1] ' mode || mode=1
fi
compose_for_mode "${mode:-1}"
if [[ "$mode" == prod || "$mode" == 2 ]]; then
  printf '生产模式使用已发布镜像，请先配置镜像命名空间与标签。\n'
fi
"${compose[@]}" up -d
"${compose[@]}" ps
printf '已提交启动请求；请根据容器状态与日志确认服务可用。\n查看日志：%s logs -f\n' "${compose[*]}"
