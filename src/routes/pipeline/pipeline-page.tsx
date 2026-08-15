import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckIcon,
  CoffeeIcon,
  MinusIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { GradeFilterDefs, gradeStyle } from "@/dev/overlays/grade-filter";
import { api, type ApiStep } from "@/lib/api";
import { findStylePack } from "../../../server/style-pack-catalog";
import { cn } from "@/lib/utils";

import { StylePickerCard } from "./style-picker-card";
import { usePipeline } from "./use-pipeline";

/**
 * Màn chờ: máy dựng, người dùng đứng ngoài.
 *
 * MÁY LÀM XONG HẾT RỒI MỚI TỚI LƯỢT NGƯỜI DÙNG. Sản phẩm bán sự tự động, nên
 * quãng chờ không phải phiền toái cần giấu — nó chính là thứ đang bán. Đổi lại,
 * người dùng không phải ngồi canh; và vì không ai sửa trong lúc máy ghi nên máy
 * không bao giờ đè mất việc đã làm.
 *
 * Hệ quả: bàn dựng ĐÓNG cho tới khi xong (`pipeline.settled`).
 *
 * MÀN NÀY KHÔNG CÓ NÚT "LÀM LẠI". Muốn quyết "có nên chia đoạn lại không" thì
 * phải NHÌN 219 đoạn ấy — mà chúng nằm ở bàn dựng. Đặt nút ở đây là bắt người
 * dùng quyết trong lúc không có gì để nhìn, tức là đoán. Ngoại lệ duy nhất là
 * chặng HỎNG: hỏng thì tự nó đã là bằng chứng.
 */

/** Tên hiện ra của từng chặng. Khoá phải khớp `STEP_PLAN` của máy chủ. */
export const STEP_LABELS: Record<string, string> = {
  prepare: "Chuẩn bị video",
  transcribe: "Nghe và chép lời",
  fix: "Sửa chỗ nghe nhầm",
  captions: "Chia đoạn, sinh chữ",
  silence: "Cắt chỗ im lặng",
  cuts: "Tìm chỗ nên bỏ",
  // Hai cổng chờ người và chặng chốt nằm giữa mạch. Tên nói rõ AI ĐANG LÀM GÌ:
  // hai cái đầu là việc của người ("Bạn soát…"), cái giữa là việc của máy.
  "review-cut": "Bạn soát chỗ cắt",
  "commit-cut": "Chốt lát cắt, chép lời lại",
  "review-text": "Bạn soát chính tả",
  keywords: "Chọn từ khoá",
  describe: "Đọc tư liệu chèn",
  place: "Ghép tư liệu chèn",
  effects: "Chọn hiệu ứng",
  music: "Chọn nhạc nền",
};

/**
 * Dòng phụ MẶC ĐỊNH của mỗi chặng — bày lúc CHƯA tới (chưa có kết quả). Nhờ nó
 * mọi hàng đều hai dòng, không "cụt ngủn" một dòng. Chặng XONG thì kết quả thật
 * (vd "65 đoạn · 53 chữ") đè lên mô tả này.
 */
export const STEP_DESCRIPTIONS: Record<string, string> = {
  prepare: "Chuẩn hoá tiếng và hình",
  transcribe: "Máy nghe rồi gõ ra chữ",
  fix: "Chữa lại từ nghe sai",
  captions: "Tách câu, dựng phụ đề",
  silence: "Bỏ quãng lặng thừa",
  cuts: "Gợi ý đoạn nên bỏ",
  "review-cut": "Bạn xem lại chỗ cắt",
  "commit-cut": "Chốt bản cắt cuối",
  "review-text": "Bạn soát lỗi chính tả",
  keywords: "Tô đậm từ quan trọng",
  describe: "Máy xem từng tư liệu",
  place: "Đặt b-roll đúng chỗ",
  effects: "Thêm chuyển cảnh, nhấn nhịp",
  music: "Chọn nhạc hợp mạch",
};

/**
 * "đang chạy 12s" — mốc `updated_at` là lúc chặng đổi sang `running`.
 *
 * Trang tự hỏi lại máy chủ mỗi 1,5 giây nên con số này nhích theo mà không cần một
 * bộ đếm riêng.
 */
function elapsed(updatedAt: number) {
  const seconds = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  if (seconds < 60) return `đang chạy ${seconds}s`;
  return `đang chạy ${Math.floor(seconds / 60)}p${seconds % 60}s`;
}

