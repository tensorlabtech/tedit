import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { InspectorPanel } from "./inspector-panel";
import { MusicLibraryPanel } from "./music-library-panel";
import { ReviewQueue, useReviewIssues } from "./review-queue";
import type { EditorState } from "./use-editor";

/**
 * Cột phải: hàng soát và khung sửa dùng CHUNG một thẻ, chuyển bằng tab.
 *
 * Trước đây hai thẻ xếp chồng và tranh nhau chiều cao — ở màn 720px thì thẻ nào
 * cũng bị cắt ngang, cắt mất đúng cái nút người dùng đang định bấm. Chữa bằng
 * cách cho hàng soát tự thu về một dòng lúc đang chọn, nhưng thế là một cái
 * đang mở lại co cái kia — hai thứ dính nhau mà không ai bảo chúng phải dính.
 *
 * Tab thì nói thẳng: chỉ một trong hai được nhìn, và người dùng chọn cái nào.
 * Cả chiều cao thuộc về cái đang mở.
 *
 * KHÔNG có việc gì cần soát thì bỏ luôn tab — một cái tab đơn độc là một câu
 * hỏi không có lựa chọn nào.
 */
export function RightPanel({
  editor,
  onPreview,
}: {
  editor: EditorState;
  /** Đưa vạch tới `at` (giây gốc) rồi cho chạy, dừng ở `denKhi` nếu có */
  onPreview: (at: number, until?: number) => void;
}) {
  const { issues, boQua } = useReviewIssues(editor);
  const [tab, setTab] = useState("sua");
  // Theo dõi CHÍNH thứ đang chọn, không phải "có chọn gì không".
  //
  // Dùng cờ có/không thì đang mở hàng soát mà bấm một khối khác trên dải, cờ
  // vẫn đúng bằng `true` từ lần chọn trước — hiệu ứng không chạy lại, và khung
  // sửa mở ra sau lưng một cái tab đang đóng. Chọn từ đâu cũng phải mở nó ra.
  const hasSelection = editor.selection
    ? `${editor.selection.kind}:${editor.selection.id}`
    : null;

  // Chọn một thứ là chuyển sang khung sửa; bỏ chọn thì về hàng soát. Đây là
  // thứ người dùng vừa nói mình muốn xem, không phải phỏng đoán.
  useEffect(() => {
    // Đang mở kho nhạc thì ĐỪNG giật sang khung sửa: đặt một bài vào dải là tự
    // chọn nó, nên tab sẽ nhảy đi ngay giây người dùng vừa bấm — mà họ còn đang
    // định chọn thêm bài nữa.
    setTab((cu) => (cu === "kho" ? cu : hasSelection ? "sua" : "soat"));
  }, [hasSelection]);

  // Hàng soát rỗng thì BỎ tab của nó, chứ không bỏ cả hàng tab: kho nhạc luôn có
  // đó, nên vẫn còn hai lựa chọn để mà chọn. Trước đây chỗ này thoát sớm và trả về
  // riêng khung sửa — làm thế bây giờ là kho nhạc biến mất đúng lúc dự án sạch
  // việc, tức là đúng lúc người ta rảnh tay đi chọn nhạc.
  const showReview = issues.length > 0;
  const openTab = !showReview && tab === "soat" ? "sua" : tab;

  return (
    // `h-full` chứ không `flex-1`: thẻ này giờ là một ô lưới, nó phải cao đúng
    // bằng ô — bằng hai cột kia — chứ không cao theo nội dung.
    <Card className="h-full min-h-0">
      {/* `flex-1 min-h-0` cho cả Tabs lẫn từng TabsContent: Tabs thay chỗ bố
          cục dọc của Card, nên thiếu nó thì chiều cao không truyền xuống được
          và thẻ bên trong tự cao theo nội dung rồi bị cắt chân. */}
      {/* `min-w-0` cùng với `min-h-0`: Tabs và CardContent đều là con của một
          flex, mà con flex mặc định không co dưới bề rộng nội dung. Thiếu nó thì
          một tên bài dài trong kho nhạc nong cả cột phải ra rộng hơn thẻ, và hàng
          công cụ trồi hẳn ra ngoài màn. */}
      <Tabs
        value={openTab}
        onValueChange={(value) => setTab(String(value))}
        className="min-h-0 w-full min-w-0 flex-1"
      >
        <CardHeader>
          {/* Các TIÊU ĐỀ đứng cạnh nhau, cái không mở thì mờ — chứ không phải
              một hàng tab kẻ gạch chân nằm dưới một tiêu đề. Thẻ chỉ có một
              tên, và tên đó là thứ đang xem. */}
          <TabsList variant="title">
            {showReview && (
              <TabsTrigger value="soat">
                Cần bạn xem
                <Badge variant="secondary">{issues.length}</Badge>
              </TabsTrigger>
            )}
            <TabsTrigger value="sua">Đang sửa</TabsTrigger>
            <TabsTrigger value="kho">Kho nhạc</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent className="min-h-0 min-w-0 flex-1">
          {showReview && (
            <TabsContent value="soat" className="h-full min-h-0">
              {/* Giấu cả đầu thẻ của hàng soát: tab ngay trên đã nói "Cần bạn
                  xem 3" rồi, lặp lại lần nữa cách hai chục pixel là thừa. */}
              <LotVo className="[&_[data-slot=card-header]]:hidden">
                <ReviewQueue editor={editor} issues={issues} onBoQua={boQua} />
              </LotVo>
            </TabsContent>
          )}
          <TabsContent value="sua" className="h-full min-h-0">
            <LotVo>
              <InspectorPanel editor={editor} onPreview={onPreview} />
            </LotVo>
          </TabsContent>
          <TabsContent value="kho" className="h-full min-h-0 min-w-0">
            <MusicLibraryPanel editor={editor} open={openTab === "kho"} />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

/**
 * Lột vỏ Card của một panel để nó nằm vừa trong thẻ đang có tab.
 *
 * Làm ở CHỖ GỌI chứ không thêm cờ `bare` vào từng panel: hai panel kia có sáu
 * nhánh trả về Card khác nhau, luồn một cờ qua hết là sáu chỗ để quên. Ở đây
 * chỉ có một dòng, và nó nói rõ mình đang tắt cái gì.
 */
function LotVo({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // `h-full` cho cả vỏ lẫn thẻ bên trong: thiếu nó thì thẻ trong cao theo
        // nội dung, tràn khỏi thẻ ngoài và bị `overflow-hidden` cắt mất chân —
        // đúng chỗ đặt nút "Xoá chữ này".
        "h-full min-h-0 [&>[data-slot=card]]:h-full [&>[data-slot=card]]:gap-3 [&>[data-slot=card]]:rounded-none [&>[data-slot=card]]:bg-transparent [&>[data-slot=card]]:py-0 [&>[data-slot=card]]:ring-0 [&_[data-slot=card-content]]:px-0 [&_[data-slot=card-footer]]:px-0 [&_[data-slot=card-header]]:px-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
