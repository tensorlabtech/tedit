import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlayerRef } from "@remotion/player";
import { SparklesIcon } from "lucide-react";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

import { RemotionPreview } from "@/routes/editor/remotion-preview";
import { RightPanel } from "@/routes/editor/right-panel";
import { StyleSwitchDialog } from "@/routes/editor/style-switch-dialog";
import { Timeline } from "@/routes/editor/timeline";
import { useEditor, type EditorState } from "@/routes/editor/use-editor";
import { useEditorGuards } from "@/routes/editor/use-editor-guards";
import { ExportModal } from "./export-modal";

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
  // ĐỔI VIBE: mở hộp chọn bộ dáng. `setStylePack` dựng lại toàn bộ style ở server.
  const [styleOpen, setStyleOpen] = useState(false);
  // Phát tự do (Cách) → BỎ mốc tự-dừng của lần xem-thử trước, kẻo đang phát lại
  // khựng ở mốc cũ.
  const togglePlay = () => {
    editor.previewStopRef.current = null;
    playerRef.current?.toggle();
  };
  // Chọn cụm = tua tới đó (chỉ `at`). ĐỔI kiểu (chỗ nối / phong cách chữ) truyền
  // cả `until` = một QUÃNG → tua đầu quãng RỒI PHÁT, vì chỗ nối/hiện-chữ là hiệu
  // ứng THEO THỜI GIAN, đứng một khung không thấy gì. Đặt mốc TỰ DỪNG = `until`
  // (giờ gốc) để phát hết quãng thì dừng, không chạy tuột hết video.
  const onPreview = (at: number, until?: number) => {
    editor.seek(at);
    editor.previewStopRef.current = until ?? null;
    if (until != null) playerRef.current?.play();
  };
  const onAudit = (span: { start: number; end: number }) => {
    editor.seek(span.start);
    editor.previewStopRef.current = span.end;
    playerRef.current?.play();
  };
  useEditorGuards({ editor, onTogglePlay: togglePlay });

  // Ô nút ở header do flow-page dựng cùng lượt; tìm sau khi gắn là thấy.
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setActionSlot(document.getElementById(STUDIO_ACTION_SLOT));
  }, []);

  // Modal xuất (kiểu TikTok) — nút header mở, editor giữ mounted phía dưới.
  const [exportOpen, setExportOpen] = useState(false);

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
      {actionSlot &&
        createPortal(
          <ExportAction editor={editor} onOpen={() => setExportOpen(true)} />,
          actionSlot,
        )}
      <ExportModal
        editor={editor}
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />

      <div className="grid gap-2 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_34rem]">
        {/* KHUNG XEM = Remotion Player (chính VideoComposition của export) → preview
            khớp export từng pixel. Rebuild payload khi lịch màn đổi. */}
        <Card className="relative min-h-80 min-w-0 lg:min-h-0">
          {editor.duration > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStyleOpen(true)}
              className="absolute right-3 top-3 z-20 gap-1.5"
            >
              <SparklesIcon />
              Đổi phong cách
            </Button>
          )}
          <StyleSwitchDialog
            open={styleOpen}
            onOpenChange={setStyleOpen}
            value={editor.stylePack}
            onAccept={(next) => void editor.setStylePack(next)}
            poster={editor.posterUrl}
            preview={null}
          />
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
          // Chạm dải = người dùng tự lái → bỏ mốc tự-dừng của lần xem-thử trước.
          editor.previewStopRef.current = null;
          playerRef.current?.pause();
        }}
      >
        <Timeline editor={editor} onAudit={onAudit} studio />
      </div>
    </div>
  );
}

/**
 * Nút xuất ở header — MỞ MODAL xuất (kiểu TikTok), không tự chạy ngay ở đây. Việc
 * render / tiến trình / tải / huỷ do `ExportModal` lo; nút chỉ phản ánh trạng thái
 * và là cửa vào. Nhãn: đang dựng nền / Xuất / Xuất lại (đã sửa) / Video sẵn sàng.
 */
function ExportAction({
  editor,
  onOpen,
}: {
  editor: EditorState;
  onOpen: () => void;
}) {
  const job = editor.exportJob;
  const running = job?.status === "running" || job?.status === "queued";
  const freshDone = job?.status === "done" && !editor.exportStale;
  const doneButStale = job?.status === "done" && editor.exportStale;
  return (
    <Button
      disabled={editor.sentences.length === 0 || !editor.masterReady}
      onClick={onOpen}
    >
      {running
        ? "Đang xuất…"
        : !editor.masterReady
          ? "Đang chuẩn bị bản dựng…"
          : freshDone
            ? "Video đã sẵn sàng"
            : doneButStale
              ? "Xuất lại video"
              : "Xuất video"}
    </Button>
  );
}
