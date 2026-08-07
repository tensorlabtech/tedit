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
import { FieldDescription } from "@/components/ui/field";

import { findLayout } from "../../../server/layout-kinds";

import { MusicInspector } from "./inspector-music";
import { EffectPane } from "./inspector-effect-pane";
import { InspectorHeadlinePane } from "./inspector-headline-pane";
import { TextPane } from "./inspector-text-pane";
import { LayoutKhungPane } from "./inspector-layout-pane";
import { demElement, type EditorState } from "./use-editor";

/**
 * Các trục CHUYỂN ĐỘNG — kiểu chỗ nối, cách tư liệu hiện ra — bày bằng CHỮ, không
 * icon, không ảnh xem trước.
 *
 * Ảnh xem trước không dựng được: một khung tĩnh làm "zoom vào" và "zoom ra" ra
 * cùng một hình. Icon cũng không hợp — một đời trước từng thử `—` `><` `<>` `⚡`
 * `○`, và ở cỡ nhỏ chúng đọc ra như ký tự bàn phím chứ không nói thêm được gì.
 *
 * Luật rút ra: icon chỉ có chỗ khi khái niệm VẼ RA ĐƯỢC (trên/giữa/dưới). Khái
 * niệm về CHUYỂN ĐỘNG hay THỜI GIAN thì để chữ nói. Và khi một trục có nhiều lựa
 * chọn (gần ba chục kiểu chỗ nối, sau này hàng trăm kiểu khung), bảng chỉ bày cái
 * ĐANG chọn + nút Đổi, cả danh sách nằm trong modal lưới — bày phẳng hết ra thì
 * vừa tràn mép vừa bắt người dùng đọc một dãy dài rồi so từng cái.
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
        <CardContent className="flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-y-auto no-scrollbar">
          {/* Thứ cấp DỰ ÁN sống ở đây: không chọn gì thì khung sửa nói về cả
              video, không nói về một phần tử. Bộ dáng nào không khai `title`
              thì pane này tự ẩn. */}
          <InspectorHeadlinePane editor={editor} />
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

  if (selection.kind === "scene") {
    const scene = editor.sceneLayout?.schedule.find(
      (item) => item.elementId === selection.id,
    );
    if (!scene?.elementId) return null;
    // Ô NGƯỜI = khung KHÔNG tư liệu. Mốc màn ở trục ĐÃ CẮT → quy về gốc cho chạy thử.
    return (
      <LayoutKhungPane
        key={selection.id}
        editor={editor}
        elementId={scene.elementId}
        layout={scene.layout}
        media={null}
        srcStart={editor.toSource(scene.start)}
        srcEnd={editor.toSource(scene.end)}
        outStart={scene.start}
        outEnd={scene.end}
        onPreview={onPreview}
      />
    );
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

  // B-ROLL = khung CÓ tư liệu (2 ô). Cùng bảng "Khung" với ô người — không còn
  // bảng riêng. Mốc của `editor.inserts` ở trục GỐC (theo từ) → quy sang trục đã
  // cắt cho tiêu đề/đặt tư liệu.
  const firstBroll = (editor.sceneLayout?.allowedLayouts ?? []).find((choice) =>
    findLayout(choice.id).needsInsert,
  )?.id;
  return (
    <LayoutKhungPane
      key={selection.id}
      editor={editor}
      elementId={item.id}
      layout={item.insertLayout ?? firstBroll ?? "hai-o"}
      media={{
        thumbUrl: item.thumbUrl ?? item.url,
        isVideo: item.isVideo,
        label: item.fullName ?? item.label,
      }}
      srcStart={item.start}
      srcEnd={item.end}
      outStart={editor.toOutput(item.start)}
      outEnd={editor.toOutput(item.end)}
      onPreview={onPreview}
    />
  );
}

/**
 * Bảng sửa cho một TỪ.
 *
 * Việc chính là SỬA, không phải xoá: máy nghe "chạm" thành "chọn" thì cần gõ lại
 * đúng chữ, còn xoá là mất luôn một từ khỏi lời nói.
 */
