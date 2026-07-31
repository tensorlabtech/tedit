#!/usr/bin/env bash
#
# Đưa bản mới lên máy chủ đang chạy. Chạy TRÊN máy chủ:
#
#   sudo bash /srv/tedit/deploy/update.sh
#
# Khác với `setup-ubuntu.sh` (chạy một lần, cài cả máy), script này chạy mỗi lần
# ra bản mới và chỉ đụng vào mã nguồn.
#
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/tedit}"
APP_USER="tedit"

say() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }
cd "$APP_DIR"

TRUOC="$(git rev-parse --short HEAD)"

say "Lấy mã mới"
git fetch --quiet origin
git reset --hard --quiet "origin/$(git rev-parse --abbrev-ref HEAD)"

if [[ "$TRUOC" == "$(git rev-parse --short HEAD)" ]]; then
	say "Không có gì mới ($TRUOC) — dừng."
	exit 0
fi

say "Gói Node"
npm install --include=dev --no-audit --no-fund

say "Dựng bản web"
# DỰNG TRƯỚC khi khởi động lại: `dist/` cũ vẫn phục vụ được người dùng suốt lúc
# dựng, nên trang không chết trong hai phút. Dựng hỏng thì bản cũ vẫn nguyên.
npm run build

say "Quyền"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

say "Khởi động lại"
systemctl restart tedit
sleep 3
systemctl is-active --quiet tedit && echo "✓ đang chạy" || {
	echo "✗ không lên được — xem: journalctl -u tedit -n 50"
	exit 1
}

say "Đã lên bản $(git rev-parse --short HEAD) (từ $TRUOC)"
git log --oneline "$TRUOC..HEAD" | head -10
