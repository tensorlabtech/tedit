import { Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  REVEALS,
  type RevealId,
} from "@/dev/overlays/overlay-model";

import { MusicInspector } from "./inspector-music";
import { EffectPane } from "./inspector-effect-pane";
import { InsertShapeTiles } from "./inspector-insert-shape-tiles";
import { TextPane } from "./inspector-text-pane";
import { demElement, type EditorState } from "./use-editor";

/**
 * Hai trục CHUYỂN ĐỘNG — chỗ nối và cách tư liệu hiện ra — chỉ có NHÃN, không
 * icon, không ô xem trước.
 *
 * Ô xem trước thì không dựng được: ảnh tĩnh làm "zoom vào" và "zoom ra" ra cùng
 * một hình.
 *
 * Icon thì tôi có thêm một đời — `—` `><` `<>` `⚡` `○` — và đó là quyết định
 * sai. Thêm vì hai hàng kia (Chỗ đặt, Căn ngang) có icon, tức vì ĐỐI XỨNG chứ
 * không vì chúng nói thêm được gì: `><` với `<>` ở cỡ 14px đọc ra như ký tự bàn
 * phím, còn `—` cho "Cắt thẳng" thì chỉ là một gạch ngang. Mà chúng ăn ~25px mỗi
 * nút, đủ để năm lựa chọn gãy thành 4+1 dòng — dải chọn xuống dòng là mất luôn
 * lợi thế "thấy hết cùng lúc", tức mất lý do dùng dải chọn.
 *
 * Luật rút ra: icon chỉ có chỗ khi khái niệm VẼ RA ĐƯỢC (trên/giữa/dưới,
 * trái/phải/bậc thang). Khái niệm về THỜI GIAN thì để chữ nói.
 */

