# Tedit — một ảnh chứa cả trang và máy chủ.
#
# Gộp làm một chứ không tách web/api như các stack khác trên server này: Fastify
# tự phục vụ `dist/` và cùng một gốc thì cookie phiên đi kèm mọi request mà không
# cần CORS. Tách ra là thêm một container, thêm một khối Caddy, và thêm một chỗ
# để cấu hình lệch nhau.

# ─────────────────────────── dựng ───────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# `python3` và `build-essential` cho better-sqlite3: bản dựng sẵn không có cho
# mọi tổ hợp nền tảng, thiếu thì `npm ci` gãy giữa chừng.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 build-essential ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Cài ĐỦ cả devDependencies: `vite` nằm trong đó, không có nó thì không dựng
# được trang.
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ─────────────────────────── chạy ───────────────────────────
FROM node:22-bookworm-slim
WORKDIR /app

# ffmpeg và imagemagick là công cụ dựng video, không phải thứ tuỳ chọn.
# python3-venv cho máy nghe; build-essential còn lại để better-sqlite3 dựng được
# ở bước cài phần phụ thuộc chạy thật.
#
# `ln magick -> convert`: mã gọi lệnh `magick` (ImageMagick 7), còn Debian 12
# đóng gói bản 6 với tên `convert`. Thiếu cầu này thì đo bề rộng chữ và vẽ mặt
# nạ bo góc đều gãy — hỏng đúng phần bố cục chữ, và hỏng giữa chừng một lượt
# dựng chứ không phải lúc khởi động, nên container vẫn báo khoẻ. Đã thử đúng
# phép mã dùng trên bản 6: nó trả về đúng kết quả.
#
# Chú thích để NGOÀI khối RUN: một dòng `#` chen giữa các dòng nối bằng `\` làm
# shell coi tất cả phần sau nó là chú thích, và lệnh cuối lặng lẽ không chạy.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg imagemagick \
      python3 python3-venv python3-dev \
      build-essential ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/convert /usr/local/bin/magick

# Máy nghe: faster-whisper thay mlx-whisper.
#
# MLX tính trên chip Metal của Apple nên `import mlx_whisper` ném ImportError
# ngay dòng đầu trên x86. `server/asr/transcribe.py` tự nhận ra và đổi đường —
# cùng mô hình `large-v3-turbo`, cùng hình dạng dữ liệu trả về.
#
# Cài vào venv chứ không cài phẳng: Debian chặn `pip install` vào Python hệ
# thống (PEP 668), và `server/transcribe.ts` tìm đúng venv này.
RUN python3 -m venv /app/server/asr/venv \
    && /app/server/asr/venv/bin/pip install -q --no-cache-dir --upgrade pip \
    && /app/server/asr/venv/bin/pip install -q --no-cache-dir faster-whisper

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    # `tsx` chạy phía máy chủ nên nó là phụ thuộc LÚC CHẠY, mà `--omit=dev` vừa
    # bỏ nó đi — cài lại riêng.
    && npm install --no-save --no-audit --no-fund tsx \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY server ./server
COPY assets ./assets
COPY src ./src
COPY tsconfig*.json vite.config.ts ./

# Mô hình nghe (khoảng 1,5 GB) tải về lần chạy đầu. Trỏ vào thư mục có volume
# đè lên, không thì mỗi lần dựng lại ảnh là tải lại từ đầu.
ENV HF_HOME=/app/server/asr/hf-cache
ENV NODE_ENV=production
ENV PORT=5190

EXPOSE 5190
CMD ["node", "node_modules/.bin/tsx", "server/main.ts"]
