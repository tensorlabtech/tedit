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
# KIỂM tra thay vì đoán: `docker network connect` thất bại vì mạng không tồn tại
# cũng ra cùng một mã lỗi với "đã nối rồi", nên `|| echo "đã nối từ trước"` từng
# in ra dòng trấn an trong khi edge chưa hề với tới được container.
docker network connect tedit_default vas-printing-edge-1 2>/dev/null || true
# Thử lại vài lượt: sau khi nối mạng, DNS nội bộ của Docker cần vài giây mới
# phân giải được tên container. Kiểm một phát ngay sau `connect` thì trượt, và
# trượt kiểu ấy trông y hệt một lỗi cấu hình thật.
noi=""
for i in $(seq 1 10); do
	if docker exec vas-printing-edge-1 wget -qO- --timeout=5 http://tedit_app:5190/ >/dev/null 2>&1; then
		noi="ok"; echo "  ✓ edge gọi được tedit_app (sau $((i * 3))s)"; break
	fi
	sleep 3
done
if [[ -z "$noi" ]]; then
	echo "  ✗ edge KHÔNG gọi được tedit_app sau 30s"
	echo "    mạng tedit_app: $(docker inspect tedit_app --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')"
	echo "    mạng edge:      $(docker inspect vas-printing-edge-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')"
	exit 1
fi

say "Chờ máy chủ nhận việc"
# Lượt đầu phải tải mô hình nghe (~1,5 GB) nên chờ lâu hơn nhiều so với cảm giác.
#
# Hỏi `/api/health` chứ không hỏi `/`: `/` là `index.html` tĩnh nên nó trả 200
# kể cả khi CSDL không mở được hay ffmpeg biến khỏi PATH — deploy sẽ báo thành
# công rồi người dùng đầu tiên mới phát hiện ra mọi thao tác đều gãy.
for i in $(seq 1 60); do
	if docker exec tedit_app node -e "fetch('http://127.0.0.1:5190/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
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
