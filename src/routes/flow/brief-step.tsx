import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRevealLoop } from "@/dev/overlays/use-reveal-loop";
import { StylePreviewTile } from "@/routes/pipeline/style-preview-tile";
import { STYLE_PACKS } from "../../../server/style-pack-catalog";
import type { StylePackId } from "../../../server/style-pack";

/** Cụm ví dụ vẽ trong ô mẫu — bước này chưa có video/lời thật để lấy khung hình
 * hay lời nói, nên ô mẫu rơi về nền tối + câu ví dụ (giống `StyleSwitchDialog`
 * lúc chưa có cụm nào để bám). */
const SAMPLE_TEXT = "Video của bạn sẽ trông như thế này";

/**
 * BƯỚC ĐỀ BÀI — tên, mô tả, và chọn phong cách.
 *
 * ══ VÌ SAO MÔ TẢ LÀ Ô TO NHẤT ══
 *
 * Chữ gõ vào đây KHÔNG chỉ để người khác đọc: `asr-bias.ts:126` đưa nó vào lời
 * mồi cho máy nghe, nên nó **sửa chính tả trước khi lỗi xảy ra**. Gõ "frontend,
 * layoff, JD, onsite" thì bước Soát lời ngắn hẳn — đó là chỗ đắt nhất của cả
 * luồng, và nó nằm ở một ô chữ.
 *
 * Nên ô này để trống dòng rộng rãi và mời gõ mọi thứ: nhịp muốn nhanh hay chậm,
 * từ khoá hay lặp, tên riêng dễ nghe nhầm, cả kịch bản nếu có. Càng nhiều thì
 * bảy chặng mô hình phía sau càng bớt đoán.
 *
 * ══ MỘT CỘT, MỘT THẺ ══
 *
 * Bản đầu chia hai cột: đề bài trái, phong cách phải. Sai — hai ô chữ ngắn ngủi
 * chiếm nguyên một cột và bỏ trống hai phần ba chiều cao, trong khi lưới phong
 * cách bên kia phải cuộn.
 *
 * Đây là một biểu mẫu, mà biểu mẫu thì đọc từ trên xuống: tên → mô tả → chọn
 * phong cách. Một thẻ, một cột, cuộn dọc.
 *
 * ══ LƯỚI PHONG CÁCH ══
 *
 * Mỗi ô là `StylePreviewTile` — CÙNG ô mẫu dùng ở `/upload` và trong bàn dựng
 * (`StyleSwitchDialog`), vẽ THẬT bằng bộ máy overlay chứ không phải chữ nhãn
 * suông. Người dùng thấy font/màu/nhịp tô sáng trước khi chọn, không chọn mù.
 * Bước này chưa có video hay lời thật nên ô mẫu rơi về nền tối + câu ví dụ
 * (`SAMPLE_TEXT`) — cùng cách `StyleSwitchDialog` xử lý lúc chưa có cụm nào.
 *
 * Lưới tự giãn theo bề ngang (`auto-fill` + `minmax`) chứ không khai cứng số
 * cột: hôm nay mười hai bộ, mai ba mươi thì vẫn xếp gọn, không cần sửa gì.
 */

export function BriefStep({
  title,
  brief,
  stylePack,
  onTitle,
  onBrief,
  onStylePack,
}: {
  title: string;
  brief: string;
  stylePack: string | null;
  onTitle: (value: string) => void;
  onBrief: (value: string) => void;
  onStylePack: (id: StylePackId) => void;
}) {
  const [hovered, setHovered] = useState<StylePackId | null>(null);
  // Chỉ chạy vòng lặp hiệu ứng khi có ô đang được ngó — ba ô vẽ lại 60 lần mỗi
  // giây lúc không ai nhìn là phí vô ích.
  const seconds = useRevealLoop(hovered !== null);
  // Đủ lớn để mọi tiếng đã hiện xong: ô không được ngó thì đứng ở dáng cuối.
  const DONE = 99;

  return (
    <Card className="lg:h-full lg:min-h-0">
      <CardHeader>
        <CardTitle>Đề bài</CardTitle>
      </CardHeader>
      <CardContent className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto">
        <label className="grid gap-1.5">
          <span className="text-muted-foreground text-xs uppercase">Tên</span>
          <Input
            defaultValue={title}
            placeholder="Đặt tên cho dễ tìm lại"
            onBlur={(event) => onTitle(event.target.value)}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-muted-foreground text-xs uppercase">
            Video nói về gì
          </span>
          {/* `field-sizing-content` (design system) tự cao theo nội dung — dán
              nguyên kịch bản vào là ô phình hết màn, nuốt cả nút bên dưới. Chặn
              trần `max-h`: tới ngưỡng thì ô TỰ cuộn trong lòng, không đội trang. */}
          <Textarea
            defaultValue={brief}
            rows={5}
            className="max-h-[42vh]"
            placeholder={
              "Gõ mọi thứ liên quan — càng nhiều máy càng bớt đoán: tên riêng dễ " +
              "nghe nhầm, nhịp nhanh hay chậm, từ nào đáng nhấn, kịch bản nếu có."
            }
            onBlur={(event) => onBrief(event.target.value)}
          />
          {/* Nói rõ chữ này ĐI ĐÂU. Không nói thì nó trông như một ô ghi chú
              cho vui, và người dùng bỏ trống — mất đúng đòn bẩy rẻ nhất. */}
          <span className="text-muted-foreground text-xs">
            Máy dùng đoạn này để nghe cho đúng tên riêng, chọn từ nhấn và đặt tư
            liệu. Bỏ trống cũng chạy, chỉ là máy phải đoán nhiều hơn.
          </span>
        </label>

        <div className="grid gap-1.5">
          <span className="text-muted-foreground text-xs uppercase">
            Phong cách
          </span>
          {/* `auto-fill` + `minmax`: thêm bộ thì lưới tự thêm cột, không phải
              sửa số cột ở đây. Mười hai bộ hôm nay, ba mươi bộ vẫn gọn. */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
            {STYLE_PACKS.map((pack) => (
              <StylePreviewTile
                key={pack.id}
                pack={pack}
                text={SAMPLE_TEXT}
                poster={null}
                selected={pack.id === stylePack}
                seconds={hovered === pack.id ? seconds : DONE}
                onSelect={() => onStylePack(pack.id)}
                onHoverChange={(hovering) =>
                  setHovered(hovering ? pack.id : null)
                }
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
