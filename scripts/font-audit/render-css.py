"""Chụp bảng chữ mẫu qua đường vẽ CSS, để đặt cạnh bản ffmpeg mà soi.

Dựng một máy chủ tĩnh ở gốc dự án rồi mở `audit.html` bằng Chromium: `fetch`
không chạy trên `file://`, và `/assets/fonts/` cũng phải giải được từ gốc.

    python3 scripts/font-audit/render-css.py
"""

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = (
    ROOT / "plans" / "260731-1046-caption-style-packs" / "reports" / "font-audit"
)
PORT = 8731


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):  # noqa: D102 - im lặng, chỉ chạy vài giây
        pass


def serve() -> socketserver.TCPServer:
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    server = serve()
    try:
        with sync_playwright() as driver:
            browser = driver.chromium.launch()
            page = browser.new_page(viewport={"width": 1080, "height": 1920})
            page.goto(f"http://127.0.0.1:{PORT}/scripts/font-audit/audit.html")
            page.wait_for_selector("body[data-ready='1']", timeout=30000)
            for sheet in page.query_selector_all(".sheet"):
                font_id = sheet.get_attribute("data-font-id")
                target = OUTPUT_DIR / f"css-{font_id}.png"
                sheet.screenshot(path=str(target))
                print(f"✓ css-{font_id}.png")
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