export function StepRow({ step, onRetry }: { step: ApiStep; onRetry: () => void }) {
  // Chặng KHÔNG bắt buộc mà hỏng thì là BỎ QUA, không phải báo động: người dùng
  // vẫn có video đầy đủ. Để tam giác đỏ ở đây làm người ta tưởng hỏng cả mẻ.
  const blocking = step.status === "failed" && step.required;

  const detail =
    step.status === "running"
      ? // ĐỪNG dùng `jobs.message` ở đây. Nó là lời của job `transcribe` và đóng
        // băng ở "Đang nghe và chép lời" — các chặng AI sau không cập nhật nó, nên
        // bước "Tìm chỗ nên bỏ" cũng khoe câu đó và người đọc tưởng máy đang làm
        // việc khác. Tên bước đã nói nó làm gì; thứ còn thiếu là NÓ CHẠY BAO LÂU.
        elapsed(step.updatedAt)
      : step.status === "failed"
        ? (step.error ?? "hỏng")
        : step.status === "done"
          ? step.result
          : // Chặng CHỜ không có dòng phụ. Chữ "chờ" chỉ nói lại đúng thứ dấu tròn
            // mờ bên cạnh đã nói, mà nó lại chiếm một dòng cho mỗi chặng chưa tới.
            null;

  return (
    <Item size="sm" className="items-start">
      {/* `h-5`: khớp chiều cao một dòng `ItemTitle`, nên dấu hiệu nằm ĐÚNG hàng với
          chữ đầu tiên. Trước đây `ItemMedia` tự cao theo nội dung và dấu tròn 6px
          trôi lên phía trên baseline — nhìn ra ngay là lệch. */}
      <ItemMedia className="h-5 w-4 justify-center">
        {step.status === "done" ? (
          <CheckIcon className="text-primary" />
        ) : step.status === "running" ? (
          <Spinner />
        ) : step.status === "failed" ? (
          blocking ? (
            <AlertTriangleIcon className="text-destructive" />
          ) : (
            <MinusIcon className="text-muted-foreground" />
          )
        ) : (
          <span className="size-1.5 rounded-full bg-muted-foreground/40" />
        )}
      </ItemMedia>

      {/* Tên chặng đứng RIÊNG một dòng, kết quả thành gạch đầu dòng nhỏ bên trong.
          Trước đây hai thứ chen một dòng: tên chặng và con số dính nhau thành một
          câu dài, và kết quả dài thì bị cắt bằng dấu ba chấm ngay giữa. */}
      <ItemContent className="gap-0.5">
        <ItemTitle
          className={cn(
            (step.status === "waiting" || step.status === "failed") &&
              "text-muted-foreground",
          )}
        >
          {STEP_LABELS[step.key] ?? step.key}
        </ItemTitle>
        {detail && (
          // Không có dấu gạch đầu dòng. Kết quả vốn đã là một chuỗi ngăn bằng dấu
          // "·" ("sửa 8 chỗ · 3 lượt"), nên thêm một dấu "·" nữa ở đầu là ba dấu
          // giống nhau trên một dòng, và dấu đầu tiên không ngăn cách gì cả.
          // Thụt lề của `ItemContent` đã nói dòng này thuộc về tên bên trên.
          <ItemDescription
            className={cn("text-xs", blocking && "text-destructive")}
          >
            {detail}
          </ItemDescription>
        )}
      </ItemContent>

      {/* Nút có ở MỌI chặng hỏng, không chỉ chặng chặn đường. Chặng bỏ qua vẫn có
          thể hỏng vì một lý do tạm — mạng, mô hình quá tải, "bị ngắt giữa chừng" —
          và trước đây người dùng không có đường nào thử lại nó.

          Rẻ vì nó chạy lại ĐÚNG chặng đó (`api.retryStep`), không dựng lại cả mạch
          từ chặng nghe và chép lời. */}
      {step.status === "failed" && (
        <ItemActions>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Thử lại
          </Button>
        </ItemActions>
      )}
    </Item>
  );
}

