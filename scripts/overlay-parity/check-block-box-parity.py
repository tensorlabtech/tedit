"""So CHỖ ĐỨNG của khối chữ giữa hai đường vẽ.

Khác `check-overlay-parity.py`: trang kia so số dòng và cỡ chữ — hai thứ tính
được bằng hàm thuần, nên nó không bao giờ chạm tới CSS. Cái này dựng thật
component rồi đo bằng `getBoundingClientRect`.

Vì sao phải có: đệm DỌC của nền khối nở hộp dòng bên trang xem mà bên máy chủ
không tính, nên khối chữ của bộ "Lửa" xuất ra thấp hơn trang xem 86 điểm ảnh —
suốt thời gian đó phép so cũ vẫn báo khớp 100%. Một phép so không chạm tới CSS
thì không bắt được lỗi nằm ở CSS.

    python3 scripts/overlay-parity/check-block-box-parity.py [cổng Vite]
"""

import json
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PORT = sys.argv[1] if len(sys.argv) > 1 else "5173"
VERBOSE = "-v" in sys.argv

# 1,6% chiều cao khung ≈ 31 điểm ảnh ở khổ 1920.
#
# Con số này KHÔNG phải chọn cho dễ đạt — nó là mức mà sai số đã biết của phép
# dò cỡ chữ đẩy tới. Hai bên dò cỡ theo cùng một bước 0,005, và ở vài cụm chúng
# dừng lệch nhau ĐÚNG MỘT NẤC; `check-overlay-parity.py` ghi nhận đúng những cụm
# ấy dưới nhãn "nhắc 5%". Một nấc cỡ chữ nhân với ba hàng ra chừng 1,5% chiều
# cao khung — nên đặt ngưỡng chặt hơn là bắt lại một thứ bộ kiểm kia đã cân nhắc
# và chấp nhận.
#
# Trước khi nới, đã sửa hai nguyên nhân THẬT mà phép đo này bắt được: đệm dọc
# nền khối thiếu trong chiều cao hàng (86 điểm ảnh) và thanh chống hộp dòng của
# trình duyệt (40 điểm ảnh).
MAX_DIFF = 0.016


def server_rows() -> list[dict]:
    out = subprocess.run(
        ["npx", "tsx", "scripts/overlay-parity/dump-server-block-box.ts"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(out.stdout.strip().splitlines()[-1])


def main() -> int:
    server = {(row["pack"], row["caseIndex"]): row for row in server_rows()}

    with sync_playwright() as driver:
        browser = driver.chromium.launch()
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.goto(f"http://localhost:{PORT}/scripts/overlay-parity/block-box-page.html")
        page.wait_for_function("() => window.__blockReady === true", timeout=60_000)
        page.wait_for_timeout(400)
        web = page.evaluate("() => window.__blockBoxes()")
        browser.close()

    print(f"{'bộ dáng':<16}{'ca':>4}{'mép trên':>12}{'mép dưới':>12}")
    print("-" * 44)
    failed = 0
    for row in web:
        key = (row["pack"], row["caseIndex"])
        mine = server.get(key)
        if not mine:
            print(f"{row['pack']:<16}{row['caseIndex']:>4}  KHÔNG CÓ Ở MÁY CHỦ")
            failed += 1
            continue
        top = abs(row["top"] - mine["top"])
        bottom = abs(row["bottom"] - mine["bottom"])
        bad = top > MAX_DIFF or bottom > MAX_DIFF
        if bad:
            failed += 1
        if bad or VERBOSE:
            print(
                f"{row['pack']:<16}{row['caseIndex']:>4}"
                f"{top:>12.4f}{bottom:>12.4f}{'  ← LỆCH' if bad else ''}"
            )

    total = len(web)
    print()
    if failed:
        print(f"✗ {failed}/{total} khung lệch quá {MAX_DIFF:.3f} chiều cao khung")
        return 1
    print(f"✓ {total}/{total} khung khớp trong {MAX_DIFF:.3f} chiều cao khung")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
