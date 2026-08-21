import { useState } from "react";
import { createRoot } from "react-dom/client";

import { Field, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { OptionPicker } from "@/routes/editor/option-picker";
import "@/index.css";

import { LAYOUT_SPECS, findLayout } from "../../server/layout-kinds";

/**
 * Xem thử BẢNG KHUNG sau khi gộp: ít khung gốc + các trục tinh chỉnh.
 *
 *   npm run dev
 *   mở http://localhost:5173/scripts/caption-preview/layout-picker-preview.html
 */
const family = (id: string) => {
  const spec = findLayout(id);
  if (spec.slots.length >= 2) return "hai-o";
  const only = spec.slots[0];
  if (!only) return id;
  return only.role === "phu" ? "mot-o-tu-lieu" : "mot-o-nguoi";
};
const FAMILY_LABEL: Record<string, string> = {
  "mot-o-nguoi": "Một ô",
  "mot-o-tu-lieu": "Một ô tư liệu",
  "hai-o": "Hai ô",
};

function Harness() {
  const [layout, setLayout] = useState("hai-o");
  // Đặt sẵn hai trục để ảnh chụp thấy được sơ đồ ĐỔI THEO tuỳ chọn.
  const [opts, setOpts] = useState<Record<string, string | boolean | null>>({
    aspect: "vuong",
    place: "duoi",
  });
  const seen = new Set<string>();
  const goc = LAYOUT_SPECS.filter((spec) => {
    if (spec.id === "toan-khung" || spec.slots.length === 0) return false;
    const f = family(spec.id);
    if (seen.has(f)) return false;
    seen.add(f);
    return true;
  });
  const set = (k: string, v: string | boolean | null) =>
    setOpts((cur) => ({ ...cur, [k]: v }));
  return (
    <div className="grid min-h-svh gap-4 bg-background p-4 text-foreground">
      <Field>
        <FieldLabel>Kiểu khung (sau khi gộp — trước là 12 thẻ)</FieldLabel>
        <OptionPicker
          options={[
            { id: "toan-khung", label: "Toàn khung", diagram: { layout: "toan-khung" } },
            ...goc.map((spec) => ({
              id: spec.id,
              label: FAMILY_LABEL[family(spec.id)] ?? spec.label,
              diagram: { layout: spec.id, options: opts as never },
            })),
          ]}
          value={layout}
          onSelect={setLayout}
        />
      </Field>
      <Field>
        <FieldLabel>Hình ô</FieldLabel>
        <ToggleGroup
          value={[(opts.aspect as string) ?? "auto"]}
          onValueChange={(next) => next[0] && set("aspect", next[0] === "auto" ? null : next[0])}
        >
          <ToggleGroupItem value="auto">Theo tư liệu</ToggleGroupItem>
          <ToggleGroupItem value="doc">Dọc</ToggleGroupItem>
          <ToggleGroupItem value="vuong">Vuông</ToggleGroupItem>
          <ToggleGroupItem value="ngang">Ngang</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <Field>
        <FieldLabel>Chỗ đứng</FieldLabel>
        <ToggleGroup
          value={[(opts.place as string) ?? "auto"]}
          onValueChange={(next) => next[0] && set("place", next[0] === "auto" ? null : next[0])}
        >
          <ToggleGroupItem value="auto">Theo khung</ToggleGroupItem>
          <ToggleGroupItem value="tren">Trên</ToggleGroupItem>
          <ToggleGroupItem value="giua">Giữa</ToggleGroupItem>
          <ToggleGroupItem value="duoi">Dưới</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <Field>
        <FieldLabel>Tư liệu trong ô</FieldLabel>
        <ToggleGroup
          value={[(opts.fit as string) ?? "cover"]}
          onValueChange={(next) => next[0] && set("fit", next[0] === "auto" ? null : next[0])}
        >
          <ToggleGroupItem value="cover">Phủ kín ô</ToggleGroupItem>
          <ToggleGroupItem value="contain">Lọt trọn</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <Field orientation="horizontal">
        <FieldLabel htmlFor="swap">Đảo trên · dưới</FieldLabel>
        <Switch
          id="swap"
          checked={Boolean(opts.swap)}
          onCheckedChange={(on) => set("swap", Boolean(on))}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        Khung đang chọn: {layout} · tuỳ chọn {JSON.stringify(opts)}
      </p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
