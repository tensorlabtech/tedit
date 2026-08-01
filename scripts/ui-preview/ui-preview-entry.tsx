import { useState } from "react";
import { createRoot } from "react-dom/client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REVEALS } from "@/dev/overlays/overlay-model";
import { TextOverrideRows } from "@/routes/editor/inspector-text-override-rows";
import { FieldGroup } from "@/components/ui/field";
import { findStylePack } from "../../server/style-pack-catalog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StyleSwitchDialog } from "@/routes/editor/style-switch-dialog";
import { StylePickerCard } from "@/routes/pipeline/style-picker-card";
import "@/index.css";

import type { StylePackId } from "../../server/style-pack";

/**
 * Xem thử component giao diện KHÔNG cần đăng nhập.
 *
 * Mọi đường dẫn thật đều nằm sau cổng Google, mà Google chối đăng nhập từ trình
 * duyệt bị điều khiển tự động — nên không có trang này thì mọi lượt kiểm giao
 * diện bằng máy đều phải nhờ người ngồi bấm.
 *
 * Chỉ dựng component với dữ liệu giả. Không gọi API, không đọc CSDL: thứ cần
 * nhìn ở đây là bố cục, cỡ chữ và chỗ viền — không phải luồng dữ liệu.
 *
 *   npm run dev
 *   mở http://localhost:5173/scripts/ui-preview/ui-preview.html
 */

const SAMPLES = [
  "Nghĩ kỹ rồi bắt đầu",
  "Mình đã từng nghĩ chuyện này rất khó",
  "Ba mươi tuổi vẫn chưa có gì",
];

function Harness() {
  const [pack, setPack] = useState<StylePackId>("goc");
  const [sample, setSample] = useState(SAMPLES[0]);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="min-h-svh bg-background p-2 text-foreground">
        <div className="mb-2 flex flex-wrap gap-2 text-sm">
          {SAMPLES.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => setSample(text)}
              className="rounded-md border border-border px-3 py-1"
            >
              {text}
            </button>
          ))}
        </div>
        {/* Ba bề rộng: cột phải của màn chờ ở 1160px và 720px, cộng một cột hẹp
            hơn nữa để thấy lúc nào năm ô bắt đầu chật. */}
        <div className="flex flex-wrap items-start gap-2">
          {[460, 380, 300].map((width) => (
            <div key={width} style={{ width }}>
              <div className="mb-1 text-xs text-muted-foreground">{width}px</div>
              <StylePickerCard
                value={pack}
                onChange={setPack}
                sampleText={sample}
                // Ảnh mẫu đứng thay khung hình thật của người dùng.
                posterUrl="/dev-overlays/nen.jpg"
              />
            </div>
          ))}
        </div>

        {/* Hai hàng ĐÈ ở khung "Đang sửa" — ca chưa đè và ca đã đè. */}
        <div className="mt-3 flex flex-wrap gap-4">
          {[
            { letterCase: null, keyColor: null },
            { letterCase: "upper" as const, keyColor: "#FF5252" },
          ].map((over, index) => (
            <div key={index} className="w-80 rounded-xl border border-border p-3">
              <div className="mb-2 text-xs text-muted-foreground">
                {over.letterCase ? "đã đè" : "chưa đè (theo dáng)"}
              </div>
              <FieldGroup>
                <TextOverrideRows
                  element={{
                    id: "e1",
                    fromWordId: "",
                    toWordId: "",
                    start: 0,
                    end: 2,
                    content: sample,
                    position: "bottom",
                    align: "center",
                    emphasis: "taper",
                    keywords: [],
                    ...over,
                  }}
                  pack={findStylePack(pack)}
                  onChange={() => {}}
                />
              </FieldGroup>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-sm">Hộp chọn "Hiện ra":</span>
          <div className="w-56">
            <Select
              items={Object.fromEntries(REVEALS.map((r) => [r.id, r.label]))}
              value="fade-up"
              onValueChange={() => {}}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVEALS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3">
          <Button onClick={() => setDialogOpen(true)}>Mở dialog đổi dáng</Button>
          <StyleSwitchDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            value={pack}
            onAccept={setPack}
            /* Đổi thành `null` để soi ca "vạch đang ở chỗ chưa có chữ" — khung
               xem lớn phải rơi về chữ ví dụ chứ không được để trống. */
            poster="/dev-overlays/nen.jpg"
            preview={{
              text: sample,
              align: "center",
              emphasis: "taper",
              band: "top",
              keywords: sample.split(" ").slice(-1),
            }}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
