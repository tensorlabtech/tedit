import {
  AlignVerticalJustifyCenterIcon,
  AlignVerticalJustifyEndIcon,
  AlignVerticalJustifyStartIcon,
} from "lucide-react";

import { FieldDescription } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  ALIGNS,
  BANDS,
  type AlignId,
  type BandId,
} from "@/dev/overlays/overlay-model";
import { AlignGlyph } from "./inspector-text-axis-glyphs";

/**
 * Hai trục này chỉ cần ICON + NHÃN, không cần khung xem trước.
 *
 * Khác với "Dáng": dáng nói về hình dạng của khối chữ — thứ không gọi tên gọn
 * được, nên phải vẽ ra. Còn "trên / giữa / dưới" và "trái / giữa / phải" là
 * những khái niệm ai cũng có sẵn trong đầu; vẽ ba khung 9:16 chỉ để nói "chữ ở
 * trên" là bày một bức tranh cho điều đọc một chữ là xong.
 *
 * CHỖ ĐẶT dùng icon có sẵn (`AlignVerticalJustify*`) — trên/giữa/dưới là thứ bộ
 * icon nào cũng vẽ đúng, không có lý do tự vẽ lại.
 *
 * CĂN NGANG thì phải tự vẽ — xem `inspector-text-axis-glyphs`. Bộ icon nào cũng
 * có `AlignLeft/Center/Right`, nhưng "bậc thang" và "so le" là khái niệm của
 * riêng hệ này nên không bộ nào có; lấy tạm hai cái gần gần thì được hai hình
 * không nói gì đúng, mà lại phá tính đồng bộ của cả hàng.
 *
 * KHÔNG tooltip. Luật "thứ bấm được mà chỉ có icon thì phải có tooltip" là để
 * cứu những nút không có chữ — ở đây chữ nằm sẵn ngay cạnh icon. Thêm tooltip
 * vào chỉ là bày ra một hộp đen che mất chính hàng nút đang chọn, để đọc lại
 * đúng cái từ vừa đọc.
 */

const BAND_ICON: Record<BandId, React.ReactNode> = {
  top: <AlignVerticalJustifyStartIcon />,
  middle: <AlignVerticalJustifyCenterIcon />,
  bottom: <AlignVerticalJustifyEndIcon />,
};

export function BandRow({
  value,
  onChange,
}: {
  value: BandId;
  onChange: (next: BandId) => void;
}) {
  const note = BANDS.find((band) => band.id === value)?.note;
  return (
    <>
      <ToggleGroup
        size="sm"
        className="flex-wrap"
        value={[value]}
        onValueChange={(next) => {
          const selected = next[0] as BandId | undefined;
          if (selected) onChange(selected);
        }}
      >
        {BANDS.map((band) => (
          <ToggleGroupItem key={band.id} value={band.id}>
            {BAND_ICON[band.id]}
            {band.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {/* Lời nhắc chỉ hiện khi ĐÃ chọn đúng cái dải có vấn đề — hiện chỉ dải
          Giữa, nó là chỗ mặt người nói ngồi.
          Trước đó tôi nhét câu này vào tooltip: sai chỗ. Một lời cảnh báo mà bắt
          phải rê chuột lên mới thấy thì đúng những người cần nó nhất lại không
          bao giờ thấy. Còn in sẵn ra một dòng thì nó đứng đó suốt buổi dựng
          trong khi 96% số chữ không dùng dải này. */}
      {note && <FieldDescription>{note}</FieldDescription>}
    </>
  );
}

export function AlignRow({
  value,
  onChange,
}: {
  value: AlignId;
  onChange: (next: AlignId) => void;
}) {
  return (
    <ToggleGroup
      size="sm"
      className="flex-wrap"
      value={[value]}
      onValueChange={(next) => {
        const selected = next[0] as AlignId | undefined;
        if (selected) onChange(selected);
      }}
    >
      {ALIGNS.map((item) => (
        <ToggleGroupItem key={item.id} value={item.id}>
          <AlignGlyph align={item.id} />
          {item.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
