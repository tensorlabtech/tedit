import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";

import { MediaPickerDialog } from "@/components/media-picker-dialog";

import { InsertMediaCard } from "./insert-media-card";
import { MainTimelineCard } from "./main-timeline-card";
import { findStylePack } from "../../../server/style-pack-catalog";
import { SequencePreviewCard } from "./sequence-preview-card";
import { SetupCard } from "./setup-card";
import { hasSetupNotes, SetupNotes } from "./setup-notes";
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
  const [libraryOpen, setLibraryOpen] = useState(false);

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
  const needsReview = hasSetupNotes(upload);
  const blockReason = upload.uploading
    ? "Đang tải tệp lên"
    : upload.readyMainFiles.length === 0
      ? "Cần ít nhất một cảnh chính tải xong"
      : null;

  return (
    /* KHÔNG có đầu trang riêng. Nó từng chiếm một hàng full-width cao 88px cho đúng
       hai cái nút và một cái tên — mà cái tên nay đã có ô riêng trong khối Dự án, nên
       nó chỉ còn là bản trùng. Hai nút xuống card hành động ở đầu cột phải: chỗ đó
       ngay trên khung xem, đúng nơi người ta soát lần cuối trước khi bấm chạy, và câu
       giải thích "vì sao nút chưa bấm được" đi theo được sang đó. */
    <div className="grid min-h-svh gap-2 bg-background p-2 text-foreground lg:h-svh lg:overflow-hidden">
      {/* HAI cột: NỘI DUNG bên trái, XEM TRƯỚC bên phải.

          Cột nội dung xếp ba khối dọc theo đúng thứ tự làm việc: khai báo dự án →
          mạch chính → kho chèn. Ba khối, không phải bốn thẻ rải hai cột như trước:
          bản đó cho kho chèn một cột ngang hàng với mạch chính, đi ngược §1 (kho
          chèn không có việc gì để làm ở màn này), và ở cửa sổ 577px nó bóp ô tư liệu
          xuống 32×56px — một ô không nhận ra nội dung gì.

          `2fr_1fr`: khung xem đủ để soát mạch — nó không ra quyết định nào, nên
          không cần hơn. Từng để `1.5fr_1fr` và khung nuốt một phần ba màn, trong khi
          hai dải ô bên trái là chỗ người dùng thật sự làm việc.

          Hai dải ô giờ cuộn NGANG nên chiều cao mỗi khối là thứ cố định — thêm cảnh
          chỉ làm dải dài thêm, không làm mọi ô nhỏ đi. Nhờ vậy tỉ lệ hàng dưới đây
          chia được một lần rồi thôi.

          SÀN 9rem/7rem cho hai dải: khối Dự án ở hàng `auto` nên nó cao lên bao
          nhiêu là bóp thẳng vào hai hàng dưới. Đo lần đầu, nó ăn 312px và hai dải
          sập còn 90px/56px — ô cao 0, dải trống trơn. Hết chỗ thì thà xén khối Dự án
          từ dưới lên: thứ mất trước ở đó là dòng trạng thái, còn dải ô mất chiều cao
          là mất luôn nội dung. */}
      <div className="grid gap-2 lg:min-h-0 lg:grid-cols-[2fr_1fr]">
        {/* `overflow-y-auto` là LỐI THOÁT, không phải cách dùng thường.
            
            Ba khối cần 224+288+192 = 704px để ô còn đọc được, mà cửa sổ cao 577px
            chỉ cho cột này 473px. Ở màn thật (≥900px) không bao giờ chạm tới; ở màn
            thấp thì thà cuộn một đoạn còn hơn để ô cao 0 — đo đúng thế khi sàn còn
            9rem: dải ô trống trơn, không một tấm ảnh nào.

            Hàng đầu cũng cần SÀN, không để `auto` trơn: `auto` co được tới
            min-content, và khi tổng vượt chỗ thì khối Dự án bị nén còn 40px — đúng
            cái đầu thẻ, không còn ô nhập nào. 14rem là chiều cao ĐO ĐƯỢC của nội dung
            khối đó: đầu thẻ 40 + thân 128 (tên 60, thanh kéo 56, một khoảng cách 12)
            + đệm 48 = 216.

            Tỉ lệ hai dải hạ về 1.15/1 — kho chèn từng chỉ được 268px, mà ô của nó
            cần gần cả chiều cao đó để còn nhận ra một tấm ảnh dọc.

            Sàn mạch chính 16rem, không phải 13rem: lúc CHƯA có cảnh nào, thẻ đó bày
            một khối "Chưa có cảnh nào" kèm nút "Chọn video", và khối ấy đo được 252px.
            Ở 13rem thì nút bị xén mất — người dùng mở màn lần đầu không thấy nút nào
            để bấm, đúng lỗi §16 đã sửa một lần rồi. */}
        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-[minmax(14rem,auto)_minmax(18rem,1.15fr)_minmax(12rem,1fr)] lg:overflow-y-auto">
          <SetupCard upload={upload} />

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
            onPickFromLibrary={() => setLibraryOpen(true)}
            onDropFiles={(files) => handleFiles(files, "insert")}
            onRemove={handleRemove}
            onMove={(id) => handleMove(id, "main")}
            onCancel={upload.cancelUpload}
            onRetry={upload.retryUpload}
            selectedId={previewing?.id ?? null}
          />
        </div>

        {/* Cột phải: card HÀNH ĐỘNG trên, khung xem dưới. */}
        {/* Khung xem cần SÀN: card "Tiếp theo" ở hàng `auto` giờ cao thay đổi theo
            số dòng soát, nên không có sàn thì khung video co dần theo. Xô lệch ở đây
            đỡ hơn ở cột nội dung — nhưng vẫn phải chặn đáy. */}
        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-[auto_minmax(14rem,1fr)]">
          {/* `size="sm"`: đệm 16px thay 20px. Card này chỉ chứa một hàng, nên đệm cỡ
              thường làm nó cao 80px — 88px cả khoảng cách, đúng bằng cái đầu trang
              vừa bỏ đi, và lấy lại của khung xem đúng phần vừa tiết kiệm. */}
          <Card size="sm">
            {/* Tiêu đề và hai nút CÙNG MỘT HÀNG, không xếp dọc: `CardHeader` tự thành
                lưới hai cột khi có `CardAction`, nên thêm tiêu đề mà card không cao
                thêm một dòng nào.

                Hai nút cạnh nhau, dồn về phải: đường ra và đường đi tiếp là một cặp,
                tách chúng ra hai đầu thì mắt phải đi hết chiều ngang card mới thấy đủ
                lựa chọn. */}
            <CardHeader>
              <CardTitle>Tiếp theo</CardTitle>
              <CardAction>
                <Button variant="ghost" onClick={() => navigate("/")}>
                  Trở về
                </Button>

                <Button
                  // Phải có cảnh chính TẢI XONG: tệp hỏng hoặc đang dở mà cho bắt đầu
                  // thì máy chủ chép lời trên một dự án không có gì để nghe.
                  disabled={Boolean(blockReason) || transcribing}
                  onClick={async () => {
                    // Chép lời trước rồi mới sang bàn dựng: mở bàn dựng khi chưa có
                    // lời thì màn đó rỗng và người dùng không hiểu phải đợi gì.
                    if (upload.transcribe?.status === "done") {
                      navigate(`/editor/${upload.projectId}`);
                      return;
                    }
                    await upload.startTranscribe();
                    // Sang màn chờ NGAY, đừng giữ người dùng lại màn nạp tệp: ở đây
                    // không còn gì để làm, mà việc thì chạy mất vài phút.
                    navigate(`/pipeline/${upload.projectId}`);
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

            {/* Hàng soát và tiến độ nằm ở ĐÂY, cạnh cái nút chúng đang nói về.
                
                Trước chúng ở card Dự án — card đó ở hàng `auto` đầu cột nội dung, nên
                mỗi lần thả tệp là nó cao thêm và hai dải ô bị bóp đúng chừng ấy: cả
                layout xô lệch một nhịp giữa lúc đang làm.

                Bốn bước chép lời thì bỏ hẳn: màn `/pipeline` có danh sách chặng đầy
                đủ, mà bấm chạy là màn hình chuyển sang đó ngay. */}
            {(needsReview || upload.uploading) && (
              <CardContent className="grid gap-2">
                <SetupNotes
                  upload={upload}
                  onOpen={setPreviewId}
                  onPick={() => openPicker("main")}
                />
                {upload.uploading && (
                  <>
                    <Progress value={upload.uploadProgress} />
                    <p className="text-xs text-muted-foreground">
                      Đang tải {upload.uploadingFiles.length} tệp ·{" "}
                      {upload.uploadProgress}%
                    </p>
                  </>
                )}
              </CardContent>
            )}
          </Card>

          <SequencePreviewCard
            // Khung xem nắn màu theo phong cách đang chọn ở thẻ bên trái.
            pack={findStylePack(upload.stylePack)}
            // Ô tải hỏng KHÔNG phải một cảnh: nó không lên tới máy chủ nên nó không
            // có trong video sẽ xuất ra. Đếm nó vào đây thì khung xem báo "Cảnh 1/4"
            // cho một mạch chỉ có ba cảnh, và khúc thứ tư của thanh mạch không bao
            // giờ chạy tới.
            scenes={upload.mainFiles.filter((item) => item.status !== "error")}
            file={previewing}
            source={previewing ? upload.sourceOf(previewing.id) : undefined}
            onSelect={setPreviewId}
            onDescribe={(id, description) =>
              void upload.saveDescription(id, description)
            }
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

      {/* Cùng một hộp với bàn dựng — hai tab, một lưới, một cột xem trước. Ở
          đây KHÔNG truyền `onUse`: màn nạp chưa có vạch nào để chèn vào, nên tab
          "Của dự án" chỉ để xem lại mình đã có gì trước khi đi lấy thêm. */}
      <MediaPickerDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        title="Kho tư liệu"
        projectItems={upload.insertItems}
        alreadyIn={upload.libraryFilesInProject}
        onTake={upload.addFromLibrary}
        onUpload={(files) => handleFiles(files, "insert")}
        defaultTab="library"
        // Nút mở hộp này tên là "Từ kho" — người dùng đã nói rõ mình muốn
        // cái kho, nên đừng hỏi lại bằng một hàng tab.
        tabs={false}
      />
    </div>
  );
}
