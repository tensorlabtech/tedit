import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Một khối trên dải thời gian — lời chép, chữ đè, hay tư liệu chèn.
 *
 * MÀU nói loại lớp, không phải chữ trong khối. Ba dải xếp chồng nhau mà cùng
 * một sắc xám thì phải đọc nhãn mới biết đang nhìn lớp nào, trong khi lúc dựng
 * mắt chỉ lướt qua chứ không đọc. Bảng màu khai ở `--lane-*` trong `index.css`,
 * không đặt màu tại chỗ gọi.
 */
export type LaneTone = "word" | "text" | "insert" | "music" | "junction";

const TONE: Record<LaneTone, string> = {
  word: "bg-lane-word text-lane-word-foreground",
  text: "bg-lane-text text-lane-text-foreground",
  insert: "bg-lane-insert text-lane-insert-foreground",
  music: "bg-lane-music text-lane-music-foreground",
  junction: "bg-lane-junction text-lane-junction-foreground",
};

export function TimelineBlock({
  start,
  end,
  pxPerSecond,
  tone,
  blockId,
  active,
  trimmable,
  muted,
  minWidth = 6,
  title,
  className,
  style,
  onSelect,
  children,
}: {
  start: number;
  end: number;
  pxPerSecond: number;
  tone: LaneTone;
  /** Mã khối — bảng chuột phải đọc qua `data-block-id` */
  blockId: string;
  active?: boolean;
  /**
   * Khối này KÉO MÉP được — hai mép trái/phải dày lên để nói điều đó.
   *
   * Không phải khối nào đang chọn cũng kéo được: cụm lời chép lấy khoảng của
   * chính cụm từ nó neo vào, kéo ra khỏi cụm thì chữ không còn khớp tiếng nào.
   * Vẽ mép dày ở đó là hứa một việc không làm được.
   */
  trimmable?: boolean;
  /**
   * Mờ đi — khối vẫn bấm được, chỉ là nó chưa "thật".
   * Dùng cho hai thứ: đoạn nằm trong chỗ đã bỏ (vẽ ra để còn bấm lấy lại), và
   * hiệu ứng đang theo mặc định của dự án (chưa ai sửa riêng nó).
   */
  muted?: boolean;
  minWidth?: number;
  title?: string;
  className?: string;
  style?: CSSProperties;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      // `data-block` là dấu để dải biết cú bấm rơi vào khối hay rơi ra chỗ
      // trống — bấm ra chỗ trống thì bỏ chọn.
      data-block
      // Loại và mã của khối, để bảng chuột phải biết đang nhắm vào cái gì mà
      // bày đúng mục — không phải dò ngược từ toạ độ.
      data-kind={tone === "word" ? "clip" : tone}
      data-block-id={blockId}
      // Ngoài đường Tab: một video có hàng nghìn từ, để chúng trong đường Tab
      // thì bấm Tab cả buổi vẫn chưa ra khỏi dải. Chuột vẫn chọn được.
      tabIndex={-1}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onSelect}
      title={title}
      className={cn(
        "absolute top-0 flex h-full items-center overflow-hidden rounded-lane text-xs whitespace-nowrap",
        TONE[tone],
        // Viền vẽ VÀO TRONG: khung nhìn của dải cắt phần tràn, nên viền ngoài
        // của khối nằm sát mép màn bị gọt mất và khối đang chọn hở một cạnh.
        "hover:inset-ring-2 hover:inset-ring-primary/40",
        muted && "opacity-45",
        className,
      )}
      style={{
        left: start * pxPerSecond,
        width: Math.max((end - start) * pxPerSecond - 2, minWidth),
        ...style,
      }}
    >
      {children}
      {/* VIỀN ĐANG-CHỌN vẽ bằng một lớp phủ, KHÔNG bằng bóng đổ trên chính nút.
          `box-shadow: inset` vẽ trên nền nhưng DƯỚI nội dung — mà khối tư liệu
          chèn có một ảnh nhỏ 32px dán sát mép trái, nên nó che mất đúng cái mép
          dày ở đó. Lớp phủ là con CUỐI nên vẽ trên mọi thứ.
          `inset-0` + `rounded-[inherit]` khiến nó trùng khít khối từng pixel và
          dùng chung bán kính bo — vẫn không có chỗ nào cho khe len vào. */}
      {active && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] inset-ring-2 inset-ring-primary",
            trimmable &&
              "shadow-[inset_4px_0_0_0_var(--color-primary),inset_-4px_0_0_0_var(--color-primary)]",
          )}
        />
      )}
    </button>
  );
}