export function InspectorPanel({
  editor,
  onPreview,
}: {
  editor: EditorState;
  /** Đưa vạch tới `at` (giây gốc) rồi cho chạy, dừng ở `denKhi` nếu có */
  onPreview: (at: number, until?: number) => void;
}) {
  const { selection } = editor;

  if (!selection) {
    return (
      <Card className="h-full min-h-0">
        {/* Trạng thái rỗng VẪN PHẢI CÓ TIÊU ĐỀ. Bỏ đầu thẻ đi thì đây là thẻ duy
            nhất trong ba cột không có mốc chữ ở trên, và cả cột thứ ba tụt lên
            so với hai cột kia — trong khi các nhánh khác của chính khung này
            ("Chữ trên màn", "Đoạn", "Nhạc nền") đều có. Không chọn gì cũng là
            một trạng thái, và tên của nó là "Chưa chọn gì". */}
        <CardHeader>
          <CardTitle>Chưa chọn gì</CardTitle>
        </CardHeader>
        {/* Lời mách phải CO ĐƯỢC: khối `Empty` cao cố định ~120px, mà ở màn 720px
            thẻ này chỉ được chia 110px nên nó tràn ra 10px. Dùng chữ thường, căn
            giữa, cho phép cuộn — giống cách hàng soát làm khi hết chỗ. */}
        <CardContent className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          {/* Dự án còn rỗng thì đừng bảo người ta bấm vào thứ chưa có. Lời mách
              phải nói bước TIẾP THEO của đúng trạng thái đang đứng. */}
          <p className="text-center text-sm text-muted-foreground">
            {editor.sentences.length === 0
              ? "Chép lời xong thì mỗi câu, mỗi khối trên dải đều bấm để sửa được"
              : "Bấm một câu, một khối trên dải, hay một chữ trên màn để sửa"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (selection.kind === "text") {
    const element = editor.textElements.find(
      (item) => item.id === selection.id,
    );
    if (!element) return null;
    return (
      <TextPane editor={editor} element={element} onPreview={onPreview} />
    );
  }

  if (selection.kind === "junction") {
    const junction = editor.effects.find((item) => item.id === selection.id);
    if (!junction) return null;
    return (
      <EffectPane
        key={junction.id}
        editor={editor}
        effect={junction}
        onPreview={onPreview}
      />
    );
  }

  if (selection.kind === "music") {
    const track = editor.music.find((item) => item.id === selection.id);
    if (!track) return null;
    return <MusicInspector key={track.id} track={track} editor={editor} />;
  }

  if (selection.kind === "clip") {
    const segment = editor.segments.find((item) => item.id === selection.id);
    if (!segment) return null;
    const heldCount = demElement(editor, segment.start, segment.end);
    return (
      <Card className="h-full min-h-0">
        <CardHeader>
          {/* Cùng phép thử với bảng chỗ nối: quãng KHÔNG đổi quyết định nào —
              khối đang chọn đã sáng lên trên dải nên vị trí là thứ mắt vừa thấy,
              con số chỉ xác nhận lại. Độ dài thì đổi: thấy đoạn dài quá là nghĩ
              tới chuyện chẻ đôi hay bỏ bớt. */}
          <CardTitle>Đoạn</CardTitle>
          <CardAction>
            <Badge variant={segment.removed ? "destructive" : "secondary"}>
              {segment.removed
                ? "không vào video"
                : `${(segment.end - segment.start).toFixed(1)} giây`}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex-1">
          <div className="grid gap-2">
            <p className="truncate text-sm">{segment.label}</p>
            {/* Bỏ câu "Bấm ✂ trên dải để tách đoạn này làm hai": cái kéo giờ
                LUÔN hiện ở đầu dưới vạch chạy, không còn phải chọn đoạn mới thấy
                — nên câu chỉ đường ấy nói về một hành vi không còn nữa.

                Chữ và tư liệu NEO VÀO TỪ, nên bỏ đoạn là chúng cũng mất. Câu này
                thì GIỮ, và chỉ hiện khi có thứ để mất: nói trước khi bấm, chứ
                mất im lặng thì mười phút sau người dùng mới biết. */}
            {!segment.removed && heldCount > 0 && (
              <FieldDescription>
                Đang giữ {heldCount} chữ/tư liệu — bỏ đoạn thì chúng cũng không
                vào video
              </FieldDescription>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void editor.toggleSegment(segment.id)}
          >
            {segment.removed ? "Giữ lại đoạn này" : "Bỏ đoạn này"}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const item = editor.inserts.find((insert) => insert.id === selection.id);
  if (!item) return null;

  /**
   * Đổi một lựa chọn là CHẠY THỬ ngay đúng khoảng tư liệu này.
   *
   * "Hiện ra" là chuyển động thuần; còn "Dáng khung" tuy là hình tĩnh nhưng nó
   * hiện ra CÙNG với chuyển động ấy, nên xem lại vẫn đáng.
   *
   * Chỉ chạy khi ĐỔI LỰA CHỌN, không chạy khi vừa chọn khối — cùng lý do với
   * bảng chữ.
   */
  const replay = () => onPreview(item.start - 0.2, item.end + 0.3);

  return (
    <Card className="h-full min-h-0">
      <CardHeader>
        {/* Không huy hiệu độ dài, không dòng tên tệp.
            Độ dài: đổi một lựa chọn là khối tự chạy thử, xem là biết dài ngắn.
            Tên tệp: khối trên dải đã mang ẢNH THẬT của nó, và khung xem đang
            chiếu chính nó — một dòng "Ảnh · personal-tracker" chỉ lặp lại bằng
            chữ thứ hai mắt đang nhìn. */}
        <CardTitle>Tư liệu chèn</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <div className="grid gap-3">
          <Field>
            <FieldLabel>Dáng khung</FieldLabel>
            {/* Bốn ô vẽ ra, thay cho câu tả dài nhất bảng này từng có:
                "Đè kín phủ toàn khung; ba dáng còn lại là một hộp thụt 8% mỗi
                bên, đặt ở 13% chiều cao". Câu ấy đọc ra một bức tranh bằng lời
                và bắt nhớ ba con số. */}
            <InsertShapeTiles
              value={item.shape}
              onChange={(next) => {
                editor.setInsertStyle(item.id, { shape: next });
                replay();
              }}
            />
          </Field>
          <Field>
            <FieldLabel>Hiện ra</FieldLabel>
            <ToggleGroup
              size="sm"
              className="flex-wrap"
              value={[item.reveal]}
              onValueChange={(value) => {
                const next = value[0] as RevealId | undefined;
                if (!next) return;
                editor.setInsertStyle(item.id, { reveal: next });
                replay();
              }}
            >
              {REVEALS.map((reveal) => (
                <ToggleGroupItem key={reveal.id} value={reveal.id}>
                  {reveal.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldDescription>
              {REVEALS.find((reveal) => reveal.id === item.reveal)?.note}
            </FieldDescription>
          </Field>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void editor.deleteElement(item.id)}
        >
          <Trash2Icon data-icon="inline-start" />
          Gỡ tư liệu này
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Bảng sửa cho một TỪ.
 *
 * Việc chính là SỬA, không phải xoá: máy nghe "chạm" thành "chọn" thì cần gõ lại
 * đúng chữ, còn xoá là mất luôn một từ khỏi lời nói.
 */
