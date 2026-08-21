import { useState } from "react";
import { FilmIcon, Trash2Icon } from "lucide-react";

import { MediaPickerDialog } from "@/components/media-picker-dialog";
import { pickerItemFromApiFile } from "@/components/media-picker-item";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

import { findLayout } from "../../../server/layout-kinds";
import { findStylePack } from "../../../server/style-pack-catalog";
import { formatTimeFine } from "./editor-data";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

import { OptionPicker } from "./option-picker";
import type { EditorState } from "./use-editor";

/** Chạy thêm một nhịp mỗi đầu để thấy khung vào/ra thế nào. */
const PAD = 0.2;

/**
 * Tên theo CẤU TRÚC + THUỘC TÍNH, không theo 6 "kiểu" phẳng. Hai cấu trúc: 1 ô
 * (người) và 2 ô (người + tư liệu); còn lại là thuộc tính (vị trí, tỉ lệ ô).
 */
const KHUNG_LABEL: Record<string, string> = {
  "o-don": "1 ô · Trên",
  "o-vuong": "1 ô · Vuông",
  "o-lech": "1 ô · Dưới",
  "broll-don": "B-roll · Riêng",
  "broll-vuong": "B-roll · Vuông",
  "hai-o": "2 ô · Đều",
  "vuong-ngang": "2 ô · Vuông trên",
  "ngang-vuong": "2 ô · Ngang trên",
};
const khungLabel = (id: string) => KHUNG_LABEL[id] ?? findLayout(id).label;

/**
 * HỌ của một bố cục — mấy bố cục chỉ khác nhau ở thứ mà các trục tuỳ chọn đã lo
 * thì cùng một họ, và picker chỉ bày một đại diện.
 *
 * Xếp theo SỐ Ô và VAI của chúng, vì đó là hai thứ trục không đổi được: một ô
 * người khác hẳn hai ô, và ô người khác hẳn ô tư liệu. Còn tỉ lệ, chỗ đứng, cách
 * lọt khung thì đổi được ngay dưới thẻ nên không đáng là một lựa chọn riêng.
 */
function layoutFamily(id: string): string {
  const spec = findLayout(id);
  if (spec.slots.length >= 2) return "hai-o";
  const only = spec.slots[0];
  if (!only) return id; // `trang-chu` không có ô nào — để riêng
  return only.role === "phu" ? "mot-o-tu-lieu" : "mot-o-nguoi";
}

/** Tên theo HỌ — thẻ trong picker giờ là một họ, không phải một bố cục cụ thể. */
const FAMILY_LABEL: Record<string, string> = {
  "mot-o-nguoi": "Một ô",
  "mot-o-tu-lieu": "Một ô tư liệu",
  "hai-o": "Hai ô",
};

/**
 * Bảng sửa MỘT KHUNG — một loại duy nhất cho cả b-roll lẫn ô người.
 *
 * B-roll KHÔNG phải một loại riêng: nó chỉ là một khung CÓ tư liệu. Tư liệu là
 * một HÀNG thuộc tính, không phải một bảng riêng. Kiểu khung hiện GỌN (thẻ đang
 * chọn + nút Đổi → modal danh sách) vì sau sẽ có hàng chục, hàng trăm kiểu — bày
 * phẳng hết ra thì vừa chật vừa thừa chỗ trống.
 */
