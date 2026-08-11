"""Chạy trọn một lượt dựng trên BẢN ĐANG CHẠY THẬT, qua container thử.

Khác `walk-flow.py`: cái kia bấm nút "Vào bằng tài khoản dev chung", mà nút ấy bị
`import.meta.env.DEV` xoá hẳn khỏi bản dựng production — nên trên ảnh thật nó
không tồn tại. Ở đây đăng nhập bằng API rồi nạp cookie vào trình duyệt.

    python3 thu-server.py <cổng> <video> <thư mục ảnh>
"""

import json
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

PORT, VIDEO, SHOTS = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
SHOTS.mkdir(parents=True, exist_ok=True)
BASE = f"http://localhost:{PORT}"

DEV_EMAIL = "dev@teddit.local"
DEV_PASSWORD = "dev-only-password-2026"
VIEWPORT = {"width": 1512, "height": 950}
# Máy chủ chép lời bằng CPU chứ không phải chip Apple — chậm hơn nhiều so với máy
# phát triển, và đây chính là thứ cần đo.
BUILD_TIMEOUT = 1_800_000

loi_trang: list = []


def dang_nhap() -> str:
    """Lấy cookie phiên qua cửa dev, trả về giá trị cookie."""
    req = urllib.request.Request(
        f"{BASE}/api/auth/sign-in/email",
        data=json.dumps({"email": DEV_EMAIL, "password": DEV_PASSWORD}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        for k, v in res.getheaders():
            if k.lower() == "set-cookie" and "session_token" in v:
                return v.split(";")[0].split("=", 1)[1]
    raise SystemExit("không lấy được cookie phiên")


def shot(page, name: str) -> None:
    page.screenshot(path=str(SHOTS / f"{name}.png"))
    print(f"  ✓ {name}")


def main() -> int:
    token = dang_nhap()
    print("1 · đã đăng nhập qua cửa dev")

    with sync_playwright() as driver:
        browser = driver.chromium.launch()
        ctx = browser.new_context(viewport=VIEWPORT, device_scale_factor=1)
        ctx.add_cookies([{
            "name": "better-auth.session_token", "value": token,
            "domain": "localhost", "path": "/",
        }])
        page = ctx.new_page()
        page.set_default_timeout(60_000)
        page.on("pageerror", lambda e: loi_trang.append(f"PAGEERROR {e}"))
        page.on("console", lambda m: loi_trang.append(m.text) if m.type == "error" else None)

        print("2 · mở màn nạp tệp")
        page.goto(f"{BASE}/upload")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1_500)
        shot(page, "01-nap-tep-trong")

        print("3 · thả video")
        page.set_input_files("input[type=file]", str(VIDEO))
        page.wait_for_timeout(6_000)
        page.wait_for_load_state("networkidle")
        shot(page, "02-da-nap")

        print("4 · bắt đầu dựng")
        page.get_by_role("button", name="Bắt đầu chép lời").click()
        page.wait_for_url("**/pipeline/**", timeout=60_000)
        page.wait_for_timeout(3_000)
        shot(page, "03-man-cho")

        print("5 · chờ mạch dựng (chép lời bằng CPU — có thể lâu)")
        page.wait_for_selector(
            "button:not([disabled]):has-text('Mở trình sửa')", timeout=BUILD_TIMEOUT
        )
        page.wait_for_timeout(2_000)
        shot(page, "04-cho-xong")

        print("6 · vào bàn dựng")
        page.get_by_role("button", name="Mở trình sửa").click()
        page.wait_for_url("**/flow/**", timeout=60_000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(4_000)
        shot(page, "05-ban-dung")

        chu = page.inner_text("body")
        print(f"   bản chép lời có chữ: {'Bản chép lời' in chu}")

        print("7 · xuất video")
        page.get_by_role("button", name="Xuất video").click()
        page.wait_for_selector(
            "a:has-text('Tải video về'), button:has-text('Tải video về')",
            timeout=BUILD_TIMEOUT,
        )
        page.wait_for_timeout(1_500)
        shot(page, "06-xuat-xong")

        browser.close()

    print(f"\nlỗi trang: {loi_trang[:5] or 'không có'}")
    return 1 if loi_trang else 0


if __name__ == "__main__":
    sys.exit(main())
