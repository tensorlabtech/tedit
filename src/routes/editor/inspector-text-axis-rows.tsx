import { FieldDescription } from "@/components/ui/field";

import { BANDS, type BandId } from "@/dev/overlays/overlay-model";
import { OptionPicker } from "./option-picker";

/**
 * CHỖ ĐẶT — dùng thẻ CHUẨN 9:16 tên-ở-giữa như mọi picker khác trong "Đang sửa"
 * (`OptionPicker`), để sau dán ảnh xem trước vào cho đồng bộ.
 */
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
      <OptionPicker
        size="lg"
        options={BANDS.map((band) => ({ id: band.id, label: band.label }))}
        value={value}
        onSelect={(id) => onChange(id as BandId)}
      />
      {/* Lời nhắc chỉ hiện khi ĐÃ chọn dải Giữa — chỗ mặt người nói ngồi. */}
      {note && <FieldDescription>{note}</FieldDescription>}
    </>
  );
}
