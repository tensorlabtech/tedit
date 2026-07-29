import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";

import { InsertMediaCard } from "./insert-media-card";
import { MainTimelineCard } from "./main-timeline-card";
import { SequencePreviewCard } from "./sequence-preview-card";
import { SetupCard } from "./setup-card";
import { shortName, type MediaRole } from "./upload-data";
import { useUpload } from "./use-upload";

/** Quá số này thì gộp lại: thả nhầm cả thư mục sẽ đẻ ra hàng chục thông báo. */
const MAX_REJECTION_TOASTS = 3;

export function UploadPage() {
  const { projectId: openingProjectId } = useParams<{ projectId: string }>();
  const upload = useUpload(openingProjectId);
  const navigate = useNavigate();
  const pickRef = useRef<HTMLInputElement>(null);
  const pickRole = useRef<MediaRole | undefined>(undefined);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Dự án vừa sinh ra ở lần thả tệp đầu tiên: ghi mã nó lên đường dẫn NGAY, và
  // ghi đè mục lịch sử hiện tại chứ không thêm mục mới — người dùng chưa "đi"
  // đâu cả, nút lùi phải vẫn về danh sách như trước. Không có bước này thì tải
  // lại trang là mất mạch đang xếp.
  useEffect(() => {
    if (upload.projectId && !openingProjectId) {
      navigate(`/upload/${upload.projectId}`, { replace: true });
    }
  }, [upload.projectId, openingProjectId, navigate]);

  const handleFiles = (incoming: File[], role?: MediaRole) => {
    const result = upload.addFiles(incoming, role);
    if (result.accepted > 0) {
      toast.add({ title: `Đã thêm ${result.accepted} tệp`, type: "success" });
    }
    // Báo từng tệp bị từ chối kèm lý do — gộp thành "3 tệp lỗi" thì người dùng
    // không biết phải sửa gì. Chỉ gộp khi nhiều tới mức đọc không xuể.
    if (result.rejected.length > MAX_REJECTION_TOASTS) {
      toast.add({
        title: `${result.rejected.length} tệp không nhận được`,
        description: result.rejected
          .slice(0, MAX_REJECTION_TOASTS)
          .map((item) => `${item.name}: ${item.reason}`)
          .join("\n"),
        type: "error",
      });
      return;
    }
    for (const item of result.rejected) {
      toast.add({ title: item.name, description: item.reason, type: "error" });
    }
  };

  const handleRemove = (id: string) => {
    const gone = upload.files.find((item) => item.id === id);
    const restore = upload.removeFile(id);
    // Ô vừa gỡ mà đang mở trong khung xem thì phải đóng khung lại — không thì
    // người dùng ngồi xem một thứ không còn nằm trong dự án nữa.
    if (previewId === id) setPreviewId(null);
    toast.add({
      title: gone ? `Đã gỡ ${shortName(gone.name)}` : "Đã gỡ tệp",
      // Bấm nhầm nút gỡ một video vừa tải xong thì không có cách nào lấy lại
      // ngoài tải lại từ đầu — nên lối hoàn tác phải nằm ngay tại chỗ báo, và
      // đứng lâu hơn thông báo thường: năm giây là vừa đủ để đọc xong câu, chưa
      // đủ để nhận ra mình vừa gỡ nhầm cảnh nào.
      timeout: 12000,
      actionProps: { children: "Hoàn tác", onClick: restore },
    });
  };

  const handleMove = (id: string, role: MediaRole) => {
    const reason = upload.setRole(id, role);
    if (reason) toast.add({ title: reason, type: "error" });
  };

  const openPicker = (role?: MediaRole) => {
    pickRole.current = role;
    pickRef.current?.click();
  };

  // Chưa bấm ô nào thì lấy cảnh đầu: khung xem để trống trong khi mạch đã có
  // video là một khoảng trắng vô nghĩa. Ô vừa bị gỡ cũng tự rơi về đây.
  const previewing =
    upload.files.find((item) => item.id === previewId) ??
    upload.mainFiles[0] ??
    null;
  const transcribing = upload.transcribe?.status === "running";
  const blockReason = upload.uploading
    ? "Đang tải tệp lên"
    : upload.readyMainFiles.length === 0
      ? "Cần ít nhất một cảnh chính tải xong"
      : null;

  return (
    <div className="grid min-h-svh gap-2 bg-background p-2 text-foreground lg:h-svh lg:grid-rows-[auto_1fr] lg:overflow-hidden">
      {/* Đầu trang giữ đúng HAI nút: đường ra và đường đi tiếp. Nút chạy từng
          nằm ở chân cột phải, cạnh một khối số liệu — chỗ đó đọc ra như phần
          kết của một bảng thống kê, chứ không ra hành động chính của cả màn. */}
      <Card>
        <CardHeader>
          <CardTitle>Dự án mới</CardTitle>
          <CardAction>
            <Button variant="ghost" onClick={() => navigate("/")}>
              Trở về
            </Button>
            <Button
              // Phải có cảnh chính TẢI XONG: tệp hỏng hoặc đang dở mà cho bắt
              // đầu thì máy chủ chép lời trên một dự án không có gì để nghe.
              disabled={Boolean(blockReason) || transcribing}
              onClick={async () => {
                // Chép lời trước rồi mới sang bàn dựng: mở bàn dựng khi chưa có
                // lời thì màn đó rỗng và người dùng không hiểu phải đợi gì.
                if (upload.transcribe?.status === "done") {
                  navigate(`/editor/${upload.projectId}`);
                  return;
                }
                await upload.startTranscribe();
              }}
            >
              {upload.uploading
                ? "Đang tải tệp…"
                : transcribing
                  ? "Đang chép lời…"
                  : upload.transcribe?.status === "done"
                    ? "Mở bàn dựng"
                    : "Bắt đầu chép lời"}
            </Button>
          </CardAction>
        </CardHeader>
      </Card>

      {/* Hai cột, cùng một nếp: thứ chiếm hết chỗ còn lại nằm trên, thứ cao bằng
          nội dung nằm dưới. Trái là tư liệu (mạch chính · kho chèn), phải là
          thành phẩm (khung xem cả mạch · thiết lập). */}
      <div className="grid gap-2 lg:min-h-0 lg:grid-cols-4">
        <div className="grid gap-2 lg:col-span-3 lg:min-h-0 lg:grid-rows-[1fr_auto]">
          <MainTimelineCard
            files={upload.mainFiles}
            sourceOf={upload.sourceOf}
            onOpen={setPreviewId}
            onPick={() => openPicker("main")}
            onDropFiles={(files) => handleFiles(files, "main")}
            onRemove={handleRemove}
            onMove={(id) => handleMove(id, "insert")}
            onCancel={upload.cancelUpload}
            onRetry={upload.retryUpload}
            selectedId={previewing?.id ?? null}
            onReorder={upload.moveFile}
            onReorderTo={upload.moveFileTo}
          />

          <InsertMediaCard
            files={upload.insertFiles}
            sourceOf={upload.sourceOf}
            onOpen={setPreviewId}
            onPick={() => openPicker("insert")}
            onDropFiles={(files) => handleFiles(files, "insert")}
            onRemove={handleRemove}
            onMove={(id) => handleMove(id, "main")}
            onCancel={upload.cancelUpload}
            onRetry={upload.retryUpload}
            selectedId={previewing?.id ?? null}
          />
        </div>

        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-[1fr_auto]">
          <SequencePreviewCard
            // Ô tải hỏng KHÔNG phải một cảnh: nó không lên tới máy chủ nên nó
            // không có trong video sẽ xuất ra. Đếm nó vào đây thì khung xem báo
            // "Cảnh 1/4" cho một mạch chỉ có ba cảnh, và khúc thứ tư của thanh
            // mạch không bao giờ chạy tới.
            scenes={upload.mainFiles.filter((item) => item.status !== "error")}
            file={previewing}
            source={previewing ? upload.sourceOf(previewing.id) : undefined}
            onSelect={setPreviewId}
          />
          <SetupCard
            upload={upload}
            onOpen={setPreviewId}
            onPick={() => openPicker("main")}
          />
        </div>
      </div>

      {/* Một hộp chọn tệp dùng chung cho mọi nút "Chọn…": mỗi nút một input thì
          phải nhân bản cả phần dọn `value` sau khi chọn. */}
      <input
        ref={pickRef}
        type="file"
        multiple
        hidden
        data-file-input
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          if (picked.length > 0) handleFiles(picked, pickRole.current);
          pickRole.current = undefined;
          // Xoá giá trị để chọn lại đúng tệp vừa gỡ vẫn kích hoạt `change`.
          event.target.value = "";
        }}
      />
    </div>
  );
}