export function LayoutKhungPane({
  editor,
  elementId,
  layout,
  framePreset,
  isBlur,
  /** Có tư liệu → khung 2 ô (b-roll). `null` → khung 1 ô (người). */
  media,
  opts,
  srcStart,
  srcEnd,
  outStart,
  outEnd,
  onPreview,
}: {
  editor: EditorState;
  elementId: string;
  layout: string;
  /** Preset đã đóng dấu look Ô của cảnh này — để tô ĐÚNG khung khi đã trộn. */
  framePreset?: string | null;
  /** Cảnh đang là KHUNG MỜ (defocus) — để picker tô đúng ô "Khung mờ". */
  isBlur?: boolean;
  media: {
    thumbUrl?: string;
    isVideo?: boolean;
    label?: string;
    /** Đang giữ tiếng clip hay câm; `undefined` khi khung chưa có tư liệu. */
    keepAudio?: boolean;
  } | null;
  /** Tuỳ chọn cấu trúc đang đóng dấu trên khung này; `null` = theo bố cục gốc. */
  opts?: {
    aspect?: string | null;
    fit?: string | null;
    place?: string | null;
    swap?: boolean | null;
  } | null;
  srcStart: number;
  srcEnd: number;
  outStart: number;
  outEnd: number;
  onPreview: (at: number, until?: number) => void;
}) {
  // KHÔNG tự chạy khi vừa CHỌN khung — chỉ chạy khi ĐỔI (kiểu khung, tư liệu).
  const replay = () => onPreview(Math.max(0, srcStart - PAD), srcEnd + PAD);

  // POOL KHUNG — mọi khung của MỌI preset, phẳng. Ở màn dựng không còn "video
  // thuộc preset nào": khung là block độc lập, nhặt cái nào cũng được, look của
  // khung đi theo cảnh. Nhóm theo preset (cái RỔ) chỉ để dễ ngắm — tiêu đề nhóm là
  // tên preset, nhãn khung để gọn; cả hai gộp lại đọc ra "Phấn · 2-ô".
  const blocks = editor.sceneLayout?.frameBlocks ?? [];
  const behindPresets = editor.sceneLayout?.behindPresets ?? [];
  // MỘT danh sách phẳng, mỗi khung tự xưng "{preset} - {bố cục}" (vd "Nhịp đen -
  // Ô đơn", "Prism Pro - Toàn khung") — nhìn phát biết look của khung thuộc theme
  // nào, và preset LOCK look đó (khung Nhịp-đen luôn nền caro, ở mọi video).
  // "Chữ sau người" là một LOẠI khung của preset khai chữ-nền (Phấn): nhặt nó
  // không đổi cấu trúc cảnh mà mở ô nhập chữ-nền của cả video.
  // Nhãn NGẮN (chỉ bố cục) vì đã nhóm theo preset — tiêu đề nhóm mang tên preset.
  const frameOptions = [
    ...blocks.map((b) => ({
      id: b.id,
      presetId: b.presetId,
      presetLabel: b.presetLabel,
      layout: b.layout,
      label: khungLabel(b.layout),
    })),
    ...behindPresets.map((p) => ({
      id: `behindtext:${p.id}`,
      presetId: p.id,
      presetLabel: p.label,
      layout: "behindtext",
      label: "Chữ sau người",
    })),
  ];
  // TOÀN KHUNG dùng CHUNG (không theo preset): người phủ kín màn → nền preset bị
  // che, defocus là mức-video → mọi preset render Y HỆT. Bày một ô chung (đóng dấu
  // theo style dự án), khỏi lặp ba ô trùng ở ba nhóm.
  const toanKhungId = `${editor.stylePack}:toan-khung`;
  const khungMoId = "chung:khung-mo";
  // Cảnh toàn-khung THƯỜNG (không mờ) vs KHUNG MỜ — cùng layout `toan-khung`, phân
  // biệt bằng cờ `blur` đã đóng dấu; để tô đúng ô nào trong nhóm "Chung".
  const isToanKhung = layout === "toan-khung" && !isBlur;
  // Nhãn khung ĐANG chọn cho thẻ gọn: KHUNG MỜ hiện tên riêng (không "preset -
  // toan-khung"), còn lại ghép "{preset} - {bố cục}".
  const currentFrameLabel = isBlur
    ? "Khung mờ"
    : `${findStylePack(framePreset ?? editor.stylePack).label} - ${khungLabel(layout)}`;
  // NHÓM theo preset (bỏ toan-khung), ĐẨY style dự án lên đầu: phần lớn nhặt khung
  // trong theme đang dùng; theme khác (để trộn) xuống dưới. Giữ thứ tự khai.
  const frameGroups = (() => {
    const byPreset = new Map<
      string,
      { label: string; items: typeof frameOptions }
    >();
    /*
     * MỖI PHONG CÁCH CHỈ BÀY VÀI KHUNG GỐC, không bày hết mọi bố cục.
     *
     * Mười hai bố cục vốn là tổ hợp của cùng mấy trục — `o-don` với `o-lech` chỉ
     * khác chỗ đứng, `o-vuong` chỉ khác tỉ lệ ô, `broll-full` với `broll-fit` chỉ
     * khác cách ảnh lọt vào ô. Bày cả mười hai là bắt người dùng chọn trong mười
     * hai cái tên khó đoán để làm việc mà thật ra là ba câu hỏi dễ, và ba câu ấy
     * giờ đã có sẵn ngay dưới thẻ khung (hình ô · tư liệu trong ô · đảo trên dưới
     * · chỗ đứng).
     *
     * Nên ở đây chỉ giữ MỘT đại diện cho mỗi họ. Chọn khung xong thì tinh chỉnh
     * bằng các trục — cùng ngần ấy khả năng, ít hơn hẳn thứ phải đọc.
     */
    const seenFamily = new Set<string>();
    for (const opt of frameOptions) {
      if (opt.layout === "toan-khung") continue; // toan-khung ra ô CHUNG
      const family = `${opt.presetId}:${layoutFamily(opt.layout)}`;
      if (seenFamily.has(family)) continue;
      seenFamily.add(family);
      const group = byPreset.get(opt.presetId) ?? {
        label: opt.presetLabel,
        items: [],
      };
      group.items.push(opt);
      byPreset.set(opt.presetId, group);
    }
    return [...byPreset.entries()]
      .sort(([a], [b]) =>
        a === editor.stylePack ? -1 : b === editor.stylePack ? 1 : 0,
      )
      .map(([id, group]) => ({ id, ...group }));
  })();
  // Khung ĐANG chọn của cảnh này — tô sáng đúng block đang mang look ấy: khớp cấu
  // trúc + đúng preset LOOK đã đóng dấu vào cảnh. Khi cảnh chưa trộn (chưa có
  // `framePreset`) thì lùi về preset dự án cho khớp.
  const lookPreset = framePreset ?? editor.stylePack;
  const currentBlockId =
    blocks.find((b) => b.layout === layout && b.presetId === lookPreset)?.id ??
    null;

  const [frameOpen, setFrameOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);

  // Khung 2 ô (cần ô tư liệu) — dù ĐÃ hay CHƯA có tư liệu. Tư liệu là thuộc tính,
  // không quyết cấu trúc: chọn khung 2 ô là ra ngay (ô phụ trống = placeholder),
  // KHÔNG bắt chọn tư liệu trước.
  const is2o = findLayout(layout).needsInsert;

  // Nhặt một khung từ pool: đổi CẤU TRÚC (`insertLayout`) VÀ đóng dấu LOOK của khung
  // (`frameBlock`) vào cảnh — nền/viền của khung đi theo cảnh, nên trộn được Phấn
  // với Nhịp-đen trong cùng video.
  const onPick = (blockId: string) => {
    setFrameOpen(false);
    // Khung "Chữ sau người": không đổi cấu trúc cảnh — đưa tới ô nhập chữ-nền.
    if (blockId.startsWith("behindtext:")) {
      editor.pickBehindText();
      return;
    }
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    const nextLayout = block.layout;
    const frameBlock = JSON.stringify(block.frameLook);
    const framePreset = block.presetId; // đóng dấu preset LOOK để picker tô ĐÚNG khi trộn.
    if (findLayout(nextLayout).needsInsert) {
      if (media)
        editor.setInsertStyle(elementId, {
          insertLayout: nextLayout,
          frameBlock,
          framePreset,
        });
      else
        editor.setSegmentLayout(elementId, nextLayout, frameBlock, framePreset);
      replay();
    } else if (media) {
      // 2 ô → 1 ô: gỡ tư liệu, MANG THEO look khung vừa nhặt (nếu không, cảnh về
      // preset dự án — Khung mờ ra không mờ, mất look preset khi trộn).
      void editor.convertBrollToPerson(
        elementId,
        nextLayout,
        frameBlock,
        framePreset,
      );
    } else {
      editor.setSegmentLayout(elementId, nextLayout, frameBlock, framePreset);
      replay();
    }
  };

  return (
    <Card className="h-full min-h-0">
      <CardHeader>
        <CardTitle>
          Khung · {formatTimeFine(outStart)}–{formatTimeFine(outEnd)}
        </CardTitle>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        <div className="grid gap-4">
          <Field>
            <FieldLabel>
              Kiểu khung · {findStylePack(editor.stylePack).label}
            </FieldLabel>
            {/* Thumbnail 9:16 TO, tên ở TRÊN, nút ở DƯỚI. Bấm Đổi mở modal cả danh
                sách — sau trăm kiểu thì vẫn gọn ở đây. */}
            <div className="flex items-stretch gap-3">
              <div className="grid aspect-[9/16] w-16 shrink-0 place-items-center overflow-hidden rounded-lg inset-ring-1 inset-ring-border p-2 text-center">
                <span className="line-clamp-3 text-xs leading-tight">
                  {currentFrameLabel}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                <p className="truncate text-sm font-medium">
                  {currentFrameLabel}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  onClick={() => setFrameOpen(true)}
                >
                  Đổi khung
                </Button>
              </div>
            </div>
          </Field>

          {/* TƯ LIỆU = một thuộc tính của khung 2 ô. Hiện theo CẤU TRÚC, không theo
              "đã có tư liệu": chưa có thì bày ô trống + "Chọn tư liệu". Cùng khổ với
              Kiểu khung: thumbnail to, tên trên, nút dưới. */}
          {is2o && (
            <Field>
              <FieldLabel>Tư liệu</FieldLabel>
              <div className="flex items-stretch gap-3">
                {media?.thumbUrl ? (
                  <img
                    src={media.thumbUrl}
                    alt=""
                    className="aspect-[9/16] w-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid aspect-[9/16] w-16 shrink-0 place-items-center rounded-lg bg-secondary">
                    <FilmIcon className="size-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                  <p className="truncate text-sm font-medium text-muted-foreground">
                    {media?.label ?? "Chưa có tư liệu"}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    onClick={() => setMediaOpen(true)}
                  >
                    {media ? "Đổi tư liệu" : "Chọn tư liệu"}
                  </Button>
                </div>
              </div>
              {/* CẮT ĐOẠN clip giờ làm NGAY TRÊN KHỐI b-roll ở dải thời gian (kéo
                  mép trái/phải = chọn đoạn, kéo thân = đặt chỗ) — không còn thanh
                  riêng ở đây. */}
            </Field>
          )}
          {/*
           * BA TRỤC CỦA KHUNG — phần chỉnh được TRONG một bố cục.
           *
           * Mười hai bố cục vốn là tổ hợp của đúng mấy trục này (`vuong-ngang` và
           * `ngang-vuong` chỉ hoán vị trên–dưới, `broll-full` và `broll-fit` chỉ
           * khác cách vừa khung). Hỏi bằng ba câu dễ thì người dùng trả lời được;
           * bày mười hai cái tên thì họ phải đoán.
           *
           * Đây đều là trục NỘI DUNG — hình dạng ô, ảnh lọt vào ô thế nào, ô nào
           * trên. Màu/viền/nền vẫn thuộc bộ dáng và KHÔNG mở ra ở đây, vì đó mới
           * là thứ giữ cho mọi video cùng một phong cách còn giống nhau.
           */}
          {is2o && (
            <>
              <Field>
                <FieldLabel>Hình ô</FieldLabel>
                {/* Các trục là lựa chọn CHỮ nên dùng ToggleGroup, không dùng thẻ
                    9:16 của picker khung: thẻ ấy tồn tại để chứa SƠ ĐỒ, còn ở đây
                    nó chỉ là một ô cao trăm pixel đựng hai chữ — tốn hết chiều cao
                    của bảng, mà bảng thì đang phải chứa bốn trục. */}
                <ToggleGroup
                  value={[opts?.aspect ?? "auto"]}
                  onValueChange={(next) => {
                    const id = next[0];
                    if (!id) return;
                    void editor.setLayoutOptions(elementId, {
                      ...opts,
                      aspect: id === "auto" ? null : id,
                    });
                  }}
                >
                  <ToggleGroupItem value="auto">Theo tư liệu</ToggleGroupItem>
                  <ToggleGroupItem value="doc">Dọc</ToggleGroupItem>
                  <ToggleGroupItem value="vuong">Vuông</ToggleGroupItem>
                  <ToggleGroupItem value="ngang">Ngang</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <Field>
                <FieldLabel>Tư liệu trong ô</FieldLabel>
                <ToggleGroup
                  value={[opts?.fit ?? "cover"]}
                  onValueChange={(next) => {
                    const id = next[0];
                    if (!id) return;
                    void editor.setLayoutOptions(elementId, { ...opts, fit: id });
                  }}
                >
                  <ToggleGroupItem value="cover">Phủ kín ô</ToggleGroupItem>
                  <ToggleGroupItem value="contain">Lọt trọn</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              {/* CHỖ ĐỨNG chỉ có nghĩa khi ô KHÔNG phủ kín khung: ô phủ kín thì
                  dời lên hay xuống cũng vẫn phủ kín, công tắc thành nút chết. */}
              {findLayout(layout).slots.some((slot) => slot.areaShare < 1) && (
                <Field>
                  <FieldLabel>Chỗ đứng</FieldLabel>
                  <ToggleGroup
                    value={[opts?.place ?? "auto"]}
                    onValueChange={(next) => {
                      const id = next[0];
                      if (!id) return;
                      void editor.setLayoutOptions(elementId, {
                        ...opts,
                        place: id === "auto" ? null : id,
                      });
                    }}
                  >
                    <ToggleGroupItem value="auto">Theo khung</ToggleGroupItem>
                    <ToggleGroupItem value="tren">Trên</ToggleGroupItem>
                    <ToggleGroupItem value="giua">Giữa</ToggleGroupItem>
                    <ToggleGroupItem value="duoi">Dưới</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              )}
              {/* Đảo chỗ chỉ có nghĩa khi khung THẬT SỰ có hai ô — bố cục một ô
                  thì công tắc này không đổi được gì, bày ra là bày một nút chết. */}
              {findLayout(layout).slots.length === 2 && (
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="swap-slots">Đảo trên · dưới</FieldLabel>
                  <Switch
                    id="swap-slots"
                    checked={opts?.swap ?? false}
                    onCheckedChange={(on) =>
                      void editor.setLayoutOptions(elementId, {
                        ...opts,
                        swap: Boolean(on),
                      })
                    }
                  />
                </Field>
              )}
            </>
          )}
          {/* GIỮ TIẾNG — chỉ hiện với tư liệu là VIDEO: ảnh không có tiếng để giữ,
              bày công tắc chết ở đó chỉ tổ làm người dùng đi tìm xem nó hỏng ở đâu. */}
          {is2o && media?.isVideo && (
            <Field orientation="horizontal">
              <FieldLabel htmlFor="keep-audio">Giữ tiếng tư liệu</FieldLabel>
              <Switch
                id="keep-audio"
                checked={media.keepAudio ?? false}
                onCheckedChange={(on) =>
                  void editor.setInsertKeepAudio(elementId, Boolean(on))
                }
              />
            </Field>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            void (media
              ? editor.deleteElement(elementId)
              : editor.deleteSegment(elementId))
          }
        >
          <Trash2Icon data-icon="inline-start" />
          Bỏ khung
        </Button>
      </CardFooter>

      {/* Modal chọn KIỂU KHUNG — lưới nhiều dòng, có chỗ cho danh sách dài. */}
      <Dialog open={frameOpen} onOpenChange={setFrameOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chọn kiểu khung</DialogTitle>
          </DialogHeader>
          {/* NHÓM theo preset (style dự án lên đầu), khung đang dùng TÔ SÁNG. Nhặt
              khung nào cũng được, look preset của nó đóng dấu theo cảnh (trộn được
              Phấn nền vàng với Nhịp-đen nền caro trong cùng video). */}
          <div className="grid max-h-[70vh] gap-4 overflow-y-auto pt-1 no-scrollbar">
            {/* Toàn khung + Khung mờ — dùng chung mọi phong cách (người phủ kín,
                nền che). "Khung mờ" = người defocus, chữ nổi trên. */}
            <Field>
              <FieldLabel>Chung</FieldLabel>
              <OptionPicker
                variant="grid"
                options={[
                  {
                    id: toanKhungId,
                    label: "Toàn khung",
                    diagram: { layout: "toan-khung" },
                  },
                  {
                    id: khungMoId,
                    label: "Khung mờ",
                    diagram: { layout: "toan-khung" },
                  },
                ]}
                value={isBlur ? khungMoId : isToanKhung ? toanKhungId : null}
                onSelect={onPick}
              />
            </Field>
            {frameGroups.map((group) => (
              <Field key={group.id}>
                <FieldLabel>{group.label}</FieldLabel>
                <OptionPicker
                  variant="grid"
                  // SƠ ĐỒ Ô thay cho tên: người dùng chọn bằng hình dạng nhìn ra
                  // được, tên chỉ còn để gọi lại về sau. Vẽ từ chính `slotPixels`
                  // nên không có bản thứ hai để lệch với bản dựng.
                  options={group.items.map((opt) => ({
                    id: opt.id,
                    label: FAMILY_LABEL[layoutFamily(opt.layout)] ?? opt.label,
                    diagram: { layout: opt.layout },
                  }))}
                  value={currentBlockId}
                  onSelect={onPick}
                />
              </Field>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Hộp tư liệu — cho hàng "Tư liệu" (chọn/đổi). Gắn tư liệu vào chính khung
          này (placeholder → b-roll), không tạo khung mới. */}
      <MediaPickerDialog
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        title={media ? "Đổi tư liệu" : "Chọn tư liệu"}
        projectItems={editor.insertLibrary.map(pickerItemFromApiFile)}
        alreadyIn={editor.insertLibrary
          .map((file) => file.library_file)
          .filter((file): file is string => !!file)}
        onUse={(fileId) => {
          setMediaOpen(false);
          void editor.setSegmentMedia(elementId, fileId);
          replay();
        }}
        useLabel="Dùng tệp này"
        onTake={(files) => editor.addAssetsFromLibrary(files)}
        takeLabel="Lấy về dự án"
        onUpload={(files) => void editor.addMedia(files)}
        uploading={editor.uploadingMedia}
        defaultTab={editor.insertLibrary.length === 0 ? "library" : "project"}
      />
    </Card>
  );
}
