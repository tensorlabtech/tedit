import { useEffect } from "react";
import { Trash2Icon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";

import { JUNCTIONS, type JunctionId } from "@/dev/overlays/overlay-model";
import { JUNCTION_GROUPS } from "../../../server/junction-kinds";
import { OptionPicker } from "./option-picker";
import type { EditorState } from "./use-editor";

/** Lùi trước khi chạy, để mắt kịp bắt nhịp trước khi hiệu ứng nổ ra. */
const LEAD_IN = 0.4;
/** Chạy thêm một nhịp sau khi hiệu ứng hết, cho thấy nó lắng xuống thế nào. */
const TAIL = 0.3;

const ALL_GROUPS: string[] = JUNCTION_GROUPS.map((group) => group.id);

/**
 * Bảng sửa một hiệu ứng — chỗ nối ở vết cắt, hay nhấn nhịp giữa đoạn.
 *
 * BÀY HẾT các kiểu ra, KHÔNG giấu vào modal: chuyển động phải XEM TRỰC TIẾP mới
 * chọn được — bấm cái nào là chạy thử ngay cái đó, so cái mới với cái vừa xem.
 * Gần ba chục kiểu thì gom vào ba nhóm cảm giác (Gắt/Vừa/Êm) bằng accordion, mặc
 * định mở hết; dài quá thì thu gọn từng nhóm lại.
 *
 * Tách khỏi `inspector-panel` vì nó cần một `useEffect` riêng: đổi kiểu nào là
 * CHẠY THỬ ngay kiểu đó.
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
   * Đổi kiểu là CHẠY THỬ ngay, và chỉ chạy đúng quãng của nó. Chỉ theo mã và
   * kiểu; thêm `onPreview` vào đây thì mỗi lượt vẽ lại của trang cha là một lần
   * tự chạy.
   */
  const { toSource } = editor;
  useEffect(() => {
    onPreview(
      toSource(effect.outStart) - LEAD_IN,
      toSource(effect.outEnd) + TAIL,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect.id, effect.kind]);

  const currentSpec = JUNCTIONS.find((item) => item.id === effect.kind);
  const pick = (id: JunctionId) => void editor.setEffectKind(effect.id, id);

  return (
    <Card className="h-full min-h-0">
      <CardHeader>
        {/* Không huy hiệu độ dài: nó không đổi quyết định nào. Muốn biết dài ngắn
            thì giờ đã XEM được — đổi kiểu là nó chạy. */}
        <CardTitle>{effect.atCut ? "Chỗ nối" : "Nhấn nhịp"}</CardTitle>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        <div className="grid gap-3">
          {/* base-ui mặc định mở-nhiều: liệt kê cả ba nhóm là ba nhóm cùng mở. */}
          <Accordion defaultValue={ALL_GROUPS} className="gap-0">
            {JUNCTION_GROUPS.map((group) => {
              const items = JUNCTIONS.filter(
                (item) => item.group === group.id && item.id !== "none",
              );
              if (items.length === 0) return null;
              const holdsCurrent = currentSpec?.group === group.id;
              return (
                <AccordionItem key={group.id} value={group.id}>
                  <AccordionTrigger className="py-2.5 hover:no-underline">
                    <span className="font-heading font-medium">
                      {group.label}
                    </span>
                    {/* Thu gọn nhóm chứa kiểu đang chọn thì vẫn thấy tên nó ở đây,
                        khỏi phải mở ra dò. */}
                    {holdsCurrent && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        {currentSpec?.label}
                      </span>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <OptionPicker
                      variant="grid"
                      options={items.map((item) => ({
                        id: item.id,
                        label: item.label,
                      }))}
                      value={effect.kind}
                      onSelect={(id) => pick(id as JunctionId)}
                    />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {/* Câu tả kiểu ĐANG chọn — nó ở nhóm nào không quan trọng, đây là chỗ
              đọc "kiểu này cảm giác ra sao". */}
          {currentSpec?.note && (
            <FieldDescription>{currentSpec.note}</FieldDescription>
          )}
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        {/* Nút XOÁ thật, không phải một ô "Cắt thẳng" trong danh sách: chọn "cắt
            thẳng" là THÊM một lựa chọn mà chẳng đổi gì (chỗ nối vốn đã cắt thẳng
            khi chưa gắn kiểu) — thừa. Xoá ở đây: chỗ nối ở vết cắt thì gỡ hiệu
            ứng về cắt thẳng, còn nhấn nhịp tự đặt thì gỡ hẳn. Phím Delete cũng
            làm đúng việc này.
            Hiện khi CÓ gì để xoá: nhấn nhịp luôn có; chỗ nối chỉ khi đang gắn một
            kiểu (chưa gắn thì không có gì để bỏ). */}
        {(!effect.atCut || effect.kind !== "none") && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void editor.deleteEffect(effect.id)}
          >
            <Trash2Icon data-icon="inline-start" />
            Xoá
          </Button>
        )}
        {/* ẨN chứ không làm mờ khi nó chẳng làm gì (kiểu ở đây đã đúng bằng mặc
            định của dự án). */}
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
