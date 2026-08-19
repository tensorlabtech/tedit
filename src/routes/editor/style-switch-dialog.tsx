import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GradeFilterDefs, gradeStyle } from "@/dev/overlays/grade-filter";
import { OverlayTextBlock } from "@/dev/overlays/overlay-render";
import { StylePreviewTile } from "@/routes/pipeline/style-preview-tile";
import { useRevealLoop } from "@/dev/overlays/use-reveal-loop";
import type { BandId } from "@/dev/overlays/overlay-model";

import type { StylePackId } from "../../../server/style-pack";
import { describeStyleFeel, packForElement } from "../../../server/style-pack";
import { STYLE_PACKS, findStylePack } from "../../../server/style-pack-catalog";

/**
 * Đổi BỘ DÁNG CHỮ của cả dự án, ngay trong bàn dựng.
 *
 * Vì sao phải đổi được ở đây dù màn chờ đã cho chọn: quyết định không hoàn tác
 * được thì người dùng chọn mặc định — phản xạ chung, và nó dẫn ngược về đúng chỗ
 * xuất phát (mọi video một dáng, chỉ khác là có thêm một màn chọn mà ai cũng bấm
 * "để nguyên").
 *
 * Dialog chứ không phải một tab thứ tư ở cột phải: bộ dáng là chuyện CẤP DỰ ÁN,
 * mà Inspector là nơi sửa *vật đang chọn* — đặt ở đó là sai cấp. Và đây là việc
 * làm một lần cho cả dự án, cần diện tích để so sánh chứ không đáng chiếm chỗ
 * vĩnh viễn trong ba cột.
 *
 * Không có phép đếm "đổi 47 cụm · giữ 6 cụm bạn đã sửa": cả năm bộ dáng khai
 * `defaults` giống hệt nhau nên đổi bộ dáng KHÔNG đụng bảng `elements`.
 */
export function StyleSwitchDialog({
  open,
  onOpenChange,
  value,
  onAccept,
  poster = null,
  moment = "da-dung-xong",
  /** Cụm chữ TẠI VẠCH HIỆN TẠI — thứ người dùng đang nhìn, không phải cụm đầu video. */
  preview,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  value: StylePackId;
  onAccept: (next: StylePackId) => void;
  /** Khung hình thật làm nền ô mẫu; `null` thì ô rơi về nền tối. */
  poster?: string | null;
  /**
   * Chọn TRƯỚC khi máy chạy hay ĐỔI sau khi đã dựng — hai thời điểm cho hai kết
   * quả khác hẳn nhau, và Dialog phải nói đúng cái đang xảy ra.
   *
   * `truoc-khi-dung`: phong cách lái cả nhạc, hiệu ứng, mật độ tư liệu và nhịp
   * cắt. Đây là lúc duy nhất lựa chọn còn lái được máy.
   *
   * `da-dung-xong`: chỉ vẽ lại chữ. Nhạc và hiệu ứng đã đặt xong; tự đặt lại là
   * ghi đè lên những vật người dùng nhìn thấy trên dải và có thể đã sắp lại.
   */
  moment?: "truoc-khi-dung" | "da-dung-xong";
  preview: {
    text: string;
    align: "left" | "center" | "right" | "stair" | "stagger";
    emphasis: "even" | "keyword-large" | "mixed-size" | "taper";
    band: BandId;
    keywords: string[];
  } | null;
}) {
  // Chọn TẠM, chưa ghi. Đóng bằng Esc hay bấm Thôi là bỏ hẳn lựa chọn tạm.
  const [draft, setDraft] = useState<StylePackId>(value);
  const [hovered, setHovered] = useState<StylePackId | null>(null);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const seconds = useRevealLoop(open);
  const DONE = 99;
  const sample = preview?.text?.trim() || "Nghĩ kỹ rồi bắt đầu";
  const draftPack = findStylePack(draft);

  /**
   * Khung xem lớn KHÔNG BAO GIỜ được trống.
   *
   * Vạch hay dừng ở chỗ chưa có chữ — quãng lặng, đầu video, chỗ giữa hai cụm —
   * và lúc đó ô lớn nhất của Dialog là một mảng đen. Nó đọc ra như hỏng chứ
   * không đọc ra như "chỗ này không có chữ", nên người dùng ngờ cả cái Dialog.
   *
   * Rơi về chữ ví dụ với đúng bố cục mặc định: vẫn so được năm bộ dáng, mà đó
   * là việc duy nhất màn này sinh ra để làm.
   */
  const shown = preview ?? {
    text: sample,
    align: "center" as const,
    emphasis: "even" as const,
    band: "middle" as BandId,
    keywords: [],
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {moment === "truoc-khi-dung"
              ? "Chọn phong cách video"
              : "Đổi phong cách video"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          {/* Khung xem lớn vẽ cụm TẠI VẠCH HIỆN TẠI, nên ngữ cảnh đi theo người
              dùng vào Dialog — không phải nhớ mình đang đứng ở đâu. */}
          {/* Cao theo MÀN chứ không theo cột: khung 9:16 để tự do sẽ kéo dialog
              cao gần gấp đôi phần lưới ô bên phải, và hai phần ba chiều cao ấy
              là chỗ trống. Chốt chiều cao rồi để bề rộng suy ra từ tỉ lệ. */}
          <div className="@container relative mx-auto h-[min(46vh,380px)] w-auto aspect-[9/16] overflow-hidden rounded-lg bg-neutral-800">
            <GradeFilterDefs pack={draftPack} />
            {poster && (
              <img
                src={poster}
                alt=""
                className="absolute inset-0 size-full object-cover"
                style={gradeStyle(draftPack)}
              />
            )}
            <OverlayTextBlock
              config={{ ...shown, insert: { kind: "none", shape: "wide" } }}
              pack={packForElement(draftPack, null, shown.keywords)}
              seconds={seconds}
            />
          </div>

          <div className="grid content-start gap-2">
            <div className="grid grid-cols-5 gap-1">
              {STYLE_PACKS.map((pack) => (
                <StylePreviewTile
                  key={pack.id}
                  pack={pack}
                  text={sample}
                  poster={poster}
                  selected={pack.id === draft}
                  seconds={hovered === pack.id ? seconds : DONE}
                  onSelect={() => setDraft(pack.id)}
                  onHoverChange={(hovering) =>
                    setHovered(hovering ? pack.id : null)
                  }
                />
              ))}
            </div>
            <p className="text-sm">
              <span className="text-foreground">{draftPack.label}</span>{" "}
              <span className="text-muted-foreground">
                · {describeStyleFeel(draftPack)}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {moment === "truoc-khi-dung"
                ? "Máy sẽ chọn nhạc, hiệu ứng, mật độ tư liệu và nhịp cắt theo phong cách này."
                : "Dựng lại TOÀN BỘ phong cách: look chữ, khung b-roll, ô người theo bộ mới. Giữ nguyên nội dung (cắt, chữ, tư liệu). Chỉnh-tay về phong cách sẽ bị ghi đè — đổi về bộ cũ để hoàn tác."}
            </p>
            {!preview && (
              // Nói rõ khung bên trái đang vẽ chữ ví dụ. Không nói thì người
              // dùng tưởng đó là chữ của mình và không hiểu vì sao nó lạ.
              <p className="text-sm text-muted-foreground">
                Vạch đang ở chỗ chưa có chữ, nên khung bên trái chạy chữ ví dụ.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Thôi</Button>} />
          <Button
            onClick={() => {
              onAccept(draft);
              onOpenChange(false);
            }}
          >
            {moment === "truoc-khi-dung" ? "Dùng phong cách này" : "Đổi sang phong cách này"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
