import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import { KEY_COLORS, type StylePack } from "../../../server/style-pack";
import type { TextElement } from "./editor-data";

/**
 * MÀU TỪ NHẤN — trục người dùng đè được cho RIÊNG một cụm.
 *
 * Không có nút "Theo phong cách" riêng nữa: phong cách chỉ là màu mà AI đã chọn
 * sẵn, nên nó đứng NGANG HÀNG như một ô màu bình thường (ô đầu, được chọn khi
 * chưa đè). Bấm ô đó là về lại màu mặc định; bấm ô khác là đè. Không câu giải
 * thích — ô màu tự nói.
 *
 * Tập màu ĐÓNG, không phải bộ chọn màu tự do: màu tự do thì chọn được màu trùng
 * nền hoặc không đọc nổi trên video mà không có gì cản.
 */
export function TextOverrideRows({
  element,
  pack,
  onChange,
}: {
  element: TextElement;
  /** Phong cách của DỰ ÁN — quyết định màu mặc định. */
  pack: StylePack;
  onChange: (patch: Partial<TextElement>) => void;
}) {
  const packColor = pack.color.key.color;
  // Bỏ ô trùng màu mặc định khỏi danh sách đè — không thì có hai ô cùng màu,
  // một "mặc định" một "đè", trông như lỗi.
  const overrides = KEY_COLORS.filter(
    (item) => item.value.toUpperCase() !== packColor.toUpperCase(),
  );

  return (
    <Field className="pb-2">
      <FieldLabel>Màu từ nhấn</FieldLabel>
      <div className="flex flex-wrap items-center gap-1.5">
        <ColorSwatch
          color={packColor}
          label="Mặc định"
          active={!element.keyColor}
          onClick={() => onChange({ keyColor: null })}
        />
        {overrides.map((item) => (
          <ColorSwatch
            key={item.value}
            color={item.value}
            label={item.label}
            active={element.keyColor === item.value}
            // Bấm lại màu đang chọn là bỏ đè, về mặc định.
            onClick={() =>
              onChange({
                keyColor: element.keyColor === item.value ? null : item.value,
              })
            }
          />
        ))}
      </div>
    </Field>
  );
}

function ColorSwatch({
  color,
  label,
  active,
  onClick,
}: {
  color: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        // Viền vẽ VÀO TRONG: ô sát mép cột bên phải thì viền ngoài bị gọt mất.
        "size-7 rounded-md border border-border",
        active
          ? "inset-ring-2 inset-ring-primary"
          : "hover:inset-ring-2 hover:inset-ring-primary/40",
      )}
      style={{ backgroundColor: color }}
    />
  );
}
