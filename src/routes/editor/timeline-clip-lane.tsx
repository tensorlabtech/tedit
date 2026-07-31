import { cn } from "@/lib/utils";

import type { Clip } from "./editor-data";
import { ClipWave, type AudioEnvelope } from "./timeline-audio-lane";
import type { Range } from "./timeline-ruler";
import type { Selection } from "./use-editor";

/**
 * Chiều cao phần KHUNG HÌNH của khối.
 *
 * 56 chứ không 44 như trước: dải chữ đè lên 16px trên cùng, nên ở 44 thì khung
 * hình chỉ còn 28px nhìn thấy — chữ che quá nửa. Ảnh sprite máy chủ dựng ở 88px
 * (2× của 44) nên vẽ ở 56 vẫn dưới cỡ gốc, không lên hạt.
 */
const LANE_HEIGHT = 56;


/**
 * Chiều cao dải sóng âm, nằm ngay dưới khung hình TRONG CÙNG một khối.
 *
 * Sóng là tiếng của CHÍNH đoạn phim ấy, không phải một lớp riêng để chọn hay
 * kéo — tách nó ra thành dải riêng là bịa ra hai vật cho một thứ, và ăn thêm
 * một khoảng hở giữa hai dải. Gộp vào thì một khối đọc ra đúng như bàn dựng nào
 * cũng vẽ: chữ đè trên, hình ở giữa, sóng ở đáy.
 */
const WAVE_HEIGHT = 16;

/**
 * Bề rộng một ô ảnh trên dải.
 *
 * Ô là đơn vị vẽ, KHÔNG phải đơn vị thời gian: mỗi ô lấy khung hình ở đúng giây
 * của mép trái nó, vẽ ở tỉ lệ gốc. Phóng to thì các ô lấy trùng khung của nhau,
 * thu nhỏ thì chúng nhảy cách quãng — đó là cách một dải phim thật cư xử.
 */
const CELL_WIDTH = 44;

/**
 * Dải ĐOẠN VIDEO — lớp dày nhất, mang ảnh phim nên không cần tô màu loại.
 */
type ClipView = Clip & {
  /** Giây của BẢN GỐC nơi đoạn này bắt đầu — dải ảnh lấy khung theo mốc đó */
  srcStart: number;
};

