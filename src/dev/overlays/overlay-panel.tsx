import { useEffect, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  ALIGNS,
  BANDS,
  EMPHASES,
  MAX_LINES,
  fitCum,
  splitCum,
  type AlignId,
  type BandId,
  type EmphasisId,
} from "./overlay-model";
import { availOf, OverlayRender, type OverlayConfig } from "./overlay-render";
import { useDemoMedia } from "./demo-media";
import { useRevealLoop } from "./use-reveal-loop";

/**
 * Bảng thao tác CHỮ trên video: bên trái mọi thứ tuỳ biến được, bên phải thấy ngay.
 *
 * Trang trước bày sẵn mười khung mẫu — xem được nhưng không nói được người dùng
 * phải làm gì để ra cái đó. Bảng này đảo lại: mỗi thứ đổi được là một hàng điều
 * khiển, và khung bên phải là kết quả thật của đúng những lựa chọn đó.
 */

const MAU = "Mình nghĩ 30 tuổi là lớn lắm";

/** Một dòng điều khiển: nhãn, lời giải thích, và bộ chọn. */
function Hang({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldDescription>{hint}</FieldDescription>
      {children}
    </Field>
  );
}

export function OverlayPanel() {
  const [text, setText] = useState(MAU);
  // HAI trục, hai giá trị. Trước dùng một `layout` cho cả hai hộp chọn, nên bấm
  // hộp dưới là mất lựa chọn của hộp trên — bày ra hai lựa chọn mà máy chỉ giữ một.
  const [align, setAlign] = useState<AlignId>("center");
  const [emphasis, setEmphasis] = useState<EmphasisId>("deu");
  const [band, setBand] = useState<BandId>("top");
  const [keywords, setKeywords] = useState<string[]>(["30", "tuổi"]);
  const seconds = useRevealLoop();
  const media = useDemoMedia();

  const words = text.trim().split(/\s+/).filter(Boolean);
  const cum = splitCum(text);
  const [dau, ...sau] = cum;
  const config: OverlayConfig = {
    text: dau ?? "",
    align,
    emphasis,
    band,
    keywords,
    // Tư liệu chèn có thẻ riêng bên dưới; bày cả ở đây là một control hai chỗ.
    insert: { kind: "none", shape: "wide" },
  };
  const fitted = fitCum(config.text, availOf(band));

  /**
   * Số đo THẬT của bản in ra, hỏi thẳng máy chủ.
   *
   * Bảng này ước bề rộng theo số ký tự, còn máy chủ đo bằng đúng tệp font sẽ in.
   * Bày cả hai cạnh nhau để lệch là thấy ngay — chứ không phải tin rằng hai bên
   * đang cùng một luật.
   */
  const [thatSu, setThatSu] = useState<
    { lines: number; size: number } | "loi" | null
  >(null);
  useEffect(() => {
    if (emphasis !== "deu" || !config.text.trim()) {
      setThatSu(null);
      return;
    }
    let alive = true;
    api
      .layoutText(config.text, band)
      .then((result) => {
        if (!alive) return;
        setThatSu({
          lines: result.lines.length,
          // `fontRatio` tính theo chiều cao; đổi về bề rộng cho cùng trục với bảng.
          size: (result.fontRatio * 1920) / 1080,
        });
      })
      .catch(() => alive && setThatSu("loi"));
    return () => {
      alive = false;
    };
  }, [config.text, band, emphasis]);

  return (
    <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="min-h-0">
        <CardHeader>
          <CardTitle>Làm một overlay</CardTitle>
          <CardAction>
            <Badge variant="secondary">
              {cum.length > 1 ? `${cum.length} cụm` : `${words.length} tiếng`}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Năm thứ đổi được, mỗi thứ một trục riêng — đổi cái này không mất cái
            kia. Máy lo cỡ chữ và bẻ dòng: người chọn ý, máy chọn số đo.
          </p>
          <FieldSet>
            <Hang
              label="1 · Chữ"
              hint={`Gõ lời cần hiện. Quá ${MAX_LINES} dòng thì máy tự tách thành nhiều cụm hiện lần lượt, không co chữ lại.`}
            >
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={2}
                placeholder="Ví dụ: Mình nghĩ 30 tuổi là lớn lắm"
              />
              <FieldDescription>
                {fitted.lines.length} dòng · cỡ chữ{" "}
                {Math.round(fitted.size * 100)}% bề rộng khung
                {sau.length > 0 &&
                  ` · tách thêm ${sau.length} cụm: “${sau.join("” / “")}”`}
              </FieldDescription>
              {thatSu === "loi" ? (
                <FieldDescription>
                  Chưa nối được máy chủ — số trên là ƯỚC, không phải số của bản
                  in ra
                </FieldDescription>
              ) : thatSu ? (
                <FieldDescription>
                  Bản in ra (máy chủ đo bằng font thật): {thatSu.lines} dòng ·
                  cỡ {Math.round(thatSu.size * 100)}%
                  {thatSu.lines !== fitted.lines.length &&
                    " ← LỆCH với khung xem"}
                </FieldDescription>
              ) : null}
            </Hang>

            <Hang
              label="2 · Căn — các hàng nằm đâu"
              hint={
                ALIGNS.find((item) => item.id === align)?.note ??
                "Chỗ đứng của các hàng theo bề ngang"
              }
            >
              <ToggleGroup
                className="flex-wrap"
                value={[align]}
                onValueChange={(value) =>
                  value[0] && setAlign(value[0] as AlignId)
                }
              >
                {ALIGNS.map((item) => (
                  <ToggleGroupItem key={item.id} value={item.id}>
                    {item.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Hang>

            <Hang
              label="3 · Nhấn — tiếng nào to hơn"
              hint={
                EMPHASES.find((item) => item.id === emphasis)?.note ??
                "Cách phân biệt cỡ chữ trong cụm"
              }
            >
              <ToggleGroup
                className="flex-wrap"
                value={[emphasis]}
                onValueChange={(value) =>
                  value[0] && setEmphasis(value[0] as EmphasisId)
                }
              >
                {EMPHASES.map((item) => (
                  <ToggleGroupItem key={item.id} value={item.id}>
                    {item.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Hang>

            <Hang
              label="4 · Vị trí"
              hint="Ba chỗ. Giữa là chỗ có mặt người nói — chỉ dùng khi thật sự cần. Hai chỗ dưới chừa lề phải rộng hơn vì cột nút của TikTok nằm bên đó."
            >
              <ToggleGroup
                className="flex-wrap"
                value={[band]}
                onValueChange={(value) =>
                  value[0] && setBand(value[0] as BandId)
                }
              >
                {BANDS.map((item) => (
                  <ToggleGroupItem key={item.id} value={item.id}>
                    {item.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Hang>

            <Hang
              label="5 · Từ khoá"
              hint="Bấm vào tiếng để đánh dấu. Tiếng được đánh dấu thì đậm hơn, và là tiếng được phóng to ở các bố cục theo tiếng."
            >
              <ToggleGroup
                multiple
                className="flex-wrap"
                value={keywords}
                onValueChange={(value) => setKeywords(value as string[])}
              >
                {words.map((word, index) => (
                  <ToggleGroupItem key={`${word}-${index}`} value={word}>
                    {word}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Hang>
          </FieldSet>
        </CardContent>
      </Card>

      <Card className="min-h-0">
        <CardHeader>
          <CardTitle>Thấy ngay</CardTitle>
          {/* Số cụm thì bảng bên trái không nói, nên vẫn phải có một chỗ. */}
          {cum.length > 1 && (
            <CardAction>
              <Badge variant="secondary">đang xem cụm 1/{cum.length}</Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <div className="@container mx-auto w-full max-w-[340px]">
            <OverlayRender
              config={config}
              seconds={seconds}
              background={media.main}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
