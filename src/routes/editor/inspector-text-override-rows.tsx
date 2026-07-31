import { CaseSensitiveIcon, CaseUpperIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import { KEY_COLORS, type StylePack } from "../../../server/style-pack";
import type { TextElement } from "./editor-data";

/**
 * Hai trục người dùng đè được cho RIÊNG một cụm.
 *
 * Mọi trục khác của bộ dáng — font, viền, quầng, mật độ, nhịp — đều ở cấp dự
 * án, và cố ý như vậy: đổi font cho riêng một cụm là cụm đó rơi hẳn ra khỏi
 * video. Hai trục ở đây thì ngược lại, chúng là cách nhấn MỘT chỗ mà không phá
 * mạch chung.
 *
 * **Mặc định là "theo dáng", không phải một giá trị.** Người dùng chưa đụng thì
 * cụm đi theo bộ dáng và đổi bộ dáng là nó đổi theo; đụng rồi thì nó đứng yên kể
 * cả khi đổi bộ dáng. Bấm lại đúng ô đang chọn là bỏ đè.
 */
export function TextOverrideRows({
  element,
  pack,
  onChange,
}: {
  element: TextElement;
  /** Phong cách của DỰ ÁN — để nói "theo phong cách" nghĩa là gì. */
  pack: StylePack;
  onChange: (patch: Partial<TextElement>) => void;
}) {
  const packCase = pack.letterCase === "upper" ? "CHỮ HOA" : "như đã gõ";
  const packColor = pack.color.key.color;

  return (
    <>
      <Field>
        <FieldLabel>Kiểu chữ</FieldLabel>
        <ToggleGroup
          size="sm"
          value={[element.letterCase ?? "theo-dang"]}
          onValueChange={(next) => {
            const picked = next[0];
            // Bỏ chọn (bấm lại ô đang chọn) cũng về "theo dáng": người dùng
            // không phải nhớ rằng có một ô riêng tên là "theo dáng".
            onChange({
              letterCase:
                picked === "upper" || picked === "as-typed" ? picked : null,
            });
          }}
        >
          <ToggleGroupItem value="theo-dang">Theo phong cách</ToggleGroupItem>
          <ToggleGroupItem value="as-typed">
            <CaseSensitiveIcon />
            Như gõ
          </ToggleGroupItem>
          <ToggleGroupItem value="upper">
            <CaseUpperIcon />
            HOA
          </ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription>
          {element.letterCase
            ? "Cụm này đứng riêng — đổi phong cách cả video cũng không đổi nó."
            : `Đi theo phong cách “${pack.label}” (${packCase}).`}
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Màu từ khoá</FieldLabel>
        {/* Tập màu ĐÓNG, không phải bộ chọn màu tự do: màu tự do thì chọn được
            màu trùng nền hoặc không đọc nổi trên video mà không có gì cản. */}
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant={element.keyColor ? "outline" : "secondary"}
            size="xs"
            onClick={() => onChange({ keyColor: null })}
          >
            Theo phong cách
          </Button>
          {KEY_COLORS.map((item) => {
            const active = element.keyColor === item.value;
            return (
              <button
                key={item.value}
                type="button"
                aria-label={item.label}
                aria-pressed={active}
                title={item.label}
                // Bấm lại màu đang chọn là bỏ đè — cùng lối với hàng trên.
                onClick={() =>
                  onChange({ keyColor: active ? null : item.value })
                }
                className={cn(
                  // Viền vẽ VÀO TRONG: ô sát mép cột bên phải thì viền ngoài bị
                  // gọt mất một cạnh.
                  "size-7 rounded-md border border-border",
                  active
                    ? "inset-ring-2 inset-ring-primary"
                    : "hover:inset-ring-2 hover:inset-ring-primary/40",
                )}
                style={{ backgroundColor: item.value }}
              />
            );
          })}
        </div>
        <FieldDescription>
          {element.keyColor
            ? "Cụm này đứng riêng — đổi phong cách cả video cũng không đổi nó."
            : `Đi theo phong cách “${pack.label}” (${packColor}). Chỉ đổi những tiếng đã đánh dấu từ khoá.`}
        </FieldDescription>
      </Field>
    </>
  );
}
