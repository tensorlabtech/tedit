import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

import {
  FLOW_STEPS,
  currentStep,
  stepIndex,
  type FlowStepId,
} from "../../../server/flow-steps";
import { FlowSidebar } from "./flow-sidebar";
import { MediaPickerDialog } from "@/components/media-picker-dialog";
import { BRollList } from "./broll-list";
import { SetupNotes } from "../upload/setup-notes";
import { SceneStrip } from "./scene-strip";
import { SequencePreviewCard } from "../upload/sequence-preview-card";
import { useUpload } from "../upload/use-upload";
import { toast } from "@/components/ui/toast";
import { findStylePack } from "../../../server/style-pack-catalog";
import type { MediaRole } from "./../upload/upload-data";

/**
 * MỘT MÀN, NHIỀU BƯỚC — sidebar trái, nội dung phải.
 *
 * ══ VÌ SAO GỘP LẠI MỘT MÀN ══
 *
 * Trước đây luồng đi qua HAI trang: `/pipeline` chờ máy, `/editor` sửa. Mỗi lần
 * máy dừng chờ người là một chuyến đi qua lại, và tôi đã làm hỏng đúng chỗ ấy
 * hai lần — một lần bày bảng chỉ-đọc ngoài màn chờ, một lần để nút chốt sai chỗ.
 *
 * Một màn thì không còn chuyến đi nào. Bên phải đổi nội dung, sidebar nói đang
 * ở đâu. Người dùng không bao giờ "rời" chỗ đang làm.
 *
 * ══ MỖI BƯỚC MỘT MÀN RIÊNG, KHÔNG DÙNG CHUNG ══
 *
 * Nội dung từng bước làm ĐÚNG việc của bước ấy, không dựng component chung cho
 * nhiều bước. Bàn dựng hiện tại 11.236 dòng đúng vì một màn phải gánh cắt, dựng
 * chữ, phong cách, b-roll và dòng thời gian cùng lúc — mỗi trục thêm vào nhân
 * với mọi trục đã có.
 *
 * Chép hai danh sách bản chép ra hai bước tốn vài trăm dòng. Một danh sách hai
 * chế độ tốn một mê cung điều kiện mà rồi không ai dám sửa.
 */

/** Trạng thái tối thiểu để suy ra bước — xem `currentStep`. */
type Snapshot = {
  hasMain: boolean;
  hasBrief: boolean;
  awaiting: string | null;
  settled: boolean;
  started: boolean;
};

const TRONG: Snapshot = {
  hasMain: false,
  hasBrief: false,
  awaiting: null,
  settled: false,
  started: false,
};

