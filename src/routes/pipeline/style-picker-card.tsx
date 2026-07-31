import { useState } from "react";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRevealLoop } from "@/dev/overlays/use-reveal-loop";

import type { StylePackId } from "../../../server/style-pack";
import {
  THEME_LABELS,
  THEME_NOTES,
  describeStyleFeel,
  type StyleTheme,
} from "../../../server/style-pack";
import { STYLE_PACKS, findStylePack } from "../../../server/style-pack-catalog";
import { StylePreviewTile } from "./style-preview-tile";

/**
 * Chọn DÁNG CHỮ ở màn chờ.
 *
 * Vì sao ở đây chứ không ở bàn dựng: màn chờ là chỗ DUY NHẤT người dùng rảnh mà
 * vẫn đang tập trung vào dự án này. Họ ngồi không 2–5 phút và ta đang khuyên họ
 * đi làm việc khác. Vào bàn dựng rồi thì họ bận sửa chữ, không ai đi đổi dáng nữa.
 *
 * Và ở đây đổi qua đổi lại là MIỄN PHÍ: chặng `captions` chạy sau `transcribe`,
 * nên lúc người dùng đang chọn thì chữ chưa sinh ra — không có cụm nào để mà giữ
 * hay đè.
 *
 * **Thẻ này không được đọc ra như "còn một bước nữa".** Cả màn đang hứa *"cứ làm
 * việc khác đi"*; một thẻ đọc ra như việc phải làm là phá đúng lời hứa đó. Nên:
 * không có nút xác nhận, và câu dưới ô nói thẳng là không chọn cũng xong.
 */
/** Thứ tự nhóm: mạnh trước, vì đó là thứ người mới hay tìm. */
const THEMES: StyleTheme[] = ["manh", "ke-chuyen", "gon"];

export function StylePickerCard({
  value,
  onChange,
  sampleText,
  posterUrl,
}: {
  /** Mã bộ dáng đang lưu trên dự án; rỗng với dự án cũ. */
  value: string | null | undefined;
  onChange: (next: StylePackId) => void;
  /** Chữ vẽ trong ô mẫu — lời THẬT của người dùng khi đã chép xong. */
  sampleText: string;
  /** Khung hình thật làm nền ô mẫu; `null` thì ô rơi về nền tối. */
  posterUrl: string | null;
}) {
  const [hovered, setHovered] = useState<StylePackId | null>(null);
  const current = findStylePack(value);
  // Chỉ chạy vòng lặp khi thật sự có ô đang được ngó. Năm ô vẽ lại ở 60 khung
  // mỗi giây trong lúc ffmpeg chạy nền là tranh CPU với đúng việc người dùng
  // đang chờ.
  const seconds = useRevealLoop(hovered !== null);
  // Rê vào ô nào thì dòng mô tả nói về ô đó — xem trước mà không phải bấm.
  const shown = hovered ? findStylePack(hovered) : current;
  // Số đủ lớn để mọi tiếng đã hiện xong: ô không được ngó thì đứng ở dáng cuối.
  const DONE = 99;

  return (
    /*
     * Thẻ này TỰ CUỘN phần thân, không đẩy chiều cao của cả cột.
     *
     * Mười ô mẫu ở khổ 3:4 cao hơn chỗ cột phải có, nên trước đây nó bóp danh
     * sách chặng xuống còn một vạch — đo được trên ảnh chụp luồng: tiêu đề
     * "Tedit đang tự động 12/12" chỉ còn ló ra một nửa dòng. Mà danh sách chặng
     * mới là thứ người dùng mở màn này để xem; chọn phong cách là việc làm thêm
     * trong lúc chờ.
     */
    <Card size="sm" className="lg:min-h-0">
      <CardHeader>
        <CardTitle>Phong cách video</CardTitle>
      </CardHeader>
      <CardContent className="no-scrollbar grid min-h-0 flex-1 gap-2 overflow-y-auto">
        {/* Chia theo NHÓM Ý ĐỒ, không đổ mười ô thành một lưới.
            Mười ô ngang hàng nhau bắt người dùng so từng cái với chín cái còn
            lại; ba nhóm thì họ trả lời một câu dễ trước ("video này thuộc loại
            gì") rồi mới so trong ba, bốn ô. */}
        {THEMES.map((theme) => {
          const packs = STYLE_PACKS.filter((pack) => pack.theme === theme);
          if (packs.length === 0) return null;
          return (
            <div key={theme} className="grid gap-1">
              <span className="text-xs text-muted-foreground">
                {THEME_LABELS[theme]} — {THEME_NOTES[theme]}
              </span>
              <div className="grid grid-cols-4 gap-1">
                {packs.map((pack) => (
                  <StylePreviewTile
                    key={pack.id}
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
                ))}
              </div>
            </div>
          );
        })}
        {/* Câu này là phần quan trọng nhất của cả thẻ. Không có nó thì năm ô đọc
            ra như một bước bắt buộc — hỏng về cảm giác chứ không hỏng về code,
            nên chỉ phát hiện được bằng cách nhìn. */}
        {/* Phần bộ dáng quyết định mà ô mẫu KHÔNG vẽ ra được. Rê chuột vào ô
            nào thì đọc ô đó, không rê thì đọc ô đang chọn — nên nó vừa là lời
            giải thích vừa là cách xem trước. */}
      </CardContent>
      {/* Chân thẻ phải GỌN: nó ăn thẳng vào chiều cao của lưới ô ngay trên.
          Bản trước để cả một khối lời nhắn hai dòng ở đây, và nó bóp thân thẻ
          xuống còn 29px trên màn cao 720 — đo được, nhìn thì tưởng chỉ hơi chật.

          Câu trấn an không cần khung màu: nó không báo lỗi cũng không báo xong,
          chỉ nói "không bắt buộc". Một dòng chữ mờ nói đúng chừng ấy. */}
      <CardFooter className="grid gap-0.5">
        <p className="text-sm">
          {shown.label}
          <span className="ml-2 text-muted-foreground">
            {describeStyleFeel(shown)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Không chọn cũng được — máy đang dùng “{current.label}”.
        </p>
      </CardFooter>
    </Card>
  );
}
