import { cn } from "@/lib/utils";

import { revealStyle } from "./use-reveal-loop";

/**
 * Khung 9:16 để bày thử overlay.
 *
 * Mọi số đo tính theo BỀ RỘNG khung, không dùng px cố định: bản in ra là
 * 1080×1920 còn khung này rộng chừng 200px, chỉ tỉ lệ mới so sánh được.
 */
export function OverlayFrame({
  children,
  className,
  showSafeArea = true,
  background,
}: {
  children?: React.ReactNode;
  className?: string;
  showSafeArea?: boolean;
  /** Đường dẫn video thật làm nền; thiếu thì dùng ảnh mẫu */
  background?: string | null;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-muted",
        className,
      )}
    >
      {/* Nền là VIDEO THẬT khi có dự án: chữ khổ lớn trên hình đang động đọc ra
          rất khác trên một khung đứng im, mà đây là màn để quyết định thẩm mỹ. */}
      {background ? (
        <video
          src={background}
          className="absolute inset-0 size-full object-cover"
          muted
          loop
          autoPlay
          playsInline
        />
      ) : (
        <img
          src="/dev-overlays/nen.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {showSafeArea && (
        // Dải an toàn 9:16: trên 10%, dưới 20%, trái 5%, phải 18%. Lề phải rộng
        // hơn vì cột nút của TikTok/Reels nằm bên đó.
        <div className="absolute inset-x-[5%] top-[10%] bottom-[20%] rounded-sm border border-dashed border-white/30" />
      )}
      {children}
    </div>
  );
}

/**
 * Trần số dòng của MỘT cụm chữ. Quá trần thì tách thành nhiều cụm hiện lần lượt,
 * không co chữ lại cho vừa.
 *
 * Vì sao 3: bốn dòng chữ khổ lớn đã chiếm hơn nửa khung dọc, và dòng thứ tư luôn
 * là dòng bị bẻ giữa từ — người xem đọc xong dòng bốn thì câu đã trôi qua. Trần
 * dòng là ràng buộc THAY CHO việc co chữ: co chữ thì mất phong cách, tách cụm thì
 * không mất gì ngoài việc chia thời gian.
 */
export const MAX_LINES = 3;

/**
 * Bề rộng trung bình một ký tự, tính theo cỡ chữ.
 *
 * 0.60 chứ không phải 0.52: đo trên bản nghiêng nét 800 — nghiêng đậm rộng hơn
 * đứng thường chừng 15%, và ước theo số nhỏ làm chữ bị bẻ dòng ngoài dự tính
 * (đúng lỗi "30 tuổi" tự tách hai dòng ở bậc thang).
 */
const CHAR_WIDTH = 0.6;

/**
 * Cỡ chữ suy ra từ DIỆN TÍCH muốn che, không phải từ % bề rộng.
 *
 * Đây là chỗ tôi làm sai suốt: đặt cỡ theo % bề rộng thì chữ ít ký tự vẫn bé —
 * "30 tuổi" ở 15% bề rộng chỉ che chừng 8% diện tích khung, không tạo được hiệu
 * ứng thị giác nào. Đặt theo diện tích thì chữ ngắn TỰ to lên.
 *
 * Suy ra: một dòng N ký tự rộng ≈ N × 0.60 × cỡ, cao ≈ 1.2 × cỡ, nên diện tích
 * ≈ N × 0.72 × cỡ². Cho bằng `coverage × W × H` rồi giải ra cỡ.
 */
