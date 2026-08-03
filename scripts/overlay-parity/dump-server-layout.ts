/**
 * In số đo của ĐƯỜNG VẼ MÁY CHỦ ra JSON, để so với đường vẽ trang xem.
 *
 * Đây là nửa dưới của phép kiểm mà `/_dev/overlays` làm bằng mắt: trang đó gọi
 * `/api/layout` rồi bày cạnh bảng ước của trình duyệt. Tách ra chạy được không
 * cần đăng nhập, nên nó chạy được trong mọi lượt kiểm tự động.
 *
 *   npx tsx scripts/overlay-parity/dump-server-layout.ts
 */
import { OUT_WIDTH } from "../../server/render";
import { packForElement } from "../../server/style-pack";
import { STYLE_PACKS } from "../../server/style-pack-catalog";
import { fitLines, usableWidthOf } from "../../server/text-layout";
import { CASES } from "./parity-cases";

/*
 * Dùng `fitLines`, KHÔNG dùng `layoutText`.
 *
 * `layoutText` là đường của khung xem trước trong bàn dựng; đường thật sự in ra
 * video đi qua `placeWords` → `fitLines`. Hai hàm chừa lề khác nhau và dò cỡ
 * theo hai bước nhảy khác nhau, nên so nhầm hàm là báo lệch ở chỗ không lệch —
 * đúng cái bẫy mà `/_dev/overlays` từng mắc phải theo chiều ngược lại.
 */
const rows = [];
for (const pack of STYLE_PACKS) {
  for (const item of CASES) {
    const usable = usableWidthOf(item.band, OUT_WIDTH);
    // Vai chữ theo chính ca thử — cùng hàm `fontRoleFor` mà đường in dùng.
    const shown = packForElement(pack, null, item.keywords);
    const laid = await fitLines(item.text, usable, OUT_WIDTH, shown);
    rows.push({
      pack: pack.id,
      text: item.text,
      band: item.band,
      role: shown.font.file,
      lines: laid.lines.length,
      // Cỡ theo BỀ RỘNG khung — cùng trục với `fitGroup` của trang xem.
      scale: laid.scale,
    });
  }
}
console.log(JSON.stringify(rows));
