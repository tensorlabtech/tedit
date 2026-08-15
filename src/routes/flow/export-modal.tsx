import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DownloadIcon, FilmIcon, XIcon } from "lucide-react";

import { Player } from "@remotion/player";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { VideoComposition } from "@/remotion/video-composition";
import type { RemotionPayload } from "../../../server/remotion-payload";

import type { EditorState } from "../editor/use-editor";

/**
 * MODAL XUẤT VIDEO — overlay PHỦ TOÀN MÀN kiểu CapCut/TikTok (khoá sửa).
 *
 * KHUNG CHUNG cho mọi trạng thái: [tiêu đề + mô tả] → [video — LUÔN cùng chỗ] →
 * [khu giữa] → [nút dưới]. Chỉ NỘI DUNG từng khu đổi, video KHÔNG nhích:
 *  · Đang xuất  — viền CHẠY quanh video; khu giữa = %+chặng; dưới = Huỷ. Khoá hẳn.
 *  · Xong       — video thành phẩm (xem được); khu giữa = nút Tải về; dưới = Đóng.
 *  · Đã huỷ/Lỗi — khu giữa = nút Xuất lại; dưới = Đóng.
 *
 * Editor VẪN mounted dưới modal → đóng là về đúng chỗ, không dựng lại. "Tươi" (suy
 * qua `editor.exportStale`) → mở là thấy luôn màn Xong, khỏi render lại.
 */