export function ClipLane({
  clips,
  pxPerSecond,
  range,
  selection,
  onSelect,
  stripUrl,
  stripSeconds,
  nativeSecondWidth,
  envelope,
}: {
  clips: ClipView[];
  pxPerSecond: number;
  range: Range;
  selection: Selection;
  onSelect: (id: string) => void;
  stripUrl?: string;
  /**
   * Số GIÂY mà tệp dải ảnh biểu diễn.
   *
   * Bề rộng ảnh chia cho nó ra "một giây rộng bao nhiêu điểm ảnh thật". Bản
   * trước ghi cứng 1000 giây trong khi ảnh chỉ dài bằng video, nên với video
   * một phút thì ảnh bị kéo giãn gần 20 lần — đó là chỗ "ảnh trên dải bị vỡ".
   */
  stripSeconds: number;
  /**
   * Thang GỐC của ảnh: một giây rộng bao nhiêu px khi ảnh cao đúng 44px.
   *
   * Vẽ cả dải ảnh bằng một hình nền kéo theo mức phóng thì zoom ra là ảnh tự
   * co lại còn một sợi chỉ giữa dải cao 44px — vì giữ tỉ lệ thì bề cao phải
   * co theo bề ngang. Nên ảnh luôn vẽ ở thang gốc này, còn mức phóng chỉ quyết
   * định các ô lấy khung nào.
   */
  nativeSecondWidth: number;
  /** Đường bao âm lượng để vẽ sóng ở đáy khối; `null` thì khối chỉ có hình */
  envelope: AudioEnvelope | null;
}) {
  return (
    <div
      className="relative"
      style={{ height: LANE_HEIGHT + WAVE_HEIGHT }}
    >
      {clips.map((clip) => {
        const width = (clip.end - clip.start) * pxPerSecond;
        const active = selection?.kind === "clip" && selection.id === clip.id;
        return (
          <button
            key={clip.id}
            type="button"
            data-block
            data-kind="clip"
            data-block-id={clip.id}
            tabIndex={-1}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onSelect(clip.id)}
            className={cn(
              // Viền vẽ VÀO TRONG — xem chú thích ở `timeline-block.tsx`.
              // Khối phim mang ảnh thật nên đây là chỗ BẮT BUỘC còn viền: tô nền
              // lên một khung hình thì không nhìn ra.
              "group/clip absolute top-0 h-full overflow-hidden rounded-lane bg-muted text-left inset-ring inset-ring-border",
              "hover:inset-ring-2 hover:inset-ring-primary/40",

            )}
            style={{
              left: clip.start * pxPerSecond + 1,
              width: Math.max(width - 2, 8),
            }}
          >
            {stripUrl ? (
              <span
                className="absolute inset-x-0 top-0 overflow-hidden"
                style={{ height: LANE_HEIGHT }}
              >
                <FilmCells
                  clip={clip}
                  pxPerSecond={pxPerSecond}
                  range={range}
                  stripUrl={stripUrl}
                  stripSeconds={stripSeconds}
                  nativeSecondWidth={nativeSecondWidth}
                />
              </span>
            ) : (
              // Chưa có dải ảnh (đang dựng, hoặc dựng hỏng): ô kẻ đều để khối
              // vẫn đọc ra là một đoạn phim, không phải một mảng trống.
              <span
                className="absolute inset-x-0 top-0 flex items-stretch"
                style={{ height: LANE_HEIGHT }}
              >
                {Array.from(
                  { length: Math.max(1, Math.round(width / CELL_WIDTH)) },
                  (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "flex-1 border-r border-border/60 last:border-r-0",
                        index % 2 === 0 ? "bg-card" : "bg-card/70",
                      )}
                    />
                  ),
                )}
              </span>
            )}
            {/* Nhãn chỉ hiện khi rê vào hoặc đang chọn: bảy chục đoạn mà đoạn
                nào cũng đeo nhãn thì dải phim thành một hàng chữ. Chữ của đoạn
                thì đã có dải chữ vẽ đè lên ngay phía trên. */}
            {/* Sóng âm: tầng đáy của chính khối này. */}
            <span
              // Nền ĐẶC, không nửa trong suốt: dải này nằm trên khung hình, mà
              // một lớp trong suốt đè lên hình đúng là lỗi vẽ đã phải gỡ ba lần
              // (§48). Nền đặc còn cho sóng một cái nền cố định để tương phản,
              // thay vì lúc rõ lúc chìm tuỳ khung hình bên dưới sáng hay tối.
              className="pointer-events-none absolute inset-x-0 bottom-0 bg-lane-text"
              style={{ height: WAVE_HEIGHT }}
            >
              {envelope && (
                <ClipWave
                  clip={clip}
                  envelope={envelope}
                  pxPerSecond={pxPerSecond}
                />
              )}
            </span>
            <span
              title={clip.label}
              className={cn(
                "pointer-events-none absolute inset-x-2 truncate text-xs text-white transition-opacity",
                active
                  ? "opacity-100"
                  : "opacity-0 group-hover/clip:opacity-100",
              )}
              style={{
                bottom: WAVE_HEIGHT + 4,
                textShadow: "0 1px 3px rgba(0,0,0,.85)",
              }}
            >
              {clip.label}
            </span>
            {/* Viền đang-chọn là LỚP PHỦ, vẽ trên cả dải ảnh phim lẫn nhãn —
                cùng luật với `TimelineBlock`, nhưng dải này tự vẽ khối nên phải
                nhắc lại. Mép trái/phải dày 4px để nói "kéo được".

                `z-30` là bắt buộc: dải chữ chép lời vẽ ĐÈ lên 16px trên cùng của
                dải phim ở lớp 20, nên nó che mất đúng cạnh TRÊN của viền — khối
                đang chọn hở một cạnh, mà chỉ hở ở những đoạn có lời. */}
            {active && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 z-30 rounded-[inherit] inset-ring-2 inset-ring-primary shadow-[inset_4px_0_0_0_var(--color-primary),inset_-4px_0_0_0_var(--color-primary)]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Các ô ảnh của MỘT đoạn, chỉ dựng phần đang nhìn thấy.
 *
 * Dựng cả đoạn thì ở mức phóng lớn một đoạn dài đẻ ra hàng nghìn thẻ, trong khi
 * màn hình chỉ chứa được vài chục.
 */
function FilmCells({
  clip,
  pxPerSecond,
  range,
  stripUrl,
  stripSeconds,
  nativeSecondWidth,
}: {
  clip: ClipView;
  pxPerSecond: number;
  range: Range;
  stripUrl: string;
  stripSeconds: number;
  nativeSecondWidth: number;
}) {
  // Lùi/tiến một ô ở hai đầu để lúc kéo dải không thấy mép ô trống chạy vào.
  const edge = CELL_WIDTH / pxPerSecond;
  const from = Math.max(clip.start, range.from - edge);
  const to = Math.min(clip.end, range.to + edge);
  const count = Math.max(
    0,
    Math.ceil(((to - from) * pxPerSecond) / CELL_WIDTH),
  );

  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const at = from + (index * CELL_WIDTH) / pxPerSecond;
        // Ô đặt theo mốc XUẤT RA, nhưng lấy khung theo mốc BẢN GỐC: một đoạn
        // giữ lại thì hai mốc chỉ lệch nhau một hằng số, nên cộng bù là xong.
        const source = clip.srcStart + (at - clip.start);
        return (
          <span
            key={index}
            className="absolute top-0 h-full bg-cover"
            style={{
              left: (at - clip.start) * pxPerSecond - 1,
              width: CELL_WIDTH,
              backgroundImage: `url(${stripUrl})`,
              // Ảnh vẽ ở thang gốc theo BỀ NGANG; bề cao lấy đúng cỡ khối để
              // lấp kín, và vì ảnh gốc cao 88px nên phóng lên 56px vẫn còn dư
              // điểm ảnh — không lên hạt.
              backgroundSize: `${stripSeconds * nativeSecondWidth}px ${LANE_HEIGHT}px`,
              backgroundPositionX: `${-source * nativeSecondWidth}px`,
              backgroundRepeat: "no-repeat",
            }}
          />
        );
      })}
    </>
  );
}
