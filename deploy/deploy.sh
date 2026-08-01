#!/usr/bin/env bash
#
# Đưa bản mới lên máy chủ. Chạy TRÊN máy chủ:
#
#   cd /root/projects/tedit && git pull && bash deploy/deploy.sh
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

say() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }

[[ -f ../.env ]] || { echo "Thiếu ../.env — chép từ .env.example rồi điền."; exit 1; }

say "Giữ ảnh đang chạy làm bản lùi"
# Gắn thẻ TRƯỚC khi dựng: dựng xong mới gắn thì `tedit:latest` đã trỏ sang ảnh
# mới, và bản lùi thành chính bản vừa hỏng.
if docker image inspect tedit:latest >/dev/null 2>&1; then
	docker tag tedit:latest tedit:rollback
	echo "  đã gắn tedit:rollback"
else
	echo "  chưa có ảnh nào — lượt dựng đầu"
fi

say "Dựng ảnh"
# Máy chủ chỉ còn khoảng 4 GB nhớ trống và swap 2 GB. Một tiến trình dựng thôi,
# không song song: `npm ci` với cây phụ thuộc này là chỗ ngốn nhớ nhất.
docker compose build --progress plain

say "Khởi động"
docker compose up -d

say "Nối vào edge Caddy"
# Chạy lại nhiều lần không sao — Docker báo lỗi "already exists" thì bỏ qua.
docker network connect tedit_default vas-printing-edge-1 2>/dev/null \
	&& echo "  đã nối" || echo "  đã nối từ trước"

say "Chờ máy chủ nhận việc"
# Lượt đầu phải tải mô hình nghe (~1,5 GB) nên chờ lâu hơn nhiều so với cảm giác.
for i in $(seq 1 60); do
	if docker exec tedit_app node -e "fetch('http://127.0.0.1:5190/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
		echo "  ✓ sống sau $((i * 5))s"
		break
	fi
	if [[ $i -eq 60 ]]; then
		echo "  ✗ không lên sau 5 phút — xem: docker logs tedit_app --tail 50"
		exit 1
	fi
	sleep 5
done

say "Deploy hoàn tất"
docker ps --filter name=tedit_ --format "{{.Names}}\t{{.Status}}"
