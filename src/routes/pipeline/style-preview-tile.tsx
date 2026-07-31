import { describeStyleFeel, type StylePack } from "../../../server/style-pack";
import { GradeFilterDefs, gradeStyle } from "@/dev/overlays/grade-filter";
import { OverlayTextBlock } from "@/dev/overlays/overlay-render";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Ô mẫu MỘT bộ dáng — chữ thật, dựng bằng đúng bộ vẽ của khung xem.
 *
 * Dùng lại `OverlayTextBlock` chứ không vẽ riêng: đó là cùng một bộ máy với
 * `/_dev/overlays` và với khung xem trong bàn dựng, nên thấy sao thì xuất ra vậy.
 * Một bộ vẽ thứ hai chỉ dành riêng cho ô mẫu là một bản để lệch.
 */
/**
 * Hình mẫu của ô xem trước. Cố định để mười ô so được với nhau — đổi hình theo
 * bộ dáng thì người ta so hình chứ không so bộ dáng.
 */
const TILE_EMOJI = "🔥";

export function StylePreviewTile({
  pack,
  text,
  poster,
  selected,
  seconds,
  onSelect,
  onHoverChange,
}: {
  pack: StylePack;
  text: string;
  /**
   * Khung hình THẬT của video người dùng làm nền.
   *
   * Đây là khác biệt giữa "chọn phong cách" và "chọn font": chữ trắng trên nền
   * đen thì người dùng chỉ so được font, còn chữ đè lên chính khuôn mặt họ vừa
   * quay thì họ thấy được thứ sẽ ra. `null` thì rơi về nền tối — dự án cũ hoặc
   * chưa dựng xong chặng đầu.
   */
  poster: string | null;
  selected: boolean;
  /** Mốc của vòng lặp hiệu ứng. Số lớn nghĩa là đã hiện xong, đứng yên. */
  seconds: number;
  onSelect: () => void;
  onHoverChange: (hovering: boolean) => void;
}) {
  /*
   * Ô mẫu phải áp CẢ HAI trục phụ đề, không thì nó bày ra thứ người dùng sẽ
   * không nhận được:
   *
   * · CHIA CỤM xảy ra ở `buildCaptionGroups`, tức TRƯỚC bộ vẽ — nên bộ
   *   "Từng chữ" mà không cắt ở đây sẽ hiện nguyên cả câu.
   * · TÔ SÁNG cần mốc từng tiếng. Ô mẫu không có lời thật nên rải đều: đây là ô
   *   XEM TRƯỚC, rải đều là cách trung thực nhất để nói "nó sẽ chạy thế này".
   */
  const words = text.trim().split(/\s+/).filter(Boolean);
  const shownWords = words.slice(0, pack.grouping.maxWords);
  const shownText = shownWords.join(" ");
  const BEAT = 0.32;
  const wordStarts = shownWords.map((_, index) => index * BEAT);
  const span = shownWords.length * BEAT;
  // Bộ có tô sáng thì trạng thái tĩnh phải đứng GIỮA cụm, không thì vệt sáng đã
  // chạy qua hết và ô đọc ra y hệt bộ không tô sáng.
  const restingAt = pack.highlight ? span / 2 : seconds;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={pack.label}
            aria-pressed={selected}
            onClick={onSelect}
            onPointerEnter={() => onHoverChange(true)}
            onPointerLeave={() => onHoverChange(false)}
            onFocus={() => onHoverChange(true)}
            onBlur={() => onHoverChange(false)}
            className={cn(
              // Nền tối cố định khi chưa có khung hình: chữ overlay vẽ ra trắng
              // nên nền phải tối ở cả chủ đề sáng lẫn tối.
              //
              // Tỉ lệ 3:4 chứ không phải ô vuông: ô vuông đọc ra như một nút,
              // còn 3:4 đọc ra như một khung hình. Không lấy hẳn 9:16 vì mười ô
              // dọc thì thẻ cao gần gấp đôi danh sách chặng bên trên.
              // `w-full` KHÔNG thừa: gốc component là `Tooltip`, mà nó không dựng
              // thẻ DOM nào — nên nút này là con trực tiếp của nơi gọi. Trong
              // một hàng `flex` thì nó co theo nội dung và tụt về bề rộng 0.
              "relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-neutral-800",
              // Viền vẽ VÀO TRONG. Ô sát mép vùng cuộn thì viền ngoài bị gọt mất
              // một cạnh, và ô đầu/cuối trông khác các ô giữa mà không vì lý do gì.
              // Viền báo chọn KHÔNG vẽ ở đây nữa — xem lớp phủ ở cuối ô.
              !selected && "hover:inset-ring-2 hover:inset-ring-primary/40",
            )}
          />
        }
      >
        <GradeFilterDefs pack={pack} />
        {poster && (
          <img
            src={poster}
            alt=""
            className="absolute inset-0 size-full object-cover"
            // Ô mẫu phải nắn màu y như bản xuất: nếu không thì hai phong cách
            // khác nhau hẳn về màu HÌNH lại ra hai ô có nền giống hệt, và trục
            // mạnh nhất vừa thêm vào thành vô hình đúng ở màn để chọn nó.
            style={gradeStyle(pack)}
          />
        )}
        {/* Phủ tối nhẹ: khung hình sáng thì chữ trắng chìm mất, mà bản xuất thật
            có quầng tối sau chữ nên khung xem phải bù lại bằng một lớp tương tự. */}
        {poster && <div className="absolute inset-0 bg-black/35" />}
        {/*
         * Khung 9:16 THẬT nằm trong ô vuông, neo giữa.
         *
         * `@container` phải đặt ở ĐÂY chứ không ở nút: cỡ chữ đo bằng `cqw` —
         * phần trăm bề rộng vùng chứa — nên vùng chứa phải là thứ mang đúng tỉ
         * lệ khung hình. Đặt ở ô vuông thì cùng con số ấy ăn vào chiều cao gấp
         * gần hai lần đáng lẽ.
         *
         * Ô ngoài là 3:4 chứ không phải 9:16: mười ô dọc trong cột phải cao gần
         * gấp đôi danh sách chặng. Phần trên và dưới khung vốn trống vì khối chữ
         * neo giữa, nên xén chỗ trống không mất gì.
         */}
        <span className="@container absolute inset-x-0 top-1/2 block aspect-[9/16] -translate-y-1/2">
          <OverlayTextBlock
            config={{
              text: shownText,
              // BỐ CỤC THẬT của bộ dáng, không phải một bố cục chung cho mọi ô.
              //
              // Đây là thứ đổi nhiều nhất cảm giác của cả màn chọn: `defaults`
              // giờ khác nhau giữa các bộ, nên ô mẫu phải bày đúng thứ người
              // dùng sẽ nhận. Bày một bố cục chung cho tám ô là giấu đi trục dễ
              // nhận ra nhất — hình dạng khối chữ.
              align: pack.defaults.align,
              emphasis: pack.defaults.emphasis,
              band: "middle",
              // Một tiếng được đánh dấu để trục MÀU NHẤN nhìn ra được — đó là
              // trục tách các bộ dáng mạnh thứ hai sau font, mà cụm không có từ
              // khoá nào thì nó vô hình.
              keywords: shownWords.slice(-1),
              // Một hình MẪU cố định cho mọi ô: ô nào có emoji thì hiện, ô nào
              // tắt thì không. Nhờ vậy ba bộ nhóm "Gọn" nói ra được điều chúng
              // khác — mà nếu không bày thì trục này vô hình đúng ở màn chọn nó.
              emoji: TILE_EMOJI,
              insert: { kind: "none", shape: "wide" },
            }}
            pack={pack}
            wordStarts={wordStarts}
            span={span}
            seconds={restingAt}
          />
        </span>
        {/*
         * Viền báo ĐANG CHỌN nằm ở lớp trên cùng, không nằm trên chính cái nút.
         *
         * `inset-ring` vẽ vào nền của nút, mà ảnh khung hình và khối chữ đều là
         * con của nút và phủ kín nó — nên viền bị che sạch. Đo được: ô đang chọn
         * và ô không chọn ra ảnh giống hệt nhau, người dùng không biết mình đang
         * ở bộ nào.
         */}
        {selected && (
          <span className="pointer-events-none absolute inset-0 rounded-lg inset-ring-2 inset-ring-primary" />
        )}
        {/* TÊN nằm TRONG ô, góc phải dưới.
            Tên là thứ người dùng nhớ và gọi lại về sau ("dùng Sóng như video
            trước"), nên nó phải luôn hiện chứ không giấu trong tooltip. Nhưng
            để ngoài ô thì nó ăn thêm một dòng chiều cao cho cả hàng, mà dải này
            nằm trong thẻ có luật chiều cao bất biến.
            Góc phải dưới vì khối chữ mẫu neo GIỮA khung — chỗ ấy vốn trống.
            Nền tối sau chữ: khung hình sáng thì chữ trắng chìm mất. */}
        <span className="pointer-events-none absolute right-1.5 bottom-1.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-[oklch(0.145_0_0/70%)] px-1.5 py-0.5 text-xs text-[oklch(0.99_0_0)]">
          {pack.label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{describeStyleFeel(pack)}</TooltipContent>
    </Tooltip>
  );
}
