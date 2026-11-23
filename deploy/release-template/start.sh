#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 docker，请先安装 Docker Engine 和 Compose 插件。"
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "未找到 docker compose 插件，请安装 Docker Compose v2。"
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "已生成 .env。请编辑 SITE_ADDRESS，改成服务器域名或 IP，然后重新执行 sh start.sh"
  exit 1
fi

docker compose up -d
docker compose ps
echo ""
echo "手机端：使用 .env 里的 SITE_ADDRESS 访问"
echo "后台：默认只监听 127.0.0.1:8081，请用 SSH 隧道访问"
