import { useEffect, useRef, useState } from "react";
import { EyeOffIcon, Undo2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatTime, type TextElement } from "./editor-data";
import type { EditorState } from "./use-editor";

/** Một dòng = một cụm chữ = một khối trên dải. Sửa chữ CHỈ ở đây. */
export function CaptionRow({
  row,
  editor,
  active,
  inRange,
  onPick,
}: {
  row: TextElement;
  editor: EditorState;
  active: boolean;
  /** Đang nằm trong vùng chọn nhiều dòng */
  inRange: boolean;
  onPick: (row: TextElement, noiDai: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  // "Đã bỏ" suy từ CÁC QUÃNG KHÔNG VÀO VIDEO, không từ một cờ riêng của dòng.
  // Cắt bằng đường nào — bỏ khoảng này, bỏ cả câu, hay gọt mép đoạn trên dải —
  // thì dòng cũng phải hiện như nhau, vì với người dùng đó là một chuyện.
  const giua = (row.start + row.end) / 2;
  const removed = editor.skipRanges.some(
    (span) => giua >= span.start && giua < span.end,
  );
  const selected =
    editor.selection?.kind === "text" && editor.selection.id === row.id;

  // Gạch chấm dưới chỗ máy nghe không chắc — chỉ khi chữ CÒN khớp lời, vì lúc
  // đó mới ứng được tiếng nào với từ nào.
  const words = editor.captionWords(row);

  const chon = () => {
    editor.setSelection({ kind: "text", id: row.id });
    // Nhảy vạch tới chỗ chữ này hiện: chọn xong mà khung vẫn đứng ở giây khác
    // thì người dùng đang sửa một thứ mình KHÔNG thấy.
    editor.seek(row.start + 0.05);
  };

  // MỘT cú bấm là vào sửa được luôn — không bắt bấm đúp.
  //
  // Sửa chữ là việc chính của bảng này, mà bấm đúp thì không có dấu hiệu nào
  // cho biết là làm được. Bấm một cái vừa chọn, vừa nhảy vạch tới đó, vừa mở ô
  // sửa — ba thứ người dùng đều muốn cùng lúc. Bấm ra chỗ khác là xong, không
  // sửa gì thì không có gì đổi.
  const moSua = (event: React.MouseEvent) => {
    // Shift-bấm là NỐI DÀI vùng chọn, không mở ô sửa: đang gom nhiều dòng để bỏ
    // một lượt thì mở ô sửa ra giữa chừng là chắn mất tầm nhìn.
    if (event.shiftKey) {
      onPick(row, true);
      return;
    }
    onPick(row, false);
    chon();
    setEditing(true);
  };

  return (
    <div
      // Dấu để bảng cuộn tới đúng dòng này khi nó được chọn từ nơi khác.
      data-row={row.id}
      // Đang chọn thì đổi NỀN, không kẻ viền.
      //
      // Dòng chạy sát mép trái vùng cuộn, mà vùng cuộn thì cắt phần tràn — nên
      // đúng một pixel viền bên trái bị ăn mất và khối đang chọn trông như hở
      // một cạnh. Lùi dòng vào một pixel thì chữ của cả danh sách lệch đi để
      // phục vụ một trạng thái; tô nền thì không có cạnh nào để mà cắt.
      className={cn(
        "group/row flex items-start gap-2 rounded-lg px-2 py-1",
        inRange
          ? "bg-primary/25"
          : selected
            ? "bg-primary/15"
            : active
              ? "bg-accent"
              : "hover:bg-accent/50",
      )}
    >
      <button
        type="button"
        onClick={chon}
        className="min-h-6 pt-0.5 text-xs text-muted-foreground tabular-nums"
      >
        {formatTime(row.start)}
      </button>
      {editing ? (
        <CaptionInput
          row={row}
          editor={editor}
          onDone={() => setEditing(false)}
        />
      ) : (
        <button
          type="button"
          onClick={moSua}
          className={cn(
            "min-h-6 flex-1 text-left text-sm leading-snug text-balance",
            removed && "text-muted-foreground line-through",
          )}
        >
          {words
            ? words.map((word) => (
                <span
                  key={word.id}
                  className={cn(word.unsure && "underline decoration-dotted")}
                >
                  {word.text}{" "}
                </span>
              ))
            : row.content}
        </button>
      )}
      {/* Cắt video ngay tại dòng: khoảng của cụm CHÍNH LÀ khoảng cắt, nên bỏ một
          câu thừa là bấm đúng chỗ mình đang đọc, không phải sang dải tìm mốc.

          Nút này ở lại cả lúc đang sửa. Gỡ nó ra thì dòng mất đúng 4px — nó cao
          28px trong khi hai thứ còn lại cao 24px, nên chính nó quyết chiều cao
          dòng — và cả danh sách nhích lên khi bắt đầu gõ. */}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={removed ? "Giữ lại khoảng này" : "Bỏ khoảng này"}
        // Nói rõ nó BỎ CẢ KHÚC VIDEO, không phải ẩn một dòng chữ.
        //
        // Dòng này đọc ra là "một câu chữ", nên cái nút cạnh nó đọc ra là "ẩn
        // câu chữ này". Thật ra nó cắt nguyên khúc video ở đúng khoảng đó —
        // hình, tiếng, và MỌI chữ neo vào khoảng ấy cùng đi. Có hai chữ chồng
        // nhau thì bấm một cái là bay cả hai, và người dùng đọc ra "ẩn một cái
        // thì ẩn hết".
        tooltip={
          removed
            ? "Giữ lại khúc này trong video"
            : "Bỏ khúc này khỏi video — cả hình, tiếng và mọi chữ ở đây"
        }
        className={cn(
          "shrink-0",
          removed ? "opacity-100" : "opacity-0 group-hover/row:opacity-100",
        )}
        onClick={() =>
          removed
            ? void editor.restoreRange(giua)
            : void editor.cutRange(row.start, row.end)
        }
      >
        {removed ? <Undo2Icon /> : <EyeOffIcon />}
      </Button>
    </div>
  );
}

function CaptionInput({
  row,
  editor,
  onDone,
}: {
  row: TextElement;
  editor: EditorState;
  onDone: () => void;
}) {
  // Giữ bản GỐC ngay lúc mở ô sửa. Không giữ thì không có gì để so: mỗi phím gõ
  // đã ghi thẳng vào `row.content` để khung xem đổi theo, nên tới lúc chốt thì
  // "có đổi gì không" luôn ra là không, và cú sửa không bao giờ được ghi xuống.
  const [goc] = useState(row.content);
  const [draft, setDraft] = useState(row.content);
  // Đưa con trỏ vào ô NGAY, và đặt ở cuối chữ.
  //
  // `autoFocus` không đủ: cú bấm thứ hai của thao tác bấm đúp đã chuyển tiêu
  // điểm sang cái nút ngay lúc nhấn, trước cả khi ô nhập kịp dựng — nên người
  // dùng bấm đúp xong gõ vào chỗ trống mà không có gì xảy ra.
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, []);

  const commit = () => {
    onDone();
    const clean = draft.trim();
    if (clean && clean !== goc) {
      void editor.commitTextContent(row.id, clean);
    } else {
      editor.draftTextContent(row.id, goc);
    }
  };

  return (
    // Ô nhập TRẦN — không viền, không nền, không đệm, cùng cỡ chữ và cùng dòng
    // với lúc chỉ đọc. Chuyển sang sửa thì dòng không nhúc nhích một pixel nào.
    //
    // Trước đây đây là một `Textarea` hai dòng: bấm vào một cụm năm chữ thì mọc
    // ra một hộp cao gấp ba, đẩy tất cả các dòng dưới nó xuống — mà thứ đang sửa
    // chỉ là "Nhưng bây giờ nhìn lại". Dấu hiệu đang sửa là con trỏ nháy cộng
    // nền của dòng đang chọn; chừng đó là đủ, và đó cũng là cách Captions làm.
    //
    // Một dòng chứ không phải nhiều: một cụm chữ không có khái niệm xuống dòng —
    // máy tự bẻ dòng cho vừa khung hình.
    <input
      ref={ref}
      type="text"
      className="min-h-6 w-full flex-1 border-0 bg-transparent p-0 text-sm leading-snug outline-none"
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        // Khung xem trước đổi theo ngay từng phím — chỉ trên màn, chưa ghi.
        editor.draftTextContent(row.id, event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        // Enter là xong; Esc là bỏ.
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          editor.draftTextContent(row.id, goc);
          onDone();
        }
      }}
    />
  );
}
