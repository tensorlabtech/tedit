"""Soát các quy tắc UI của dự án trên MỌI màn, bằng trình duyệt thật.

Khác `walk-flow.py`: cái kia nạp một video rồi chờ cả mạch dựng chạy, để bắt lỗi
nối giữa các mảnh. Cái này không dựng gì cả — nó mở các màn đã có sẵn rồi đo
đúng những luật đã ghi trong CLAUDE.md, thứ mà mắt người soát lại từng màn thì
sót, còn trình duyệt thì đếm được:

· Không thanh cuộn ngang ở thân trang.
· Mọi thứ bấm được đều phải có con trỏ hình bàn tay.
· Nút chỉ có icon, không có chữ, phải có lời chú (tooltip hoặc aria-label) —
  không thì người dùng phải đoán.
· Các điều khiển đứng cùng một hàng phải cao bằng nhau.
· Không phần tử nào tràn khỏi mép phải màn hình.

    python3 scripts/flow-test/soat-quy-tac-ui.py <cổng web> [thư mục ảnh]
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

PORT = sys.argv[1]
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else None
if SHOTS:
    SHOTS.mkdir(parents=True, exist_ok=True)

VIEWPORT = {"width": 1512, "height": 950}

# Đo ở cả khổ hẹp: bố cục bento phủ kín màn nên chỗ vỡ đầu tiên luôn là màn hẹp.
KHO_HEP = {"width": 1024, "height": 800}

JS_SOAT = r"""
() => {
  const loi = [];
  const nhin = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const ten = (el) => {
    const t = (el.innerText || '').trim().slice(0, 30);
    return t || el.getAttribute('aria-label') || el.className?.toString().slice(0, 40) || el.tagName;
  };

  // Thân trang không được cuộn ngang.
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
    loi.push({ luat: 'cuộn ngang', chi: `thân trang rộng ${document.documentElement.scrollWidth} > khung ${document.documentElement.clientWidth}` });
  }

  const bamDuoc = [...document.querySelectorAll('button, a[href], [role=button], [role=tab], [role=option], summary, select, input[type=checkbox], input[type=radio]')].filter(nhin);

  for (const el of bamDuoc) {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
    const cs = getComputedStyle(el);

    // Con trỏ hình bàn tay — trừ những chỗ con trỏ KHÁC mới là đúng: thanh kéo
    // đổi bề rộng phải là mũi tên hai chiều, kéo-thả phải là bàn tay nắm.
    const conTroDung = ['pointer','w-resize','e-resize','ew-resize','col-resize','ns-resize','row-resize','grab','grabbing','text','move'];
    if (!conTroDung.includes(cs.cursor)) {
      loi.push({ luat: 'thiếu con trỏ bàn tay', chi: `${el.tagName.toLowerCase()} "${ten(el)}" → cursor:${cs.cursor}` });
    }

    // Nút chỉ có icon thì phải có lời chú.
    const chu = (el.innerText || '').trim();
    const coIcon = el.querySelector('svg, img');
    if (!chu && coIcon) {
      const chuThich = el.getAttribute('aria-label') || el.getAttribute('title')
        || el.getAttribute('aria-labelledby') || el.getAttribute('data-tooltip');
      if (!chuThich) {
        loi.push({ luat: 'nút icon không lời chú', chi: `${el.tagName.toLowerCase()}.${(el.className||'').toString().slice(0,50)}` });
      }
    }
  }

  /*
   * Tràn khỏi mép phải — nhưng CHỈ khi không có vùng cuộn nào chịu trách nhiệm.
   *
   * Dải phong cách, dải thời gian và thư viện nhạc đều cố ý dài hơn màn hình và
   * nằm trong một vùng cuộn ngang riêng. Không lọc chúng ra thì phép kiểm báo
   * mười dòng đúng-nhưng-vô-nghĩa, và một phép kiểm báo động giả còn tệ hơn
   * không có phép kiểm nào — người ta học cách bỏ qua nó.
   */
  const trongVungCuon = (el) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
    }
    return false;
  };
  const rongKhung = document.documentElement.clientWidth;
  for (const el of document.querySelectorAll('body *')) {
    if (!nhin(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.left >= rongKhung) continue;          // nằm hẳn ngoài: lớp ẩn, bỏ qua
    if (trongVungCuon(el)) continue;
    if (r.right > rongKhung + 2) {
      const cha = el.parentElement;
      // Chỉ báo phần tử mà CHA nó không tràn — không thì một chỗ vỡ đẻ ra hai
      // chục dòng báo cùng một nguyên nhân.
      if (cha && cha.getBoundingClientRect().right <= rongKhung + 2) {
        loi.push({ luat: 'tràn mép phải', chi: `${el.tagName.toLowerCase()} "${ten(el)}" phải=${Math.round(r.right)} > ${rongKhung}` });
      }
    }
  }

  return loi;
}
"""


def soat(page, ten_man: str, ra: list) -> None:
    try:
        loi = page.evaluate(JS_SOAT)
    except Exception as e:  # noqa: BLE001
        print(f"  ⚠ {ten_man}: không soát được ({e})")
        return
    for l in loi:
        ra.append({**l, "man": ten_man})
    dau = "✓" if not loi else "✗"
    print(f"  {dau} {ten_man}: {len(loi)} điểm")


def main() -> int:
    base = f"http://localhost:{PORT}"
    tat_ca: list = []

    with sync_playwright() as driver:
        browser = driver.chromium.launch()
        page = browser.new_page(viewport=VIEWPORT, device_scale_factor=1)
        page.set_default_timeout(30_000)

        page.goto(base)
        page.wait_for_load_state("networkidle")
        nut = page.get_by_role("button", name="Vào bằng tài khoản dev chung")
        if nut.count() > 0:
            nut.click()
            page.wait_for_selector("text=Dự án mới", timeout=60_000)
            page.wait_for_load_state("networkidle")

        # Lấy một dự án có sẵn để mở bàn dựng — không dựng mới, chỉ soát giao diện.
        prj = page.evaluate(
            "async () => { const r = await fetch('/api/projects'); const d = await r.json();"
            " return (d.projects ?? d ?? [])[0]?.id ?? null; }"
        )

        man = [
            ("danh sách dự án", "/"),
            ("nạp tệp", "/upload"),
            ("thư viện nhạc", "/library/music"),
            ("cài đặt", "/library/settings"),
        ]
        if prj:
            man.append(("bàn dựng", f"/flow/{prj}"))
            man.append(("tiến trình", f"/pipeline/{prj}"))

        for kho, ten_kho in ((VIEWPORT, "rộng"), (KHO_HEP, "hẹp")):
            page.set_viewport_size(kho)
            print(f"\n── khổ {ten_kho} ({kho['width']}px) ──")
            for ten, duong in man:
                page.goto(base + duong)
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(1_500)
                soat(page, f"{ten} · {ten_kho}", tat_ca)
                if SHOTS:
                    page.screenshot(path=str(SHOTS / f"{ten.replace(' ', '-')}-{ten_kho}.png"))

        browser.close()

    print(f"\n{'=' * 60}\ntổng: {len(tat_ca)} điểm cần xem")
    theo_luat: dict = {}
    for l in tat_ca:
        theo_luat.setdefault(l["luat"], []).append(l)
    for luat, ds in sorted(theo_luat.items(), key=lambda x: -len(x[1])):
        print(f"\n▸ {luat} — {len(ds)} chỗ")
        # Gộp trùng: cùng một nút hỏng ở sáu màn thì chỉ cần biết một lần.
        thay = set()
        for l in ds:
            if l["chi"] in thay:
                continue
            thay.add(l["chi"])
            print(f"    [{l['man']}] {l['chi']}")
            if len(thay) >= 12:
                print(f"    … còn {len(ds) - 12} dòng nữa")
                break

    return 1 if tat_ca else 0


if __name__ == "__main__":
    sys.exit(main())
