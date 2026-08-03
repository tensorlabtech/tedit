import {
  EMPHASES,
  type AlignId,
  type EmphasisId,
} from "@/dev/overlays/overlay-model";
import { packForElement, type StylePack } from "../../../server/style-pack";
import { OverlayTextBlock } from "@/dev/overlays/overlay-render";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Chữ mượn khi ô nhập còn TRỐNG.
 *
 * Ô dựng bằng chữ thật của người dùng — họ chọn dáng cho câu của họ, không cho
 * một câu mẫu nào đó. Nhưng chữ rỗng thì bốn ô trống trơn giống hệt nhau, mà đặt
 * chữ xong con trỏ nhảy thẳng vào ô nhập nên trạng thái rỗng có thật.
 */
const PLACEHOLDER_TEXT = "Còn đúng một năm nữa";

/** Đủ lớn để mọi tiếng đã hiện xong — ô xem trước là ảnh tĩnh, không phải phim. */
const DONE = 999;

/**
 * Chọn DÁNG bằng cách nhìn, không bằng cách đọc.
 *
 * Bản trước là bốn nút chữ: `Đều nhau` · `Từ khoá to hẳn` · `Xen cỡ` ·
 * `Dẫn nhỏ · ý to`, kèm một câu tả bên trên ("Hàng đầu nhỏ và mờ, hàng sau mới
 * là ý chính"). Ba cái sai chồng nhau:
 *
 * · Nhãn dài 1–4 tiếng nên các ô so le nhau. Luật của dải chọn là các ô BẰNG
 *   nhau về bề ngang, và nhãn quá hai–ba tiếng thì phải đổi sang thành phần khác.
 * · Câu tả đang mô tả một BỨC TRANH bằng lời. Người ta nhận ra nhanh hơn nhiều
 *   so với nhớ lại — cho xem thì khỏi phải tả.
 * · Mà mình ĐÃ CÓ bộ vẽ: `OverlayTextBlock` dựng đúng bằng bộ số của bản xuất,
 *   khung xem lớn đang dùng chính nó. Cỡ chữ đo bằng `cqw` nên thu vào ô nhỏ là
 *   tự tỉ lệ, không phải viết lại gì.
 *
 * Nên mỗi lựa chọn giờ là một bản thu nhỏ THẬT, dựng từ chính chữ của người dùng.
 * Không còn câu tả nào — cái ô chính là câu tả. Tên kiểu lui vào tooltip cho ai
 * cần gọi nó ra thành lời.
 *
 * NỀN PHẢI TỐI, vì chữ overlay vốn màu TRẮNG — viền và bóng đổ đều tính cho việc
 * nằm trên video. Đặt lên nền xám nhạt của thẻ thì chỉ còn cái bóng giữ cho nó
 * đọc được, ra một khối chữ nhoè nhoẹt; rất dễ đổ lỗi nhầm cho "chữ nhỏ quá" hay
 * "bóng nặng quá", trong khi chỉ là sai nền.
 *
 * Nhưng tối TRƠN chứ không phải một khung hình. Có lúc tôi để ảnh nền thật —
 * đọc được ngay, nhưng cái ô này để SO BỐN DÁNG với nhau, mà mỗi ô một mảng ảnh
 * khác nhau thì mắt phải gạt cái ảnh đi trước rồi mới so được hình khối chữ. Ảnh
 * thật là việc của khung xem lớn ở cột giữa; ở đây nó chỉ là nhiễu.
 */
