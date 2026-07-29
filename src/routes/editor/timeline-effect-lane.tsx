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
  rieng: boolean;
  taiCat: boolean;
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
export function EffectLane({
  effects,
  pxPerSecond,
  selection,
  onSelect,
}: {
  effects: EffectItem[];
  pxPerSecond: number;
  selection: Selection;
  onSelect: (id: string) => void;
}) {
  if (effects.length === 0) return null;
  return (
    <div className="relative h-6">
      {effects.map((item) => {
        const ten =
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
            title={`${item.taiCat ? "Chỗ nối" : "Nhấn nhịp"} — ${ten} · ${formatTimeFine(
              item.outStart,
            )}–${formatTimeFine(item.outEnd)}${
              item.rieng ? "" : " (theo mặc định của dự án)"
            }`}
            className="gap-1 px-2"
            onSelect={() => onSelect(item.id)}
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
            <span className="truncate">{ten}</span>
          </TimelineBlock>
        );
      })}
    </div>
  );
}
