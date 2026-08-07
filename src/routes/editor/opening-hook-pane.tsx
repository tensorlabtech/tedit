import { useEffect, useState } from "react";
import { PlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { OverlayTextBlock } from "@/dev/overlays/overlay-render";
import { api } from "@/lib/api";

import { packForElement } from "../../../server/style-pack";
import { applyFontStyle, findStylePack } from "../../../server/style-pack-catalog";
import type { EditorState } from "./use-editor";

/**
 * BA ĐƯỜNG XỬ LÝ cho ba giây đầu.
 *
 * Không có con số chấm điểm nào ở đây. Hook tốt hay không thì máy không đo được,
 * và một con số bịa ra ở màn này sẽ làm hỏng lòng tin vào mọi con số khác đang
 * bày ra — phép thử là "nó đổi được quyết định nào?", mà một điểm số bịa thì
 * không đổi được quyết định nào cả.
 *
 * Ba đường KHÔNG cùng phụ thuộc một thứ: hai đường đầu chạy hoàn toàn bằng dữ
 * liệu đã có, chỉ đường thứ ba cần mô hình ngôn ngữ. Thiếu khoá mô hình thì màn
 * này vẫn dùng được.
 */

const PREVIEW_SECONDS = 3;

/**
 * Quãng im ở đầu, từ mức này trở lên mới đáng đề nghị cắt.
 *
 * Khớp `DEAD_LEAD_IN` của hàng soát. Đề nghị bỏ 0,4 giây là đề nghị người dùng
 * bấm một nút để đổi lấy một thứ không ai nhận ra.
 */
const DEAD_LEAD_IN = 1.2;

export function OpeningHookPane({
  open,
  onOpenChange,
  editor,
  onPreview,
  onDone,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  editor: EditorState;
  onPreview: (at: number, until?: number) => void;
  /** Đã nhận một đường — hàng soát ẩn lời nhắc đi. */
  onDone: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<string[] | null>(null);
  const [asking, setAsking] = useState(false);

  const words = editor.words;
  const firstWord = words[0];
  /** Cụm chữ đầu tiên — thứ đường 2 phóng to. */
  const firstText = [...editor.textElements].sort(
    (a, b) => a.start - b.start,
  )[0];
  const pack = applyFontStyle(findStylePack(editor.stylePack), editor.fontStyle);

  // Chữ của đúng ba giây đầu, lấy từ bảng `words`.
  const opening = words
    .filter((word) => word.start < PREVIEW_SECONDS)
    .map((word) => word.text)
    .join(" ");

  /**
   * Mốc lời THẬT bắt đầu — mép đường 1 đề nghị cắt tới.
   *
   * Lấy mốc từ đầu tiên chứ không dò lại đường bao âm lượng: `segment-seed.ts`
   * đã nới mép từng đoạn theo sóng âm khi gieo đoạn, nên mốc trong bảng `words`
   * vốn đã là mốc lời thật.
   */
  const speechStart = firstWord?.start ?? 0;

  useEffect(() => {
    if (!open || lines !== null || asking || !editor.projectId) return;
    setAsking(true);
    void api
      .suggestOpeningLines(editor.projectId)
      .then((result) => setLines(result.lines))
      .catch(() => setLines([]))
      .finally(() => setAsking(false));
  }, [open, lines, asking, editor.projectId]);

  const applyBigFirst = () => {
    if (!firstText) return;
    // KHÔNG tạo loại phần tử mới và KHÔNG đụng thứ tự đoạn: vẫn là chữ neo vào
    // khoảng từ, chỉ khác giá trị hai trục.
    editor.updateTextElement(firstText.id, {
      position: "middle",
      emphasis: "keyword-large",
    });
    onDone();
    onOpenChange(false);
  };

  const applyWritten = async () => {
    const text = draft.trim();
    if (!text || words.length === 0) return;
    // Việc thêm phần tử nằm ở `useEditor`, không ở đây: nó phải cập nhật state
    // ngay sau khi máy chủ nhận, không thì chữ mới không hiện ra cho tới lúc
    // tải lại trang.
    await editor.addOpeningText(text);
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ba giây đầu</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <Field>
            <FieldLabel>Bạn đang mở đầu bằng</FieldLabel>
            <p className="text-sm">“{opening || "…"}”</p>
            <FieldDescription>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onPreview(0, PREVIEW_SECONDS)}
              >
                <PlayIcon data-icon="inline-start" />
                Nghe thử 3 giây đầu
              </Button>
            </FieldDescription>
          </Field>

          {speechStart >= DEAD_LEAD_IN && (
            <Field>
              <FieldLabel>Bỏ phần rào đón</FieldLabel>
              <FieldDescription>
                Lời thật bắt đầu ở giây {speechStart.toFixed(1)}. Bỏ quãng trước
                đó thì video vào thẳng.
              </FieldDescription>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onPreview(speechStart, speechStart + PREVIEW_SECONDS)}
                >
                  Xem thử
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    // Cơ chế cắt CÓ SẴN: quãng bỏ vẫn nằm ở khung "Sẽ không vào
                    // video" nên lấy lại được, và không đụng `segments.position`.
                    editor.cutRange(0, speechStart);
                    onDone();
                    onOpenChange(false);
                  }}
                >
                  Bỏ quãng này
                </Button>
              </div>
            </Field>
          )}

          {firstText && (
            <Field>
              <FieldLabel>Phóng to câu đầu</FieldLabel>
              <FieldDescription>
                Cụm chữ đầu tiên chuyển sang giữa khung và cỡ lớn.
              </FieldDescription>
              {/* Xem thử là VẼ RA kết quả, không phải mô tả nó: cùng bộ vẽ với
                  khung xem và với bản xuất, nên thấy sao thì ra vậy. */}
              <div className="@container relative mx-auto h-40 w-auto aspect-[9/16] overflow-hidden rounded-lg bg-neutral-800">
                <OverlayTextBlock
                  config={{
                    text: firstText.content,
                    align: firstText.align,
                    emphasis: "keyword-large",
                    band: "middle",
                    keywords: firstText.keywords,
                    insert: { kind: "none", shape: "wide" },
                  }}
                  pack={packForElement(pack, null, firstText.keywords)}
                  seconds={99}
                />
              </div>
              <Button size="sm" onClick={applyBigFirst}>
                Dùng cách này
              </Button>
            </Field>
          )}

          <Field>
            <FieldLabel>Tự viết câu mở</FieldLabel>
            <Textarea
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Câu bạn muốn hiện ngay từ đầu"
            />
            {asking && (
              <FieldDescription>Đang nghĩ vài câu gợi ý…</FieldDescription>
            )}
            {lines && lines.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {lines.map((line) => (
                  <Button
                    key={line}
                    variant="outline"
                    size="sm"
                    onClick={() => setDraft(line)}
                  >
                    {line}
                  </Button>
                ))}
              </div>
            )}
            {lines && lines.length === 0 && !asking && (
              <FieldDescription>
                Chưa gợi ý được — bạn tự viết nhé, hai cách trên vẫn dùng được.
              </FieldDescription>
            )}
            <FieldDescription>
              Gợi ý sửa được trước khi nhận. Câu này neo vào mấy tiếng đầu, nên
              nó không bao giờ hiện trước lúc có tiếng nói.
            </FieldDescription>
            <Button
              size="sm"
              disabled={!draft.trim()}
              onClick={() => void applyWritten()}
            >
              Dùng câu này
            </Button>
          </Field>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Để nguyên</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
