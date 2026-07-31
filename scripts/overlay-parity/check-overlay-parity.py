"""Bắt LỆCH giữa hai đường vẽ, chạy được không cần đăng nhập.

`/_dev/overlays` làm đúng việc này nhưng bằng mắt và sau một lượt đăng nhập
Google, nên nó không chạy được trong lượt kiểm tự động. Ở đây hai nửa vẫn là mã
THẬT: nửa máy chủ gọi `layoutText`, nửa trang xem `import` thẳng
`overlay-model.ts` qua máy chủ Vite — không có bản chép nào để trôi khỏi bản gốc.

Cần Vite đang chạy (`npm run dev`). Cổng mặc định 5173, đổi bằng đối số đầu.

    python3 scripts/overlay-parity/check-overlay-parity.py [cổng]
"""

import json
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PORT = sys.argv[1] if len(sys.argv) > 1 else "5173"

# Hai ngưỡng, vì hai mức nghiêm trọng khác hẳn nhau.
#
# SỐ DÒNG lệch là hỏng thật: khung xem bày hai dòng mà video ra ba dòng, người
# dùng canh xong xuất ra khác hẳn. Luôn báo hỏng.
#
# CỠ CHỮ lệch vài phần trăm thì không: hai đường ĐO khác nhau (`magick label:` ở
# máy chủ, `measureText` ở trình duyệt) nên không bao giờ bằng nhau tuyệt đối.
# Đo ngày 31-07-2026: lệch dưới 2% ở chữ thường, tới 11% ở vài tiếng chữ HOA có
# dấu chồng (`ỮA`, `ẮT`). Trên 8% thì bắt đầu đổi được chỗ bẻ dòng nên mới là
# hỏng; giữa 3% và 8% chỉ nhắc.
SCALE_WARN = 0.03
SCALE_FAIL = 0.08


def server_rows() -> list[dict]:
    out = subprocess.run(
        ["npx", "tsx", "scripts/overlay-parity/dump-server-layout.ts"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(out.stdout.strip().splitlines()[-1])


def client_rows() -> list[dict]:
    with sync_playwright() as driver:
        browser = driver.chromium.launch()
        page = browser.new_page()
        page.goto(f"http://localhost:{PORT}/scripts/overlay-parity/parity-page.html")
        # `wait_for_selector` không dùng được: trang này không vẽ gì cả nên
        # `<body>` luôn ở trạng thái ẩn, và phép chờ mặc định chờ hiện ra.
        page.wait_for_function("() => window.__parity !== undefined", timeout=30000)
        rows = page.evaluate("window.__parity")
        browser.close()
    return rows


def main() -> int:
    server = server_rows()
    client = client_rows()

    print(f"{'bộ dáng':<15}{'cụm':<40}{'dải':<8}{'dòng':>10}{'cỡ chữ':>18}")
    print("-" * 93)
    broken, warned = 0, 0
    for a, b in zip(server, client):
        gap = abs(a["scale"] - b["scale"]) / a["scale"]
        if a["lines"] != b["lines"] or gap > SCALE_FAIL:
            mark, broken = " ← LỆCH", broken + 1
        elif gap > SCALE_WARN:
            mark, warned = f" ← nhắc {gap * 100:.0f}%", warned + 1
        else:
            mark = ""
        label = (a["text"][:37] + "…") if len(a["text"]) > 38 else a["text"]
        print(
            f"{a['pack']:<15}{label:<40}{a['band']:<8}"
            f"{a['lines']:>5}/{b['lines']:<4}"
            f"{a['scale']:>9.3f}/{b['scale']:<8.3f}{mark}"
        )

    print()
    if broken:
        print(f"✗ {broken}/{len(server)} cụm LỆCH")
        return 1
    print(f"✓ {len(server)}/{len(server)} cụm khớp" + (f" ({warned} cụm chỉ nhắc)" if warned else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
