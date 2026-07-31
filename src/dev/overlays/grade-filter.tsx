import { gradeChannels, type StylePack } from "../../../server/style-pack";

/**
 * NẮN MÀU ở trang xem — dựng bằng bộ lọc SVG để khớp ĐÚNG phép tính của ffmpeg.
 *
 * Vì sao không dùng `filter: brightness() contrast() saturate()` của CSS: không
 * hàm nào trong đó nhân RIÊNG từng kênh, mà ấm/lạnh chính là nhân riêng từng
 * kênh. Ép nó bằng `sepia()` thì trang xem và bản xuất ra hai màu khác nhau —
 * đúng lỗi "xem một đằng xuất một nẻo" mà cả hệ này chống.
 *
 * Ba nguyên thuỷ, đúng thứ tự của chuỗi ffmpeg (ba phép này KHÔNG giao hoán):
 *
 * | ffmpeg | ở đây |
 * |---|---|
 * | `colorchannelmixer=rr:gg:bb` | `feColorMatrix` đường chéo |
 * | `eq=contrast=C` | `feComponentTransfer` tuyến tính, dốc `C`, chặn `(1-C)/2` |
 * | `eq=saturation=S` | `feColorMatrix type="saturate"` |
 *
 * Còn một chỗ lệch đã biết và KHÔNG khép được ở tầng này: phép bão hoà của SVG
 * dùng hệ số sáng Rec.709, còn `eq` của ffmpeg làm trong không gian YUV Rec.601.
 * Sai khác chỉ lộ ở màu rất bão hoà; đã đo bằng
 * `scripts/style-packs/measure-grade-parity.py`.
 */
export function gradeFilterId(pack: StylePack) {
  return `grade-${pack.id}`;
}

/**
 * Khai bộ lọc cho MỘT bộ dáng. Đặt ở đâu trong cây DOM cũng được — `filter:
 * url(#id)` tra theo mã, không theo chỗ đứng.
 */
export function GradeFilterDefs({ pack }: { pack: StylePack }) {
  if (!pack.grade) return null;
  const gain = gradeChannels(pack.grade);
  const { contrast, saturation } = pack.grade;
  // Đúng công thức `eq=contrast` của ffmpeg: out = (in − 0,5)·C + 0,5.
  const intercept = (1 - contrast) / 2;

  return (
    <svg
      aria-hidden
      // Không chiếm chỗ trong bố cục: đây chỉ là một khai báo, không phải hình
      // để nhìn. `position: absolute` thôi thì nó vẫn ăn một dòng ở vài trình
      // bày, nên cắt hẳn cả bề rộng lẫn chiều cao.
      className="pointer-events-none absolute size-0"
    >
      <defs>
        <filter id={gradeFilterId(pack)} colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values={[
              gain.r, 0, 0, 0, 0,
              0, gain.g, 0, 0, 0,
              0, 0, gain.b, 0, 0,
              0, 0, 0, 1, 0,
            ].join(" ")}
          />
          <feComponentTransfer>
            <feFuncR type="linear" slope={contrast} intercept={intercept} />
            <feFuncG type="linear" slope={contrast} intercept={intercept} />
            <feFuncB type="linear" slope={contrast} intercept={intercept} />
          </feComponentTransfer>
          <feColorMatrix type="saturate" values={String(saturation)} />
        </filter>
      </defs>
    </svg>
  );
}

/** Giá trị `filter` cho thẻ hình/video; rỗng khi bộ dáng không nắn màu. */
export function gradeStyle(pack: StylePack): React.CSSProperties {
  return pack.grade ? { filter: `url(#${gradeFilterId(pack)})` } : {};
}
