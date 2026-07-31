#!/usr/bin/env bash
#
# Cài Tedit lên một máy Ubuntu trắng (thử trên 24.04). Chạy MỘT LẦN, bằng sudo:
#
#   sudo bash deploy/setup-ubuntu.sh
#
# Chạy lại lần nữa cũng không sao — mọi bước đều kiểm tra trước khi làm.
#
set -euo pipefail

DOMAIN="${DOMAIN:-tedit.tensorlab.tech}"
APP_DIR="${APP_DIR:-/srv/tedit}"
APP_USER="tedit"
REPO="${REPO:-}"

say() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }

[[ $EUID -eq 0 ]] || { echo "Phải chạy bằng sudo."; exit 1; }

say "Gói hệ thống"
apt-get update -qq
# ffmpeg và imagemagick là công cụ dựng; build-essential+python3-dev để
# better-sqlite3 tự biên dịch khi không có bản dựng sẵn cho máy này.
apt-get install -y -qq \
	ffmpeg imagemagick \
	python3 python3-venv python3-pip python3-dev \
	build-essential git curl ca-certificates debian-keyring debian-archive-keyring apt-transport-https

say "Node 22"
if ! command -v node >/dev/null || [[ "$(node -v | cut -c2-3)" -lt 22 ]]; then
	curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
	apt-get install -y -qq nodejs
fi
node -v

say "Caddy"
if ! command -v caddy >/dev/null; then
	curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
		| gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
		> /etc/apt/sources.list.d/caddy-stable.list
	apt-get update -qq && apt-get install -y -qq caddy
fi

say "Người dùng chạy dịch vụ"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"

say "Mã nguồn ở $APP_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
	[[ -n "$REPO" ]] || { echo "Chưa có mã nguồn. Đặt REPO=git@... rồi chạy lại, hoặc tự chép vào $APP_DIR"; exit 1; }
	git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

say "Bộ nhớ tạm (swap)"
# Gói VPS nhỏ chỉ có 8 GB RAM. Mô hình nghe ngốn khoảng 2 GB, ffmpeg thêm vài
# trăm MB mỗi luồng — thiếu swap thì lượt dựng đầu bị nhân giết mà không báo gì.
if ! swapon --show | grep -q .; then
	fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap -q /swapfile && swapon /swapfile
	grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "Gói Node"
# Cài ĐỦ cả devDependencies: `vite` nằm trong đó mà không có nó thì không dựng
# được bản web. `tsx` cũng vậy — nó chạy phía máy chủ nên là phụ thuộc lúc chạy.
npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund

say "Môi trường nghe (faster-whisper)"
# Máy chủ x86 không dùng được mlx-whisper — MLX là thư viện của Apple, tính trên
# chip Metal. `server/asr/transcribe.py` tự nhận ra điều đó và đổi đường.
python3 -m venv "$APP_DIR/server/asr/venv"
"$APP_DIR/server/asr/venv/bin/pip" install -q --upgrade pip
"$APP_DIR/server/asr/venv/bin/pip" install -q faster-whisper

say "Dựng bản web"
npm run build

say "Quyền thư mục"
mkdir -p "$APP_DIR/server/data" "$APP_DIR/server/asr/hf-cache" /var/log/caddy
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

say "Tệp .env"
if [[ ! -f "$APP_DIR/.env" ]]; then
	cp "$APP_DIR/.env.example" "$APP_DIR/.env"
	# Sinh sẵn khoá ký phiên: để trống là mọi lượt đăng nhập đều hỏng, mà thông
	# báo lỗi lúc đó không hề nói ra nguyên nhân.
	SECRET="$(openssl rand -base64 32)"
	sed -i "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$SECRET|" "$APP_DIR/.env"
	sed -i "s|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=https://$DOMAIN|" "$APP_DIR/.env"
	chmod 600 "$APP_DIR/.env"; chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
	echo "⚠ Đã tạo $APP_DIR/.env — CÒN PHẢI ĐIỀN: OPENROUTER_API_KEY, GOOGLE_CLIENT_ID,"
	echo "  GOOGLE_CLIENT_SECRET, TEDDIT_ALLOWED_EMAILS (bỏ trống là khoá sạch, không ai vào được)."
fi

say "Dịch vụ"
sed "s|/srv/tedit|$APP_DIR|g" "$APP_DIR/deploy/tedit.service" > /etc/systemd/system/tedit.service
sed "s|tedit.tensorlab.tech|$DOMAIN|g" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable tedit >/dev/null
systemctl reload-or-restart caddy

cat <<EOF

Xong phần cài. Còn ba việc phải làm bằng tay:

 1. Trỏ tên miền: bản ghi A của $DOMAIN về IP máy này
      $(curl -s --max-time 5 ifconfig.me || echo '<không lấy được IP>')
    Caddy chỉ xin được chứng chỉ sau khi tên miền đã trỏ đúng.

 2. Điền $APP_DIR/.env — nhất là TEDDIT_ALLOWED_EMAILS.

 3. Google Cloud Console → OAuth client → Authorized redirect URIs, thêm:
      https://$DOMAIN/api/auth/callback/google

 Rồi bật máy chủ:  sudo systemctl start tedit
 Xem nhật ký:      sudo journalctl -u tedit -f
EOF
