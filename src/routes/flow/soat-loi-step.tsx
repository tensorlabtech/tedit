import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

import { PreviewPanel } from "@/routes/editor/preview-panel";
import { TranscriptPanel } from "@/routes/editor/transcript-panel";
import { useEditor } from "@/routes/editor/use-editor";
import { useEditorGuards } from "@/routes/editor/use-editor-guards";
import { usePreviewPlayback } from "@/routes/editor/use-preview-playback";

/**
 * BƯỚC SOÁT LỜI — tái dùng bàn chép của bàn dựng, cắt còn hai cột.
 *
 * ══ VÌ SAO TÁI DÙNG, KHÔNG DỰNG RIÊNG ══
 *
 * Bàn dựng đã có sẵn bảng chép lời tốt nhất: mỗi CỤM CAPTION một dòng NGẮN (đúng
 * cái hiện lên khung ở giây đó), sửa thẳng trong dòng, tô chữ đang đọc lúc phát,
 * chấm dưới chỗ máy chưa chắc. Dựng một bảng thứ hai cho bước này là hai nguồn
 * sự thật, sửa hai nơi ra hai kết quả. Nên bước Soát lời DÙNG LẠI nguyên
 * `useEditor` + `TranscriptPanel` + `PreviewPanel`, chỉ bày hai cột và bật cờ
 * `proofread` để ẩn việc cắt (cắt đã xong ở bước "Cắt đoạn lỗi").
 *
 * Cụm caption ở đây có sẵn: `GET /api/projects/:id` gieo lười caption khi mạch
 * đang chờ người và chưa gieo — tức đúng lúc bước này mở ra.
 *
 * Nút "Chốt chính tả" nằm ở hàng dưới của `/flow` (cùng chỗ các cổng khác), nên
 * bước này không dựng nút; nó chỉ lo bảng chép + khung xem.
 */
export function SoatLoiStep({ projectId }: { projectId: string | undefined }) {
  const editor = useEditor(projectId);
  const { playing, togglePlay } = usePreviewPlayback(editor);
  useEditorGuards({ editor, onTogglePlay: togglePlay });

  if (editor.loading || editor.error) {
    return (
      <Card className="lg:h-full lg:min-h-0">
        <CardContent className="grid min-h-0 flex-1 place-items-center">
          <Empty>
            {editor.error ? null : <Spinner />}
            <EmptyTitle>
              {editor.error ? "Không mở được bản chép" : "Đang mở bản chép…"}
            </EmptyTitle>
            <EmptyDescription>
              {editor.error ?? "Đang lấy bản chép lời từ máy chủ"}
            </EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  // Cùng khung với bước Bàn dựng: VIDEO to bên trái (1fr), bản chép làm SIDEBAR
  // phải 34rem — đúng bề rộng RightPanel của Bàn dựng. Trước đây bước này để bản
  // chép chiếm 1fr còn video co về 26rem bên phải: đi Cắt → Soát → Bàn dựng thì
  // video nhảy từ trên xuống góc phải rồi lại sang trái, mắt phải tìm lại ba lần.
  // Video to ở đây không phí: nó chạy karaoke, xem chữ cháy lên khung có khớp
  // không chính là việc soát. Cụm caption ngắn thì vừa khít cột 34rem, hết ô trống.
  return (
    <div className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_34rem]">
      <PreviewPanel
        editor={editor}
        playing={playing}
        onTogglePlay={togglePlay}
        proofread
      />
      <TranscriptPanel editor={editor} proofread />
    </div>
  );
}
