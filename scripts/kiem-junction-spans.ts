import { readFileSync } from "node:fs";

import { junctionHalves, JUNCTION_SPECS } from "../server/junction-kinds";
import { effectPeak } from "../server/render";

/**
 * Kiểm quãng hiệu ứng KHÔNG tràn ra ngoài video và KHÔNG chồng lên nhau.
 *
 * Công cụ này cắt im lặng, nên dải còn lại thường là một chuỗi đoạn ngắn. Hai
 * nửa của một kiểu êm dài tới 2,6 giây mỗi bên — dài hơn cả đoạn. Không kẹp thì
 * quãng đầu bắt đầu ở số âm (khung hình đầu tiên đã phóng dở) và các quãng chồng
 * lên nhau (hình không bao giờ trở lại tỉ lệ thật).
 *
 * Dựng lại đúng phép tính của `runExport` thay vì gọi nó: chặng ấy cần cả cơ sở
 * dữ liệu lẫn ffmpeg, mà thứ cần kiểm ở đây chỉ là số học.
 */

type Span = { start: number; end: number; peak: number };

function dungSpans(kept: Array<{ start: number; end: number }>, kind: string): Span[] {
  const [before, after] = junctionHalves(kind);
  const cutMarks: number[] = [];
  let running = 0;
  for (const range of kept.slice(0, -1)) {
    running += range.end - range.start;
    cutMarks.push(running);
  }
  const tong = kept.reduce((s, r) => s + (r.end - r.start), 0);

  const out: Span[] = [];
  for (const [index, cutAt] of cutMarks.entries()) {
    const sanTruoc = index > 0 ? (cutMarks[index - 1] + cutAt) / 2 : 0;
    const sanSau =
      index + 1 < cutMarks.length ? (cutAt + cutMarks[index + 1]) / 2 : tong;
    const coTruoc = before > 0 ? (cutAt - sanTruoc) / before : Infinity;
    const coSau = after > 0 ? (sanSau - cutAt) / after : Infinity;
    const co = Math.min(1, coTruoc, coSau);
    const start = cutAt - before * co;
    const end = cutAt + after * co;
    if (end - start > 0.1) {
      out.push({ start, end, peak: effectPeak(start, end, kind as never) });
    }
  }
  return out;
}

/** Các dải đáng nghi, tính cả những dải chỉ gặp ở ca biên. */
const DAI: Array<{ ten: string; kept: Array<{ start: number; end: number }> }> = [
  {
    ten: "bốn đoạn ngắn (ca thường sau khi cắt im lặng)",
    kept: [
      { start: 0, end: 1.0 }, { start: 1.0, end: 3.0 },
      { start: 3.0, end: 4.0 }, { start: 4.0, end: 9.0 },
    ],
  },
  {
    ten: "đoạn cực ngắn liên tiếp",
    kept: Array.from({ length: 8 }, (_, i) => ({ start: i * 0.4, end: (i + 1) * 0.4 })),
  },
  {
    ten: "một chỗ nối sát đầu video",
    kept: [{ start: 0, end: 0.3 }, { start: 0.3, end: 12 }],
  },
  {
    ten: "một chỗ nối sát cuối video",
    kept: [{ start: 0, end: 12 }, { start: 12, end: 12.3 }],
  },
  { ten: "không có chỗ nối nào", kept: [{ start: 0, end: 20 }] },
];

let dat = 0;
let truot = 0;

for (const { ten, kept } of DAI) {
  const tong = kept.reduce((s, r) => s + (r.end - r.start), 0);
  for (const spec of JUNCTION_SPECS) {
    if (spec.id === "none") continue;
    const spans = dungSpans(kept, spec.id);
    const loi: string[] = [];

    for (const s of spans) {
      if (s.start < -1e-6) loi.push(`bắt đầu ở ${s.start.toFixed(2)} (trước giây 0)`);
      if (s.end > tong + 1e-6) loi.push(`kết thúc ở ${s.end.toFixed(2)} (quá ${tong})`);
      if (s.peak < s.start - 1e-6 || s.peak > s.end + 1e-6)
        loi.push(`đỉnh ${s.peak.toFixed(2)} nằm ngoài quãng`);
    }
    for (let i = 1; i < spans.length; i++) {
      if (spans[i].start < spans[i - 1].end - 1e-6)
        loi.push(`quãng ${i} chồng lên quãng ${i - 1}`);
    }

    // Đỉnh phải rơi ĐÚNG vết cắt — đó là chỗ hình đứt, và cú nhấn đặt lệch khỏi
    // nó thì nhấn vào giữa một cảnh đang chạy liền mạch.
    const cutMarks: number[] = [];
    let running = 0;
    for (const r of kept.slice(0, -1)) { running += r.end - r.start; cutMarks.push(running); }
    for (const s of spans) {
      const gan = cutMarks.reduce((a, b) => (Math.abs(b - s.peak) < Math.abs(a - s.peak) ? b : a), Infinity);
      if (Math.abs(gan - s.peak) > 0.02)
        loi.push(`đỉnh ${s.peak.toFixed(2)} lệch khỏi vết cắt gần nhất ${gan.toFixed(2)}`);
    }

    if (loi.length > 0) {
      truot++;
      console.log(`✗ ${spec.id.padEnd(12)} · ${ten}`);
      for (const l of [...new Set(loi)]) console.log(`    ${l}`);
    } else {
      dat++;
    }
  }
}

/*
 * Mọi kiểu trong vốn từ phải được TẢ trong lời nhắc chọn hiệu ứng.
 *
 * Danh sách cho mô hình chọn lấy thẳng từ `JUNCTION_SPECS`, nên thêm một kiểu là
 * nó lập tức nằm trong enum. Nhưng mô hình gần như không bao giờ chọn thứ nó
 * không được tả — kiểu mới sẽ hợp lệ, có mặt, và không bao giờ được dùng. Đúng
 * chuyện đã xảy ra với `push-in` và `drift`.
 */
const loiNhac = readFileSync(
  new URL("../server/ai-effects.ts", import.meta.url),
  "utf8",
).split("const INSTRUCTIONS = `")[1]?.split("`;")[0] ?? "";
const chuaTa = JUNCTION_SPECS.filter(
  (spec) => spec.id !== "none" && !loiNhac.includes(spec.id),
);
if (chuaTa.length > 0) {
  truot++;
  console.log(`✗ lời nhắc chọn hiệu ứng chưa tả: ${chuaTa.map((s) => s.id).join(", ")}`);
} else {
  dat++;
}

console.log(`\n${dat} đạt · ${truot} trượt`);
if (truot > 0) process.exitCode = 1;
