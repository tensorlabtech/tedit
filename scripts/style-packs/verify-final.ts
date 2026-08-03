/** Bảng trạng thái CUỐI của mười bộ dáng — dựng từ chính catalog, không chép tay. */
import { STYLE_PACKS } from "../../server/style-pack-catalog";
const f = (p: string) => p.split("/").pop()!.replace(".ttf", "").slice(0, 16);
console.log("bộ      theme      vai phụ đề       vai cảm xúc      khung   hình dán        bám chữ      nền chữ  tiêu đề  mảng màu");
console.log("-".repeat(122));
for (const p of STYLE_PACKS) {
  console.log(
    p.label.padEnd(8) + p.theme.padEnd(11) +
    f(p.fonts.voice.file).padEnd(17) +
    (p.fonts.accent.file === p.fonts.voice.file ? "—" : f(p.fonts.accent.file)).padEnd(17) +
    (p.frame ? p.frame.background.color : "—").padEnd(8) +
    ((p.graphics ?? []).map((g) => g.id).join("+") || "—").padEnd(16) +
    (p.wrap ? `${p.wrap.id}/${p.wrap.scope}` : "—").padEnd(13) +
    (p.box ? p.box.tone.color : "—").padEnd(9) +
    (p.title ? p.title.band : "—").padEnd(9) +
    (p.plate ? p.plate.tone.color : "—"),
  );
}
/*
 * Trục nào vẽ SUỐT VIDEO, trục nào chỉ hiện khi có cụm chữ.
 *
 * Bốn trục vẽ thẳng lên dòng hình, không có biểu thức thời gian nào:
 * `frame` · `graphics` · `plate` · `title`. Ba trục còn lại (`box`, `wrap`, cặp
 * font) gắn với TỪNG CỤM nên chúng tắt cùng lúc với chữ.
 *
 * Phân biệt này là cả kết luận của hai đợt, nên nó phải đọc thẳng từ catalog chứ
 * không chép tay — bản chép tay của tôi đã sai một lần rồi.
 */
const suot = (p: (typeof STYLE_PACKS)[number]) =>
  [
    p.frame && "khung",
    p.graphics && "hình dán",
    p.plate && "mảng màu",
    p.title && "tiêu đề",
  ].filter(Boolean) as string[];
const theoCum = (p: (typeof STYLE_PACKS)[number]) =>
  [
    p.box && "nền chữ",
    p.wrap && "bám chữ",
    p.fonts.accent.file !== p.fonts.voice.file && "cặp font",
  ].filter(Boolean) as string[];

console.log();
console.log("bộ       trục vẽ SUỐT VIDEO            trục theo TỪNG CỤM");
console.log("-".repeat(74));
let du = 0;
for (const p of STYLE_PACKS) {
  const a = suot(p);
  const b = theoCum(p);
  if (a.length > 0) du += 1;
  console.log(
    `${p.label.padEnd(9)}${(a.join(" + ") || "— KHÔNG CÓ").padEnd(30)}${b.join(" + ") || "—"}`,
  );
}
console.log(`\n${du}/${STYLE_PACKS.length} bộ có ít nhất một trục hiện ở mọi khung hình.`);
