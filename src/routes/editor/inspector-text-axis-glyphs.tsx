import { indentOf, type AlignId } from "@/dev/overlays/overlay-model";
import { cn } from "@/lib/utils";

/**
 * Dấu hiệu cho trục CĂN NGANG — tự vẽ, không lấy từ bộ icon.
 *
 * Bộ icon nào cũng có `AlignLeft` / `AlignCenter` / `AlignRight`, nhưng không bộ
 * nào có "căn bậc thang" hay "căn so le" — chúng là khái niệm của riêng hệ này.
 * Lấy tạm `IndentIncrease` và `StretchHorizontal` cho hai kiểu ấy thì được hai
 * cái hình không nói gì đúng, mà lại phá luôn tính đồng bộ: ba cái đầu là dấu
 * hiệu về CĂN CHỈNH, hai cái sau là dấu hiệu về thứ khác hẳn.
 *
 * (Trục CHỖ ĐẶT thì không cần: trên/giữa/dưới là thứ bộ icon nào cũng vẽ đúng.
 * Tôi có lúc tự vẽ cả cái đó — một khung dọc có vạch — nhưng ở cỡ 14px cái khung
 * đọc ra như một ô trống, thua hẳn icon có sẵn.)
 *
 * Nên vẽ cả năm bằng CÙNG MỘT LUẬT: ba vạch, khác nhau đúng ở chỗ mỗi vạch nằm
 * đâu. Mà "mỗi vạch nằm đâu" thì đã có sẵn — `indentOf` chính là hàm bộ dựng
 * dùng để đặt các hàng. Dấu hiệu vì thế không phải bản phỏng đoán, nó là bản thu
 * nhỏ của đúng cái luật sẽ chạy.
 */

/** Bề rộng ba vạch — PHẢI khác nhau, không thì trái/giữa/phải trông y hệt nhau. */
const ROWS = [0.9, 0.55, 0.72];

/**
 * Thổi phồng phần thụt lề.
 *
 * Bản thật thụt 5,5% (bậc thang) và 14% (so le) — đo trên một khung rộng 1080px
 * thì thấy rõ, thu vào cái dấu 14px thì còn chưa tới một pixel. Dấu hiệu phải
 * ĐỌC ĐƯỢC, nên phóng phần thụt lên; tỉ lệ giữa các kiểu vẫn giữ nguyên.
 */
const PHONG = 3.4;

export function AlignGlyph({ align }: { align: AlignId }) {
  const canh =
    align === "center"
      ? "items-center"
      : align === "right"
        ? "items-end"
        : "items-start";
  return (
    <span
      aria-hidden
      className={cn("flex size-3.5 flex-col justify-center gap-[2px]", canh)}
    >
      {ROWS.map((rong, index) => {
        const thut = Math.min(0.45, indentOf(align, index, ROWS.length) * PHONG);
        return (
          <span
            key={index}
            className="block h-[2px] shrink-0 rounded-full bg-current"
            style={{
              // Cắt bớt vạch đúng bằng phần thụt vào: không cắt thì vạch thụt
              // nhiều nhất chạy quá mép dấu và bị xén cụt.
              width: `${Math.max(0.2, rong - thut) * 100}%`,
              ...(align === "right"
                ? { marginRight: `${thut * 100}%` }
                : { marginLeft: `${thut * 100}%` }),
            }}
          />
        );
      })}
    </span>
  );
}
