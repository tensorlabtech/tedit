import {
  ChevronDownIcon,
  ChevronUpIcon,
  MergeIcon,
  SplitIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  BANDS,
  EMPHASES,
  type BandId,
  type EmphasisId,
} from "@/dev/overlays/overlay-model";
import {
  applyFontStyle,
  findStylePack,
} from "../../../server/style-pack-catalog";

import { formatTime, type TextElement } from "./editor-data";
import { BandRow } from "./inspector-text-axis-rows";
import { TextOverrideRows } from "./inspector-text-override-rows";
import { OptionPicker } from "./option-picker";
import type { EditorState } from "./use-editor";

/**
 * Bảng sửa MỘT chữ trên màn.
 *
 * Bản trước bày cả bốn trục ngang hàng nhau (dáng, căn ngang, chỗ đặt, từ khoá),
 * mỗi trục một nhãn và một câu tả: 55 từ, 20 nút, cao 666px cho một chữ. Đếm trên
 * chính kho dữ liệu của dự án (189 chữ), 179 chữ y nguyên mặc định — bảng đang dồn
 * hết diện tích cho thứ gần như không ai đụng.
 *
 * Nay CỠ CHỮ, CĂN NGANG, KIỂU CHỮ đều do PHONG CÁCH quyết: mỗi bộ một dáng, chữ
 * trong bộ đồng đều, người dùng không chỉnh từng cụm. Bảng chỉ còn hai thứ người
 * ta thật sự đổi cho RIÊNG một cụm:
 *
 * · NỘI DUNG — thứ luôn được dùng, đứng đầu.
 * · CHỖ ĐẶT — trên/giữa/dưới, bày bằng HÌNH nên không cần câu tả.
 * · TỪ NHẤN — chọn tiếng nào đổi màu, rồi chọn màu.
 *
 * Ít trục hơn = nhìn một cái là xong.
 */
const BAND_LABEL: Record<string, string> = Object.fromEntries(
  BANDS.map((band) => [band.id, band.label]),
);

/** Lùi trước khi chạy, để mắt kịp bắt nhịp trước khi chữ bắt đầu hiện. */
const LEAD_IN = 0.2;
/** Chạy thêm một nhịp sau khi chữ hết, cho thấy nó tắt đi thế nào. */
const TAIL = 0.3;

