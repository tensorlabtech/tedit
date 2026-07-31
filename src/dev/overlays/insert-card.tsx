import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { OverlayFrame } from "./overlay-frame";
import {
  REVEALS,
  REVEAL_RISE,
  REVEAL_SECONDS,
  type RevealId,
} from "./overlay-model";
import { useDemoMedia } from "./demo-media";
import { useRevealLoop } from "./use-reveal-loop";

/**
 * Tư liệu chèn: ảnh hoặc video đè lên lời nói, và CÁCH NÓ HIỆN RA.
 *
 * Hiệu ứng ở đây in ra được thật — cùng bộ số với `insertFilter` của
 * `server/render.ts`. Kiểu nào chưa in ra được thì không có trong danh sách.
 */

type Shape = "square" | "portrait" | "wide" | "full";

const SHAPES: Array<{ id: Shape; label: string; ratio: string }> = [
  { id: "square", label: "Vuông", ratio: "1 / 1" },
  { id: "portrait", label: "Dọc", ratio: "3 / 4" },
  { id: "wide", label: "Ngang", ratio: "16 / 9" },
  { id: "full", label: "Đè kín", ratio: "9 / 16" },
];

/**
 * Kiểu hiện ra, tính theo giây đã trôi trong vòng lặp.
 *
 * Nới chậm (1-(1-x)³) chứ không tuyến tính: vào nhanh rồi dừng êm mới ra chuyển
 * động, tuyến tính đọc ra như bị kéo bằng tay. Cùng công thức với `insertY` của
 * `server/render.ts` để xem trước và bản in ra cùng nhịp.
 */
function revealStyleOf(reveal: RevealId, seconds: number): React.CSSProperties {
  if (reveal === "none") return {};
  const p = Math.min(1, seconds / REVEAL_SECONDS);
  const rest = (1 - p) ** 3;
  if (reveal === "fade") return { opacity: p };
  return { opacity: p, transform: `translateY(${REVEAL_RISE * 100 * rest}%)` };
}

export function InsertCard() {
  const [kind, setKind] = useState<"image" | "video">("image");
  const [shape, setShape] = useState<Shape>("wide");
  const [reveal, setReveal] = useState<RevealId>("fade");
  const seconds = useRevealLoop();
  const media = useDemoMedia();

  const found = SHAPES.find((item) => item.id === shape) ?? SHAPES[2];
  const content =
    kind === "video" ? (
      <video
        src={media.insert ?? "/dev-overlays/mau-video.mp4"}
        className="size-full object-cover"
        muted
        loop
        autoPlay
        playsInline
      />
    ) : (
      <img
        src="/dev-overlays/mau-anh.jpg"
        alt=""
        className="size-full object-cover"
      />
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tư liệu chèn</CardTitle>
        <CardAction>
          <Badge variant="secondary">0,8 giây</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Ảnh hoặc video đè lên lời nói. Hai cách hiện ra, mỗi cách 0,8 giây —
          đủ dài để nhìn là thấy, và cả hai đều in được ra video thật.
        </p>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
          <FieldSet>
            <Field>
              <FieldLabel>Loại tư liệu</FieldLabel>
              <ToggleGroup
                size="sm"
                value={[kind]}
                onValueChange={(value) =>
                  value[0] && setKind(value[0] as "image" | "video")
                }
              >
                <ToggleGroupItem value="image">Ảnh</ToggleGroupItem>
                <ToggleGroupItem value="video">Video</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel>Hình dáng khung</FieldLabel>
              <ToggleGroup
                size="sm"
                className="flex-wrap"
                value={[shape]}
                onValueChange={(value) =>
                  value[0] && setShape(value[0] as Shape)
                }
              >
                {SHAPES.map((item) => (
                  <ToggleGroupItem key={item.id} value={item.id}>
                    {item.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel>Hiện ra thế nào</FieldLabel>
              <FieldDescription>
                {REVEALS.find((item) => item.id === reveal)?.note}
              </FieldDescription>
              <ToggleGroup
                size="sm"
                className="flex-wrap"
                value={[reveal]}
                onValueChange={(value) =>
                  value[0] && setReveal(value[0] as RevealId)
                }
              >
                {REVEALS.map((item) => (
                  <ToggleGroupItem key={item.id} value={item.id}>
                    {item.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          </FieldSet>

          <div className="@container mx-auto w-full max-w-[240px]">
            <OverlayFrame showSafeArea={false} background={media.main}>
              {shape === "full" ? (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={revealStyleOf(reveal, seconds)}
                >
                  {content}
                </div>
              ) : (
                <div className="absolute inset-x-[8%] top-[13%] overflow-hidden rounded-[3cqw]">
                  <div
                    style={{
                      aspectRatio: found.ratio,
                      ...revealStyleOf(reveal, seconds),
                    }}
                  >
                    {content}
                  </div>
                </div>
              )}
            </OverlayFrame>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
