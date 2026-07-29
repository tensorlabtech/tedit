import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { OverlayFrame } from "./overlay-frame";
import {
  DIP_SECONDS,
  FLASH_AMOUNT,
  FLASH_SECONDS,
  JUNCTIONS,
  PUNCH_SCALE,
  PUNCH_SECONDS,
  type JunctionId,
} from "./overlay-model";
import { useDemoMedia } from "./demo-media";
import { useRevealLoop } from "./use-reveal-loop";

/**
 * Chỗ nối giữa hai đoạn.
 *
 * Bày đúng hai kiểu vì chỉ hai kiểu in ra được. Mờ chồng (`xfade` của ffmpeg) cần
 * hai luồng gối nhau nên phải dựng lại cả bước cắt — chưa làm thì chưa bày.
 *
 * Nhấn zoom chỉ phóng HÌNH GỐC, không phóng chữ: chữ vẽ sau bước phóng, nên cỡ chữ
 * đã tính công phu không bị kéo theo.
 */
export function TransitionCard() {
  const [kind, setKind] = useState<JunctionId>("zoom-in");
  const seconds = useRevealLoop();
  const media = useDemoMedia();

  // Vòng lặp 4 giây, chỗ nối ở giây 2: nửa đầu là đoạn trước, nửa sau là đoạn sau.
  const CUT_AT = 2;
  const sau = seconds >= CUT_AT;
  const tuNoi = seconds - CUT_AT;
  // "Vào" thì dâng lên rồi rơi quanh chỗ nối; "ra" thì bắt đầu ở đỉnh rồi hạ dần.
  // Cùng hình dạng với `zoomPunchFilter` của `server/render.ts`.
  /** Xung tại chỗ nối — cùng hình dạng với `pulseExpr` của máy chủ. */
  const xung = (seconds: number, motBen: boolean) =>
    motBen
      ? sau && tuNoi < seconds
        ? 1 - tuNoi / seconds
        : 0
      : Math.max(0, 1 - Math.abs(tuNoi) / seconds);

  const zoom =
    kind === "zoom-in"
      ? xung(PUNCH_SECONDS, false)
      : kind === "zoom-out"
        ? xung(PUNCH_SECONDS, true)
        : 0;
  const sang =
    kind === "flash"
      ? xung(FLASH_SECONDS, false) * FLASH_AMOUNT
      : kind === "dip"
        ? -xung(DIP_SECONDS, false)
        : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chỗ nối giữa hai đoạn</CardTitle>
        <CardAction>
          <Badge variant="secondary">
            {sau ? "sau chỗ nối" : "trước chỗ nối"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Bỏ một đoạn thì hai đoạn còn lại dính vào nhau — chỗ dính đó cần được
          đánh dấu, không thì người xem thấy hình nhảy mà không hiểu vì sao.
        </p>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
          <Field>
            <FieldLabel>Kiểu nối</FieldLabel>
            <FieldDescription>
              {JUNCTIONS.find((item) => item.id === kind)?.note}
            </FieldDescription>
            <ToggleGroup
              size="sm"
              value={[kind]}
              onValueChange={(value) =>
                value[0] && setKind(value[0] as JunctionId)
              }
            >
              {JUNCTIONS.map((item) => (
                <ToggleGroupItem key={item.id} value={item.id}>
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldDescription>
              Bật cho cả video ở thanh công cụ trong editor — nó đổi dáng mọi
              chỗ nối, nên không phải thứ đặt riêng từng chỗ.
            </FieldDescription>
          </Field>

          <div className="@container mx-auto w-full max-w-[240px]">
            <OverlayFrame showSafeArea={false} background={media.main}>
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  transform: `scale(${1 + PUNCH_SCALE * zoom})`,
                  // Nháy sáng / chìm đen làm bằng độ sáng, cùng cách máy chủ dùng
                  // (`eq=brightness`) — không phải phủ một lớp màu lên trên.
                  filter: `brightness(${1 + sang})`,
                }}
              >
                {/* Hai "đoạn" là HAI MỐC của cùng video thật: chỗ nối chỉ đọc được
                    khi hai bên là chất liệu thật, còn ảnh tĩnh thì không biết cú
                    nhấn có thấy được hay không. */}
                {media.main ? (
                  <SegmentClip src={media.main} at={sau ? 24 : 3} />
                ) : (
                  <img
                    src="/dev-overlays/nen.jpg"
                    alt=""
                    className="size-full object-cover"
                  />
                )}
              </div>
            </OverlayFrame>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Một "đoạn": cùng video, tua tới mốc `at` rồi phát tiếp. */
function SegmentClip({ src, at }: { src: string; at: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.currentTime = at;
    void node.play().catch(() => {});
  }, [at, src]);
  return (
    <video
      ref={ref}
      src={src}
      className="size-full object-cover"
      muted
      playsInline
    />
  );
}
