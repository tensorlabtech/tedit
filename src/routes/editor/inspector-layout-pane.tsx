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

import { findLayout } from "../../../server/layout-kinds";
import { findStylePack } from "../../../server/style-pack-catalog";
import { formatTimeFine } from "./editor-data";
import { OptionPicker, type PickOption, swatchTextColor } from "./option-picker";
import type { EditorState } from "./use-editor";

/** Chạy thêm một nhịp mỗi đầu để thấy khung vào/ra thế nào. */
const PAD = 0.2;

/**
 * Tên theo CẤU TRÚC + THUỘC TÍNH, không theo 6 "kiểu" phẳng. Hai cấu trúc: 1 ô
 * (người) và 2 ô (người + tư liệu); còn lại là thuộc tính (vị trí, tỉ lệ ô).
 */
const KHUNG_LABEL: Record<string, string> = {
  "o-don": "1 ô · Trên",
  "o-lech": "1 ô · Dưới",
  "broll-don": "B-roll · Riêng",
  "hai-o": "2 ô · Đều",
  "vuong-ngang": "2 ô · Vuông trên",
  "ngang-vuong": "2 ô · Ngang trên",
};
const khungLabel = (id: string) => KHUNG_LABEL[id] ?? findLayout(id).label;

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
  /** Có tư liệu → khung 2 ô (b-roll). `null` → khung 1 ô (người). */
  media,
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
  media: { thumbUrl?: string; isVideo?: boolean; label?: string } | null;
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
  // Look của một block → swatch (nền + viền). Đây là cái làm Phấn (kem/vàng) nhìn
  // KHÁC HẲN Nhịp-đen (tối) ngay trên thẻ — không chỉ khác nhãn chữ.
  // Khung không khai `page` (nền) thì lùi về nền thẻ mặc định — vẫn hiện được viền.
  const swatchOf = (b: (typeof blocks)[number]) => ({
    bg: b.frameLook.page?.tone.color ?? "transparent",
    border: b.frameLook.subjectEdge?.tone.color ?? null,
  });
  const presetGroups = (() => {
    const by = new Map<string, { label: string; options: PickOption[] }>();
    for (const b of blocks) {
      const g = by.get(b.presetId) ?? { label: b.presetLabel, options: [] };
      g.options.push({
        id: b.id,
        label: khungLabel(b.layout),
        swatch: swatchOf(b),
      });
      by.set(b.presetId, g);
    }
    // "Chữ sau người" là một LOẠI khung của preset khai chữ-nền (Phấn) — bày chung
    // pool để thấy ĐỦ loại. Như b-roll có ô ẢNH, khung này có ô CHỮ. Nhặt nó không
    // đổi cấu trúc cảnh mà mở ô nhập chữ-nền (chữ mở màn của cả video). Swatch mượn
    // nền của preset ấy (từ một block cùng rổ) để thẻ ăn màu với các khung anh em.
    for (const p of behindPresets) {
      const g = by.get(p.id) ?? { label: p.label, options: [] };
      const kin = blocks.find((b) => b.presetId === p.id);
      g.options.push({
        id: `behindtext:${p.id}`,
        label: "Chữ sau người",
        swatch: kin ? swatchOf(kin) : undefined,
      });
      by.set(p.id, g);
    }
    return [...by.values()];
  })();
  // Khung ĐANG chọn của cảnh này — tô sáng đúng block đang mang look ấy: khớp cấu
  // trúc + đúng preset LOOK đã đóng dấu vào cảnh. Khi cảnh chưa trộn (chưa có
  // `framePreset`) thì lùi về preset dự án cho khớp.
  const lookPreset = framePreset ?? editor.stylePack;
  const currentBlock =
    blocks.find((b) => b.layout === layout && b.presetId === lookPreset) ?? null;
  const currentBlockId = currentBlock?.id ?? null;
  // Look cảnh đang mang — để thẻ "Kiểu khung" hiện đúng nền/viền của cảnh này.
  const currentSwatch = currentBlock ? swatchOf(currentBlock) : null;

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
      void editor.convertBrollToPerson(elementId, nextLayout); // 2 ô → 1 ô: gỡ tư liệu.
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
              <div className="relative grid aspect-[9/16] w-24 shrink-0 place-items-center overflow-hidden rounded-lg inset-ring-1 inset-ring-border p-2 text-center">
                {/* Nền + viền look của CHÍNH cảnh này (kem/vàng cho Phấn, tối cho
                    Nhịp-đen) — thấy ngay cảnh đang mang look nào. */}
                {currentSwatch && (
                  <span
                    aria-hidden
                    className="absolute inset-0"
                    style={{ backgroundColor: currentSwatch.bg }}
                  />
                )}
                {currentSwatch?.border && (
                  <span
                    aria-hidden
                    className="absolute inset-[3px] rounded-md border-2"
                    style={{ borderColor: currentSwatch.border }}
                  />
                )}
                <span
                  className="relative line-clamp-3 text-xs leading-tight"
                  style={
                    currentSwatch
                      ? { color: swatchTextColor(currentSwatch.bg) }
                      : undefined
                  }
                >
                  {khungLabel(layout)}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                <p className="truncate text-sm font-medium">
                  {khungLabel(layout)}
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
                    className="aspect-[9/16] w-24 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid aspect-[9/16] w-24 shrink-0 place-items-center rounded-lg bg-secondary">
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
          {/* MỌI khung của MỌI preset, phẳng — nhóm theo preset (cái rổ) chỉ để dễ
              ngắm; tiêu đề nhóm là tên preset, nên nhãn khung đọc ra "Phấn · 2-ô".
              Nhặt khung nào cũng được, look của nó đi theo cảnh. */}
          <div className="grid gap-4 pt-1">
            {presetGroups.map((group) => (
              <div key={group.label} className="grid gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {group.label}
                </p>
                <OptionPicker
                  variant="grid"
                  options={group.options}
                  value={currentBlockId}
                  onSelect={onPick}
                />
              </div>
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
