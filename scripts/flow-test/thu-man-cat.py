"""Dùng THẬT màn Cắt đoạn lỗi: bấm, kéo mép, thêm khoảng, chuột phải xoá.

Vì sao có tệp này: mọi lần trước tôi chụp ảnh rồi NHÌN, và nhìn thì chỉ thấy
"có hiện ra". Bấm mới thấy "không chạy". Bốn thao tác dưới đây là toàn bộ việc
người dùng làm ở bước này — cái nào cũng phải đổi được dữ liệu và sống qua một
lần tải lại trang.

    python3 scripts/flow-test/thu-man-cat.py <cổng web> <mã dự án> <thư mục ảnh>
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

PORT, PROJECT, SHOTS = sys.argv[1], sys.argv[2], Path(sys.argv[3])
SHOTS.mkdir(parents=True, exist_ok=True)
VIEWPORT = {"width": 1512, "height": 950}

passed, failed = [], []


def check(name: str, ok: bool, detail: str = "") -> None:
    (passed if ok else failed).append(name)
    print(f"  {'ĐẠT ' if ok else 'TRƯỢT'}  {name}{' — ' + detail if detail else ''}")


def spans(page):
    """Các khoảng cắt đang vẽ trên dải, đọc từ máy chủ chứ không từ DOM."""
    rows = page.evaluate(
        """async (id) => {
            const response = await fetch(`/api/projects/${id}/segments`);
            return { status: response.status, body: await response.json() };
        }""",
        PROJECT,
    )
    # Nói RÕ máy chủ trả gì khi hỏng, đừng để nó nổ thành "filter is not a
    # function" — lần trước tôi mất hai lượt chỉ vì thông báo ấy giấu mất
    # nguyên nhân thật (chưa đăng nhập).
    if not isinstance(rows["body"], list):
        raise SystemExit(f"máy chủ trả {rows['status']}: {rows['body']}")
    return [
        {"id": r["id"], "start": r["start_sec"], "end": r["end_sec"]}
        for r in rows["body"]
        if r["removed"] == 1
    ]


def restore(page, target):
    """Đưa tập khoảng cắt về đúng như lúc bắt đầu.

    Phép thử này SỬA dữ liệu thật — kéo mép, thêm, xoá. Không trả lại thì lần
    chạy sau bắt đầu từ một chỗ khác, và có lần trượt vì hết chỗ trống để bấm
    chứ không phải vì sản phẩm hỏng. Mất một lượt mới nhận ra.
    """
    page.evaluate(
        """async ({ id, target }) => {
            const list = () => fetch(`/api/projects/${id}/segments`).then(r => r.json());
            for (const row of (await list()).filter(s => s.removed === 1)) {
                await fetch(`/api/segments/${row.id}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ removed: false }),
                });
            }
            for (const span of [...target].sort((a, b) => b.start - a.start)) {
                await fetch(`/api/projects/${id}/segments/remove-range`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ start: span.start, end: span.end }),
                });
            }
        }""",
        {"id": PROJECT, "target": target},
    )


def main() -> int:
    base = f"http://localhost:{PORT}"
    with sync_playwright() as driver:
        browser = driver.chromium.launch()
        page = browser.new_page(viewport=VIEWPORT, device_scale_factor=1)
        page.set_default_timeout(20_000)

        page.goto(base)
        page.wait_for_load_state("networkidle")
        login = page.get_by_role("button", name="Vào bằng tài khoản dev chung")
        if login.count():
            login.click()
            page.wait_for_load_state("networkidle")
            # Cửa dev đặt cookie phiên rồi mới điều hướng; đi tiếp ngay thì lượt
            # gọi đầu tiên bay đi trước khi có cookie và nhận 401.
            page.wait_for_timeout(1500)

        page.goto(f"{base}/flow/{PROJECT}")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2500)

        # ── 1. Đứng đúng bước, và dải có vẽ ra ─────────────────────────────
        blocks = page.locator("[data-cut-span]")
        before = spans(page)
        baseline = [{"start": s["start"], "end": s["end"]} for s in before]
        check(
            "dải vẽ đủ số khoảng máy đề xuất",
            blocks.count() == len(before) and len(before) > 0,
            f"dải {blocks.count()} · máy chủ {len(before)}",
        )
        lane_box = page.locator("[data-cut-lane]").bounding_box()
        check(
            "dải nằm gọn trong khung, không tràn ngang",
            lane_box["width"] < VIEWPORT["width"],
            f'dải rộng {lane_box["width"]:.0f}px · màn {VIEWPORT["width"]}px',
        )
        check(
            "cả trang không cuộn ngang",
            page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"),
            page.evaluate("`${document.documentElement.scrollWidth} vs ${window.innerWidth}`"),
        )

        wave = page.locator("svg rect")
        check("có băng sóng", wave.count() > 50, f"{wave.count()} cột")
        # Mở màn phải thấy TOÀN BẢN: bước này để soát, mà ở thang mặc định của
        # bàn dựng nó chỉ hiện 5,8 giây trên 118.
        seen = page.evaluate(
            """() => {
                const lane = document.querySelector('[data-cut-lane]');
                const inner = lane.firstElementChild;
                return inner.getBoundingClientRect().width / lane.clientWidth;
            }"""
        )
        check(
            "mở màn thấy trọn bản, không phải một mẩu",
            seen <= 1.001,
            f"dải rộng gấp {seen:.3f} lần khung",
        )
        # Giây CUỐI phải nằm trong khung. "Gần vừa khít" vẫn có thể xén mất đoạn
        # chào kết, mà đó đúng là chỗ người ta hay soát.
        tail = page.evaluate(
            """() => {
                const lane = document.querySelector('[data-cut-lane]');
                const clips = [...lane.querySelectorAll("[data-kind='clip']")];
                if (!clips.length) return null;
                const last = clips[clips.length - 1].getBoundingClientRect();
                const box = lane.getBoundingClientRect();
                return last.right - box.right;
            }"""
        )
        check(
            "khung phim cuối cùng không bị xén khỏi khung",
            tail is not None and tail <= 1,
            f"tràn {tail:.1f}px" if tail is not None else "không thấy clip",
        )
        # Nhãn trên lớp che hẹp phải TẮT, không bị xén ngang chữ.
        cramped = page.evaluate(
            """() => [...document.querySelectorAll('[data-cut-span]')]
                 .filter(el => el.getBoundingClientRect().width < 56 && el.innerText.trim())
                 .length"""
        )
        check("lớp che hẹp không nhét chữ bị xén", cramped == 0, f"{cramped} chỗ")
        page.screenshot(path=str(SHOTS / "cat-01-mo-man.png"))

        # ── 2. Bấm chọn một khoảng ─────────────────────────────────────────
        blocks.first.click()
        page.wait_for_timeout(400)
        check(
            "bấm một khoảng thì nó sáng lên",
            blocks.first.get_attribute("data-state") == "here",
        )
        page.screenshot(path=str(SHOTS / "cat-02-chon.png"))

        # ── 3. Kéo mép phải cho khoảng rộng ra ─────────────────────────────
        handle = page.get_by_label("Gọt mép phải")
        check("khoảng đang chọn hiện tay nắm mép", handle.count() > 0)
        if handle.count():
            box = handle.first.bounding_box()
            page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            page.mouse.down()
            page.mouse.move(box["x"] + 60, box["y"] + box["height"] / 2, steps=12)
            page.mouse.up()
            page.wait_for_timeout(1500)
            after = spans(page)
            grew = [s for s in after if s["end"] - s["start"] > before[0]["end"] - before[0]["start"] + 0.1]
            check(
                "kéo mép thì khoảng rộng ra thật",
                len(grew) > 0,
                f"trước {before[0]['end'] - before[0]['start']:.2f}s",
            )
        page.screenshot(path=str(SHOTS / "cat-03-keo-mep.png"))

        # ── 4. Nút cộng trên vạch thêm một khoảng ──────────────────────────
        #
        # Đưa vạch tới một chỗ CHƯA có khoảng nào. Không suy được toạ độ từ giây
        # nếu chỉ nhìn dải: dải trượt ngang theo vạch. Nên đo ngược từ một khoảng
        # đã biết — nó cho cả thang lẫn gốc toạ độ.
        # Thu nhỏ hết cỡ trước: ở thang mặc định 200px/giây chỉ thấy 5,8 giây
        # của một video 118 giây, nên chỗ trống cần bấm thường nằm ngoài tầm.
        for _ in range(6):
            out = page.get_by_label("Thu nhỏ dải", exact=False).first
            if not out.is_enabled():
                break
            out.click()
            page.wait_for_timeout(150)

        here = spans(page)
        first = page.locator(f"[data-cut-span='{here[0]['id']}']").bounding_box()
        px_per_second = first["width"] / (here[0]["end"] - here[0]["start"])
        origin_x = first["x"] - here[0]["start"] * px_per_second

        def x_of(second: float) -> float:
            return origin_x + second * px_per_second

        # Chỗ trống đầu tiên đủ rộng, nằm trong tầm nhìn.
        box = page.locator("[data-cut-lane]").bounding_box()
        # Đặt vạch ngay SAU mép một khoảng, không đặt vào giữa chỗ trống: nút
        # cộng bỏ đúng 1 giây tính từ vạch, nên đặt giữa một chỗ trống 1,5 giây
        # là khoảng mới chạm vào khoảng kế tiếp rồi bị gộp — số đếm không đổi và
        # trông y như nút không chạy.
        target = None
        for a, b in zip(here, here[1:]):
            at = a["end"] + 0.15
            if b["start"] - a["end"] >= 1.4 and box["x"] + 8 < x_of(at) < box["x"] + box["width"] - 40:
                target = at
                break
        check("tìm được chỗ trống để thêm", target is not None)

        count_before = len(here)
        if target is not None:
            page.mouse.click(x_of(target), box["y"] + box["height"] - 8)
            page.wait_for_timeout(400)
            # Vạch phải dừng ĐÚNG chỗ bấm. Không đo riêng chỗ này thì một cú lệch
            # toạ độ hiện ra thành "nút cộng hỏng", và tôi đi sửa nhầm chỗ.
            landed = page.evaluate("() => document.querySelector('video')?.currentTime ?? -1")
            check(
                "bấm vào dải thì vạch dừng đúng chỗ bấm",
                abs(landed - target) < 0.15,
                f"xin {target:.2f}s · tới {landed:.2f}s",
            )
            page.get_by_label("Thêm khoảng cắt tại đây").click()
            page.wait_for_timeout(1800)
            check(
                "nút cộng thêm được một khoảng",
                len(spans(page)) == count_before + 1,
                f"{count_before} → {len(spans(page))} (tại {target:.1f}s)",
            )
        page.screenshot(path=str(SHOTS / "cat-04-them.png"))

        # ── 5. Chuột phải xoá một khoảng ───────────────────────────────────
        count_before = len(spans(page))
        page.locator("[data-cut-span]").last.click(button="right")
        page.wait_for_timeout(500)
        page.screenshot(path=str(SHOTS / "cat-05-chuot-phai.png"))
        item = page.get_by_role("menuitem", name="Xoá khoảng cắt")
        check("chuột phải bày mục xoá", item.count() > 0)
        if item.count():
            item.click()
            page.wait_for_timeout(1500)
            check(
                "xoá thì bớt một khoảng",
                len(spans(page)) == count_before - 1,
                f"{count_before} → {len(spans(page))}",
            )

        # ── 6. Hoàn tác ────────────────────────────────────────────────────
        undo = page.get_by_label("Hoàn tác", exact=False)
        check("có nút hoàn tác", undo.count() > 0)
        if undo.count() and undo.first.is_enabled():
            count_before = len(spans(page))
            undo.first.click()
            page.wait_for_timeout(2500)
            check(
                "hoàn tác trả lại khoảng vừa xoá",
                len(spans(page)) == count_before + 1,
                f"{count_before} → {len(spans(page))}",
            )
        page.screenshot(path=str(SHOTS / "cat-07-hoan-tac.png"))

        # ── 7. Sống qua tải lại ────────────────────────────────────────────
        keep = len(spans(page))
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2500)
        check(
            "tải lại vẫn đúng số khoảng",
            page.locator("[data-cut-span]").count() == keep,
        )

        # ── 8. Hai nút phóng ───────────────────────────────────────────────
        #
        # Đo THANG, không đo bề rộng một thẻ `svg` bất kỳ: `svg` đầu tiên trong
        # trang là một icon lucide, đo nó ra một con số không đổi và tôi suýt
        # kết luận nhầm là nút phóng hỏng.
        def scale() -> float:
            rows = spans(page)
            box = page.locator(f"[data-cut-span='{rows[0]['id']}']").bounding_box()
            return box["width"] / (rows[0]["end"] - rows[0]["start"])

        zoom_in = page.get_by_label("Phóng to dải", exact=False)
        check("có nút phóng của bàn dựng", zoom_in.count() > 0)
        if zoom_in.count():
            before_scale = scale()
            zoom_in.first.click()
            page.wait_for_timeout(600)
            after_scale = scale()
            check(
                "phóng to thì thang giãn ra",
                after_scale > before_scale * 1.1,
                f"{before_scale:.0f} → {after_scale:.0f} px/giây",
            )
        page.screenshot(path=str(SHOTS / "cat-06-phong-to.png"))

        # ── 8b. Kéo mép TRÁI, và kéo THU HẸP ────────────────────────────────
        #
        # Trước đây chỉ thử mép phải và chỉ thử nới rộng. Hai chiều còn lại đi qua
        # nhánh mã khác (`clamp` cận trên thay cận dưới), và cú kéo ở mức phóng
        # KHÁC lại đi qua đúng phép đổi toạ độ từng lệch 8px.
        rows = spans(page)
        wide = max(rows, key=lambda r: r["end"] - r["start"])
        page.locator(f"[data-cut-span='{wide['id']}']").click()
        page.wait_for_timeout(400)
        left = page.get_by_label("Gọt mép trái").first
        if left.count():
            box = left.bounding_box()
            page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            page.mouse.down()
            page.mouse.move(box["x"] + 25, box["y"] + box["height"] / 2, steps=10)
            page.mouse.up()
            page.wait_for_timeout(1500)
            after = spans(page)
            shrunk = next((s for s in after if abs(s["end"] - wide["end"]) < 0.3), None)
            check(
                "kéo mép trái vào trong thì khoảng ngắn lại",
                shrunk is not None
                and shrunk["start"] > wide["start"] + 0.1
                and shrunk["end"] - shrunk["start"] < wide["end"] - wide["start"],
                f'{wide["end"] - wide["start"]:.2f}s → '
                + (f'{shrunk["end"] - shrunk["start"]:.2f}s' if shrunk else "mất"),
            )
        page.screenshot(path=str(SHOTS / "cat-09-mep-trai.png"))

        # ── 8c. Xoá bằng nút thùng rác ở hàng soát ─────────────────────────
        count_before = len(spans(page))
        bin_button = page.get_by_label("Xoá khoảng cắt", exact=False).first
        check("hàng soát có nút xoá", bin_button.count() > 0)
        if bin_button.count():
            bin_button.click()
            page.wait_for_timeout(1500)
            check(
                "nút thùng rác xoá được khoảng",
                len(spans(page)) == count_before - 1,
                f"{count_before} → {len(spans(page))}",
            )

        # ── 8d. Bấm một dòng ở hàng soát thì dải chọn theo ─────────────────
        rows = spans(page)
        page.get_by_label("Nghe chỗ này").first.wait_for(state="visible")
        first_row = page.locator("[data-state]").filter(has=page.get_by_label("Nghe chỗ này")).first
        first_row.click()
        page.wait_for_timeout(500)
        lit = page.locator("[data-cut-span][data-state='here']")
        check("bấm dòng bên trái thì dải sáng theo", lit.count() == 1, f"{lit.count()} khoảng sáng")

        # ── 9. Phát bản đã cắt: phải NHẢY QUA chỗ bỏ ───────────────────────
        #
        # Đây là lời hứa lõi của bước: nghe ra ngay bản dựng sẽ thế nào. Nếu nó
        # phát cả chỗ sắp bỏ thì người dùng soát trên một thứ không phải kết quả.
        # Chọn khoảng bỏ nào cũng được, miễn đủ dài để phân biệt "nhảy qua" với
        # "phát bình thường" — buộc nó phải nằm ở đầu bản là ràng buộc của phép
        # thử, không phải của sản phẩm, và có lần dựng không có khoảng nào ở đó.
        now = spans(page)
        head = next((s for s in now if s["start"] > 1 and s["end"] - s["start"] > 1.2), None)
        check("có một khoảng bỏ đủ dài để thử", head is not None)
        if head:
            page.evaluate(
                "(at) => { document.querySelector('video').currentTime = at; }",
                max(0, head["start"] - 0.4),
            )
            page.wait_for_timeout(400)
            page.get_by_role("button", name="Phát bản đã cắt").click()
            page.wait_for_timeout(1200)
            at = page.evaluate("() => document.querySelector('video').currentTime")
            check(
                "phát thì nhảy qua chỗ bỏ",
                at >= head["end"] - 0.05,
                f'dừng ở {at:.2f}s · chỗ bỏ {head["start"]:.2f}→{head["end"]:.2f}',
            )
            page.get_by_role("button", name="Dừng").click()
            page.wait_for_timeout(300)

        # ── 10. Nghe thử một chỗ: phải phát ĐÚNG chỗ ấy, không nhảy qua ────
        row = page.locator("[data-state] >> text=/^0:\\d\\d · /").first
        listen = page.get_by_label("Nghe chỗ này").first
        check("hàng soát có nút nghe", listen.count() > 0)
        if listen.count():
            listen.click()
            page.wait_for_timeout(1200)
            playing = page.evaluate("() => { const v=document.querySelector('video'); return {t: v.currentTime, paused: v.paused}; }")
            check(
                "nghe thử thì phát thật, không bị nhảy qua",
                not playing["paused"],
                f'mốc {playing["t"]:.2f}s · dừng={playing["paused"]}',
            )
            page.evaluate("() => document.querySelector('video').pause()")
        page.screenshot(path=str(SHOTS / "cat-08-phat.png"))

        restore(page, baseline)
        page.wait_for_timeout(800)
        check(
            "trả dữ liệu về đúng như lúc bắt đầu",
            len(spans(page)) == len(baseline),
            f"{len(spans(page))} · nền {len(baseline)}",
        )

        browser.close()

    print(f"\n{len(passed)} đạt, {len(failed)} trượt")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
