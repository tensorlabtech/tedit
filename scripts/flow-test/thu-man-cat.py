"""Dùng THẬT màn Cắt đoạn lỗi như người dùng cuối — CÙNG tương tác với bàn dựng.

Vì sao viết lại: bản đầu tôi tự dựng một dải trông giống bàn dựng nhưng cư xử
khác — vạch chạy thay vì ghim giữa, bấm-để-tua thay vì kéo, không lăn được. Giờ
màn cắt dùng CHUNG `useTimelineDrag` của bàn dựng, nên phép thử cũng phải kiểm
đúng những nết ấy: kéo dải để tua, lăn để tua, Ctrl+lăn để phóng, vạch ghim
giữa, nút + ra menu, chuột phải chỗ trống thêm / chuột phải khoảng cắt xoá.

Mỗi phép SỬA dữ liệu thật rồi TRẢ LẠI nguyên trạng ở cuối, nên chạy lại được.

    python3 scripts/flow-test/thu-man-cat.py <cổng web> <mã dự án> <thư mục ảnh>
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

PORT, PROJECT, SHOTS = sys.argv[1], sys.argv[2], Path(sys.argv[3])
SHOTS.mkdir(parents=True, exist_ok=True)
VIEWPORT = {"width": 1512, "height": 950}
PX_PER_SECOND = 200  # thang mặc định, khớp bàn dựng

passed, failed = [], []


def check(name: str, ok: bool, detail: str = "") -> None:
    (passed if ok else failed).append(name)
    print(f"  {'ĐẠT ' if ok else 'TRƯỢT'}  {name}{' — ' + detail if detail else ''}")


def spans(page):
    rows = page.evaluate(
        """async (id) => {
            const r = await fetch(`/api/projects/${id}/segments`);
            return { status: r.status, body: await r.json() };
        }""",
        PROJECT,
    )
    if not isinstance(rows["body"], list):
        raise SystemExit(f"máy chủ trả {rows['status']}: {rows['body']}")
    return [
        {"id": r["id"], "s": r["start_sec"], "e": r["end_sec"]}
        for r in rows["body"]
        if r["removed"] == 1
    ]


def restore(page, base):
    """Trả tập khoảng cắt về đúng lúc bắt đầu — để chạy lại được nhiều lần."""
    page.evaluate(
        """async ({ id, base }) => {
            const L = () => fetch(`/api/projects/${id}/segments`).then(r => r.json());
            for (const r of (await L()).filter(s => s.removed === 1))
                await fetch(`/api/segments/${r.id}`, { method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ removed: false }) });
            for (const s of [...base].sort((a, b) => b.s - a.s))
                await fetch(`/api/projects/${id}/segments/remove-range`, { method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ start: s.s, end: s.e, exact: true }) });
        }""",
        {"id": PROJECT, "base": base},
    )


def now(page):
    return page.evaluate("() => document.querySelector('video')?.currentTime ?? -1")


def widest_gap(base):
    """Giữa hai khoảng cắt, khe RỘNG NHẤT — chỗ chắc chắn còn phim để thêm cắt.

    Lấy rộng nhất thay vì đòi một ngưỡng cứng: có bản AI cắt dày, không còn khe
    nào tới 3 giây, mà phép thử vẫn cần một chỗ trống đủ cho một khoảng 1 giây.
    """
    best = None
    for a, b in zip(base, base[1:]):
        if b["s"] - a["e"] > (best[1] - best[0] if best else 1.4):
            best = (a["e"], b["s"])
    return (best[0] + best[1]) / 2 if best else None


def zoom_out_fully(page):
    """Thu nhỏ hết cỡ để khối nào cũng bé và nằm gọn khi đưa về giữa — mới bấm
    trúng ở mọi mức phóng."""
    for _ in range(8):
        btn = page.get_by_label("Thu nhỏ dải", exact=False).first
        if not btn.is_enabled():
            break
        btn.click()
        page.wait_for_timeout(120)


def scrub_to(page, cx, cy, second):
    """Đưa vạch (ghim giữa) tới mốc `second` bằng con LĂN.

    Không kéo chuột: Playwright kẹp con trỏ trong khung, nên một cú kéo dài để
    nhảy vài chục giây bị cắt cụt và không tới đích. Lăn thì không bị kẹp và tới
    đúng nơi — kéo có phép thử riêng bên dưới.
    """
    for _ in range(80):
        cur = now(page)
        if abs(cur - second) < 0.4:
            break
        page.mouse.move(cx, cy)
        page.mouse.wheel(0, 200 if second > cur else -200)
        page.wait_for_timeout(50)
    page.wait_for_timeout(300)


def main() -> int:
    base_url = f"http://localhost:{PORT}"
    with sync_playwright() as driver:
        browser = driver.chromium.launch()
        page = browser.new_page(viewport=VIEWPORT, device_scale_factor=1)
        page.set_default_timeout(20_000)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:160]))

        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        login = page.get_by_role("button", name="Vào bằng tài khoản dev chung")
        if login.count():
            login.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)
        page.goto(f"{base_url}/flow/{PROJECT}")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3500)

        base = [{"s": s["s"], "e": s["e"]} for s in spans(page)]
        lane = page.locator("[data-cut-lane]")
        box = lane.bounding_box()
        cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2

        # ── Nền: dải vẽ ra, gọn trong khung, không lỗi ────────────────────
        check("dải vẽ đủ số khoảng máy đề xuất",
              page.locator("[data-cut-span]").count() == len(base) and len(base) > 0,
              f'{page.locator("[data-cut-span]").count()} · {len(base)}')
        check("dải nằm gọn trong khung",
              box["width"] < VIEWPORT["width"], f'{box["width"]:.0f}px')
        check("có băng sóng", page.locator("svg rect").count() > 50)
        page.screenshot(path=str(SHOTS / "cat-01.png"))

        # ── KÉO dải để tua (bounded, nằm trong khung) ─────────────────────
        # Kéo 300px sang trái ≈ 1,5s tới. Đây là phép chứng minh KÉO chạy; định
        # vị xa thì để con lăn lo (xem `scrub_to`).
        t0 = now(page)
        page.mouse.move(cx, cy)
        page.mouse.down()
        page.mouse.move(cx - 300, cy, steps=15)
        page.mouse.up()
        page.wait_for_timeout(400)
        check("kéo dải sang trái thì tua tới", now(page) > t0 + 1,
              f"{t0:.1f}→{now(page):.1f}s")

        # ── LĂN để tua ────────────────────────────────────────────────────
        t1 = now(page)
        page.mouse.move(cx, cy)
        page.mouse.wheel(0, 400)
        page.wait_for_timeout(300)
        check("lăn chuột thì tua", abs(now(page) - t1) > 1, f"{t1:.1f}→{now(page):.1f}s")

        # ── Ctrl+lăn để PHÓNG ─────────────────────────────────────────────
        def scale():
            rows = spans(page)
            el = page.locator(f"[data-cut-span='{rows[0]['id']}']")
            bb = el.first.bounding_box() if el.count() else None
            return bb["width"] / (rows[0]["e"] - rows[0]["s"]) if bb else None
        s_before = scale()
        page.evaluate("""() => document.querySelector('[data-cut-lane]').dispatchEvent(
            new WheelEvent('wheel', { deltaY: -300, ctrlKey: true, bubbles: true, cancelable: true }))""")
        page.wait_for_timeout(400)
        check("Ctrl+lăn thì phóng to", s_before and scale() and scale() > s_before * 1.1,
              f"{s_before:.0f}→{scale():.0f} px/s" if s_before and scale() else "n/a")
        page.get_by_label("Thu nhỏ dải", exact=False).first.click()
        page.wait_for_timeout(300)

        # ── Nút SIDE-RAIL phóng ───────────────────────────────────────────
        s2 = scale()
        page.get_by_label("Phóng to dải", exact=False).first.click()
        page.wait_for_timeout(400)
        check("nút phóng side-rail chạy", s2 and scale() and scale() > s2 * 1.1)
        page.get_by_label("Thu nhỏ dải", exact=False).first.click()
        page.wait_for_timeout(300)

        # ── Nút + STICK ra menu, thêm ở vạch ──────────────────────────────
        gap0 = widest_gap(base)
        scrub_to(page, cx, cy, gap0)  # tới một khe rộng, tính động
        t_at = now(page)
        before = spans(page)
        page.get_by_label("Thêm đoạn cắt tại vạch").click()
        page.wait_for_timeout(400)
        item = page.get_by_role("menuitem", name="Thêm đoạn cắt tại vạch")
        check("nút + ra menu Thêm đoạn cắt", item.count() > 0)
        if item.count():
            item.click()
            page.wait_for_timeout(1500)
            check("nút + thêm được một khoảng ở vạch",
                  len(spans(page)) == len(before) + 1, f"{len(before)}→{len(spans(page))}")
        restore(page, base)
        page.wait_for_timeout(500)

        # ── Chuột phải CHỖ TRỐNG → thêm tại đúng chỗ bấm ──────────────────
        gap = widest_gap(base)
        if gap:
            scrub_to(page, cx, cy, gap)
            before = spans(page)
            page.mouse.click(cx, cy, button="right")
            page.wait_for_timeout(400)
            add = page.get_by_role("menuitem", name="Thêm đoạn cắt tại đây")
            check("chuột phải chỗ trống ra menu Thêm", add.count() > 0)
            if add.count():
                add.click()
                page.wait_for_timeout(1500)
                after = spans(page)
                new = [s for s in after if not any(abs(s["s"] - o["s"]) < 0.05 for o in before)]
                check("thêm đúng chỗ bấm (không phải chỗ khác)",
                      len(after) == len(before) + 1 and new and abs((new[0]["s"] + new[0]["e"]) / 2 - gap) < 1.5,
                      f'khe {gap:.1f}s · khoảng {new[0]["s"]:.1f}→{new[0]["e"]:.1f}' if new else "không thêm")
            restore(page, base)
            page.wait_for_timeout(500)

        # ── GỌT MÉP một khoảng ────────────────────────────────────────────
        # Đưa chính khoảng đầu về GIỮA khung rồi mới bấm: sau các bước phóng/thu,
        # zoom không chắc về 200, nên "bấm phần tử đầu" có thể rơi ngoài khung.
        zoom_out_fully(page)
        first = spans(page)[0]
        scrub_to(page, cx, cy, (first["s"] + first["e"]) / 2)
        page.locator("[data-cut-span]").first.click()
        page.wait_for_timeout(300)
        h = page.get_by_label("Gọt mép phải")
        check("span chọn hiện tay nắm mép", h.count() > 0)
        if h.count():
            b0 = spans(page)[0]
            hb = h.first.bounding_box()
            page.mouse.move(hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2)
            page.mouse.down()
            page.mouse.move(hb["x"] + 80, hb["y"] + hb["height"] / 2, steps=12)
            page.mouse.up()
            page.wait_for_timeout(1500)
            a0 = [s for s in spans(page) if abs(s["s"] - b0["s"]) < 0.1]
            check("gọt mép phải thì khoảng dài ra",
                  a0 and (a0[0]["e"] - a0[0]["s"]) > (b0["e"] - b0["s"]) + 0.1,
                  f'{b0["e"]-b0["s"]:.2f}→{a0[0]["e"]-a0[0]["s"]:.2f}s' if a0 else "mất")
        restore(page, base)
        page.wait_for_timeout(500)

        # ── Chuột phải KHOẢNG CẮT → xoá ───────────────────────────────────
        zoom_out_fully(page)
        first = spans(page)[0]
        scrub_to(page, cx, cy, (first["s"] + first["e"]) / 2)
        before = len(spans(page))
        page.locator("[data-cut-span]").first.click(button="right")
        page.wait_for_timeout(400)
        rm = page.get_by_role("menuitem", name="Xoá khoảng cắt")
        check("chuột phải khoảng cắt ra menu Xoá", rm.count() > 0)
        if rm.count():
            rm.click()
            page.wait_for_timeout(1500)
            check("xoá thì bớt một khoảng", len(spans(page)) == before - 1)
        restore(page, base)
        page.wait_for_timeout(500)

        # ── PHÁT nhảy qua chỗ bỏ; NGHE THỬ thì không nhảy ─────────────────
        head = next((s for s in spans(page) if s["e"] - s["s"] > 1.2), None)
        if head:
            page.evaluate("(at) => { document.querySelector('video').currentTime = at; }",
                          max(0, head["s"] - 0.4))
            page.wait_for_timeout(400)
            page.get_by_role("button", name="Phát bản đã cắt").click()
            page.wait_for_timeout(1200)
            check("phát thì nhảy qua chỗ bỏ", now(page) >= head["e"] - 0.05,
                  f'dừng {now(page):.1f} · bỏ {head["s"]:.1f}→{head["e"]:.1f}')
            page.get_by_role("button", name="Tạm dừng").click()
            page.wait_for_timeout(300)
        listen = page.get_by_label("Nghe chỗ này").first
        if listen.count():
            listen.click()
            page.wait_for_timeout(1200)
            st = page.evaluate("() => { const v = document.querySelector('video'); return { t: v.currentTime, p: v.paused }; }")
            check("nghe thử thì phát thật, không nhảy qua", not st["p"])
            page.evaluate("() => document.querySelector('video').pause()")

        # ── Nút phát NẰM TRÊN preview, và phím CÁCH phát/dừng ─────────────
        ov = page.get_by_label("Phát bản đã cắt")
        vid = page.locator("video").bounding_box()
        ovb = ov.bounding_box() if ov.count() else None
        check("nút phát nằm chồng trên video",
              ovb is not None and ovb["y"] < vid["y"] + vid["height"],
              "trên video" if ovb and vid else "không thấy")
        t_before = now(page)
        page.locator("body").press(" ")
        page.wait_for_timeout(1000)
        check("phím Cách phát", now(page) > t_before + 0.5, f"{t_before:.1f}→{now(page):.1f}s")
        page.locator("body").press(" ")  # dừng
        page.wait_for_timeout(300)

        # ── Sống qua tải lại ──────────────────────────────────────────────
        keep = len(spans(page))
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        check("tải lại vẫn đúng số khoảng",
              page.locator("[data-cut-span]").count() == keep)

        check("không có lỗi JS suốt phiên", not errors, "; ".join(errors[:2]))
        browser.close()

    print(f"\n{len(passed)} đạt, {len(failed)} trượt")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
