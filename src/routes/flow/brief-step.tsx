import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { STYLE_PACKS } from "../../../server/style-pack-catalog";
import type { StylePackId } from "../../../server/style-pack";

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
 * ══ LƯỚI PHONG CÁCH ══
 *
 * Mỗi bộ một khung 9:16 với tên ở giữa — cùng khổ với video sẽ xuất ra, nên khi
 * thay bằng đoạn phim mẫu thì không phải xếp lại lưới.
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
  return (
    <div className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-cols-[22rem_1fr]">
      <Card className="lg:min-h-0">
        <CardHeader>
          <CardTitle>Đề bài</CardTitle>
        </CardHeader>
        {/* `grid-rows-[auto_1fr]` chứ không `content-start`: ô mô tả phải ăn hết
            chỗ còn lại. Với `content-start` nó co theo nội dung và còn ba dòng,
            trong khi nửa dưới thẻ bỏ trống — mà đây là ô đáng gõ nhiều nhất. */}
        <CardContent className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-3 overflow-y-auto">
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs uppercase">Tên</span>
            <Input
              defaultValue={title}
              placeholder="Đặt tên cho dễ tìm lại"
              onBlur={(event) => onTitle(event.target.value)}
            />
          </label>
          <label className="grid min-h-0 grid-rows-[auto_1fr_auto] gap-1.5">
            <span className="text-muted-foreground text-xs uppercase">
              Video nói về gì
            </span>
            <Textarea
              defaultValue={brief}
              className="h-full resize-none"
              placeholder={
                "Gõ mọi thứ liên quan vào đây — càng nhiều máy càng bớt đoán:\n\n" +
                "· tên riêng dễ nghe nhầm (công ty, sản phẩm, thuật ngữ)\n" +
                "· nhịp muốn nhanh hay chậm\n" +
                "· từ nào đáng nhấn\n" +
                "· kịch bản, dàn ý nếu có"
              }
              onBlur={(event) => onBrief(event.target.value)}
            />
            {/* Nói rõ chữ này ĐI ĐÂU. Không nói thì nó trông như một ô ghi chú
                cho vui, và người dùng bỏ trống — mất đúng cái đòn bẩy rẻ nhất. */}
            <span className="text-muted-foreground text-xs">
              Máy dùng đoạn này để nghe cho đúng tên riêng, chọn từ nhấn và đặt
              tư liệu. Bỏ trống cũng chạy, chỉ là máy phải đoán nhiều hơn.
            </span>
          </label>
        </CardContent>
      </Card>

      <Card className="lg:min-h-0">
        <CardHeader>
          <CardTitle>Phong cách</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          {/* `auto-fill` + `minmax`: thêm bộ thì lưới tự thêm cột, không phải
              sửa số cột ở đây. Mười hai bộ hôm nay, ba mươi bộ vẫn gọn. */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2">
            {STYLE_PACKS.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => onStylePack(pack.id)}
                data-state={pack.id === stylePack ? "here" : "off"}
                className="grid aspect-[9/16] cursor-pointer place-items-center rounded-lg border border-border p-2 text-center data-[state=here]:ring-2 data-[state=here]:ring-primary data-[state=here]:ring-inset"
              >
                <span className="text-sm">{pack.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
