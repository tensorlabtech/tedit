"""Đo LỆCH MÀU giữa hai đường nắn màu: ffmpeg và bộ lọc SVG của trang xem.

`scripts/overlay-parity/` chỉ so CHỮ — nó không biết gì về màu. Nên trục nắn màu
vừa thêm vào là một chỗ hai đường vẽ trôi khỏi nhau mà không có gì bắt được.

Cách đo: lấy MỘT tấm ảnh mẫu, cho ffmpeg nắn màu, cho Chromium nắn màu bằng đúng
bộ lọc SVG mà trang xem dùng, rồi so từng điểm ảnh.

Ảnh mẫu là một dải màu dựng bằng ffmpeg chứ không phải khung hình thật: khung
hình thật tập trung ở vùng tối, nên nó giấu mất chỗ lệch ở vùng sáng và ở màu
bão hoà — mà đó đúng là chỗ hai công thức xa nhau nhất.

    python3 scripts/style-packs/measure-grade-parity.py [cổng Vite]
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PORT = sys.argv[1] if len(sys.argv) > 1 else "5173"
SIZE = (480, 270)

# Trên mức này thì mắt bắt đầu nhận ra hai bên là hai màu khác nhau. Dưới nó thì
# lệch vẫn có nhưng nằm trong sai số của chính việc mã hoá ảnh.
MAX_MEAN_DIFF = 6.0


def packs() -> list[dict]:
    out = subprocess.run(
        [
            "npx",
            "tsx",
            "-e",
            "import { STYLE_PACKS } from './server/style-pack-catalog';"
            "import { gradeFilter } from './server/style-pack';"
            "console.log(JSON.stringify(STYLE_PACKS.map(p => "
            "({ id: p.id, label: p.label, grade: p.grade, filter: gradeFilter(p.grade) }))));",
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(out.stdout.strip().splitlines()[-1])


def make_source(path: Path) -> None:
    """Dải màu chuẩn + dải xám: phủ cả màu bão hoà lẫn toàn thang sáng tối."""
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-y",
            "-f", "lavfi", "-i", f"smptebars=s={SIZE[0]}x{SIZE[1] // 2}",
            "-f", "lavfi", "-i", f"gradients=s={SIZE[0]}x{SIZE[1] // 2}:c0=black:c1=white:nb_colors=2",
            "-filter_complex", "[0:v][1:v]vstack=inputs=2",
            "-frames:v", "1", str(path),
        ],
        check=True,
    )


def grade_with_ffmpeg(source: Path, target: Path, chain: str) -> None:
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(source), "-vf", chain, "-frames:v", "1", str(target)],
        check=True,
    )


def mean_diff(a: Path, b: Path) -> float:
    out = subprocess.run(
        ["magick", "compare", "-metric", "MAE", str(a), str(b), "null:"],
        capture_output=True,
        text=True,
    )
    # `MAE` in ra dạng "1234.5 (0.018)" — lấy số tuyệt đối trên thang 0–255.
    raw = (out.stderr or out.stdout).strip().split()[0]
    return float(raw) / 257.0


def main() -> int:
    work = Path(tempfile.mkdtemp(prefix="grade-"))
    # Ảnh mẫu phải nằm TRONG repo để máy chủ Vite phục vụ được cho trang kiểm.
    source = ROOT / "scripts" / "style-packs" / "grade-source.png"
    make_source(source)

    rows = [row for row in packs() if row["grade"]]
    print(f"{'phong cách':<16}{'lệch trung bình':>18}")
    print("-" * 36)

    failed = 0
    with sync_playwright() as driver:
        browser = driver.chromium.launch()
        page = browser.new_page(
            viewport={"width": SIZE[0], "height": SIZE[1]},
            device_scale_factor=1,
        )
        page.goto(f"http://localhost:{PORT}/scripts/style-packs/grade-parity-page.html")
        page.wait_for_function("() => window.__gradeReady === true", timeout=30000)

        for row in rows:
            ffmpeg_out = work / f"{row['id']}-ffmpeg.png"
            grade_with_ffmpeg(source, ffmpeg_out, row["filter"])

            page.evaluate("(id) => window.__applyGrade(id)", row["id"])
            page.wait_for_timeout(60)
            web_out = work / f"{row['id']}-web.png"
            page.locator("#plate").screenshot(path=str(web_out))

            diff = mean_diff(ffmpeg_out, web_out)
            mark = "" if diff <= MAX_MEAN_DIFF else "  ← LỆCH"
            if mark:
                failed += 1
            print(f"{row['label']:<16}{diff:>15.2f}/255{mark}")
        browser.close()

    print()
    if failed:
        print(f"✗ {failed}/{len(rows)} phong cách lệch quá {MAX_MEAN_DIFF}/255")
        return 1
    print(f"✓ {len(rows)}/{len(rows)} phong cách khớp trong {MAX_MEAN_DIFF}/255")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
