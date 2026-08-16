import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { AlertTriangleIcon, ArrowRightIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api";

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
import { FinishCutButton } from "./finish-cut-button";
import { FinishTextButton } from "./finish-text-button";
import { CutStep } from "./cut-step";
import { SoatLoiStep } from "./soat-loi-step";
import { STUDIO_ACTION_SLOT, StudioStep } from "./studio-step";
import { MachineWorkingPanel } from "./machine-working-panel";
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

/**
 * Gộp bảng đoạn thành ba con số cho nút chốt.
 *
 * Đọc từ chính `getProject` mà trang vốn đã hỏi mỗi giây rưỡi, không mở thêm một
 * lượt gọi nữa: hai nguồn cho cùng một con số là hai chỗ để lệch nhau, và ở đây
 * con số ấy đứng trong một câu hỏi không quay lại được.
 */
function summariseCut(rows: Array<{ start_sec: number; end_sec: number; removed: number }>) {
  const cuts = rows.filter((row) => row.removed === 1);
  const seconds = cuts.reduce((sum, row) => sum + (row.end_sec - row.start_sec), 0);
  const total = rows.at(-1)?.end_sec ?? 0;
  return { count: cuts.length, seconds, kept: Math.max(0, total - seconds) };
}

/** Trạng thái tối thiểu để suy ra bước — xem `currentStep`. */
type Snapshot = {
  hasMain: boolean;
  hasBrief: boolean;
  stage: string | null;
  settled: boolean;
  started: boolean;
  /** Mười bốn chặng máy — chỉ bày ở BÊN PHẢI lúc bước máy đang chạy. */
  steps: ApiStep[];
  /** Thống kê bản cắt cho nút chốt trên đầu trang. */
  cut: { count: number; seconds: number; kept: number };
  /** Số chữ máy còn chưa chắc — nút "Chốt chính tả" nhắc nếu còn. */
  unsureCount: number;
};

const TRONG: Snapshot = {
  hasMain: false,
  hasBrief: false,
  stage: null,
  settled: false,
  started: false,
  steps: [],
  cut: { count: 0, seconds: 0, kept: 0 },
  unsureCount: 0,
};

export function FlowPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [snap, setSnap] = useState<Snapshot>(TRONG);
  const [loading, setLoading] = useState(true);
  /**
   * Lượt hỏi máy chủ gần nhất hỏng — chuỗi là câu lỗi để bày, `null` là ổn.
   *
   * Không hỏng thì `snap` không đổi gì cả — dự án CÓ tồn tại, thiếu đúng một
   * lượt hỏi. Trước đây `pull()` không bắt lỗi này: `snap` đứng nguyên ở giá
   * trị RỖNG ban đầu, và trang đọc `hasMain: false` ra thành "chưa có gì",
   * bày khung thả tệp cho một dự án đang có sẵn dữ liệu.
   */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Bấm "Thử lại" chỉ cần đổi số này — effect bên dưới có nó trong deps. */
  const [retryTick, setRetryTick] = useState(0);
  /**
   * BƯỚC NHẬP LIỆU (main → cảnh phụ → đề bài) là một WIZARD một chiều, người dùng
   * TỰ bấm "Tiếp" để sang bước sau.
   *
   * Tách khỏi máy: `currentStep` suy bước từ dữ liệu (vừa có cảnh chính là nhảy
   * "cảnh phụ"), mà người dùng không muốn bị NHẢY ngay khi vừa thả tệp — họ muốn
   * đứng lại xem, rồi bấm sang. Nên ba bước nhập do `intakeStep` cầm; máy chạy rồi
   * (`snap.started`) thì bám theo máy. Luồng MỘT CHIỀU: không quay lại bước cũ
   * (sidebar không bấm được), chỉ tiến bằng nút.
   */
  const [intakeStep, setIntakeStep] = useState(0);

  useEffect(() => {
    // Chưa có mã (vào `/flow` để tạo mới): không có gì để tải — tắt cờ chờ ngay,
    // không thì `loading` khởi tạo `true` kẹt mãi và cả màn chỉ có vòng xoay.
    if (!projectId) {
      setLoading(false);
      return;
    }
    let alive = true;
    let timer: number | undefined;
    const pull = async () => {
      try {
        const data = await api.getProject(projectId);
        if (!alive) return;
        const steps = data.pipeline?.steps ?? [];
        /*
         * Chặng máy đang dừng ở: đang chạy, đang mở cổng chờ người, hoặc — nếu
         * không chặng nào đang bận — đã VẤP ở một chặng BẮT BUỘC.
         *
         * Bỏ sót nhánh cuối là lý do một chặng hỏng biến thành ngõ cụt: máy
         * dừng hẳn (không chặng nào `running`/`awaiting-user` nữa), `stage`
         * rơi về `null`, `currentStep` (`server/flow-steps.ts`) rơi về
         * "preparing" vì không phân biệt được với "chưa chạy gì", sidebar
         * quay mãi ở "Chuẩn bị", và chặng hỏng bị lọc KHỎI danh sách bày ở
         * `MachineWorkingPanel` — nút "Thử lại" nó đã có sẵn không hiện ra.
         */
        const active = steps.find(
          (item) =>
            item.status === "running" || item.status === "awaiting-user",
        );
        const blocked = steps.find(
          (item) => item.status === "failed" && item.required,
        );
        setSnap({
          hasMain: data.files.some((file) => file.role === "main"),
          hasBrief: Boolean(data.project.profile?.trim()),
          stage: (active ?? blocked)?.key ?? null,
          settled: data.pipeline?.settled ?? false,
          started: steps.length > 0,
          steps,
          cut: summariseCut(data.segments ?? []),
          unsureCount: (data.words ?? []).filter(
            (row) => (row.confidence ?? 1) < 0.6,
          ).length,
        });
        setLoadError(null);
        // Đã tới bàn dựng thì không còn chặng nào đổi nữa — hỏi tiếp mỗi 1,5s
        // là hỏi cho có, tốn một lượt gọi mạng mỗi giây rưỡi suốt lúc người
        // dùng ngồi sửa ở bàn dựng.
        if (data.pipeline?.settled && timer !== undefined) {
          window.clearInterval(timer);
        }
      } catch (err) {
        // KHÔNG bắt là lỗi cũ: một lượt 500 ném thẳng xuống, `snap` đứng
        // nguyên ở giá trị RỖNG ban đầu, và trang bày khung thả tệp cho một
        // dự án đang tồn tại — bắt ở đây để bày đúng "chưa tải được", không
        // giả một dự án trống.
        if (!alive) return;
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Không tải được dự án, thử lại.",
        );
      } finally {
        if (alive) setLoading(false);
      }
    };
    void pull();
    // Hỏi lại đều đặn: bước máy đổi mà không có ai báo, nên trang phải tự nhìn.
    // Dừng lại khi đã `settled` — xem nhánh trong `pull()`.
    timer = window.setInterval(() => void pull(), 1500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [projectId, retryTick]);

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
  // TẠO-KHI-THẢ: vào `/flow` chưa có mã, thả tệp đầu tiên là `ensureProject` tạo
  // dự án rồi mã nhảy lên đường dẫn để tải lại không mất việc — cùng lối `/upload`
  // (tránh đẻ dự án rỗng khi bấm "Dự án mới" rồi bỏ ngang).
  useEffect(() => {
    if (upload.projectId && !projectId) {
      navigate(`/flow/${upload.projectId}`, { replace: true });
    }
  }, [upload.projectId, projectId, navigate]);
  const pickRef = useRef<HTMLInputElement>(null);
  const pickRole = useRef<MediaRole | undefined>(undefined);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  /**
   * Người dùng đã bấm "Vẫn mở bàn dựng" sau lời nhắc "không nghe ra câu nào".
   *
   * `upload.noSpeechFound` không tự tắt — chép lời xong 0 câu vẫn cứ 0 câu cho
   * tới khi chép lại. Không có cờ riêng này thì lời nhắc chặn bàn dựng VĨNH
   * VIỄN kể cả với video nhạc-không-lời hợp lệ, mà `at` đã ở "studio" thì
   * không còn nút "Chép lại lời" nào để thoát ra nữa.
   */
  const [bypassNoSpeech, setBypassNoSpeech] = useState(false);

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
   * Mạch LỆCH thì CHẶN, không nhắc — nhưng CHỈ lúc còn ở bước NHẬP.
   *
   * `transcriptStale` bật khi thêm hoặc bớt cảnh sau lúc chép lời xong — phần
   * mới không có chữ nào. Trang cũ chỉ hiện một dòng nhắc, mà nút đi tiếp vẫn
   * sáng: người dùng bấm qua và mọi thứ sau đó dựng trên bản chép của một mạch
   * khác. Cắt sai chỗ vì lịch cắt bám mốc từ, soát lời trên bản chép cũ, đặt tư
   * liệu vào chỗ không còn tồn tại.
   *
   * Nhắc một dòng cho một hậu quả cỡ ấy là không cân. Chặn — nhưng chỉ chặn
   * đúng chỗ người dùng còn SỬA được cảnh/đề bài (ba bước nhập). Trước đây cờ
   * này đứng ĐẦU ternary của `action` mà không xét `at`, nên hễ nó bật lên là
   * nút chính ở MỌI bước — kể cả nút "Xuất video" ở bàn dựng — bị nuốt mất,
   * thay bằng một nút "Chép lại lời" một-cú-bấm-là-xoá-sạch-cắt-soát-chữ.
   */
  const stale = upload.transcriptStale || upload.briefStale;

  /**
   * Đang gửi lệnh chép lời — che nút trong khoảng hở giữa lúc gọi máy chủ
   * xong và lúc `snap.started` bắt kịp (mãi 1,5s sau, nhịp hỏi của `pull()`).
   *
   * Chỉ tắt lại khi HỎNG: gọi xong mà không hỏng thì cứ để `true` — bước sẽ tự
   * đổi (`snap.started`) và nút này biến mất theo, không cần ai tắt tay.
   */
  const [transcribing, setTranscribing] = useState(false);
  const beginTranscribe = async () => {
    setTranscribing(true);
    try {
      await upload.startTranscribe();
    } catch {
      setTranscribing(false);
      toast.add({
        title: "Chưa bắt đầu chép lời được",
        description: "Máy chủ không nhận. Thử lại.",
        type: "error",
      });
    }
  };

  const machineAt = currentStep(snap);
  // KHÔNG tự nhảy bước theo dữ liệu: tải cảnh chính xong (hoặc mở lại dự án) vẫn
  // ĐỨNG ở bước nhập đang xem; muốn sang bước sau phải BẤM "Tiếp". Chỉ khi máy đã
  // chạy (`snap.started`) mới bám theo máy ở dưới. Reload = về bước 0 rồi bấm qua.
  const INTAKE_STEPS = ["main-footage", "b-roll", "brief"] as const;
  // Máy chưa chạy → bước do wizard cầm; chạy rồi → bám máy (bước máy tự tiến qua
  // Chuẩn bị/Cắt/Soát/Dựng/Bàn dựng).
  const at: FlowStepId = snap.started
    ? machineAt
    : INTAKE_STEPS[Math.min(intakeStep, 2)];
  const step = FLOW_STEPS[stepIndex(at)];
  // Nhắc "Chép lại lời" CHỈ ở ba bước nhập — sau khi máy đã chạy thì nút chính
  // của cut/proofread/studio không được nhường chỗ cho nó (xem đoạn trên).
  const staleAction =
    stale && (at === "main-footage" || at === "b-roll" || at === "brief");
  /** Đã tới bàn dựng mà chưa nghe ra câu nào, và người dùng chưa bấm qua. */
  const noSpeechWarning =
    at === "studio" && upload.noSpeechFound && !bypassNoSpeech;
  /*
   * Khung xem chiếu đúng LOẠI tệp của bước đang đứng.
   *
   * Bản đầu luôn rơi về `mainFiles[0]`, nên ở bước cảnh phụ nó chiếu một cảnh
   * CHÍNH, và ô mô tả bên dưới hỏi "Tư liệu này là gì?" cho một cảnh chính.
   * Chụp một dự án mới mới thấy — dự án cũ có sẵn cả hai loại nên không lộ.
   */
  /*
   * Máy có đang bận Ở CHÍNH BƯỚC NÀY không — hỏi trạng thái thật, không hỏi nhãn.
   *
   * `FLOW_STEPS` khai bước 6 là của NGƯỜI, mà hai chặng đầu của nó (`commit-cut`,
   * `fix`) lại là máy chạy. Xét theo nhãn thì suốt lúc ấy ô phải bày "màn chưa
   * dựng" và nút đầu trang mời "Mở bàn dựng" — mà bàn dựng thấy dự án đang kẹt
   * nên đá về màn chờ. Một ngõ cụt, đúng kiểu vừa sửa ở bước 5.
   */
  const machineBusy = snap.steps.some(
    (item) =>
      item.key === snap.stage &&
      item.status === "running" &&
      STAGES_OF[at].includes(item.key),
  );
  /**
   * Bước đang đứng có một chặng máy CỦA NÓ đã vấp chưa — kể cả khi bước ấy
   * nhãn là của NGƯỜI (`proofread` sở hữu `commit-cut`/`fix`, hai chặng MÁY
   * chạy trước cổng soát chính tả).
   *
   * Thiếu nhánh này thì `commit-cut` hỏng ở bước `proofread` không khớp
   * `machineBusy` (nó chỉ hỏi `running`) lẫn không khớp `step.actor==="machine"`
   * (nhãn của `proofread` là "user") — ô phải rơi thẳng vào `SoatLoiStep`, tức
   * bày bảng soát lời cho một bản chép CHƯA CÓ, và nút Thử lại nằm ở
   * `MachineWorkingPanel` chẳng bao giờ được dựng ra.
   */
  const machineBlocked = snap.steps.some(
    (item) =>
      item.status === "failed" &&
      item.required &&
      STAGES_OF[at].includes(item.key),
  );

  const pool = at === "b-roll" ? upload.insertFiles : upload.mainFiles;
  const previewing =
    pool.find((item) => item.id === previewId) ?? pool[0] ?? null;

  /*
   * NÚT VIỆC CHÍNH của bước — header đã bỏ, nút xuống CHÂN cột phải.
   *
   * Đặt ngay dưới chỗ người dùng vừa thao tác: soát xong bản cắt thì nút "Chốt"
   * nằm ngay dưới dải cắt, không phải ngước lên đỉnh trang tìm. Bước máy đang
   * chạy thì không có nút — chờ là chờ.
   *
   * Studio để TRƯỚC nhánh `user` chung: bàn dựng cũng là bước của người, nhưng
   * nút của nó là ô cắm portal cho "Xuất video" (render từ `StudioStep`), không
   * phải nút "Mở bàn dựng".
   */
  const action = staleAction ? (
    // Việc XOÁ SẠCH cắt/soát/chữ đã dựng — hỏi trước, không một-cú-bấm-là-mất.
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button disabled={transcribing}>
            Chép lại lời
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Chép lại lời?</AlertDialogTitle>
          <AlertDialogDescription>
            Mạch cảnh hoặc đề bài đã đổi sau lần chép lời trước. Chép lại sẽ{" "}
            <strong>xoá bản cắt, soát lời và chữ đã dựng</strong> để chép trên
            mạch mới.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Để sau</AlertDialogCancel>
          <AlertDialogAction onClick={() => void beginTranscribe()}>
            Chép lại, xoá bản cũ
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : at === "cut" && projectId ? (
    <FinishCutButton
      projectId={projectId}
      cuts={snap.cut.count}
      seconds={snap.cut.seconds}
      kept={snap.cut.kept}
    />
  ) : machineBusy || machineBlocked ? null : at === "proofread" &&
    projectId ? (
    <FinishTextButton projectId={projectId} unsureCount={snap.unsureCount} />
  ) : noSpeechWarning ? null : at === "studio" ? (
    <div id={STUDIO_ACTION_SLOT} className="contents" />
  ) : at === "main-footage" ? (
    /* WIZARD một chiều: mỗi bước nhập xong bấm "Tiếp" sang bước KẾ, không nhảy
       thẳng vào chép lời. Cảnh chính bắt buộc — chưa có thì nút mờ. */
    <Button
      disabled={!snap.hasMain || transcribing}
      onClick={() => setIntakeStep(1)}
    >
      Tiếp
      <ArrowRightIcon data-icon="inline-end" />
    </Button>
  ) : at === "b-roll" ? (
    // Cảnh phụ KHÔNG bắt buộc — luôn cho đi tiếp.
    <Button disabled={transcribing} onClick={() => setIntakeStep(2)}>
      Tiếp
      <ArrowRightIcon data-icon="inline-end" />
    </Button>
  ) : at === "brief" ? (
    // Bước nhập CUỐI: bắt đầu chép lời, máy tự chạy tiếp các bước sau. Che nút
    // trong lúc gửi — `snap.started` bắt kịp mãi ~1,5s sau (nhịp hỏi máy chủ),
    // nên không che thì click đúp bắn hai lượt `startTranscribe`.
    <Button disabled={transcribing} onClick={() => void beginTranscribe()}>
      Bắt đầu chép lời
      <ArrowRightIcon data-icon="inline-end" />
    </Button>
  ) : null;

  if (loadError) {
    return (
      <div className="hide-scrollbars grid min-h-svh place-items-center gap-2 bg-background p-2 text-foreground lg:h-svh lg:overflow-hidden">
        <Card className="w-full max-w-sm">
          <CardContent>
            <Empty>
              <EmptyTitle>Không tải được dự án</EmptyTitle>
              <EmptyDescription>{loadError}</EmptyDescription>
              <EmptyContent>
                <Button
                  onClick={() => {
                    setLoading(true);
                    setRetryTick((tick) => tick + 1);
                  }}
                >
                  Thử lại
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    <div className="hide-scrollbars grid min-h-svh gap-2 bg-background p-2 text-foreground lg:h-svh lg:grid-cols-[8.5rem_1fr] lg:overflow-hidden">
      {/* Header đã bỏ: tên dự án lên đỉnh sidebar, "Trang chủ" xuống chân sidebar,
          nút việc chính xuống chân cột phải — mỗi thứ về đúng chỗ người dùng cần. */}
      <FlowSidebar
        current={at}
        // Luồng MỘT CHIỀU: sidebar chỉ là bản đồ "đang ở đâu", không bấm được —
        // bước trước `at` là đã qua, bước sau là chưa tới. Tiến bằng nút, không
        // quay lại.
        onHome={() => navigate("/")}
      />

      {/* Cột phải: nội dung bước ở trên, NÚT việc chính ghim ở chân.
          `min-w-0`: đây là ô `1fr` của lưới ngoài `[8.5rem_1fr]`. Grid-item mặc
          định `min-width:auto` — không cho co dưới min-content, nên bước nào có
          khung xem rộng là cả ô này phình quá bề ngang, đẩy nội dung lòi khỏi mép
          và bị `overflow-hidden` cắt (ring cột phải mất một cạnh). Cho co về 0. */}
      <div
        className={`grid min-h-0 min-w-0 gap-2 lg:h-full ${
          action
            ? "lg:grid-rows-[minmax(0,1fr)_auto]"
            : "lg:grid-rows-[minmax(0,1fr)]"
        }`}
      >
        {/*
          Ô phải KHÔNG bọc thêm một Card nữa.

          `SequencePreviewCard` tự mang tiêu đề "Xem trước", `MainTimelineCard`
          tự mang "Mạch chính" — chúng vốn là thẻ CẤP TRANG, đứng cạnh nhau ở
          `/upload`. Bọc chúng trong một Card có tiêu đề "Cảnh chính" nữa là ba
          tầng khung chồng nhau: tiêu đề lặp, và tầng ngoài ăn hết chiều cao nên
          danh sách dưới bị cắt cụt.

          Tên bước đã nằm ở sidebar. Nhắc lần nữa ở đây không thêm gì.
        */}
        <div className="grid min-h-0 min-w-0 gap-2 lg:h-full lg:grid-rows-[minmax(0,1fr)]">
          <input
            ref={pickRef}
            type="file"
            // Cảnh phụ nhận cả ẢNH lẫn video (b-roll có thể là ảnh); cảnh chính
            // chỉ video. Trước đây một `accept="video/*"` dùng chung ẩn mất ảnh ở
            // hộp chọn tệp của cảnh phụ.
            accept={at === "b-roll" ? "video/*,image/*" : "video/*"}
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
          ) : at === "cut" ? (
            <CutStep
              projectId={projectId}
              previewUrl={projectId ? api.baseVideoUrl(projectId) : null}
            />
          ) : step.actor === "machine" || machineBusy || machineBlocked ? (
            /*
             * Bước MÁY: bày các chặng của bước ấy ở BÊN PHẢI.
             *
             * Sidebar cố tình gộp chúng vào một dòng — nó là bản đồ, không phải
             * nhật ký. Nhưng lúc máy đang chạy thì người dùng muốn biết nó đang
             * làm gì, và đây đúng là chỗ để nhìn — dựng như đang-sống, vì quãng
             * chờ tự động này chính là thứ đang bán.
             */
            <MachineWorkingPanel
              steps={snap.steps.filter((item) =>
                STAGES_OF[at].includes(item.key),
              )}
              // Dùng lại đường có sẵn ở `api` chứ không gọi fetch trần: một chỗ
              // đổi đường dẫn thì mọi nơi theo.
              onRetry={(key) => void api.retryStep(projectId!, key)}
            />
          ) : at === "proofread" ? (
            /* Cổng soát chính tả đã mở (hai chặng máy `commit-cut`/`fix` chạy
               xong thì nhánh máy ở trên không còn bắt). Bày bản chép để soát. */
            <SoatLoiStep projectId={projectId} />
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
            <div className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_34rem]">
              <SequencePreviewCard
                // Grid-item của track `minmax(0,1fr)` vẫn `min-width:auto` — phải
                // cho `min-w-0` lên chính Card này thì nó mới co, không thì khung
                // xem 9:16 giữ nguyên min-content và đẩy cột phải lòi khỏi màn.
                className="min-w-0"
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
            <div className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_34rem]">
              <SequencePreviewCard
                // Grid-item của track `minmax(0,1fr)` vẫn `min-width:auto` — phải
                // cho `min-w-0` lên chính Card này thì nó mới co, không thì khung
                // xem 9:16 giữ nguyên min-content và đẩy cột phải lòi khỏi màn.
                className="min-w-0"
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
          ) : noSpeechWarning ? (
            /*
             * Máy chép lời chạy xong mà KHÔNG nghe ra câu nào — video có thể
             * chỉ có nhạc, hoặc máy nghe hỏng. `useUpload` đã tính sẵn
             * `noSpeechFound`, nhưng trước đây `/flow` chưa từng đọc nó: mở
             * thẳng vào bàn dựng RỖNG chữ, không một lời báo.
             */
            <Card className="lg:min-h-0 lg:h-full">
              <CardContent className="grid min-h-0 flex-1 place-items-center">
                <Empty>
                  <EmptyMedia variant="icon">
                    <AlertTriangleIcon />
                  </EmptyMedia>
                  <EmptyTitle>Không nghe ra câu nào</EmptyTitle>
                  <EmptyDescription>
                    Máy chép lời chạy xong nhưng không tách được câu nói nào.
                    Video có thể chỉ có nhạc, hoặc máy nghe nhầm — bàn dựng sẽ
                    trống chữ nếu mở tiếp.
                  </EmptyDescription>
                  <EmptyContent>
                    <Button
                      variant="outline"
                      onClick={() => setBypassNoSpeech(true)}
                    >
                      Vẫn mở bàn dựng
                    </Button>
                  </EmptyContent>
                </Empty>
              </CardContent>
            </Card>
          ) : at === "studio" ? (
            /* Bước cuối "Bàn dựng": bàn dựng thế hệ mới — editor lược phần cắt.
               Nút xuất video nằm trong chính workspace này. */
            <StudioStep projectId={projectId} />
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

        {/* Chân cột phải: NÚT việc chính của bước. Bước máy đang chạy thì `action`
            rỗng — hàng này biến mất, không để lại thẻ trống. */}
        {action ? (
          <Card size="sm">
            <CardContent className="flex items-center justify-end gap-2">
              {action}
            </CardContent>
          </Card>
        ) : null}
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