export function ExportModal({
  editor,
  open,
  onClose,
}: {
  editor: EditorState;
  open: boolean;
  onClose: () => void;
}) {
  const job = editor.exportJob;
  const status = job?.status;
  const running = status === "running" || status === "queued";
  const freshDone = status === "done" && !editor.exportStale;
  const cancelled = status === "error" && job?.message === "Đã huỷ";
  const errored = status === "error" && !cancelled;
  const view = freshDone
    ? "done"
    : cancelled || errored
      ? "ended"
      : "running";

  // Mốc XONG để phá cache <video>: cùng đường dẫn `final.mp4`, xuất lại phải nạp
  // bản mới chứ không dùng bản trình duyệt đang giữ.
  const [doneAt, setDoneAt] = useState(0);
  const prevStatus = useRef<string | undefined>(undefined);
  // Đã tự-tải cho lượt render này chưa — reset khi bắt đầu lượt mới.
  const autoDownloadedRef = useRef(false);
  useEffect(() => {
    if (status === "running" || status === "queued")
      autoDownloadedRef.current = false;
    if (status === "done" && prevStatus.current !== "done") {
      const now = Date.now();
      setDoneAt(now);
      // Vừa render XONG (từ đang chạy) → TỰ TẢI, khỏi bắt bấm thêm. Mở lại bản cũ
      // (prev không phải đang chạy) thì KHÔNG tự tải — người dùng chỉ vào xem.
      const justFinished =
        prevStatus.current === "running" || prevStatus.current === "queued";
      if (justFinished && !autoDownloadedRef.current && editor.projectId) {
        autoDownloadedRef.current = true;
        triggerDownload(`${api.exportUrl(editor.projectId)}?t=${now}`);
      }
    }
    prevStatus.current = status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Mở modal mà CHƯA có bản tươi và KHÔNG đang chạy → tự bắt đầu render (người dùng
  // vừa bấm "Xuất video"/"Xuất lại"). Có bản tươi thì chỉ hiện, khỏi dựng lại.
  const openedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    if (!running && !freshDone) void editor.startExport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const percent = Math.min(100, Math.max(0, job?.progress ?? 0));
  const projectId = editor.projectId;
  const canClose = !running; // khoá hẳn lúc đang xuất

  const [title, desc] =
    view === "done"
      ? ["Đã dựng xong", "Bạn có thể tải xuống ngay bây giờ"]
      : view === "ended"
        ? cancelled
          ? ["Đã huỷ xuất", "Bạn có thể xuất lại bất cứ lúc nào"]
          : ["Xuất video không xong", job?.message ?? "Máy chủ không nói lý do"]
        : ["Đang xuất 1080p…", "Đừng đóng tab trong lúc đang xuất"];

  // `?t=` phá cache trình duyệt sau mỗi lượt xuất (đường dẫn final.mp4 cố định).
  const exportSrc = projectId
    ? `${api.exportUrl(projectId)}${doneAt ? `?t=${doneAt}` : ""}`
    : "";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-background/97 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Xuất video"
    >
      {/* Đóng (X) chỉ khi được phép; lúc đang xuất ẩn để buộc Huỷ. KHÔNG đóng bằng
          bấm nền — tránh lỡ tay mất màn kết quả. */}
      {canClose && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Đóng"
          className="absolute top-4 right-4"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      )}

      <div className="grid w-full max-w-sm justify-items-center gap-5 p-6 text-center">
        {/* HEADER — hai dòng ở mọi trạng thái → video bên dưới không nhích. */}
        <div className="grid gap-1">
          <p className="font-heading text-lg font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>

        {/* VIDEO — CÙNG khung, cùng chỗ. Xong: thành phẩm xem được. Còn lại: xem
            trước sống. Viền CHẠY chỉ khi đang xuất. */}
        <ProgressFrame percent={percent} showBorder={view === "running"}>
          {view === "done" ? (
            <video
              key={exportSrc}
              src={exportSrc}
              controls
              playsInline
              className="size-full object-contain"
            />
          ) : projectId ? (
            <LivePreview projectId={projectId} />
          ) : (
            <PlaceholderFrame />
          )}
        </ProgressFrame>

        {/* KHU DƯỚI VIDEO — Đang xuất: %+chặng rồi Huỷ. Xong/Kết: nút chính rồi
            Đóng NGAY DƯỚI (gộp một khối, kề nhau). */}
        {view === "running" ? (
          <>
            <div className="grid min-h-[3.75rem] content-center gap-0.5">
              {percent > 0 ? (
                <span className="font-heading text-3xl font-semibold tabular-nums">
                  {Math.round(percent)}%
                </span>
              ) : (
                <Spinner className="justify-self-center" />
              )}
              <span className="text-xs text-muted-foreground">
                {stageLabel(job?.message, status)}
              </span>
            </div>
            <Button variant="secondary" onClick={() => void editor.cancelExport()}>
              Huỷ
            </Button>
          </>
        ) : (
          <div className="grid w-full justify-items-center gap-2">
            {view === "done" ? (
              <Button
                className="w-full"
                render={<a href={exportSrc} download="video.mp4" />}
              >
                <DownloadIcon data-icon="inline-start" />
                Tải về
              </Button>
            ) : (
              <Button onClick={() => void editor.startExport()}>Xuất lại</Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Đóng
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Bấm tải một tệp bằng thẻ `<a download>` ẩn — dùng để TỰ tải khi render xong. */
function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "video.mp4";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Nhãn chặng thân thiện — gộp các con số/thông điệp thô của job về câu dễ đọc. */
function stageLabel(
  message: string | undefined,
  status: string | undefined,
): string {
  if (status === "queued") return message ?? "Đang xếp hàng…";
  const m = message ?? "";
  if (m.includes("Remotion") || m.includes("dựng hình")) return "Đang dựng hình…";
  if (m.includes("nhạc")) return "Đang trộn nhạc nền…";
  if (m.includes("chữ") || m.includes("chèn")) return "Đang in chữ & chèn tư liệu…";
  if (m.includes("bỏ") || m.includes("gạch")) return "Đang cắt ghép…";
  return m || "Đang chuẩn bị…";
}

/**
 * Khung 9:16 giữ video. Khi `showBorder`, viền là MỘT nét LIỀN chạy (kiểu TikTok):
 * một `rect` SVG, `pathLength=100` nên `strokeDashoffset = 100 - percent` vẽ đúng %.
 *
 * KHÔNG dùng `non-scaling-stroke`/`preserveAspectRatio="none"`: cặp này + dash làm
 * nét VỠ THÀNH KHÚC. Cứ để nét & bo góc theo viewBox (viewBox 9:16 = tỉ lệ khung
 * nên không méo). `rx=7.5` + inset 1.5 → đồng tâm với `rounded-[1.5rem]` (24px) của
 * hộp ở bề rộng khung. Không rãnh mờ → đúng 1 nét.
 */
function ProgressFrame({
  percent,
  showBorder,
  children,
}: {
  percent: number;
  showBorder: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative aspect-[9/16] w-full max-w-[15rem]">
      {/* Video PHỦ KÍN khung. */}
      <div className="absolute inset-0 overflow-hidden rounded-[1.5rem] bg-black">
        {children}
      </div>
      {showBorder && (
        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 90 160"
          fill="none"
        >
          {/* Line chạy Ở TRONG video, THỤT vào ~9px cho có khoảng hở với mép; `rx`
              chọn để đồng tâm với góc video (video bo 24px, line thụt 3.5 đơn-vị). */}
          <rect
            x="3.5"
            y="3.5"
            width="83"
            height="153"
            rx="5.5"
            ry="5.5"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={100 - percent}
            strokeLinecap="round"
            className="stroke-primary transition-[stroke-dashoffset] duration-500"
            strokeWidth="1.2"
          />
        </svg>
      )}
    </div>
  );
}

function PlaceholderFrame() {
  return (
    <div className="grid size-full place-items-center">
      <FilmIcon className="size-8 text-muted-foreground" />
    </div>
  );
}

/**
 * Xem trước SỐNG — chính `VideoComposition` (thứ đang được xuất) chạy câm, lặp, tự
 * phát. Không điều khiển, không cướp phím; hỏng payload thì về khung trống.
 */
function LivePreview({ projectId }: { projectId: string }) {
  const [payload, setPayload] = useState<RemotionPayload | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .remotionPayload(projectId)
      .then((p) => alive && setPayload(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (!payload) return <PlaceholderFrame />;
  return (
    <Player
      component={VideoComposition}
      inputProps={payload}
      durationInFrames={Math.max(1, Math.round(payload.seconds * payload.fps))}
      fps={payload.fps}
      compositionWidth={payload.width}
      compositionHeight={payload.height}
      style={{ width: "100%", height: "100%" }}
      autoPlay
      loop
      numberOfSharedAudioTags={0}
      clickToPlay={false}
      spaceKeyToPlayOrPause={false}
    />
  );
}
