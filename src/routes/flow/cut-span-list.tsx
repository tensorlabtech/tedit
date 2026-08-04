import { PlayIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDuration } from "@/lib/format-duration";

import type { Span } from "./cut-lane";

/**
 * HÀNG SOÁT — từng chỗ máy định bỏ, kèm LỜI nằm trong đó.
 *
 * ══ VÌ SAO CÓ CẢ DẢI RỒI VẪN CẦN HÀNG NÀY ══
 *
 * Dải trả lời "cắt ở đâu, mép rơi vào chỗ nghỉ hay giữa tiếng". Nó KHÔNG trả lời
 * "cắt mất câu gì" — trên dải thì mọi lớp che giống nhau, và chữ nhét vào một
 * khối rộng 20px thì không đọc được.
 *
 * Mà "cắt mất câu gì" mới là câu hỏi của bước này.
 *
 * ══ CHỖ LẶNG TÁCH RA, KHÔNG XẾP LẪN ══
 *
 * Bản đầu bày cả mười hai chỗ thành một danh sách phẳng. Chụp màn ra thì tám
 * trong mười hai dòng ghi "— không có tiếng nói —": đó là các chỗ `auto-trim`
 * rút bớt im lặng, và chúng chôn mất đúng ba dòng CÓ LỜI — thứ duy nhất đáng
 * soát.
 *
 * Hai loại ấy hỏi hai câu khác nhau. Bỏ một chỗ lặng thì cùng lắm nhịp hơi gấp;
 * bỏ nhầm một câu thì mất hẳn một ý. Nên chỗ có lời bày ra từng dòng, còn chỗ
 * lặng gộp thành MỘT dòng tổng — vẫn đọc được máy rút bao nhiêu, mà không chiếm
 * chỗ của thứ cần nhìn.
 */

export type SpanRow = Span & { text: string };

export function CutSpanList({
  heading,
  rows,
  selectedId,
  onSelect,
  onAudit,
  onDelete,
}: {
  heading: string;
  rows: SpanRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Nghe đúng chỗ này, kể cả khi bản xem trước đang nhảy qua nó. */
  onAudit: (span: SpanRow) => void;
  onDelete: (id: string) => void;
}) {
  const spoken = rows.filter((row) => row.text.trim().length > 0);
  const silent = rows.filter((row) => row.text.trim().length === 0);
  const silentSeconds = silent.reduce(
    (sum, row) => sum + (row.end - row.start),
    0,
  );

  return (
    <Card className="lg:min-h-0">
      <CardHeader>
        <CardTitle>{heading}</CardTitle>
      </CardHeader>
      {/* Cuộn KHÔNG thanh cuộn, mép dưới mờ dần báo "còn nữa" — cùng lối panel
          bản chép của bàn dựng. `CLAUDE.md` dặn tránh scrollbar; một danh sách hay
          dài hơn khung mà đeo vạch xám suốt buổi là đúng thứ quy tắc ấy cấm. */}
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea
          className="h-full"
          scrollbar={false}
          viewportClassName="scroll-fade-b"
        >
          <div className="grid content-start gap-1 px-4">
            {rows.length === 0 ? (
              <p className="text-muted-foreground">
                Máy không tìm thấy chỗ nào đáng bỏ. Thấy chỗ nào lỗi thì đưa
                vạch tới đó rồi bấm dấu cộng trên dải.
              </p>
            ) : null}

            {spoken.map((row) => (
              <div
                key={row.id}
                data-state={row.id === selectedId ? "here" : "off"}
                className="grid cursor-pointer gap-1 rounded-lg border border-border px-3 py-2 data-[state=here]:ring-2 data-[state=here]:ring-primary data-[state=here]:ring-inset"
                onClick={() => onSelect(row.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0 tabular-nums text-xs">
                    {formatDuration(row.start)} ·{" "}
                    {(row.end - row.start).toFixed(1)}s
                  </span>
                  <span className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Nghe chỗ này"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAudit(row);
                    }}
                  >
                    <PlayIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Xoá khoảng cắt — giữ lại phần phim này"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(row.id);
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                {/* Lời bị bỏ GẠCH NGANG: đây là thứ sẽ biến mất, và gạch ngang nói
                điều ấy mà không cần một dòng chú thích nào. */}
                <span className="text-muted-foreground line-clamp-3 text-sm leading-tight line-through">
                  {row.text}
                </span>
              </div>
            ))}

            {spoken.length === 0 && rows.length > 0 ? (
              <p className="text-muted-foreground text-sm">
                Máy không bỏ câu nào — chỉ rút bớt chỗ lặng.
              </p>
            ) : null}

            {silent.length > 0 ? (
              /* Một dòng tổng, KHÔNG bấm được: không có gì để soát ở đây, và làm nó
             trông bấm được là mời người dùng đi vào một chỗ không có việc gì. */
              <p className="text-muted-foreground mt-1 rounded-lg border border-border px-3 py-2 text-xs">
                Và {silent.length} chỗ lặng · {formatDuration(silentSeconds)} —
                máy rút cho nhịp gọn, không mất lời nào. Sửa được trên dải bên
                dưới.
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
