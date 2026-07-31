import { useEffect } from "react";
import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { JUNCTIONS, type JunctionId } from "@/dev/overlays/overlay-model";
import type { EditorState } from "./use-editor";

/** Lùi trước khi chạy, để mắt kịp bắt nhịp trước khi hiệu ứng nổ ra. */
const LEAD_IN = 0.4;
/** Chạy thêm một nhịp sau khi hiệu ứng hết, cho thấy nó lắng xuống thế nào. */
const TAIL = 0.3;

/**
 * Bảng sửa một hiệu ứng — chỗ nối ở vết cắt, hay nhấn nhịp giữa đoạn.
 *
 * Tách khỏi `inspector-panel` vì nó cần một `useEffect` riêng: chọn cái nào là
 * CHẠY THỬ ngay cái đó.
 */
export function EffectPane({
  editor,
  effect,
  onPreview,
}: {
  editor: EditorState;
  effect: {
    id: string;
    kind: JunctionId;
    outStart: number;
    outEnd: number;
    custom: boolean;
    atCut: boolean;
  };
  onPreview: (at: number, until?: number) => void;
}) {
  /**
   * Chọn là CHẠY THỬ ngay, và chỉ chạy đúng quãng của nó.
   *
   * Năm lựa chọn ở đây đều là CHUYỂN ĐỘNG. Trước đó bảng tả chúng bằng một câu
   * rồi hết; rồi tôi thêm một nút "Xem thử" — vẫn còn thừa một cú bấm cho thứ
   * mà người dùng chọn vào là để xem.
   *
   * Chạy lại cả khi ĐỔI KIỂU, không chỉ khi đổi chỗ: đổi kiểu chính là lúc cần
   * so cái mới với cái vừa xem.
   */
  const { toSource } = editor;
  useEffect(() => {
    onPreview(
      toSource(effect.outStart) - LEAD_IN,
      toSource(effect.outEnd) + TAIL,
    );
    // Chỉ theo mã và kiểu. Thêm `onPreview` vào đây thì mỗi lượt vẽ lại của
    // trang cha là một lần tự chạy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect.id, effect.kind]);

  return (
    <Card className="h-full min-h-0">
      <CardHeader>
        {/* Không huy hiệu độ dài nữa: nó không đổi quyết định nào. Muốn biết dài
            ngắn thì giờ đã XEM được — chọn vào là nó chạy. */}
        <CardTitle>{effect.atCut ? "Chỗ nối" : "Nhấn nhịp"}</CardTitle>
      </CardHeader>

      <CardContent className="min-h-0 flex-1">
        <Field>
          <FieldLabel>Kiểu</FieldLabel>
          <ToggleGroup
            size="sm"
            className="flex-wrap"
            value={[effect.kind]}
            onValueChange={(value) => {
              const next = value[0] as JunctionId | undefined;
              if (next) void editor.setEffectKind(effect.id, next);
            }}
          >
            {JUNCTIONS.map((item) => (
              <ToggleGroupItem key={item.id} value={item.id}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>
            {JUNCTIONS.find((item) => item.id === effect.kind)?.note}
          </FieldDescription>
        </Field>
      </CardContent>

      <CardFooter className="gap-2">
        {/* Chân thẻ từng có ba nút, hai trong đó không đáng có:
            · "Xem thử" — giờ chọn vào là tự chạy.
            · "Bỏ đánh dấu" ở chỗ nối — nó ĐÚNG BẰNG việc chọn "Cắt thẳng" ở hàng
              trên, tức một lối thứ hai tới cùng một chỗ.

            Chỉ hiệu ứng TỰ ĐẶT mới cần nút xoá thật: xoá nó là gỡ hẳn một vật,
            không có lựa chọn nào ở hàng trên làm được việc đó. */}
        {!effect.atCut && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void editor.deleteEffect(effect.id)}
          >
            <Trash2Icon data-icon="inline-start" />
            Xoá nhấn này
          </Button>
        )}
        {/* ẨN chứ không làm mờ khi nó chẳng làm gì (kiểu ở đây đã đúng bằng mặc
            định của dự án). Một cái nút mờ nằm đó suốt buổi trông như hỏng; hiện
            ra đúng lúc bấm được thì nó tự nói là "giờ mới có việc để làm". */}
        {effect.atCut && editor.zoomPunch !== effect.kind && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void editor.setZoomPunch(effect.kind)}
          >
            Dùng cho mọi chỗ nối
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
