import { useEffect, useRef, useState } from "react";
import { PlayIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * KHE THIẾU LỜI — gợi ý bấm-để-thêm ở chỗ máy nghe SÓT cả câu.
 *
 * Máy nghe bỏ sót nguyên một câu thì không có từ nào để mà bấm, nên bản chép
 * bắt đầu ở giữa (ví dụ mất câu mở đầu). Khe này lấp đúng chỗ trống ấy: bấm vào
 * mở ô gõ câu bị sót, mốc chia đều trong khoảng `[start, end]` của khe.
 */
export function AddLineRow({
  seconds,
  onAdd,
  onListen,
}: {
  /** Độ dài khe, giây — in kèm để người dùng ước lượng "sót bao nhiêu". */
  seconds: number;
  onAdd: (text: string) => void;
  /** Nghe đúng khoảng này (có tiếng chưa có chữ) để biết máy sót lời gì. */
  onListen?: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div
        className={cn(
          "group/gap flex items-center gap-1 rounded-lg border border-dashed border-border pr-1 text-sm transition-colors",
          "hover:border-primary/40 hover:bg-primary/5",
        )}
      >
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-muted-foreground group-hover/gap:text-primary flex flex-1 items-center gap-2 px-2 py-1 text-left"
        >
          <PlusIcon className="text-primary size-3.5 shrink-0" />
          <span>Thêm lời</span>
          <span className="text-muted-foreground/70 text-xs tabular-nums">
            · {seconds.toFixed(1).replace(".", ",")}s có tiếng chưa có chữ
          </span>
        </button>
        {onListen && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Nghe khoảng này"
            tooltip="Nghe khoảng này"
            className="shrink-0 opacity-0 group-hover/gap:opacity-100"
            onClick={onListen}
          >
            <PlayIcon />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-2 py-1">
      <Editor
        onAdd={(text) => {
          setEditing(false);
          onAdd(text);
        }}
        onCancel={() => setEditing(false)}
      />
    </div>
  );
}

/** Ô gõ câu bị sót — Enter thêm, Esc/để trống thì thôi. */
function Editor({
  onAdd,
  onCancel,
}: {
  onAdd: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  // Enter/Esc đóng ô (unmount) làm bắn thêm một `blur` — chốt để chỉ xử một lần.
  const done = useRef(false);
  const once = (run: () => void) => {
    if (done.current) return;
    done.current = true;
    run();
  };

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const commit = () => once(() => (text.trim() ? onAdd(text) : onCancel()));

  return (
    <textarea
      ref={ref}
      rows={1}
      value={text}
      placeholder="Gõ câu máy nghe sót…"
      className="min-h-6 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-sm leading-snug outline-none"
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          once(onCancel);
        }
      }}
      onBlur={commit}
    />
  );
}
