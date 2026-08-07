import { memo, useMemo } from "react";

import type { Clip } from "./editor-data";

/**
 * Trần số cột cho MỘT đoạn — chỉ để một đoạn dài ở mức phóng lớn nhất không đẻ
 * ra hàng vạn thẻ. Đặt đủ cao để mức phóng thường ngày không bao giờ chạm tới,
 * nếu không thì phóng to mà sóng vẫn giữ nguyên độ chi tiết cũ.
 */
const MAX_BARS = 2000;

export type AudioEnvelope = {
  hop: number;
  values: number[];
  speechLevel: number;
};

type ClipView = Clip & {
  /** Giây của BẢN GỐC nơi đoạn này bắt đầu — sóng lấy theo mốc đó */
  srcStart: number;
};

/**
 * Sóng âm của MỘT đoạn — vẽ ở tầng đáy của chính khối phim đó.
 *
 * Đây là câu hỏi không lớp nào khác trả lời được: chỗ này có ai nói không, và
 * tiếng kéo tới đâu. Bản chép lời chỉ nói tới mốc TỪ, mà mốc từ của máy đóng
 * sớm hơn tiếng thật (đo được: đuôi tiếng còn kéo thêm 70ms trung vị, có chỗ
 * 380ms) — nhìn bảng Lời mà cắt là cắt mù.
 *
 * Nằm TRONG khối chứ không thành một dải riêng: sóng là tiếng của chính đoạn
 * phim ấy, không phải một lớp để chọn hay kéo. Vẽ theo GIỜ XUẤT RA như mọi thứ
 * khác, nên chỗ đã bỏ không để lại vệt nào.
 *
 * Mỗi cột lấy ĐỈNH của khoảng nó gộp, không lấy trung bình: trung bình làm
 * phẳng mọi tiếng bật và dải sóng chỉ còn là một cái gò.
 */
export const ClipWave = memo(function ClipWave({
  clip,
  envelope,
}: {
  clip: ClipView;
  envelope: AudioEnvelope;
}) {
  const length = clip.end - clip.start;

  // Gộp nhiều ô 20ms vào một cột và lấy ĐỈNH, không lấy trung bình: trung bình
  // làm phẳng mọi tiếng bật, và dải sóng chỉ còn là một cái gò.
  const bars = useMemo(() => {
    const from = Math.floor(clip.srcStart / envelope.hop);
    const to = Math.ceil((clip.srcStart + length) / envelope.hop);
    const samples = Math.max(1, to - from);
    // Số cột theo SỐ Ô ENVELOPE (một cột/20ms), KHÔNG theo pixel bề rộng: SVG dưới
    // đây `preserveAspectRatio=none` nên tự co giãn khi phóng. Trước đây `count`
    // phụ thuộc `width`: mỗi nấc phóng đổi bề rộng là vòng lấy đỉnh chạy lại + hàng
    // nghìn `<rect>` reconcile MỖI KHUNG → phóng dải GIẬT. Giờ cột cố định theo nội
    // dung nên `memo` (bọc ngoài) bỏ qua được cả khối lúc phóng. Trần `MAX_BARS`
    // chặn đoạn dài đẻ quá nhiều thẻ.
    const count = Math.max(1, Math.min(MAX_BARS, samples));
    const out: number[] = [];
    // Chia ĐỀU toàn bộ `samples` ô vào `count` cột bằng mốc PHÂN SỐ: cột i phủ
    // đúng [i/count, (i+1)/count] của đoạn nguồn. Nhờ vậy mỗi cột nằm đúng vị trí
    // giây của nó khi trải ra cả bề rộng khối.
    //
    // Bản cũ dùng `per = floor(samples/count)` (số nguyên): khi khối dài hơn ~40s
    // thì `samples > MAX_BARS`, `per*count` NHỎ HƠN `samples` — vòng chỉ đọc tới
    // ô thứ `per*count` rồi bỏ sót phần đuôi, MÀ `count` cột vẫn trải kín cả khối.
    // Hệ quả: sóng bị kéo giãn ~5% và cả đoạn tiếng vẽ TRỄ dần về cuối khối — có
    // chỗ lệch hơn một giây, thành ra "chỗ đang nói thì sóng phẳng, phần lặng ngay
    // trước đó lại bị đẩy vào đúng chỗ playhead".
    for (let i = 0; i < count; i += 1) {
      const lo = from + Math.floor((i * samples) / count);
      const hi = from + Math.floor(((i + 1) * samples) / count);
      let peak = 0;
      for (let j = lo; j < Math.max(lo + 1, hi); j += 1) {
        const value = envelope.values[j] ?? 0;
        if (value > peak) peak = value;
      }
      out.push(peak);
    }
    return out;
  }, [clip.srcStart, envelope, length]);

  return (
    <span className="block h-full w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${bars.length} 100`}
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden
      >
        {bars.map((value, index) => {
          // Mọc từ ĐÁY lên, không đối xứng quanh đường tim.
          //
          // Dải chỉ cao 16px: căn giữa thì mỗi bên còn 8px, và mọi tiếng to nhỏ
          // đều bẹp thành một vệt như nhau. Mọc từ đáy thì dùng trọn 16px, đọc
          // ra gấp đôi biên độ — cũng là lối các bàn dựng khác vẽ.
          //
          // Cao theo CĂN BẬC HAI của mức, không theo mức thẳng. Mức đã chuẩn
          // hoá theo đỉnh của cả bản, mà trung vị chỉ 0,095 — vẽ thẳng thì
          // quá nửa số cột cao chưa tới 2px và cả dải sóng bẹp thành một vạch.
          // Căn bậc hai kéo khoảng giữa lên (0,095 → 31%) mà vẫn giữ đúng thứ
          // tự to nhỏ; tai người cũng nghe độ to theo lối nén như vậy.
          const height = Math.max(4, Math.sqrt(value) * 100);
          return (
            <rect
              key={index}
              x={index + 0.2}
              y={100 - height}
              // Hở 40% bề rộng ô: kín quá thì cả dải thành một mảng đặc, mà
              // thứ cần đọc là NHỊP — chỗ nào dày, chỗ nào thưa.
              width={0.6}
              height={height}
              // Dưới ngưỡng nói thì nhạt hẳn đi: đó chính là chỗ cắt được mà
              // không mất tiếng ai.
              // Sóng lấy màu CHỮ của chính dải này (trắng trên nền sắc chủ
              // đạo), không lấy màu chữ của cả trang: nền dưới nó là một mảng
              // đặc màu, mà `foreground` thì đổi theo nền TRANG — ở chế độ sáng
              // nó ra đen trên nền tím, đọc như một vết bẩn.
              className={
                value > envelope.speechLevel
                  ? "fill-lane-text-foreground/85"
                  : "fill-lane-text-foreground/35"
              }
            />
          );
        })}
      </svg>
    </span>
  );
});