export function scaleForCoverage(
  text: string,
  coverage: number,
  /** Số hàng mà cả KHỐI chữ chiếm — che diện tích là của khối, không của từng tiếng */
  rows = 1,
  aspect = 16 / 9,
  /** Số dòng cụm này được phép bẻ ra; 1 nghĩa là bắt buộc một dòng */
  maxLines = MAX_LINES,
  /** Phần bề rộng khung còn dùng được sau khi trừ lề và phần thụt */
  avail = 0.9,
) {
  const chars = Math.max(2, text.replace(/\s/g, "").length);
  // Chia cho số hàng: bản trước áp che cho TỪNG tiếng, nên năm tiếng xếp dọc là
  // 5 × 20% = che 100% khung và chữ tràn ra ngoài đáy.
  const share = coverage / Math.max(1, rows);
  const raw = Math.sqrt((share * aspect) / (chars * CHAR_WIDTH * 1.2));
  // Trần theo BỀ RỘNG: cỡ nào làm chuỗi dài hơn `maxLines` dòng thì không được
  // phép. Thiếu trần này thì công thức diện tích cứ thổi cỡ lên, còn trình bày
  // âm thầm bẻ thêm dòng — chữ vẫn "đúng diện tích" mà bố cục thì vỡ.
  const fitsLines = (maxLines * avail) / (chars * CHAR_WIDTH);
  // Chặn trên 24%: 34% làm một tiếng ngắn chiếm gần trọn bề ngang, đọc ra như
  // lỗi hơn là như thiết kế.
  return Math.min(0.24, raw, fitsLines);
}

/** Chữ in trên khung. Cỡ theo diện tích muốn che, hoặc theo tỉ lệ nếu chỉ định. */
export function FrameText({
  children,
  scale,
  coverage,
  text,
  rows = 1,
  singleLine = false,
  avail = 0.9,
  reveal,
  weight = 800,
  color = "#ffffff",
  style,
  className,
}: {
  children: React.ReactNode;
  /** Cỡ trực tiếp theo tỉ lệ bề rộng — chỉ dùng khi cần ép cứng */
  scale?: number;
  /** Phần diện tích khung mà khối chữ nên che, ví dụ 0.28 */
  coverage?: number;
  /** Chuỗi để đếm ký tự khi tính theo diện tích */
  text?: string;
  /** Số hàng của cả khối chữ — để chia phần diện tích cho đúng */
  rows?: number;
  /** Buộc nằm gọn MỘT dòng: cỡ tự hạ cho vừa, và cấm bẻ dòng */
  singleLine?: boolean;
  /**
   * Hiệu ứng hiện ra. Đặt ở đây chứ không ở nơi gọi vì HƯỚNG trượt suy từ CỠ chữ,
   * mà cỡ chỉ tính được bên trong này — nơi gọi tự tính lại là hai phép tính sẽ
   * lệch nhau lúc nào không biết.
   */
  reveal?: { seconds: number; order: number; word?: number };
  /** Bề rộng còn dùng được (0..1) — nơi gọi thụt lề thì phải trừ đi phần thụt */
  avail?: number;
  weight?: number;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const size =
    scale ??
    scaleForCoverage(
      text ?? (typeof children === "string" ? children : "aaaaaaaa"),
      coverage ?? 0.26,
      rows,
      16 / 9,
      singleLine ? 1 : MAX_LINES,
      avail,
    );
  return (
    <div
      className={cn("leading-tight", className)}
      style={{
        // Cấm bẻ dòng khi đã hạ cỡ cho vừa một dòng: nếu phép đo còn lệch thì
        // phải lộ ra bằng chữ chạm mép, chứ không được âm thầm thành hai dòng.
        whiteSpace: singleLine ? "nowrap" : undefined,
        fontSize: `${size * 100}cqw`,
        fontWeight: weight,
        color,
        // Nghiêng là MẶC ĐỊNH của hệ này, không phải lựa chọn: một khối đứng
        // thẳng toàn bộ đọc ra như phụ đề mặc định chứ không như thiết kế.
        // Nơi gọi muốn đứng thẳng thì phải nói rõ qua `style`.
        fontStyle: "italic",
        // Viền chữ thay cho đổ bóng: máy chủ dựng bằng `borderw` của drawtext,
        // đổ bóng mềm thì bản in ra không có.
        textShadow: `0 0 ${size * 12}cqw rgba(0,0,0,.9)`,
        ...(reveal
          ? revealStyle(reveal.seconds, reveal.order, size, reveal.word)
          : undefined),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
