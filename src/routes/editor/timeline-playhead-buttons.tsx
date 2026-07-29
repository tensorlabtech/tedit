import { useRef, useState } from "react";
import {
  FilmIcon,
  MusicIcon,
  PlusIcon,
  ScissorsIcon,
  SparklesIcon,
  TypeIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { InsertPicker } from "./insert-picker";
import { MIN_SEGMENT, type EditorState } from "./use-editor";

/**
 * Hai nút gắn vào VẠCH CHẠY: `+` ở đầu trên, kéo cắt ở đầu dưới.
 *
 * Bốn việc thêm-một-thứ vốn đã neo vào vạch từ trong ruột — `addTextAtPlayhead`,
 * `addEffectAtPlayhead`, `addInsertAtPlayhead`, và giờ cả nhạc; hộp chèn tư liệu
 * còn ghi thẳng "Chèn tư liệu vào 0:12". Chỉ có mấy cái NÚT là nằm tít trên thanh
 * công cụ, cách chỗ nó tác động cả trăm pixel. Đưa nút về đúng chỗ ấy thì bỏ được
 * cả hàng thanh công cụ.
 *
 * Việc này chỉ đúng vì vạch chạy GHIM CỨNG ở `left-1/2` — phim trôi, vạch đứng
 * yên. Nút gắn lên nó là một đích CỐ ĐỊNH trên màn, không thua nút thanh công cụ,
 * mà lại nằm ngay chỗ mắt đang nhìn. Cái kéo đã chứng minh điều đó (đặc tả §4).
 *
 * Trên/dưới không phải chọn bừa: `+` thêm vào các dải TRÊN (hiệu ứng, chữ, tư
 * liệu, nhạc), kéo chẻ dải phim ở DƯỚI. Nút nằm về phía thứ nó động vào.
 *
 * Cả hai đặt NGOÀI vùng cuộn của dải — vùng đó `overflow: hidden` nên nút thò ra
 * là bị xén. Chúng thò 12px vào phần đệm 20px của thẻ, nên vẫn nguyên vẹn.
 */
export function TimelinePlayheadButtons({ editor }: { editor: EditorState }) {
  const [moTuLieu, setMoTuLieu] = useState(false);
  const musicInputRef = useRef<HTMLInputElement>(null);

  const chuaCoLoi = editor.sentences.length === 0;
  /**
   * Đoạn mà vạch đang đứng trong — KHÔNG phải đoạn đang chọn.
   *
   * `splitAtPlayhead` chẻ theo GIỜ, máy chủ tự tìm đoạn chứa mốc ấy; nó chưa bao
   * giờ cần ai chọn trước. Cái kéo từng chỉ hiện khi có đoạn được chọn, nên
   * người dùng phải tự đoán ra mối liên hệ "chọn đoạn thì mới có kéo" — mà không
   * chỗ nào nói điều đó, và bản thân việc chẻ cũng không đòi hỏi.
   *
   * Giờ luôn hiện. Mờ đi khi vạch sát mép đoạn (máy chủ đòi mỗi nửa còn ít nhất
   * `MIN_SEGMENT`) và nhãn nói thẳng vì sao — một nút bấm được mà không làm gì
   * còn tệ hơn một nút mờ đi, nhưng một nút mờ mà không nói lý do cũng thế.
   */
  const doanTaiVach = editor.segments.find(
    (item) => editor.time >= item.start && editor.time < item.end,
  );
  const tachDuoc =
    !!doanTaiVach &&
    editor.time > doanTaiVach.start + MIN_SEGMENT &&
    editor.time < doanTaiVach.end - MIN_SEGMENT;

  return (
    <>
      <input
        ref={musicInputRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void editor.attachMusic(file);
          event.target.value = "";
        }}
      />
      <InsertPicker editor={editor} open={moTuLieu} onOpenChange={setMoTuLieu} />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-sm"
              disabled={chuaCoLoi}
              tooltipSide="top"
              aria-label={
                chuaCoLoi
                  ? "Chép lời xong mới thêm được"
                  : editor.selection?.kind === "clip"
                    ? "Thêm vào đoạn đang chọn"
                    : "Thêm vào chỗ vạch đang đứng"
              }
              // Nền ĐẶC kể cả lúc rê chuột. Kiểu `default` của hệ hạ xuống 80%
              // khi rê (`hover:bg-primary/80`) — mà ngay sau nút là vạch chạy,
              // nên phần trong suốt ấy để lộ vạch xuyên qua giữa nút.
              className="absolute -top-3 left-1/2 z-40 -translate-x-1/2 rounded-full shadow-md hover:bg-primary"
            />
          }
        >
          <PlusIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem onClick={() => void editor.addEffectAtPlayhead()}>
            <SparklesIcon />
            Thêm hiệu ứng
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void editor.addTextAtPlayhead()}>
            <TypeIcon />
            Thêm chữ
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={editor.uploadingMedia}
            onClick={() => setMoTuLieu(true)}
          >
            <FilmIcon />
            {editor.uploadingMedia ? "Đang tải lên…" : "Chèn tư liệu"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => musicInputRef.current?.click()}>
            <MusicIcon />
            Thêm nhạc
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="secondary"
        size="icon-sm"
        tooltipSide="bottom"
        disabled={chuaCoLoi || !tachDuoc}
        aria-label={
          tachDuoc
            ? "Tách đoạn tại vạch"
            : "Vạch đang sát mép đoạn — kéo sang giữa đoạn rồi tách"
        }
        // Khoá thì MỜ MỖI ICON, không mờ cả nút.
        //
        // `disabled:opacity-50` của hệ làm cả cái nút trong suốt một nửa,
        // mà ngay sau nó là VẠCH CHẠY — vạch lọt qua thân nút, đọc ra như
        // nút bị gạch ngang. Giữ nền đặc thì nút vẫn là một vật liền, chỉ
        // cái kéo nhạt đi để nói "chưa dùng được".
        className="absolute -bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full shadow-md disabled:opacity-100 disabled:[&_svg]:opacity-30"
        // TÁCH đoạn tại vạch, không cắt bỏ: tách rồi bỏ đoạn là hai bước nhìn
        // thấy được và lấy lại được, còn cắt thẳng thì mất luôn.
        onClick={() => void editor.splitAtPlayhead()}
      >
        <ScissorsIcon />
      </Button>
    </>
  );
}