export function TextPane({
  editor,
  element,
  onPreview,
}: {
  editor: EditorState;
  element: TextElement;
  onPreview: (at: number, until?: number) => void;
}) {
  /**
   * Đổi một lựa chọn là CHẠY THỬ ngay đúng cụm chữ này.
   *
   * Chỉ chạy khi ĐỔI LỰA CHỌN, không chạy khi vừa chọn cụm chữ — khác với hiệu
   * ứng. Hiệu ứng thì chọn vào là để xem nó động; còn cụm chữ thì phần lớn lần
   * chọn là để SỬA CHỮ, tự chạy mỗi lần là phiền.
   *
   * Chữ hiện ra theo TỪNG TIẾNG, nên đổi chỗ đặt hay đổi màu từ nhấn đều đáng xem
   * lại: cái đổi chỗ chúng bay tới, cái đổi màu tiếng được nhấn.
   */
  const playPreview = () =>
    onPreview(element.start - LEAD_IN, element.end + TAIL);

  // Bộ dáng của dự án ĐÃ áp phong cách chữ mặc định — nền để tính dáng chữ hiệu
  // lực cho cụm này. Phong cách chữ per-cụm (`element.fontStyle`) đè tiếp lên nền
  // này; trục chọn nó bày ở dưới ("Phong cách chữ").
  const projectPack = applyFontStyle(
    findStylePack(editor.stylePack),
    editor.fontStyle,
  );
  const elementPack = applyFontStyle(projectPack, element.fontStyle);
  // Phong cách chữ HIỆU LỰC của cụm — thứ "Áp cho tất cả" phát ra cả video.
  const effectiveFont = element.fontStyle ?? editor.fontStyle;
  const effectiveFontLabel = effectiveFont
    ? findStylePack(effectiveFont).label
    : "bộ chính";

  // PHONG CÁCH CHỮ per-cụm — text-look (font/HOA-thường/màu/viền/quầng) là trục
  // BÌNH ĐẲNG: mượn được của MỌI style, không khoá theo style video. Style của dự
  // án chỉ là GỢI Ý mặc định (nhóm lên đầu). Cụm chưa đặt riêng thì theo style dự
  // án — nên "đang chọn" rơi về `editor.stylePack`, và chọn đúng nó = trả về `null`
  // (kế thừa mặc định) thay vì ghim cứng.
  // POOL LOOK CHỮ — mọi preset, phẳng và bình đẳng. Nhặt block nào thì look chữ
  // (font/HOA/màu/glow/hộp) ĐÓNG DẤU vào cụm (`caption_block`), nên một video trộn
  // được chữ Phấn (nét tay) với chữ Nhịp-đen (đậm đặc) tuỳ cụm. Không đọc bộ dáng.
  const captionBlocks = editor.sceneLayout?.captionBlocks ?? [];
  // "Đang chọn": cụm chưa đặt riêng → theo preset dự án; đã đặt → khớp block theo
  // font tiếng nói (đủ để phân biệt preset). Chọn đúng preset dự án = trả `null`
  // (kế thừa mặc định, generate/migration stamp lại) thay vì ghim cứng.
  const currentCaptionBlock = element.captionBlock
    ? // Đã đặt riêng → tô ĐÚNG theo preset LOOK đã đóng dấu (`captionPreset`); thiếu
      // dấu (cụm cũ) thì lùi về so khớp font tiếng nói cho gần đúng.
      (element.captionPreset ??
      captionBlocks.find(
        (b) =>
          b.captionLook.fonts.voice.file ===
          element.captionBlock?.fonts.voice.file,
      )?.id ??
      null)
    : editor.stylePack;
  const pickCaptionBlock = (id: string) => {
    const block = captionBlocks.find((b) => b.id === id);
    if (!block) return;
    const inherit = id === editor.stylePack; // chọn đúng preset dự án = kế thừa mặc định.
    editor.updateTextElement(element.id, {
      captionBlock: inherit ? null : block.captionLook,
      captionPreset: inherit ? null : id, // đóng dấu preset LOOK để tô ĐÚNG khi trộn.
    });
    playPreview();
  };
  // Nhãn phong cách ĐANG CHỌN cho thẻ gọn — theo block đã đóng dấu, lùi về nhãn
  // hiệu lực (preset dự án) nếu cụm chưa đặt riêng.
  const currentStyleLabel =
    captionBlocks.find((b) => b.id === currentCaptionBlock)?.presetLabel ??
    effectiveFontLabel;
  const [styleOpen, setStyleOpen] = useState(false);

  const from = editor.wordsById.get(element.fromWordId);
  const deChong = editor.deLenNhau(element);
  // Chỉ chữ CHẠY THEO LỜI mới gộp được, và phải còn cụm nào ở sau nó: chữ tự do
  // neo theo giây, nhập nó với một cụm neo theo từ là trộn hai kiểu neo.
  const hasNextGroup =
    !element.byTime &&
    editor.textElements.some(
      (item) => !item.byTime && item.start >= element.end - 0.001,
    );
  const syllable = element.content.trim().split(/\s+/).filter(Boolean);
  /**
   * Chữ này còn KHỚP LỜI hay đã viết lại — và nói ra.
   *
   * Luật của máy chủ: sửa một cụm mà số tiếng vẫn khớp khoảng từ nó neo vào thì
   * lời chép bên dưới đổi theo, và chữ hiện ra theo mốc nói THẬT. Số tiếng lệch
   * đi thì lời chép giữ nguyên thứ người ta đã nói, còn chữ rải đều trong đúng
   * khoảng của cụm.
   *
   * Luật ấy đúng nhưng ẩn hoàn toàn: người dùng gõ "TensorLab" xong không biết
   * lời chép bên dưới vẫn còn "Tenso" và "Lab", cũng không biết nhịp chữ vừa
   * chuyển từ mốc thật sang rải đều. Một dòng là đủ nói.
   */
  const spokenWords = element.byTime
    ? 0
    : editor.words.filter(
        (word) =>
          word.start >= element.start - 0.01 && word.end <= element.end + 0.01,
      ).length;
  const matchesSpeech = !element.byTime && spokenWords === syllable.length;
  // Tách được khi cụm phủ từ hai TỪ trở lên: mỗi nửa phải còn ít nhất một từ để
  // neo vào. Chữ tự do không tách — nó không neo vào từ nào.
  const canSplit = !element.byTime && spokenWords >= 2;

  return (
    <Card className="h-full min-h-0">
      <CardHeader>
        {/* Chữ neo vào đâu là thứ DUY NHẤT phân biệt hai loại chữ, và nó nói
            bằng sự thật chứ không bằng một cái tên loại. Trước đây nó là một
            dòng riêng dưới nhãn "Nội dung"; gộp lên tiêu đề thì bớt một dòng mà
            không mất chữ nào. */}
        <CardTitle>
          Chỉ cụm này
          <span className="ml-2 font-normal text-muted-foreground">
            {element.byTime
              ? `${formatTime(element.start)} → ${formatTime(element.end)}`
              : `câu ${from ? formatTime(from.start) : "?"}`}
          </span>
        </CardTitle>
        {/* Dời sang câu liền kề. Vạch ở đâu thì chữ gắn vào đó, mà lệch một câu
            là chuyện thường — không có hai nút này thì cách duy nhất để sửa là
            xoá rồi dựng lại. Chữ TỰ DO không có: nó không thuộc câu nào để dời,
            khoảng của nó đổi bằng cách kéo hai đầu trên dải. */}
        {!element.byTime && (
          <CardAction>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Dời sang câu trước"
              onClick={() => void editor.moveElement(element.id, -1)}
            >
              <ChevronUpIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Dời sang câu sau"
              onClick={() => void editor.moveElement(element.id, 1)}
            >
              <ChevronDownIcon />
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="min-h-0 flex-1">
        {/* Thanh cuộn OVERLAY (Radix — absolute, KHÔNG ăn bề ngang nên không cắt ô
            "Chỗ đặt") để người dùng THẤY là cuộn được; giữ thêm `scroll-fade-b` gợi
            còn nội dung bên dưới. Trước đây ẩn hẳn thanh, đọc ra "không scroll được". */}
        <ScrollArea className="h-full" viewportClassName="scroll-fade-b">
          <div className="grid gap-3 pr-1">
            {/* Gõ tới đâu khung xem đổi tới đó, nhưng CHỐT lúc rời ô: ghi nội
                dung là ghi ngược cả vào lời chép, mà gõ dở nửa chừng thì lời
                chép sẽ nhận đúng cái nửa chừng đó. */}
            <Textarea
              // Khoá gồm cả MÉP CUỐI của cụm, không chỉ mã của nó: gộp hai cụm
              // làm một thì mã giữ nguyên mà nội dung đổi, còn `defaultValue`
              // thì chỉ đọc một lần lúc dựng — ô nhập ở lại với lời cũ, và cú
              // rời ô sau đó ghi đè lời cũ ấy lên bản vừa gộp. Gõ bình thường
              // không đụng tới mép nên tiêu điểm vẫn yên.
              key={`${element.id}:${element.toWordId}`}
              aria-label="Nội dung chữ"
              // Chữ vừa đặt thì con trỏ nhảy thẳng vào ô. Ref chứ không
              // `autoFocus` — cú bấm ở nơi tạo giành tiêu điểm trước khi ô nhập
              // kịp dựng, nên `autoFocus` rơi vào khoảng không.
              ref={(node: HTMLTextAreaElement | null) => {
                if (node && element.content === "") node.focus();
              }}
              rows={1}
              // Chặn cao: ô nhập mặc định cao 72px cho một dòng, mà cả cột chỉ
              // dư đúng chừng ấy — thừa ra là nút "Tinh chỉnh" rơi khỏi tầm mắt.
              className="min-h-14"
              defaultValue={element.content}
              onChange={(event) =>
                editor.draftTextContent(element.id, event.target.value)
              }
              onBlur={(event) => {
                const clean = event.target.value.trim();
                if (clean) {
                  void editor.commitTextContent(element.id, clean);
                } else {
                  // Xoá trắng rồi rời ô: KHÔNG ghi chữ rỗng (mất cụm), nhưng phải
                  // LÙI cả ô nhập lẫn state/preview về nội dung cũ — không thì màn
                  // hình trống trong khi máy chủ vẫn giữ chữ, hai nơi nói ngược nhau.
                  event.target.value = element.content;
                  editor.draftTextContent(element.id, element.content);
                }
              }}
            />

            {/* CHỈ nói khi có chuyện đáng nói: chữ vừa gõ LỆCH số tiếng so với lời
                đã nói, nên nhịp chuyển từ mốc-thật sang rải-đều. Lúc còn khớp thì
                im — nói "vẫn khớp" mỗi cụm là tiếng ồn, không phải tin. */}
            {!element.byTime && !matchesSpeech && (
              <p className="-mt-1.5 text-xs text-muted-foreground">
                {`${syllable.length} tiếng cho ${spokenWords} từ đã nói · chữ rải đều trong khoảng`}
              </p>
            )}

            {/* Các trục đổi PER-CỤM: CHỖ ĐẶT, MÀU TỪ NHẤN, và PHONG CÁCH CHỮ.
                Cỡ chữ/căn ngang do phong cách quyết; còn text-look thì bình đẳng —
                cụm mượn được của style bất kỳ (trục "Phong cách chữ" dưới). */}
            <Field>
              <FieldLabel>Chỗ đặt</FieldLabel>
              <BandRow
                value={element.position as BandId}
                onChange={(next) => {
                  editor.updateTextElement(element.id, { position: next });
                  playPreview();
                }}
              />
            </Field>

            {/* Cảnh báo đứng NGAY DƯỚI thứ gây ra nó. */}
            {deChong.length > 0 && (
              <FieldDescription className="text-destructive">
                Đang đè lên “{deChong[0].content || "chữ trống"}”
                {deChong.length > 1 ? ` và ${deChong.length - 1} chữ nữa` : ""} —
                đổi dải hoặc rút ngắn lại
              </FieldDescription>
            )}

            {/* TỪ NHẤN: chọn tiếng nào đổi màu, rồi chọn màu. Chữ giữ nguyên cỡ
                (dáng "even" của phong cách), chỉ tiếng đánh dấu đổi MÀU. */}
            <Field>
              <FieldLabel>Từ nhấn</FieldLabel>
              <ToggleGroup
                multiple
                size="sm"
                className="flex-wrap"
                value={element.keywords}
                onValueChange={(value) =>
                  editor.updateTextElement(element.id, {
                    keywords: value as string[],
                  })
                }
              >
                {syllable.map((word, index) => (
                  <ToggleGroupItem key={`${word}-${index}`} value={word}>
                    {word}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>

            {/* KIỂU NHẤN — máy seed sẵn theo phong cách, người dùng đổi được.
                Cần vì hai kiểu (Từ khoá to / Xen cỡ) PHÓNG TO tiếng đã đánh dấu ở
                "Từ nhấn", còn hai kiểu kia (Đều nhau / Dẫn nhỏ) chỉ đổi MÀU — nên
                đánh dấu từ nhấn trên cụm "Dẫn nhỏ" trông như không ăn. Bày kiểu ra
                để người dùng biết vì sao, và tự đổi sang kiểu phóng-to nếu muốn. */}
            <Field>
              <FieldLabel>Kiểu nhấn</FieldLabel>
              <ToggleGroup
                size="sm"
                className="flex-wrap"
                // Base UI ToggleGroup: `value` LUÔN là mảng, kể cả chọn-một
                // (không `multiple`). Bọc kiểu hiện tại thành mảng một phần tử.
                value={[element.emphasis]}
                onValueChange={(value) => {
                  // Trả về mảng; chọn-một nên nhiều nhất một phần tử. Bấm lại nút
                  // đang chọn ra mảng RỖNG — giữ nguyên kiểu cũ (mọi cụm phải có
                  // một kiểu), không cho về rỗng.
                  const next = value[0] as EmphasisId | undefined;
                  if (!next) return;
                  editor.updateTextElement(element.id, { emphasis: next });
                  playPreview();
                }}
              >
                {EMPHASES.map((mode) => (
                  <ToggleGroupItem key={mode.id} value={mode.id}>
                    {mode.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription>
                {EMPHASES.find((mode) => mode.id === element.emphasis)?.note}
              </FieldDescription>
            </Field>

            {/* PHONG CÁCH CHỮ — text-look bình đẳng: mượn của MỌI style, không
                khoá theo style video. Bày GỌN (thẻ đang chọn + nút Đổi → modal
                lưới) y như picker khung: thẻ 9:16 của lưới CAO, đặt thẳng trong
                vùng cuộn thấp thì nhãn canh giữa bị mép cuộn xén; đưa vào modal là
                có chỗ, và đồng nhất với "Đổi khung". */}
            <Field>
              <FieldLabel>Phong cách chữ · {currentStyleLabel}</FieldLabel>
              <div className="flex items-stretch gap-3">
                <div className="grid aspect-[9/16] w-24 shrink-0 place-items-center overflow-hidden rounded-lg p-2 text-center inset-ring-1 inset-ring-border">
                  <span className="line-clamp-3 text-xs leading-tight">
                    {currentStyleLabel}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {currentStyleLabel}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    onClick={() => setStyleOpen(true)}
                  >
                    Đổi phong cách
                  </Button>
                </div>
              </div>
            </Field>

            <TextOverrideRows
              element={element}
              pack={elementPack}
              onChange={(patch) => {
                editor.updateTextElement(element.id, patch);
                playPreview();
              }}
            />
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter>
      {/* Lấy CHỖ ĐẶT của cụm này làm chỗ đặt chung.

          Chỗ đặt là trục layout duy nhất người dùng còn chỉnh cho riêng một cụm
          (cỡ chữ, căn ngang, kiểu chữ đã do phong cách quyết). Phần lớn cụm giữ
          nguyên mặc định — muốn dời hết xuống/lên là muốn đổi CẢ VIDEO, mà bảng
          chỉ sửa được một cụm nên việc đó là năm chục cú bấm y hệt.

          Ở CHÂN BẢNG chứ không trong vùng cuộn: đặt trong vùng cuộn thì nó rơi
          xuống dưới mép nhìn thấy, và một cái nút phải cuộn mới thấy thì coi như
          không có.

          Hỏi lại một lần vì nó đè lên mọi cụm, kể cả những cụm đã sửa tay; và
          nói rõ con số để người dùng biết mình vừa đổi bao nhiêu. */}
          {!element.byTime && editor.textElements.length > 1 && (
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button variant="secondary" size="sm" />}
              >
                <WandSparklesIcon data-icon="inline-start" />
                Áp cho tất cả
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>Áp cho tất cả?</AlertDialogTitle>
                <AlertDialogDescription>
                  Chỗ đặt ({BAND_LABEL[element.position] ?? element.position}) và
                  phong cách chữ ({effectiveFontLabel}) của cụm này sẽ thay cho
                  mọi cụm chữ chạy theo lời — kể cả những cụm bạn đã sửa riêng.
                  Chữ tự do (tiêu đề, con số) không đổi.
                </AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel>Thôi</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      void editor
                        .applyTextStyleToAll({
                          band: element.position,
                          fontStyle: effectiveFont,
                        })
                        .then((changed) => {
                          if (changed > 0) {
                            toast.add({
                              title: `Đã áp kiểu cho ${changed} cụm chữ`,
                              type: "success",
                            });
                          }
                        })
                    }
                  >
                    Áp cho tất cả
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        {/* Gộp đứng cạnh Xoá vì hai nút cùng trả lời một cảnh: cụm này không
            đứng một mình được. Một cái tên nước ngoài bị nghe thành hai tiếng
            rơi vào hai cụm thì sửa riêng từng cụm không bao giờ ghép lại được —
            phải nhập chúng làm một rồi mới gõ đúng tên. */}
        {hasNextGroup && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void editor.mergeTextWithNext(element.id)}
          >
            <MergeIcon data-icon="inline-start" />
            Gộp cụm sau
          </Button>
        )}
        {/* Tách đứng cạnh Gộp vì hai nút là một cặp: gộp mà không tách được thì
            cú gộp là một chiều — nhập hai cụm rồi thấy dài quá cũng không lùi
            được, ngoài một bước hoàn tác. Cụm dài còn sinh ra từ chỗ khác nữa:
            người dùng tự gõ thêm chữ vào một cụm ngắn. */}
        {canSplit && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void editor.splitTextElement(element.id)}
          >
            <SplitIcon data-icon="inline-start" />
            Tách cụm
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void editor.deleteElement(element.id)}
        >
          <Trash2Icon data-icon="inline-start" />
          Xoá chữ này
        </Button>
      </CardFooter>

      {/* Modal chọn PHONG CÁCH CHỮ — lưới nhiều dòng, có chỗ cho danh sách dài.
          POOL phẳng: mọi look chữ của mọi preset, nhãn là tên preset. Nhặt cái nào
          thì look chữ đóng dấu vào cụm — trộn được chữ Phấn với chữ Nhịp-đen. */}
      <Dialog open={styleOpen} onOpenChange={setStyleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chọn phong cách chữ</DialogTitle>
          </DialogHeader>
          <div className="pt-1">
            <OptionPicker
              variant="grid"
              options={captionBlocks.map((b) => ({
                id: b.id,
                label: b.presetLabel,
              }))}
              value={currentCaptionBlock}
              onSelect={(id) => {
                pickCaptionBlock(id);
                setStyleOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export type { EmphasisId };
