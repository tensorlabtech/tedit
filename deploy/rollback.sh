#!/usr/bin/env bash
#
# Quay về ảnh của lượt deploy trước. Chạy TRÊN máy chủ:
#
#   cd /root/projects/tedit && bash deploy/rollback.sh
#
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

docker image inspect tedit:rollback >/dev/null 2>&1 \
  || { echo "Chưa có tedit:rollback — chưa deploy lần nào sau lượt đầu."; exit 1; }

# Chỉ đổi ảnh, KHÔNG đụng volume: dữ liệu người dùng không thuộc về bản dựng
# nào cả, lùi mã nguồn mà xoá luôn video của họ thì lùi để làm gì.
docker tag tedit:rollback tedit:latest
docker compose up -d --force-recreate
echo "Đã lùi. Kiểm: docker ps --filter name=tedit_"
