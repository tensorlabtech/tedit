import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatTime, type Sentence, type TextElement } from "./editor-data";
import { CaptionRow } from "./transcript-caption-row";
import type { EditorState } from "./use-editor";

/**
 * Một CÂU nói, hiện thành các dòng cụm chữ.
 *
 * Mỗi dòng là một cụm — đúng cái sẽ hiện lên khung hình ở giây đó. Câu chỉ còn
 * là cách NHÓM các dòng lại, vì người ta bỏ nội dung theo câu chứ không theo
 * cụm ("bỏ đoạn lan man này"), còn sửa chữ thì theo cụm.
 */
export function SentenceGroup({
  sentence,
  rows,
  editor,
  activeTime,
  chonNhieu,
  onPick,
}: {
  sentence: Sentence;
  rows: TextElement[];
  editor: EditorState;
  activeTime: number;
  /** Những dòng đang nằm trong vùng chọn nhiều dòng */
  chonNhieu: Set<string>;
  /** Bấm một dòng — `mo` là bấm thường, `noiDai` là Shift-bấm */
  onPick: (row: TextElement, noiDai: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "group/sentence relative grid gap-0.5 border-b border-border/70 pb-1.5 last:border-0",
        sentence.removed && "opacity-55",
      )}
    >
      {rows.length === 0 ? (
        // Câu không còn chữ nào: vẫn phải thấy được lời, không thì người dùng
        // mất dấu một quãng nói mà không hiểu vì sao dải có tiếng mà bản chép
        // lời thì trống.
        <div className="flex items-start gap-2 rounded-lg px-2 py-1">
          <button
            type="button"
            onClick={() => editor.seek(sentence.start)}
            className="min-h-6 pt-0.5 text-xs text-muted-foreground tabular-nums"
          >
            {formatTime(sentence.start)}
          </button>
          <button
            type="button"
            onClick={() => editor.seek(sentence.start)}
            className={cn(
              "min-h-6 flex-1 text-left text-sm leading-snug text-muted-foreground",
              sentence.removed && "line-through",
            )}
          >
            {sentence.text}
          </button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Tạo chữ cho câu này"
            onClick={() => void editor.createCaptionsForSentence(sentence.id)}
          >
            <PlusIcon />
          </Button>
        </div>
      ) : (
        <Rows
          rows={rows}
          editor={editor}
          activeTime={activeTime}
          chonNhieu={chonNhieu}
          onPick={onPick}
        />
      )}
    </div>
  );
}

/**
 * Các dòng của một câu — dòng ĐÃ BỎ vẫn nằm nguyên chỗ của nó, chỉ gạch ngang.
 *
 * Bản trước gom những dòng bỏ liền nhau thành một vạch `đã bỏ 3 dòng · hiện`,
 * lý lẽ là bảng Lời phải đọc ra đúng video thành phẩm. Nhưng bảng này không chỉ
 * để đọc thành phẩm — nó là chỗ người ta CẮT, mà cắt là một vòng lặp cắt → xem
 * → trả lại. Giấu thứ vừa cắt đi thì bước "trả lại" phải mở một cái vạch ra
 * trước đã, và cái vạch ấy không nói mình đang giấu câu nào.
 *
 * Gạch ngang nói đủ hai điều cùng lúc: câu này còn đó, và nó không vào video.
 */
function Rows({
  rows,
  editor,
  activeTime,
  chonNhieu,
  onPick,
}: {
  rows: TextElement[];
  editor: EditorState;
  activeTime: number;
  chonNhieu: Set<string>;
  onPick: (row: TextElement, noiDai: boolean) => void;
}) {
  return (
    <>
      {rows.map((row) => (
        <CaptionRow
          key={row.id}
          row={row}
          editor={editor}
          active={activeTime >= row.start && activeTime < row.end}
          inRange={chonNhieu.has(row.id)}
          onPick={onPick}
        />
      ))}
    </>
  );
}

// Tư liệu chèn KHÔNG hiện ở đây.
//
// Nó trải qua nhiều cụm, mà bảng này mỗi dòng đúng một cụm — đặt nó dưới dòng
// nó bắt đầu là đặt sai, và cái đuôi "phủ 2 dòng" chỉ là lời xin lỗi cho chỗ
// đặt sai đó. Lớp tư liệu trên dải vẽ đúng khoảng nó phủ, có cả ảnh thu nhỏ,
// bấm vào ra đúng khung sửa này — và dải thì luôn nằm ngay dưới. Câu hỏi
// "b-roll nằm ở đâu" là câu hỏi về THỜI GIAN; dải trả lời tốt hơn một danh sách.
