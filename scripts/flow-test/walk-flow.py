"""Đi HẾT luồng người dùng bằng trình duyệt thật, chụp ảnh từng bước.

Khác mọi phép kiểm khác trong `scripts/`: những phép kia đo MỘT mảnh (chữ, màu,
quyền sở hữu) trên dữ liệu dựng sẵn. Cái này nạp một tệp video thật lên, chờ máy
chạy hết mạch dựng, rồi mở bàn dựng — tức là nó bắt được đúng loại lỗi mà kiểm
từng mảnh không bao giờ thấy: hai mảnh đều đúng nhưng nối vào nhau thì sai.

Chạy trên máy chủ THỬ, dữ liệu để ở thư mục riêng — không đụng dự án thật.

    python3 scripts/flow-test/walk-flow.py <cổng web> <tệp video> <thư mục ảnh>
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

PORT, VIDEO, SHOTS = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
SHOTS.mkdir(parents=True, exist_ok=True)

# Điện thoại dựng video thì màn hình rộng; lấy khổ máy tính để bàn phổ thông.
VIEWPORT = {"width": 1512, "height": 950}

# Mạch dựng gọi mô hình ngôn ngữ và bộ chép lời — chậm, và chậm không đều.
BUILD_TIMEOUT = 900_000


def shot(page, name: str) -> None:
    path = SHOTS / f"{name}.png"
    page.screenshot(path=str(path))
    print(f"  ✓ {name}.png")


def main() -> int:
    base = f"http://localhost:{PORT}"
    with sync_playwright() as driver:
        browser = driver.chromium.launch()
        page = browser.new_page(viewport=VIEWPORT, device_scale_factor=1)
        page.set_default_timeout(30_000)

        print("1 · trang chủ")
        page.goto(base)
        page.wait_for_load_state("networkidle")
        shot(page, "01-trang-chu")

        print("2 · đăng nhập cửa dev")
        page.get_by_role("button", name="Vào bằng tài khoản dev chung").click()
        # Cửa dev đưa về ĐÚNG chỗ đang đứng, tức trang chủ — chưa phải màn nạp tệp.
        #
        # Chờ tới khi thân trang CÓ CHỮ chứ không chỉ chờ một nút xuất hiện: đăng
        # nhập xong là `window.location.href` tải lại cả trang, nên nút khớp trên
        # bản trước rồi DOM bị xoá sạch — bản đầu của phép kiểm này chụp ra một
        # ảnh trắng trơn và tôi suýt báo đó là lỗi sản phẩm.
        page.wait_for_selector("text=Dự án mới", timeout=60_000)
        page.wait_for_function(
            "() => document.body.innerText.includes('Thư viện nhạc')",
            timeout=30_000,
        )
        page.wait_for_load_state("networkidle")
        shot(page, "02-danh-sach-du-an")

        print("3 · mở màn nạp tệp")
        page.goto(f"{base}/upload")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1_200)
        shot(page, "03-man-nap-tep-trong")

        print("4 · thả tệp")
        page.set_input_files("input[type=file]", str(VIDEO))
        # Chờ tệp lên xong: thẻ khai báo dự án chỉ hiện tên tệp sau khi nạp xong.
        page.wait_for_timeout(4_000)
        page.wait_for_load_state("networkidle")
        shot(page, "04-da-nap-tep")

        print("5 · mở hộp chọn phong cách")
        # Màn nạp tệp gọi nút là "Chọn" (chưa chọn bao giờ), bàn dựng gọi là "Đổi".
        page.get_by_role("button", name="Chọn", exact=True).first.click()
        page.wait_for_timeout(1_200)
        shot(page, "05-chon-phong-cach")

        print("6 · chọn bộ có emoji và nắn màu rõ")
        # Bấm vào chính Ô, không bấm nhãn: nhãn nay cũng bấm được, nhưng phép
        # kiểm phải đi qua đường mà người dùng đi nhiều nhất.
        page.get_by_role("button", name="Lửa", exact=True).first.click()
        page.wait_for_timeout(800)
        shot(page, "06-da-chon-lua")
        page.get_by_role("button", name="Dùng phong cách này").click()
        page.wait_for_timeout(800)
        shot(page, "07-sau-khi-chon")

        print("7 · bắt đầu dựng")
        page.get_by_role("button", name="Bắt đầu chép lời").click()
        page.wait_for_url("**/pipeline/**", timeout=60_000)
        page.wait_for_timeout(2_500)
        shot(page, "08-man-cho-bat-dau")

        print("8 · chờ mạch dựng xong")
        # Chờ theo NÚT sang bàn dựng chứ không theo số chặng: chặng không bắt
        # buộc hỏng thì vẫn đi tiếp, mà đếm chặng xong thì không biết điều đó.
        page.wait_for_selector("button:not([disabled]):has-text('Mở trình sửa')", timeout=BUILD_TIMEOUT)
        page.wait_for_timeout(1_500)
        shot(page, "09-man-cho-xong")

        print("9 · vào bàn dựng")
        page.get_by_role("button", name="Mở trình sửa").click()
        page.wait_for_url("**/flow/**", timeout=60_000)
        page.wait_for_timeout(4_000)
        shot(page, "10-ban-dung")

        print("10 · tua tới vài cụm chữ")
        rows = page.locator("[data-row]")
        count = rows.count()
        for index in range(min(4, count)):
            rows.nth(index).click()
            page.wait_for_timeout(1_200)
            shot(page, f"11-cum-{index + 1}")

        print("11 · đổi phong cách ngay ở bàn dựng")
        # `exact` là BẮT BUỘC: đầu trang có nút "Đổi tên dự án", mà phép khớp
        # mặc định là khớp một phần nên nó ăn trước.
        page.get_by_role("button", name="Đổi", exact=True).first.click()
        page.wait_for_timeout(1_500)
        shot(page, "12-doi-phong-cach")
        page.get_by_role("button", name="Sương", exact=True).first.click()
        page.wait_for_timeout(900)
        shot(page, "13-doi-sang-suong")
        page.get_by_role("button", name="Đổi sang phong cách này").click()
        page.wait_for_timeout(2_000)
        shot(page, "14-sau-khi-doi")

        browser.close()
    print(f"\nẢnh ở {SHOTS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
