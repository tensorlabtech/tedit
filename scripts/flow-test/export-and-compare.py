"""Xuất video THẬT rồi đặt khung hình của nó cạnh khung xem trên web.

Đây là phép kiểm duy nhất trả lời câu "xem một đằng có xuất một nẻo không" bằng
bằng chứng chứ không bằng lý lẽ: `scripts/overlay-parity/` chỉ so số đo CHỮ,
`measure-grade-parity.py` chỉ so MÀU trên một dải mẫu. Cái này so cả khung hình,
với đủ mọi lớp chồng lên nhau — nắn màu, nền khối, emoji, hiệu ứng hiện chữ.

Gọi API qua chính trình duyệt đã đăng nhập chứ không dựng lại phiên bằng curl:
cookie phiên là `httpOnly`, và một đường đăng nhập thứ hai là một đường thứ hai
để hỏng.

    python3 scripts/flow-test/export-and-compare.py <cổng web> <gốc dữ liệu> <thư mục ra>
"""

import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

PORT, DATA_ROOT, OUT = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
OUT.mkdir(parents=True, exist_ok=True)

VIEWPORT = {"width": 1512, "height": 950}
EXPORT_TIMEOUT = 900_000

# Mốc lấy khung: đủ xa mép đầu để chữ đã hiện xong, và rơi vào một cụm có chữ.
AT_SECONDS = 2.2


def main() -> int:
    base = f"http://localhost:{PORT}"
    with sync_playwright() as driver:
        browser = driver.chromium.launch()
        page = browser.new_page(viewport=VIEWPORT, device_scale_factor=1)
        page.set_default_timeout(30_000)

        page.goto(base)
        page.get_by_role("button", name="Vào bằng tài khoản dev chung").click()
        page.wait_for_selector("text=Dự án mới", timeout=60_000)

        projects = page.evaluate(
            "async () => (await fetch('/api/projects')).json()"
        )
        project = projects[0] if isinstance(projects, list) else projects["projects"][0]
        project_id = project["id"]
        print(f"dự án {project_id}")

        page.goto(f"{base}/editor/{project_id}")
        page.wait_for_timeout(5_000)

        # Đưa vạch tới đúng mốc rồi chụp KHUNG XEM.
        page.evaluate(
            "(at) => { const v = document.querySelector('video'); if (v) v.currentTime = at; }",
            AT_SECONDS,
        )
        page.wait_for_timeout(2_500)
        preview = page.locator("[data-slot=card]:has(video)").first
        preview.screenshot(path=str(OUT / "web-khung-xem.png"))
        print("✓ web-khung-xem.png")

        print("xuất video…")
        page.evaluate(
            "async (id) => (await fetch(`/api/projects/${id}/export`, { method: 'POST' })).json()",
            project_id,
        )
        for _ in range(300):
            state = page.evaluate(
                "async (id) => (await fetch(`/api/projects/${id}`)).json()",
                project_id,
            )
            job = next(
                (j for j in state.get("jobs", []) if j["kind"] == "export"), None
            )
            if job and job["status"] in ("done", "error"):
                print(f"  job export: {job['status']}")
                break
            page.wait_for_timeout(3_000)
        browser.close()

    final = DATA_ROOT / "projects" / project_id / "out" / "final.mp4"
    if not final.exists():
        print(f"✗ không thấy {final}")
        return 1

    frame = OUT / "xuat-khung.png"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", str(AT_SECONDS), "-i", str(final),
         "-frames:v", "1", str(frame)],
        check=True,
    )
    print(f"✓ {frame.name}")
    print(f"\nẢnh ở {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
