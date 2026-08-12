import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlayerRef } from "@remotion/player";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

import { RemotionPreview } from "@/routes/editor/remotion-preview";
import { RightPanel } from "@/routes/editor/right-panel";
import { Timeline } from "@/routes/editor/timeline";
import { useEditor, type EditorState } from "@/routes/editor/use-editor";
import { useEditorGuards } from "@/routes/editor/use-editor-guards";

/** Ô trong hàng tiêu đề /flow mà bước Bàn dựng nhét nút xuất video vào. */
export const STUDIO_ACTION_SLOT = "flow-studio-action";

/**
 * BƯỚC BÀN DỰNG — bàn dựng thế hệ mới, BỎ phần cắt.
 *
 * Đây là editor cũ lược đi mọi việc cắt (đã làm ở bước "Cắt đoạn lỗi"): giữ khung
 * xem, khung sửa (kiểu phụ đề, chuyển cảnh, tư liệu, hiệu ứng, nhạc) và dải thời
 * gian chỉ còn các lớp DỰNG. Tái dùng nguyên `useEditor` + component của editor;
 * phần cắt tắt bằng cờ `studio` truyền xuống Timeline/RightPanel.
 *
 * Bỏ so với editor cũ: cột "Bản chép lời" (công cụ soát/cắt), dải phim bấm-chọn-
 * đoạn, dấu chỗ cắt, tay nắm gọt mép đoạn, nút ✂, và các lời nhắc cắt/soát-lời.
 *
 * Nút "Xuất video" nằm ở hàng tiêu đề /flow (đồng bộ với "Chốt bản cắt"…). Nó
 * render TỪ ĐÂY qua portal chứ không nâng `useEditor` lên flow-page: phát chạy
 * đẩy mốc 20 lần/giây, nâng lên trên là cả khung /flow dựng lại theo — portal
 * giữ việc dựng lại gói gọn trong bước này, header đứng yên.
 */
export function StudioStep({ projectId }: { projectId: string | undefined }) {
  const editor = useEditor(projectId);
  // Player LÀ đồng hồ (thay thẻ <video> cũ). SPACE bật/tắt phát; kéo dải thì dừng.
  const playerRef = useRef<PlayerRef>(null);
  const togglePlay = () => playerRef.current?.toggle();
  // Chọn cụm / nghe thử quãng = TUA (Player + vạch tự đồng bộ qua RemotionPreview).
  // Nghe-thử-CHẠY-quãng tạm lược về tua-đầu-quãng (bàn dựng ít dùng, sẽ thêm sau).
  const onPreview = (at: number) => editor.seek(at);
  const onAudit = (span: { start: number; end: number }) =>
    editor.seek(span.start);
  useEditorGuards({ editor, onTogglePlay: togglePlay });

  // Ô nút ở header do flow-page dựng cùng lượt; tìm sau khi gắn là thấy.
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setActionSlot(document.getElementById(STUDIO_ACTION_SLOT));
  }, []);

  if (editor.loading || editor.error) {
    return (
      <Card className="lg:h-full lg:min-h-0">
        <CardContent className="grid min-h-0 flex-1 place-items-center">
          <Empty>
            {editor.error ? null : <Spinner />}
            <EmptyTitle>
              {editor.error ? "Không mở được bàn dựng" : "Đang mở bàn dựng…"}
            </EmptyTitle>
            <EmptyDescription>
              {editor.error ?? "Đang lấy bản dựng từ máy chủ"}
            </EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid min-h-0 gap-2 lg:h-full lg:grid-rows-[minmax(0,1fr)_auto]">
      {actionSlot && createPortal(<ExportAction editor={editor} />, actionSlot)}

      <div className="grid gap-2 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_34rem]">
        {/* KHUNG XEM = Remotion Player (chính VideoComposition của export) → preview
            khớp export từng pixel. Rebuild payload khi lịch màn đổi. */}
        <Card className="min-h-80 min-w-0 lg:min-h-0">
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <AspectRatio ratio={9 / 16} className="mx-auto min-h-0 flex-1">
              {editor.projectId && (
                <RemotionPreview
                  projectId={editor.projectId}
                  reloadKey={editor.sceneReloadKey}
                  editor={editor}
                  playerRef={playerRef}
                />
              )}
            </AspectRatio>
          </CardContent>
        </Card>
        <RightPanel editor={editor} onPreview={onPreview} studio />
      </div>

      {/* Kéo dải lúc đang phát thì dừng phát — như bàn dựng cũ. */}
      <div
        onPointerDown={(event) => {
          if (!event.currentTarget.contains(event.target as Node)) return;
          playerRef.current?.pause();
        }}
      >
        <Timeline editor={editor} onAudit={onAudit} studio />
      </div>
    </div>
  );
}

/** Nút xuất video ở header — đang dựng nền / xuất được / đang xuất / tải về. */
function ExportAction({ editor }: { editor: EditorState }) {
  const job = editor.exportJob;
  if (job?.status === "done") {
    return (
      <Button render={<a href={api.exportUrl(editor.projectId!)} download />}>
        Tải video về
      </Button>
    );
  }
  return (
    <Button
      disabled={
        job?.status === "running" ||
        editor.sentences.length === 0 ||
        !editor.masterReady
      }
      onClick={() => void editor.startExport()}
    >
      {job?.status === "running"
        ? (job.message ?? "Đang xuất…")
        : !editor.masterReady
          ? "Đang chuẩn bị bản dựng…"
          : "Xuất video"}
    </Button>
  );
}