export function FlowPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [snap, setSnap] = useState<Snapshot>(TRONG);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  /**
   * Bước người dùng ĐANG XEM — khác bước máy đang ở.
   *
   * Bấm về một bước đã qua thì chỉ đổi cái đang xem, không kéo lùi mạch. `null`
   * là bám theo máy, và đó là mặc định: người dùng mở trang ra phải thấy đúng
   * chỗ cần họ, không phải chỗ họ xem lần trước.
   */
  const [viewing, setViewing] = useState<FlowStepId | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    const pull = async () => {
      try {
        const data = await api.getProject(projectId);
        if (!alive) return;
        setTitle(data.project.title);
        setSnap({
          hasMain: data.files.some((file) => file.role === "main"),
          hasBrief: Boolean(data.project.profile?.trim()),
          awaiting: data.pipeline?.awaiting ?? null,
          settled: data.pipeline?.settled ?? false,
          started: (data.pipeline?.steps.length ?? 0) > 0,
        });
      } finally {
        if (alive) setLoading(false);
      }
    };
    void pull();
    // Hỏi lại đều đặn: bước máy đổi mà không có ai báo, nên trang phải tự nhìn.
    const timer = setInterval(() => void pull(), 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [projectId]);

  /*
   * Ba bước nạp dùng LẠI thẻ của `/upload`, không dựng mới.
   *
   * `SequencePreviewCard` đã là ô xem trước có chỗ trống lúc chưa nạp gì,
   * `MainTimelineCard` đã là danh sách ngang có kéo-thả. Dựng lại là chép hơn
   * sáu trăm dòng đã chạy tốt để được đúng thứ ấy.
   *
   * Keo dán thì phải bê theo — nó nằm trong `upload-page.tsx` chứ không nằm
   * trong hook. Chép chừng ba chục dòng ở đây rẻ hơn bóc nó ra thành hook thứ
   * ba mà hai nơi cùng dùng: hai nơi ấy sẽ đòi hai thứ khác nhau ngay lượt sau.
   */
  const upload = useUpload(projectId);
  const pickRef = useRef<HTMLInputElement>(null);
  const pickRole = useRef<MediaRole | undefined>(undefined);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const handleFiles = (incoming: File[], role?: MediaRole) => {
    const result = upload.addFiles(incoming, role);
    if (result.accepted > 0) {
      toast.add({ title: `Đã thêm ${result.accepted} tệp`, type: "success" });
    }
    for (const item of result.rejected) {
      toast.add({ title: item.name, description: item.reason, type: "error" });
    }
  };
  const handleRemove = (id: string) => {
    const restore = upload.removeFile(id);
    // Ô vừa gỡ mà đang mở trong khung xem thì phải đóng khung lại.
    if (previewId === id) setPreviewId(null);
    toast.add({
      title: "Đã gỡ tệp",
      timeout: 12000,
      actionProps: { children: "Hoàn tác", onClick: restore },
    });
  };

  const openPicker = (role?: MediaRole) => {
    pickRole.current = role;
    pickRef.current?.click();
  };
  // Chưa bấm ô nào thì lấy cảnh đầu — khung xem để trống trong khi mạch đã có
  // video là một khoảng trắng vô nghĩa.
  const previewing =
    upload.files.find((item) => item.id === previewId) ??
    upload.mainFiles[0] ??
    null;

  const machineAt = currentStep(snap);
  const at = viewing ?? machineAt;
  const step = FLOW_STEPS[stepIndex(at)];

  if (loading) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    /*
     * Phủ KÍN màn, cùng lối `pipeline-page`.
     *
     * Bản đầu để `flex-1` trong một khung không có chiều cao, nên cả trang co
     * lại còn một phần ba màn và hai phần ba dưới là nền đen trơn. `CLAUDE.md`
     * ghi rõ mọi trang đều dạng bento phủ kín — tôi phạm chính quy tắc của dự
     * án, và ảnh chụp lộ ra ngay.
     */
    <div className="grid min-h-svh gap-2 bg-background p-2 text-foreground lg:h-svh lg:grid-rows-[auto_1fr] lg:overflow-hidden">
      {/* Hàng tiêu đề: tên dự án và ĐƯỜNG RA. Thiếu nó thì trang là ngõ cụt —
          lối về duy nhất là nút lùi trình duyệt. */}
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardAction>
            <Button variant="ghost" onClick={() => navigate("/")}>
              Trở về
            </Button>
            {/* Việc chính của bước là một NÚT, không phải chữ gạch chân trôi
                giữa khung. Bước của máy thì không có nút — chờ là chờ. */}
            {step.actor === "user" ? (
              <Button onClick={() => navigate(`/editor/${projectId}`)}>
                Mở bàn dựng
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            ) : null}
          </CardAction>
        </CardHeader>
      </Card>

      <div className="grid gap-2 lg:min-h-0 lg:grid-cols-[15rem_1fr]">
        <FlowSidebar
          current={at}
          reached={machineAt}
          onPick={(id) => setViewing(id)}
        />

        {/*
          Ô phải KHÔNG bọc thêm một Card nữa.

          `SequencePreviewCard` tự mang tiêu đề "Xem trước", `MainTimelineCard`
          tự mang "Mạch chính" — chúng vốn là thẻ CẤP TRANG, đứng cạnh nhau ở
          `/upload`. Bọc chúng trong một Card có tiêu đề "Cảnh chính" nữa là ba
          tầng khung chồng nhau: tiêu đề lặp, và tầng ngoài ăn hết chiều cao nên
          danh sách dưới bị cắt cụt.

          Tên bước đã nằm ở sidebar và ở hàng tiêu đề trên cùng. Nhắc lần thứ ba
          không thêm gì.
        */}
        <div className="grid min-h-0 gap-2 lg:grid-rows-[auto_minmax(0,1fr)]">
          {/*
            Dải cảnh báo của `/upload`, bê nguyên sang.

            So hai trang cạnh nhau mới thấy tôi bỏ sót nó: trang cũ có một thẻ
            "Tiếp theo" báo "Mạch đổi sau khi chép lời, lời không còn khớp" kèm
            nút "Chép lại". Đúng cái vừa xảy ra ở bước 1 — đổi thứ tự cảnh sau
            khi đã chép lời thì bản chép lệch hẳn, mà trang mới im lặng.

            Đây là lỗ hổng CHỨC NĂNG, không phải thẩm mỹ: người dùng kéo một
            cảnh rồi đi tiếp, và mọi thứ sau đó dựng trên một bản chép sai.
          */}
          <SetupNotes
            upload={upload}
            onOpen={setPreviewId}
            onPick={() => openPicker("main")}
          />
          <input
            ref={pickRef}
            type="file"
            accept="video/*"
            multiple
            hidden
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              if (picked.length > 0) handleFiles(picked, pickRole.current);
              event.target.value = "";
            }}
          />
          {at === "main-footage" ? (
            /*
             * Xem trước bên TRÁI, dải phim dựng ĐỨNG bên phải.
             *
             * Đo bản trước: video dọc 250px nằm giữa khung 1176 — phí 79% bề
             * ngang; sáu ô cảnh chiếm 370px trong thẻ 1176 — phí thêm 800px
             * nữa, mà tên tệp lại bị cắt còn "mai…".
             *
             * Xếp hai cột thì cả hai chỗ phí ấy biến mất cùng lúc.
             */
            <div className="grid gap-2 lg:min-h-0 lg:grid-cols-[1fr_22rem]">
              <SequencePreviewCard
                pack={findStylePack(upload.stylePack)}
                scenes={upload.mainFiles.filter((i) => i.status !== "error")}
                file={previewing}
                source={previewing ? upload.sourceOf(previewing.id) : undefined}
                onSelect={setPreviewId}
                onDescribe={(id, description) =>
                  void upload.saveDescription(id, description)
                }
              />
              <SceneStrip
                files={upload.mainFiles}
                selectedId={previewing?.id ?? null}
                onOpen={setPreviewId}
                onPick={() => openPicker("main")}
                onRemove={handleRemove}
                onReorderTo={upload.moveFileTo}
              />
            </div>
          ) : at === "b-roll" ? (
            /* Cùng hình dạng hai cột với bước cảnh chính — người dùng học một
               bố cục, dùng cho cả hai bước. */
            <div className="grid gap-2 lg:min-h-0 lg:grid-cols-[1fr_22rem]">
              <SequencePreviewCard
                pack={findStylePack(upload.stylePack)}
                scenes={upload.insertFiles.filter((i) => i.status !== "error")}
                file={previewing}
                source={previewing ? upload.sourceOf(previewing.id) : undefined}
                onSelect={setPreviewId}
                onDescribe={(id, description) =>
                  void upload.saveDescription(id, description)
                }
              />
              <BRollList
                files={upload.insertFiles}
                selectedId={previewing?.id ?? null}
                onOpen={setPreviewId}
                onPick={() => openPicker("insert")}
                onPickFromLibrary={() => setLibraryOpen(true)}
                onRemove={handleRemove}
                onDescribe={(id, description) =>
                  void upload.saveDescription(id, description)
                }
              />
            </div>
          ) : (
            <Card className="lg:min-h-0">
              <CardContent className="grid min-h-0 flex-1 place-items-center">
                <Empty>
                  <EmptyTitle>
                    {step.actor === "machine"
                      ? "Máy đang làm"
                      : "Màn của bước này chưa dựng"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {step.actor === "machine"
                      ? "Chưa tới lượt bạn — cứ đóng trang cũng được."
                      : "Tạm thời làm việc này ở bàn dựng."}
                  </EmptyDescription>
                </Empty>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Hộp kho tư liệu — nút "Từ kho" ở thẻ cảnh phụ mở cái này. Thiếu nó thì
          nút ấy rơi về hộp chọn tệp của hệ điều hành, tức là sai hẳn việc. */}
      <MediaPickerDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        title="Kho tư liệu"
        projectItems={upload.insertItems}
        alreadyIn={upload.libraryFilesInProject}
        onTake={upload.addFromLibrary}
        onUpload={(files) => handleFiles(files, "insert")}
        defaultTab="library"
        tabs={false}
      />
    </div>
  );
}
