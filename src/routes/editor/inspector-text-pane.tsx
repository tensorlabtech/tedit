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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { type BandId, type EmphasisId } from "@/dev/overlays/overlay-model";
import { findStylePack } from "../../../server/style-pack-catalog";

import { formatTime, type TextElement } from "./editor-data";
import { AlignRow, BandRow } from "./inspector-text-axis-rows";
import { TextOverrideRows } from "./inspector-text-override-rows";
import { TextShapeTiles } from "./inspector-text-shape-tiles";
import type { EditorState } from "./use-editor";

/**
 * Bảng sửa MỘT chữ trên màn.
 *
 * Bản trước bày cả bốn trục ngang hàng nhau, mỗi trục một nhãn và một câu tả:
 * 55 từ, 20 nút, cao 666px cho một chữ. Hơn nửa số từ là lời KỂ về lựa chọn chứ
 * không phải lựa chọn.
 *
 * Đếm trên chính kho dữ liệu của dự án (189 chữ) mới thấy bảng đang dồn hết
 * diện tích cho thứ gần như không ai đụng:
 *
 *   căn ngang  giữ `Giữa`          97,4%
 *   nhấn       giữ `Dẫn nhỏ · ý to` 97,9%
 *   dải dọc    giữ `Dưới`           96,3%
 *   từ khoá    không đánh dấu       97,9%
 *
 *   y nguyên mặc định 179/189 · đổi đúng MỘT trục 5 · đổi từ hai trục lên 4
 *
 * Nên chia lại theo tần suất chứ không theo sơ đồ dữ liệu:
 *
 * · NỘI DUNG — thứ luôn được dùng, đứng đầu, không đổi gì.
 * · DÁNG và CHỖ ĐẶT — hai thứ thỉnh thoảng đổi, bày ra nhưng bằng HÌNH: mỗi
 *   lựa chọn là một bản thu nhỏ thật, nên không còn câu tả nào.
 * · CĂN NGANG và TỪ KHOÁ — hai thứ dùng 2–3%, lui vào "Tinh chỉnh".
 */
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
   * Chữ hiện ra theo TỪNG TIẾNG, nên cả ba trục đều đáng xem lại: đổi dáng là
   * đổi cỡ từng tiếng, đổi dải hay đổi căn là đổi chỗ chúng bay tới.
   */
  const playPreview = () =>
    onPreview(element.start - LEAD_IN, element.end + TAIL);
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
  /**
   * Từ khoá CHỈ có nghĩa ở hai dáng.
   *
   * Đọc `buildRows` của `server/word-layout.ts`:
   * · `tu-khoa-to` — cụm đánh dấu là cụm được PHÓNG TO. Không đánh dấu thì nó
   *   bốc bừa tiếng đầu làm tâm.
   * · `xen-co`     — tiếng đánh dấu là tiếng TO. Không đánh dấu thì xen theo
   *   thứ tự chẵn lẻ.
   * · `deu` và `dan-nho` — tiếng đánh dấu chỉ đổi độ đặc từ 0,92 sang 1,0. Trên
   *   chữ trắng đè video, 8% độ đặc là không nhìn ra được.
   *
   * Trước đây tôi vẫn luôn bày hàng này, lý lẽ ghi trong mã là "tiếng đánh dấu
   * in đậm hơn". Đọc lại mã dựng thì không có chỗ nào đổi nét chữ — lý lẽ ấy
   * sai. Một hàng điều khiển không đổi được gì thì bày ra chỉ để lừa.
   */
  const usesKeywords =
    element.emphasis === "keyword-large" || element.emphasis === "mixed-size";

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
        {/* Không bày thanh cuộn — nó ăn ~12px bề ngang, đủ để ô thứ tư của hàng
            "Dáng" bị cắt cụt. `scroll-fade-b` che mờ mép dưới nên vẫn thấy được
            là bên dưới còn nữa, mà không tốn pixel nào. */}
        <ScrollArea
          className="h-full"
          scrollbar={false}
          viewportClassName="scroll-fade-b"
        >
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
                if (clean) void editor.commitTextContent(element.id, clean);
              }}
            />

            {/* Đứng ngay dưới ô nhập vì nó nói về chính thứ vừa gõ. */}
            {!element.byTime && (
              <p className="-mt-1.5 text-xs text-muted-foreground">
                {matchesSpeech
                  ? `${syllable.length} tiếng · khớp lời, chữ chạy theo nhịp nói thật`
                  : `${syllable.length} tiếng cho ${spokenWords} từ đã nói · chữ rải đều trong khoảng`}
              </p>
            )}

            <Field>
              <FieldLabel>Cách xếp chữ</FieldLabel>
              <TextShapeTiles
                text={element.content}
                align={element.align}
                keywords={element.keywords}
                value={element.emphasis}
                pack={findStylePack(editor.stylePack)}
                onChange={(next) => {
                  editor.updateTextElement(element.id, { emphasis: next });
                  playPreview();
                }}
              />
            </Field>

            {/* Ba trục còn lại chỉ cần ICON + NHÃN.
                "Dáng" phải vẽ ra vì hình dạng khối chữ không gọi tên gọn được.
                Còn "trên/giữa/dưới", "trái/giữa/phải" và một danh sách tiếng thì
                ai cũng có sẵn khái niệm trong đầu — bày ba khung 9:16 chỉ để nói
                "chữ ở trên" là dựng một bức tranh cho điều đọc một chữ là xong.
                Bỏ khung đi thì cả ba trục vừa đủ chỗ hiện thẳng, không phải giấu
                sau một lớp gập nữa. */}
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

            <Field>
              <FieldLabel>Căn ngang</FieldLabel>
              <AlignRow
                value={element.align}
                onChange={(next) => {
                  editor.updateTextElement(element.id, { align: next });
                  playPreview();
                }}
              />
            </Field>

            {/* Hai trục cụm này ĐÈ được, đặt sau ba trục bố cục: chúng là cách
                nhấn MỘT chỗ, nên chỉ có nghĩa khi đã xong phần bố cục. */}
            <TextOverrideRows
              element={element}
              pack={findStylePack(editor.stylePack)}
              onChange={(patch) => {
                editor.updateTextElement(element.id, patch);
                playPreview();
              }}
            />

            {/* Cảnh báo đứng NGAY DƯỚI thứ gây ra nó. Báo ở hàng "Cần bạn xem"
                cách nửa màn hình thì người dùng đổi dải, thấy không sao, đi tiếp
                — mười phút sau mới biết chữ đè chữ. */}
            {deChong.length > 0 && (
              <FieldDescription className="text-destructive">
                Đang đè lên “{deChong[0].content || "chữ trống"}”
                {deChong.length > 1 ? ` và ${deChong.length - 1} chữ nữa` : ""} —
                đổi dải hoặc rút ngắn lại
              </FieldDescription>
            )}

            {usesKeywords && (
            <Field>
              <FieldLabel>Từ khoá</FieldLabel>
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
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter>
      {/* Lấy kiểu của cụm này làm kiểu chung.

          Đo trên một dự án thật: 82% cụm giữ dáng mặc định, 88% giữ chỗ đặt,
          90% giữ căn ngang — người dùng không sửa từng cụm, họ muốn đổi phong
          cách CẢ VIDEO. Không có nút này thì việc đó là năm chục cú bấm y hệt.

          Ở CHÂN BẢNG chứ không trong vùng cuộn: đặt sau hàng "Căn ngang" thì
          nó rơi xuống dưới mép vùng nhìn thấy 43px, và một cái nút phải cuộn
          mới thấy thì coi như không có.

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
                <AlertDialogTitle>Áp cho tất cả chữ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Dáng, chỗ đặt và căn ngang của cụm này sẽ thay cho mọi cụm
                  chữ chạy theo lời — kể cả những cụm bạn đã sửa riêng. Chữ tự
                  do (tiêu đề, con số) không đổi.
                </AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel>Thôi</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      void editor
                        .applyTextStyleToAll({
                          band: element.position,
                          align: element.align,
                          emphasis: element.emphasis,
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
    </Card>
  );
}

export type { EmphasisId };
