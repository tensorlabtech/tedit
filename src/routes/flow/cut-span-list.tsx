import { PlayIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDuration } from "@/lib/format-duration";

import type { Span } from "./cut-lane";

/**
 * HÀNG SOÁT — MỌI chỗ máy định bỏ, xếp theo thời gian, bình đẳng.
 *
 * ══ VÌ SAO CÓ CẢ DẢI RỒI VẪN CẦN HÀNG NÀY ══
 *
 * Dải trả lời "cắt ở đâu, mép rơi vào chỗ nghỉ hay giữa tiếng". Nó KHÔNG trả lời
 * "cắt mất câu gì, bỏ chỗ nào" gọn trong một cột đọc dọc — trên dải thì mọi lớp
 * che giống nhau. Danh sách này là cái đọc được: từng chỗ một, theo thứ tự.
 *
 * ══ CHỖ LẶNG CŨNG LIỆT KÊ TỪNG CÁI ══
 *
 * Bản trước gộp chỗ lặng thành một dòng tổng ("Và N chỗ lặng"), nghĩ rằng chỉ chỗ
 * CÓ LỜI mới đáng soát. Sai: người dùng muốn soát cả chỗ lặng — có quãng lặng là
 * nhịp thở CỐ Ý, bỏ đi thì video dồn dập. Gộp lại thì không giữ lại được từng
 * cái.
 *
 * Nên mọi chỗ xếp CHUNG một danh sách theo thời gian, mỗi chỗ một dòng, đều có
 * nút nghe và nút giữ lại. Chỗ có lời hiện lời (gạch ngang — sẽ mất); chỗ lặng
 * ghi "Khoảng lặng" cho biết đây là nhịp, không phải câu.
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
  // MỌI chỗ, xếp theo mốc bắt đầu — để soát theo đúng dòng chảy của video.
  const ordered = [...rows].sort((a, b) => a.start - b.start);

  return (
    <Card className="lg:min-h-0">
      <CardHeader>
        <CardTitle>{heading}</CardTitle>
      </CardHeader>
      {/* Cuộn KHÔNG thanh cuộn, mép dưới mờ dần báo "còn nữa" — cùng lối panel
          bản chép của bàn dựng. */}
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea
          className="h-full"
          scrollbar={false}
          viewportClassName="scroll-fade-b"
        >
          {/* `pb` chừa chỗ để viền dòng CUỐI không bị mép dưới viewport xén. */}
          <div className="grid content-start gap-1 px-4 pb-4">
            {ordered.length === 0 ? (
              <p className="text-muted-foreground">
                Máy không tìm thấy chỗ nào đáng bỏ. Thấy chỗ nào lỗi thì đưa vạch
                tới đó rồi bấm dấu cộng trên dải.
              </p>
            ) : null}

            {ordered.map((row) => {
              const silent = row.text.trim().length === 0;
              return (
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
                    {/* Icon HOÀN TÁC, không phải thùng rác: bỏ một khoảng cắt là
                        GIỮ LẠI đoạn phim ấy — việc an toàn, ngược hẳn "xoá". */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Giữ lại đoạn này — không cắt nữa"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(row.id);
                      }}
                    >
                      <RotateCcwIcon />
                    </Button>
                  </div>
                  {silent ? (
                    // Chỗ lặng: KHÔNG gạch ngang (không có lời để mất), chỉ nói
                    // đây là nhịp — để người dùng cân nhắc giữ lại làm nhịp thở.
                    <span className="text-muted-foreground text-sm italic">
                      Khoảng lặng — máy rút cho nhịp gọn
                    </span>
                  ) : (
                    // Lời bị bỏ GẠCH NGANG: đây là thứ sẽ biến mất.
                    <span className="text-muted-foreground line-clamp-3 text-sm leading-tight line-through">
                      {row.text}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
