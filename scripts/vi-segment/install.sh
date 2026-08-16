#!/bin/sh
# Cài môi trường Python cho TÁCH TỪ tiếng Việt (underthesea) — dùng ở chunker phụ đề.
# Chạy một lần trên mỗi máy: `sh scripts/vi-segment/install.sh`
set -e
cd "$(dirname "$0")"

# virtualenv trước (khỏi phụ thuộc `python3 -m venv`); không có thì thử venv chuẩn.
python3 -m virtualenv vienv 2>/dev/null || python3 -m venv vienv
vienv/bin/pip install -q --disable-pip-version-check underthesea

echo "Xong. Server tự tìm scripts/vi-segment/vienv/bin/python3."
echo "Muốn dùng python khác thì đặt env VI_SEGMENT_PYTHON=<đường-dẫn>."