export function TextShapeTiles({
  text,
  align,
  keywords,
  value,
  pack,
  onChange,
}: {
  text: string;
  align: AlignId;
  keywords: string[];
  value: EmphasisId;
  /** Bộ dáng của dự án — ô mẫu phải vẽ bằng đúng font và màu sẽ xuất ra. */
  pack: StylePack;
  onChange: (next: EmphasisId) => void;
}) {
  const sample = text.trim() || PLACEHOLDER_TEXT;
  // Ô XÉN, không phải ô bóp.
  //
  // Bộ vẽ tính cỡ chữ theo DIỆN TÍCH muốn che của một khung 9:16 (xem
  // `scaleForCoverage`), rồi in ra bằng `cqw` — phần trăm BỀ RỘNG vùng chứa. Cho
  // ô vuông thì cùng con số ấy ăn vào chiều cao gấp gần hai lần đáng lẽ: chữ
  // phình gần kín ô rồi tràn xuống dưới, nhìn ra rất thô. Không phải lỗi của
  // chữ — là ô sai tỉ lệ.
  //
  // Nhưng để ô đúng 9:16 thì bốn ô cao 194px, cộng hàng "Chỗ đặt" nữa là tràn
  // 136px khỏi cột. Mà phần trên và dưới của khung vốn TRỐNG — khối chữ neo
  // giữa. Nên bên trong vẫn là một khung 9:16 thật (cỡ chữ tính đúng), còn bên
  // ngoài chỉ hé ra dải giữa. Xén chỗ trống thì không mất gì.
  return (
    <div className="grid grid-cols-4 gap-1">
      {EMPHASES.map((item) => {
        const active = item.id === value;
        return (
          <Tooltip key={item.id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={item.label}
                  aria-pressed={active}
                  onClick={() => onChange(item.id)}
                  // `@container` là BẮT BUỘC: cỡ chữ trong bộ vẽ đo bằng `cqw`
                  // (phần trăm bề rộng vùng chứa). Thiếu nó thì mọi ô lấy bề
                  // rộng của tổ tiên gần nhất có khai — tức cả cột — và chữ
                  // trong ô bé tí tràn ra ngoài.
                  className={cn(
                    // Nền tối cố định, KHÔNG dùng thẻ màu theo chủ đề: chữ vẽ ra
                    // luôn trắng, nên nền phải tối ở cả chủ đề sáng lẫn tối.
                    "relative aspect-square overflow-hidden rounded-lg bg-neutral-800",
                    // Viền vẽ VÀO TRONG: ô nào sát mép vùng cuộn thì viền ngoài
                    // bị gọt mất một cạnh.
                    //
                    // Làm mờ ô KHÔNG chọn thì không đủ để đọc ra cái nào đang
                    // chọn — trên nền tối, chênh lệch mờ/tỏ đọc ra như bốn ô hơi
                    // khác sáng chứ không như một cái được chọn. Viền màu chính
                    // thì không nhầm vào đâu được.
                    active
                      ? "inset-ring-2 inset-ring-primary"
                      : "hover:inset-ring-2 hover:inset-ring-primary/40",
                  )}
                />
              }
            >
              {/* Khung 9:16 THẬT nằm trong, neo giữa ô. `@container` đặt ở ĐÂY
                  chứ không ở nút: cỡ chữ đo bằng `cqw` của khung này, nên nó
                  phải là thứ mang đúng tỉ lệ khung hình. */}
              <span className="@container absolute inset-x-0 top-1/2 block aspect-[9/16] -translate-y-1/2">
              <OverlayTextBlock
                config={{
                  text: sample,
                  // Căn ngang giữ nguyên của chính chữ đang sửa: ô xem trước
                  // phải là bản thu nhỏ của THỨ SẼ RA, không phải của một cấu
                  // hình mẫu.
                  align,
                  emphasis: item.id,
                  // Luôn neo giữa ô: dải dọc là việc của bảng "Chỗ đặt" bên
                  // dưới. Để nó thật thì ba trong bốn ô có chữ dính mép, đọc ra
                  // như lỗi vẽ chứ không như sự khác nhau giữa các dáng.
                  band: "middle",
                  keywords,
                  insert: { kind: "none", shape: "wide" },
                }}
                pack={packForElement(pack, null, keywords)}
                seconds={DONE}
              />
              </span>
            </TooltipTrigger>
            <TooltipContent>{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
