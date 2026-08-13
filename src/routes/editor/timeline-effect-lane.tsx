import type { PointerEvent } from "react";

import { JUNCTIONS, type JunctionId } from "@/dev/overlays/overlay-model";
import { formatTimeFine } from "./editor-data";
import { TimelineBlock } from "./timeline-block";
import type { Selection } from "./use-editor";

export type EffectItem = {
  id: string;
  kind: JunctionId;
  outStart: number;
  outEnd: number;
  outPeak: number;
  custom: boolean;
  atCut: boolean;
};

/**
 * Dải HIỆU ỨNG — một khối mang TÊN, như mọi dải khác.
 *
 * Bản trước vẽ mỗi kiểu một icon riêng trong một viên tròn 16px. Hai cái sai:
 * ở cỡ đó `⇥⇤` với `⇤⇥` đọc ra như nhau, và quan trọng hơn là chẳng có lý do gì
 * để bắt người dùng học năm cái hình khi chỗ đó viết được hẳn cái tên. Bốn dải
 * còn lại đều là khối màu có nhãn — dải này đứng riêng một kiểu thì chỉ tự làm
 * mình khó đọc.
 *
 * MÀU nói đây là lớp gì (xem `TimelineBlock`), CHỮ nói đây là hiệu ứng gì. Nên
 * không cần icon nào cả: khối hẹp thì phần chữ được lấy trọn bề ngang thay vì
 * chia nửa cho một cái hình chẳng thêm thông tin gì.
 *
 * Hàng RIÊNG, không vẽ đè lên dải phim. Từng vẽ đè cho "sát mối nối" — nhưng mép
 * khối phim cũng đúng là chỗ tay nắm gọt mép đứng, nên đoạn nào có chuyển cảnh
 * là không co dãn được nữa (đo được: dấu chiếm [x−13, x+13] ở lớp 30, tay nắm
 * chiếm [x, x+14] ở lớp 20).
 */
/**
 * Khối hẹp hơn ngần này thì không in nhãn nữa.
 *
 * 44px là chỗ vừa đủ cho một chữ ngắn nhất của hệ ("Chìm đen" mất 52px, "Zoom
 * ra" 48px) cộng hai bên đệm; dưới mức đó `truncate` chỉ còn cắt ra một hai ký
 * tự đầu.
 */
const LABEL_MIN_WIDTH = 44;

export function EffectLane({
  effects,
  pxPerSecond,
  selection,
  onSelect,
  onMove,
}: {
  effects: EffectItem[];
  pxPerSecond: number;
  selection: Selection;
  onSelect: (id: string) => void;
  /** KÉO DỜI chỗ nối (đã buộc mốc nguồn) — `undefined` = không dời. */
  onMove?: (id: string) => ((event: PointerEvent) => void) | undefined;
}) {
  if (effects.length === 0) return null;
  return (
    <div className="relative h-6">
      {effects.map((item) => {
        const name =
          JUNCTIONS.find((kind) => kind.id === item.kind)?.label ?? "Cắt thẳng";
        return (
          <TimelineBlock
            key={item.id}
            blockId={item.id}
            start={item.outStart}
            end={item.outEnd}
            pxPerSecond={pxPerSecond}
            tone="junction"
            // MỌI chỗ nối vẽ như nhau, không phân biệt "đã sửa tay" với "đang
            // theo mặc định" bằng độ đậm nữa.
            //
            // Đã thử hai đời: mờ cả khối (`opacity-45`), rồi nhạt riêng phần
            // nền. Cả hai đều hỏng theo cùng một kiểu — hai khối cùng loại nằm
            // trên một dải mà đậm nhạt khác nhau thì mắt đọc ra "cái kia bị
            // sao đó", chứ không đọc ra "cái kia chưa được chỉnh riêng". Câu
            // hỏi nhận được cả hai lần đều là "sao cái này mờ hơn".
            //
            // Sự khác nhau ấy vốn cũng không đổi được quyết định nào lúc đang
            // lướt dải: muốn biết một chỗ nối theo mặc định hay đã chốt thì rê
            // vào (tooltip nói) hoặc bấm vào (bảng sửa nói).
            active={
              selection?.kind === "junction" && selection.id === item.id
            }
            trimmable
            title={`${item.atCut ? "Chỗ nối" : "Nhấn nhịp"} — ${name} · ${formatTimeFine(
              item.outStart,
            )}–${formatTimeFine(item.outEnd)}${
              item.custom ? "" : " (theo mặc định của dự án)"
            }`}
            className="gap-1 px-2"
            onSelect={() => onSelect(item.id)}
            onMoveStart={onMove?.(item.id)}
          >
            {/* Vạch ĐỈNH — chỗ cú nhấn mạnh nhất, cũng là chỗ vết cắt nếu đây
                là chỗ nối. Cần nói ra vì đỉnh KHÔNG ở giữa khối: "zoom vào" dồn
                chậm rồi buông nhanh nên đỉnh nằm ở 77% quãng, "zoom ra" thì
                ngược lại. Một vạch mảnh, không phải một cái hình. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px bg-current opacity-40"
              style={{
                left: (item.outPeak - item.outStart) * pxPerSecond,
              }}
            />
            {/* Nhãn chỉ in khi khối ĐỦ RỘNG để đọc hết một chữ.
                
                Hiệu ứng ở chỗ nối chỉ dài `trước + sau` — nháy sáng là 0,12
                giây, tức 24px ở mức phóng thường. Nhồi "Nháy sáng" vào đó thì
                `truncate` cắt còn đúng chữ "N", và một khối hồng mang một ký tự
                đọc ra như lỗi vẽ chứ không ra một cái nhãn. Cùng luật với ô từ
                hẹp ở §12: hẹp thì bỏ chữ, giữ ô — tên vẫn còn trong chú thích
                khi rê chuột vào, và bảng sửa nói đủ khi bấm vào. */}
            {(item.outEnd - item.outStart) * pxPerSecond >= LABEL_MIN_WIDTH && (
              <span className="truncate">{name}</span>
            )}
          </TimelineBlock>
        );
      })}
    </div>
  );
}
