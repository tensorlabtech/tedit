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
  STAGES_OF,
  currentStep,
  stepIndex,
  type FlowStepId,
} from "../../../server/flow-steps";
import { FlowSidebar } from "./flow-sidebar";
import { MediaPickerDialog } from "@/components/media-picker-dialog";
import { BigDropZone } from "./big-drop-zone";
import { BriefStep } from "./brief-step";
import { StepRow } from "../pipeline/pipeline-page";
import type { ApiStep } from "@/lib/api";
import { BRollList } from "./broll-list";
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
  /** Mười bốn chặng máy — chỉ bày ở BÊN PHẢI lúc bước máy đang chạy. */
  steps: ApiStep[];
};

const TRONG: Snapshot = {
  hasMain: false,
  hasBrief: false,
  awaiting: null,
  settled: false,
  started: false,
  steps: [],
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
          steps: data.pipeline?.steps ?? [],
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

  /*
   * Mạch LỆCH thì CHẶN, không nhắc.
   *
   * `transcriptStale` bật khi thêm hoặc bớt cảnh sau lúc chép lời xong — phần
   * mới không có chữ nào. Trang cũ chỉ hiện một dòng nhắc, mà nút đi tiếp vẫn
   * sáng: người dùng bấm qua và mọi thứ sau đó dựng trên bản chép của một mạch
   * khác. Cắt sai chỗ vì lịch cắt bám mốc từ, soát lời trên bản chép cũ, đặt tư
   * liệu vào chỗ không còn tồn tại.
   *
   * Nhắc một dòng cho một hậu quả cỡ ấy là không cân. Chặn.
   */
  const stale = upload.transcriptStale || upload.briefStale;

  const machineAt = currentStep(snap);
  const at = viewing ?? machineAt;
  const step = FLOW_STEPS[stepIndex(at)];
  /*
   * Khung xem chiếu đúng LOẠI tệp của bước đang đứng.
   *
   * Bản đầu luôn rơi về `mainFiles[0]`, nên ở bước cảnh phụ nó chiếu một cảnh
   * CHÍNH, và ô mô tả bên dưới hỏi "Tư liệu này là gì?" cho một cảnh chính.
   * Chụp một dự án mới mới thấy — dự án cũ có sẵn cả hai loại nên không lộ.
   */
  const pool = at === "b-roll" ? upload.insertFiles : upload.mainFiles;
  const previewing =
    pool.find((item) => item.id === previewId) ?? pool[0] ?? null;

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
      {/* DÍNH trên cùng: cửa sổ thấp thì trang cuộn, và hàng này trôi mất —
          mất luôn "Trở về" lẫn nút chính, tức mất đường ra giữa chừng. */}
      <Card className="sticky top-0 z-10">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardAction>
            <Button variant="ghost" onClick={() => navigate("/")}>
              Trở về
            </Button>
            {/* Việc chính của bước là một NÚT, không phải chữ gạch chân trôi
                giữa khung. Bước của máy thì không có nút — chờ là chờ. */}
            {stale ? (
              <Button onClick={() => void upload.startTranscribe()}>
                Chép lại lời
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            ) : step.actor === "user" ? (
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
          // Mạch lệch thì khoá từ sau bước đề bài — nhưng KHÔNG kéo `reached`
          // lùi, để sidebar vẫn nói đúng máy đã chạy tới đâu.
          blockAfter={stale ? "brief" : null}
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
        <div className="grid min-h-0 gap-2 lg:h-full lg:grid-rows-[minmax(0,1fr)]">
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
          {at === "main-footage" && upload.mainFiles.length === 0 ? (
            <BigDropZone
              title="Thả video chính vào đây"
              hint="Đây là phần người nói. Thả nhiều tệp một lúc cũng được — thứ tự sắp lại sau."
              onFiles={(files) => handleFiles(files, "main")}
              onPick={() => openPicker("main")}
            />
          ) : at === "b-roll" && upload.insertFiles.length === 0 ? (
            <BigDropZone
              title="Thả tư liệu chèn vào đây"
              hint="Ảnh hoặc video chèn giữa lời nói. Không có cũng được — máy vẫn dựng bình thường."
              onFiles={(files) => handleFiles(files, "insert")}
              onPick={() => openPicker("insert")}
              onPickFromLibrary={() => setLibraryOpen(true)}
            />
          ) : step.actor === "machine" ? (
            /*
             * Bước MÁY: bày mười bốn chặng ở BÊN PHẢI.
             *
             * Sidebar cố tình gộp chúng vào một dòng — nó là bản đồ, không phải
             * nhật ký. Nhưng lúc máy đang chạy thì người dùng muốn biết nó đang
             * làm gì, và đây đúng là chỗ để nhìn.
             *
             * Dùng lại `StepRow` của màn chờ cũ: cùng một danh sách chặng thì
             * hai chỗ vẽ khác nhau là hai chỗ phải sửa mỗi lần thêm chặng.
             */
            <Card className="lg:h-full lg:min-h-0">
              <CardHeader>
                <CardTitle>
                  Máy đang làm ·{" "}
                  {
                    snap.steps.filter(
                      (s) => STAGES_OF[at].includes(s.key) && s.status === "done",
                    ).length
                  }
                  /{STAGES_OF[at].length}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto">
                {snap.steps
                  .filter((item) => STAGES_OF[at].includes(item.key))
                  .map((item) => (
                  <StepRow
                    key={item.key}
                    step={item}
                    // Dùng lại đường có sẵn ở `api` chứ không gọi fetch trần:
                    // một chỗ đổi đường dẫn thì mọi nơi theo.
                    onRetry={() => void api.retryStep(projectId!, item.key)}
                  />
                ))}
              </CardContent>
            </Card>
          ) : at === "brief" ? (
            <BriefStep
              title={upload.title}
              brief={upload.profile}
              stylePack={upload.stylePack}
              onTitle={(v) => void upload.saveTitle(v)}
              onBrief={(v) => void upload.saveProfile(v)}
              onStylePack={(id) => void upload.saveStylePack(id)}
            />
          ) : at === "main-footage" ? (
            /*
             * Xem trước bên TRÁI, dải phim dựng ĐỨNG bên phải.
             *
             * Đo bản trước: video dọc 250px nằm giữa khung 1176 — phí 79% bề
             * ngang; sáu ô cảnh chiếm 370px trong thẻ 1176 — phí thêm 800px
             * nữa, mà tên tệp lại bị cắt còn "mai…".
             *
             * Xếp hai cột thì cả hai chỗ phí ấy biến mất cùng lúc.
             */
            <div className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-cols-[1fr_22rem]">
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
            <div className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-cols-[1fr_22rem]">
              <SequencePreviewCard
                pack={findStylePack(upload.stylePack)}
                /*
                 * `scenes` là MẠCH CHÍNH, kể cả ở bước tư liệu.
                 *
                 * `SequencePreviewCard` chỉ hiện ô nhập mô tả khi tệp đang xem
                 * KHÔNG nằm trong mạch (`file && !inSequence`) — vì mô tả chỉ
                 * có nghĩa với tư liệu chèn. Truyền `insertFiles` vào đây làm
                 * tư liệu thành "trong mạch", ô mô tả biến mất, và sau khi tôi
                 * bỏ ô trùng bên danh sách thì KHÔNG còn đường nào sửa mô tả.
                 *
                 * Đây là cái giá của việc bỏ một ô mà không chạy lại đường còn
                 * lại — ảnh chụp mới thấy.
                 */
                scenes={upload.mainFiles.filter((i) => i.status !== "error")}
                file={previewing}
                source={previewing ? upload.sourceOf(previewing.id) : undefined}
                onSelect={setPreviewId}
                onDescribe={(id, description) =>
                  void upload.saveDescription(id, description)
                }
                hideBackToSequence
              />
              <BRollList
                files={upload.insertFiles}
                selectedId={previewing?.id ?? null}
                onOpen={setPreviewId}
                onPick={() => openPicker("insert")}
                onPickFromLibrary={() => setLibraryOpen(true)}
                onRemove={handleRemove}
              />
            </div>
          ) : (
            /* Thẻ rỗng cũng phải PHỦ KÍN: ở bước chưa dựng, thẻ co lại còn
               một dải ngắn trên đỉnh và để lại hai phần ba màn nền trơn —
               chụp một dự án mới mới thấy. */
            <Card className="lg:min-h-0 lg:h-full">
              <CardContent className="grid min-h-0 flex-1 place-items-center">
                <Empty>
                  <EmptyTitle>Màn của bước này chưa dựng</EmptyTitle>
                  <EmptyDescription>
                    Tạm thời làm việc này ở bàn dựng.
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
        /* Bỏ tích một tệp đang có = gỡ nó khỏi dự án. Tìm ngược từ mã kho sang
           tệp trong dự án — `libraryFile` là mối nối duy nhất giữa hai bên. */
        onDropFromProject={(keys) => {
          for (const key of keys) {
            const mine = upload.files.find((item) => item.libraryFile === key);
            if (mine) upload.removeFile(mine.id);
          }
        }}
        onUpload={(files) => handleFiles(files, "insert")}
        defaultTab="library"
        tabs={false}
      />
    </div>
  );
}