export function PipelinePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const view = usePipeline(projectId);

  const steps = view.pipeline?.steps ?? [];
  const settled = view.pipeline?.settled ?? false;
  const blocked = view.pipeline?.blocked ?? false;
  const skipped = view.pipeline?.skipped ?? 0;
  // Chặng BỎ QUA không tính là xong: đếm 3/3 trong khi một chặng bị bỏ là khoe
  // một con số không đúng.
  const doneCount = steps.filter((step) => step.status === "done").length;
  const canOpen = settled && !blocked;
  /*
   * Cổng chờ người — máy xong phần nó, tới lượt mình.
   *
   * Nút dẫn thẳng vào BÀN DỰNG, không chốt tại chỗ.
   *
   * Bản đầu bày một bảng chỉ-đọc ngay trên màn chờ. Sai hình dạng: soát chỗ cắt
   * là phải nhìn video, nghe tiếng, đọc lời trong ngữ cảnh rồi sửa tại chỗ — đó
   * đúng là một bàn dựng, chỉ khác việc. Một danh sách không sửa được thì người
   * dùng chỉ có hai lựa chọn là tin hoặc không tin.
   */
  const awaiting = view.pipeline?.awaiting ?? null;

  // Dự án CŨ không có bảng chặng nào — chúng dựng xong từ trước khi có màn này.
  // Giữ chúng lại đây là nhốt người dùng trước một danh sách rỗng vĩnh viễn.
  useEffect(() => {
    if (!view.loading && !view.error && steps.length === 0 && projectId) {
      navigate(`/flow/${projectId}`, { replace: true });
    }
  }, [view.loading, view.error, steps.length, projectId, navigate]);

  if (view.error) {
    return (
      <div className="grid h-svh place-items-center bg-background p-2 text-foreground">
        <Empty>
          <EmptyTitle>Không mở được dự án</EmptyTitle>
          <EmptyDescription>{view.error}</EmptyDescription>
          <Button
            variant="secondary"
            className="mt-1"
            onClick={() => navigate("/")}
          >
            Về danh sách dự án
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    // Bento phủ kín màn, cùng khung xương với bàn dựng: đầu và chân co theo nội
    // dung, thân chiếm hết phần còn lại. Mọi ô là Card, cách nhau gap-2.
    <div className="grid min-h-svh gap-2 bg-background p-2 text-foreground lg:h-svh lg:grid-rows-[auto_1fr_auto] lg:overflow-hidden">
      <Card>
        <CardHeader>
          <CardTitle>{view.title}</CardTitle>
          <CardAction>
            <Button variant="ghost" onClick={() => navigate("/")}>
              Trở về
            </Button>
            {/* MỘT cửa ra. Lý do nó tắt nằm ở chân màn chứ không giấu sau
                tooltip: nút `disabled` có `pointer-events: none` nên tooltip
                không bao giờ nổ — đo được là rê chuột vào chẳng ra gì. */}
            {awaiting ? (
              <Button onClick={() => navigate(`/flow/${projectId}`)}>
                {awaiting === "review-cut" ? "Soát chỗ cắt" : "Soát chính tả"}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            ) : (
              <Button
                disabled={!canOpen}
                onClick={() => navigate(`/flow/${projectId}`)}
              >
                Mở trình sửa
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            )}
          </CardAction>
        </CardHeader>
      </Card>

      <div className="grid gap-2 lg:min-h-0 lg:grid-cols-[3fr_2fr]">
        {/* Ô xem trước có mặt từ sớm là CÓ LÝ DO: chặng đầu xong sau khoảng mười
            giây đã có video ghép. Chờ trước một thanh tiến độ thì dài; chờ
            trước chính cái video của mình thì không. */}
        <Card className="lg:min-h-0">
          <CardContent className="grid min-h-0 flex-1 place-items-center">
            {doneCount > 0 && projectId ? (
              // Lớp bọc ĐỊNH VỊ, không phải `max-h-full` trên chính thẻ video:
              // ô này là `flex-1` trong một grid nên chiều cao của nó KHÔNG xác
              // định, mà `max-height: 100%` cần cha có chiều cao xác định mới
              // giải được. Đo thật: video dọc 1080×1920 nở ra 786×1397 trong
              // một ô cao 688 — tràn gấp đôi. `absolute inset-0` thì khung luôn
              // đúng bằng ô, còn `object-contain` lo phần thư giãn tỉ lệ.
              <div className="relative size-full">
                {/* Khung xem này NẮN MÀU theo phong cách đang chọn. Nó đứng ngay
                    cạnh chỗ chọn, nên chọn xong là thấy hình đổi — mà nắn màu
                    lại đúng là trục người dùng khó hình dung nhất qua tên bộ. */}
                <GradeFilterDefs pack={findStylePack(view.stylePack)} />
                <video
                  className="absolute inset-0 size-full rounded-lg bg-neutral-900 object-contain"
                  src={api.baseVideoUrl(projectId)}
                  style={gradeStyle(findStylePack(view.stylePack))}
                  controls
                  playsInline
                />
              </div>
            ) : (
              <Empty>
                <Spinner />
                <EmptyTitle>Đang dựng bản xem trước</EmptyTitle>
                <EmptyDescription>
                  Xong chặng ghép video là khung này chạy được
                </EmptyDescription>
              </Empty>
            )}
          </CardContent>
        </Card>

        {/* Cột phải: danh sách bước rồi tới lời trấn an. Bọc trong MỘT ô của lưới,
            không thả rời làm con thứ ba — lưới chỉ có hai cột nên con thứ ba xuống
            hàng mới và rơi về phía trái, xa hẳn danh sách nó đang nói về. */}
        {/* Ba hàng: danh sách chặng co giãn, thẻ chọn dáng và lời trấn an co
            theo nội dung. Thẻ chọn dáng đặt DƯỚI danh sách chặng chứ không trên:
            thứ người dùng mở màn này để xem là việc đang chạy tới đâu. */}
        {/* Hàng chặng có SÀN chiều cao VÀ phần chia lớn hơn: thẻ chọn phong cách
            cao hơn chỗ cột có, mà danh sách chặng mới là thứ người ta mở màn này
            để xem. Bản đầu để `1fr` trần trụi thì chặng bị ép còn một vạch; bản
            sau chia đều thì mới hiện được 6/12 chặng. 1,5fr cho khoảng 8 dòng,
            phần còn lại cuộn — vệt mờ ở đáy vùng cuộn nói điều đó. */}
        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-[minmax(14rem,1.5fr)_minmax(17rem,1fr)_auto]">
          <Card className="lg:min-h-0">
            <CardHeader>
              <CardTitle>Tedit đang tự động</CardTitle>
              <CardAction>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {doneCount}/{steps.length}
                  {skipped > 0 && ` · ${skipped} bỏ qua`}
                </span>
              </CardAction>
            </CardHeader>
            {/* Không có thanh tiến độ. Danh sách chặng ngay dưới đây ĐÃ nói tiến
                độ, mà nói cụ thể hơn nhiều: dấu tích tới đâu, chặng nào đang chạy,
                mỗi chặng đẻ ra con số gì. Một thanh chỉ lặp lại cùng thông tin ấy
                dưới dạng nghèo hơn, và số "10/11" ở góc phải đã là bản gọn của nó. */}
            <CardContent className="grid min-h-0 gap-2">
              <ScrollArea viewportClassName="scroll-fade-b">
                {/* Phải ghi đè ĐÚNG biến thể `has-data-[size=sm]:` — khoảng cách
                  mặc định đến từ đó, nên `gap-0` thường không thắng nổi. */}
                <ItemGroup className="has-data-[size=sm]:gap-0">
                  {steps.map((step) => (
                    <StepRow
                      key={step.key}
                      step={step}
                      onRetry={() => void view.retry(step.key)}
                    />
                  ))}
                </ItemGroup>
              </ScrollArea>
            </CardContent>
          </Card>

          <StylePickerCard
            value={view.stylePack}
            onChange={(next) => void view.chooseStylePack(next)}
            sampleText={view.sampleText}
            posterUrl={view.posterUrl}
          />

          {/* Lời trấn an nằm TRONG cột phải, ngay dưới danh sách bước — chỗ mắt đang
            đọc. Trước nó là một Card riêng chạy hết bề ngang ở đáy trang: xa danh
            sách, và một thẻ full-width cho đúng một câu.

            Chỉ ba câu, và mỗi câu ứng với một tình huống thật:
            · chặng chặn đường → nói lỗi, chỉ chỗ bấm lại;
            · xong hết → mời sang bàn dựng;
            · đang chạy → nói ĐÓNG TRANG CŨNG ĐƯỢC. Đây là câu đáng nói nhất: việc
              chạy vài phút, mà người dùng không biết mình có phải ngồi canh không. */}
          <Alert
            variant={blocked ? "destructive" : canOpen ? "success" : "info"}
          >
            {blocked ? (
              <AlertTriangleIcon />
            ) : canOpen ? (
              <CheckIcon />
            ) : (
              <CoffeeIcon />
            )}
            <AlertTitle>
              {blocked
                ? "Có chặng hỏng"
                : canOpen
                  ? "Xong hết"
                  : "Cứ làm việc khác đi"}
            </AlertTitle>
            <AlertDescription>
              {blocked
                ? (view.jobError ?? "Bấm Thử lại ở dòng đang báo đỏ.")
                : canOpen
                  ? skipped > 0
                    ? `Có ${skipped} chặng bỏ qua, video vẫn đầy đủ lời và chữ.`
                    : "Mở bàn dựng để xem lại và chỉnh."
                  : "Đóng trang cũng được — việc vẫn chạy tiếp. Tí quay lại là thấy kết quả."}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
