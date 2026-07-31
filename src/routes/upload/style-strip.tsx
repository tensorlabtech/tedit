import { useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useRevealLoop } from "@/dev/overlays/use-reveal-loop";
import { StylePreviewTile } from "@/routes/pipeline/style-preview-tile";

import { describeStyleFeel } from "../../../server/style-pack";
import type { StylePackId } from "../../../server/style-pack";
import { STYLE_PACKS, findStylePack } from "../../../server/style-pack-catalog";

/**
 * Chọn phong cách bằng một DẢI CUỘN NGANG, ngay tại chỗ.
 *
 * Trước đây chỗ này là một dòng chữ kèm nút "Chọn" mở hộp thoại, và hộp thoại
 * ấy dựng một khung xem trước RIÊNG chạy chữ ví dụ. Hai đường vẽ cho cùng một
 * thứ thì sớm muộn cũng lệch nhau, mà người dùng lại vừa nhìn cái này vừa phải
 * nhớ cái kia.
 *
 * Bày thẳng ra thì chọn là thấy: mỗi ô vẽ CHÍNH lời của người dùng trên CHÍNH
 * khung hình họ vừa tải lên. Không nút xác nhận — đổi qua đổi lại ở màn này
 * miễn phí, vì chữ chưa sinh ra.
 *
 * Cuộn ngang chứ không xếp lưới: thẻ "Dự án" có luật chiều cao bất biến, nó
 * nằm ở hàng `auto` đầu cột nên cao thêm một nhịp là hai dải ô bên dưới bị bóp
 * đúng chừng ấy.
 */
export function StyleStrip({
  value,
  onChange,
  sampleText,
  posterUrl,
}: {
  value: string | null | undefined;
  onChange: (next: StylePackId) => void;
  /** Chữ vẽ trong ô mẫu. Chưa chép lời thì là một câu ví dụ. */
  sampleText: string;
  /** Khung hình thật của cảnh đầu; `null` thì ô rơi về nền tối. */
  posterUrl: string | null;
}) {
  const [hovered, setHovered] = useState<StylePackId | null>(null);
  const current = findStylePack(value);
  // Chỉ chạy vòng lặp khi có ô đang được ngó — mười ô vẽ lại 60 lần mỗi giây
  // trong lúc tệp đang tải lên là tranh CPU với đúng việc người dùng đang chờ.
  const seconds = useRevealLoop(hovered !== null);
  const shown = hovered ? findStylePack(hovered) : current;
  // Đủ lớn để mọi tiếng đã hiện xong: ô không được ngó thì đứng ở dáng cuối.
  const DONE = 99;
  // KHÔNG tự cuộn tới ô đang chọn. Đã thử ba cách — `scrollIntoView`,
  // `offsetLeft`, toạ độ màn hình — đều không nhúc nhích được viewport của
  // `ScrollArea`, nên thà không có còn hơn để lại một đoạn mã chạy mà không
  // làm gì.
  //
  // Chấp nhận được vì dòng ngay trên dải đã nói tên bộ dáng đang dùng: người
  // dùng biết mình đang ở đâu, chỉ là phải kéo nếu muốn nhìn lại nó.

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="shrink-0 text-sm">Chọn phong cách</span>
        {/* Mô tả của bộ đang ngó — ba trục mà ô mẫu không vẽ ra được. */}
        <span className="truncate text-xs text-muted-foreground">
          {describeStyleFeel(shown)}
        </span>
      </div>

      {/* Mười ô không bao giờ vừa bề ngang, nên phải có thứ nói "còn nữa":
          `scroll-fade-r` mờ mép PHẢI — phía còn nữa của một dải xếp từ trái
          sang. Đặt ở VIEWPORT chứ không ở khối nội dung, vì đặt vào nội dung
          thì vùng mờ trôi theo nó lúc cuộn thay vì đứng yên ở mép. Cùng cách
          với dải cảnh và dải tư liệu. */}
      <ScrollArea
        orientation="horizontal"
        className="min-h-0"
        viewportClassName="scroll-fade-r"
      >
        <div className="flex gap-2 pr-1 pb-2">
          {STYLE_PACKS.map((pack) => (
            <div key={pack.id} className="w-32 shrink-0">
              <StylePreviewTile
                pack={pack}
                text={sampleText}
                poster={posterUrl}
                selected={pack.id === current.id}
                seconds={hovered === pack.id ? seconds : DONE}
                onSelect={() => onChange(pack.id)}
                onHoverChange={(hovering) =>
                  setHovered(hovering ? pack.id : null)
                }
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
