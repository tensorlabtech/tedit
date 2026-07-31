/**
 * Kiểm BẤT BIẾN của bộ dáng chữ bằng dữ liệu thật. Chạy:
 *
 *   npm run check:style-pack
 *
 * Kiểm đúng một điều, và là điều cả nhánh này dựa vào:
 *
 *   **Đổi bộ dáng KHÔNG đụng một hàng `elements` nào.**
 *
 * Sai ở đây không gây lỗi nào nhìn thấy được — video vẫn xuất ra, chỉ là bố cục
 * người dùng đã chỉnh tay bị ghi đè, và họ chỉ biết khi mở lại bàn dựng. Đúng
 * loại lỗi phải có phép kiểm chứ không trông vào việc nhớ.
 *
 * Lệnh npm trỏ `TEDDIT_DATA_ROOT` sang thư mục tạm nên nó KHÔNG chạm CSDL thật.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { db, newId } from "./db";
import { clampEmojiTop, emojiSpot } from "./emoji-layout";
import { EMOJI_VOCAB, emojiFileName } from "./emoji-vocab";
import { DATA_ROOT, PROJECT_ROOT } from "./paths";
import { OUT_HEIGHT, OUT_WIDTH } from "./render";
import { boxPadShareY, type Band } from "./style-pack";
import { STYLE_PACKS, findStylePack } from "./style-pack-catalog";
import { readStylePack } from "./style-pack-store";
import { BAND_ANCHOR, MAX_LINES, SAFE } from "./text-layout";

if (!process.env.TEDDIT_DATA_ROOT) {
  console.error(
    "Phép kiểm này ghi dữ liệu thử vào CSDL. Chạy bằng `npm run check:style-pack`\n" +
      "để nó dùng thư mục tạm, đừng gọi tsx trực tiếp.",
  );
  process.exit(1);
}
console.log(`CSDL thử: ${DATA_ROOT}`);

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  đạt   ${label}`);
  } else {
    failed += 1;
    console.log(`  TRƯỢT ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const projectId = newId("prj");
db.prepare(
  "INSERT INTO projects (id,title,status,created_at) VALUES (?,?,?,?)",
).run(projectId, "thử bộ dáng", "draft", Date.now());

console.log("\nCột và luật rơi về mặc định");
check(
  "dự án mới có sẵn bộ dáng gốc",
  readStylePack(projectId).id === "goc",
  readStylePack(projectId).id,
);

db.prepare("UPDATE projects SET style_pack=? WHERE id=?").run(
  "chu-hoa-vang",
  projectId,
);
check(
  "đổi cột bằng tay thì đọc ra bộ mới",
  readStylePack(projectId).id === "chu-hoa-vang",
);

db.prepare("UPDATE projects SET style_pack=? WHERE id=?").run(
  "khong-co-bo-nay",
  projectId,
);
check(
  "tên rác trong CSDL rơi về bộ gốc, không sập",
  readStylePack(projectId).id === "goc",
);

db.prepare("UPDATE projects SET style_pack=NULL WHERE id=?").run(projectId);
check("cột rỗng (dự án cũ) rơi về bộ gốc", readStylePack(projectId).id === "goc");

check("dự án không tồn tại rơi về bộ gốc", readStylePack("prj_khong_co").id === "goc");
check("tên rỗng rơi về bộ gốc", findStylePack("").id === "goc");

console.log("\nBất biến: đổi bộ dáng không đụng bảng elements");
/*
 * `defaults` là thứ DUY NHẤT của bộ dáng đi vào bảng `elements`, và nó chỉ được
 * phép đọc ở ĐÚNG MỘT chỗ: `caption-elements.ts`, lúc SINH chữ.
 *
 * Vòng trước canh bất biến này bằng cách bắt cả năm bộ khai `defaults` giống hệt
 * nhau. Cách đó an toàn nhưng đắt: nó khoá luôn bố cục, nên đổi bộ dáng không
 * đổi được thứ mà khung "Đang sửa" bày ra, và năm bộ đọc ra như một bộ có năm
 * bảng màu.
 *
 * Nay canh thẳng vào điều thật sự quan trọng: **không ai đọc `pack.defaults` lúc
 * RENDER.** Đọc lúc render là đổi bộ dáng sẽ ghi đè bố cục người dùng đã chỉnh
 * tay — đúng thứ lời hứa "đổi dáng an toàn" cấm.
 *
 * Quét mã nguồn chứ không kiểm lúc chạy: đây là ràng buộc về CHỖ GỌI, mà chỗ gọi
 * thì chỉ đọc mã mới thấy được.
 */
/*
 * Danh sách này là một CỔNG DUYỆT, không phải một danh sách cho tiện.
 *
 * Phân biệt hai kiểu đọc, vì chỉ một kiểu nguy hiểm:
 *
 * - **Đọc để GHI vào `elements`** — chỉ `caption-elements.ts`, lúc sinh chữ.
 *   Thêm một chỗ nữa là đổi bộ dáng bắt đầu ghi đè bố cục người dùng đã chỉnh.
 * - **Đọc để VẼ** — an toàn: nó chỉ bày ra, không lưu gì. Ô mẫu chọn dáng phải
 *   đọc để bày đúng bố cục của từng bộ; bày một bố cục chung cho mọi ô là giấu
 *   đi trục dễ nhận ra nhất.
 *
 * Thêm tên vào đây thì phải nói được mình thuộc kiểu nào.
 */
const ALLOWED_DEFAULTS_READERS = [
  // GHI — nơi duy nhất, lúc sinh chữ.
  "server/caption-elements.ts",
  // VẼ — ô mẫu bày bố cục của từng bộ dáng, không lưu gì.
  "src/routes/pipeline/style-preview-tile.tsx",
  // Nơi khai báo: `BASE.defaults` và `defaults:` của từng bộ.
  "server/style-pack-catalog.ts",
  "server/style-pack.ts",
  // Chính tệp này.
  "server/style-pack-check.ts",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      // `pylibs` là thư viện Python cài kèm, không phải mã của mình.
      if (entry.name === "pylibs" || entry.name === "node_modules") continue;
      out.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

const projectRoot = join(import.meta.dirname, "..");
const offenders = sourceFiles(join(projectRoot, "server"))
  .concat(sourceFiles(join(projectRoot, "src")))
  .map((path) => path.slice(projectRoot.length + 1))
  .filter((rel) => !ALLOWED_DEFAULTS_READERS.includes(rel))
  .filter((rel) => /\.defaults\b/.test(readFileSync(join(projectRoot, rel), "utf8")));

check(
  "không chỗ nào ngoài danh sách duyệt đọc `pack.defaults`",
  offenders.length === 0,
  offenders.join(", "),
);

// Mỗi bộ dáng phải khai đủ ba mặc định hợp lệ: thiếu một cái là câu `INSERT`
// ghi `undefined` vào cột và cụm sinh ra không có dáng nào.
for (const pack of STYLE_PACKS) {
  check(
    `"${pack.label}" khai đủ ba mặc định`,
    Boolean(pack.defaults.align && pack.defaults.emphasis && pack.defaults.reveal),
    JSON.stringify(pack.defaults),
  );
}

console.log("\nMỗi cặp bộ dáng khác nhau ở ít nhất HAI trục nhìn thấy được");
/**
 * Các trục người xem NHÌN RA.
 *
 * Bố cục CÓ trong danh sách này từ khi `defaults` được phép khác nhau — nó là
 * thứ dễ nhận ra nhất trong tất cả, vì nó đổi cả hình dạng khối chữ chứ không
 * chỉ đổi màu mực.
 */
const visibleAxes = (pack: (typeof STYLE_PACKS)[number]) => [
  pack.defaults.align,
  pack.defaults.emphasis,
  // Hai trục PHỤ ĐỀ: chia cụm và tô sáng. Chúng đổi hẳn kiểu phụ đề chứ không
  // chỉ đổi vẻ ngoài, nên phải nằm trong phép đếm khác biệt.
  `nhom:${pack.grouping.maxWords}`,
  pack.highlight ? `sang:${pack.highlight.tone.color}` : "sang:none",
  pack.box ? `nen:${pack.box.tone.color}` : "nen:none",
  // ĐỘ MẠNH cũng là trục nhìn ra được: cú zoom 12% và cú zoom 5% là hai video
  // khác nhau, dù bảng kiểu chuyển cảnh có giống hệt.
  `zoom:${pack.intensity.punchScale}`,
  `nhay:${pack.intensity.flashAmount}`,
  pack.font.file,
  pack.letterCase,
  pack.color.key.color,
  pack.edge ? `edge:${pack.edge.share}` : "edge:none",
  pack.glow ? `glow:${pack.glow.radiusPx}` : "glow:none",
  `scale:${pack.density.maxScale}`,
  `line:${pack.density.lineHeight}`,
  `gap:${pack.density.wordGap}`,
  pack.motion.reveal,
];
for (const [i, a] of STYLE_PACKS.entries()) {
  for (const b of STYLE_PACKS.slice(i + 1)) {
    const left = visibleAxes(a);
    const right = visibleAxes(b);
    const differing = left.filter((value, index) => value !== right[index]);
    check(
      `"${a.label}" ↔ "${b.label}" khác ${differing.length} trục`,
      differing.length >= 2,
      differing.join(" · "),
    );
  }
}

console.log("\nĐộ mạnh nằm trong dải an toàn");
for (const pack of STYLE_PACKS) {
  const { punchScale, flashAmount, keywordShare, minSilence } = pack.intensity;
  check(
    `"${pack.label}" độ mạnh trong dải`,
    // Zoom quá 15% là mặt người méo hẳn ở khổ 9:16; nháy quá 1 là trắng xoá.
    // Nhấn quá nửa số cụm thì nhấn mất nghĩa. Rút lặng quá 3 giây thì gần như
    // không quãng nào bị rút.
    punchScale > 0 && punchScale <= 0.15 &&
      flashAmount > 0 && flashAmount <= 1 &&
      keywordShare >= 0 && keywordShare <= 0.5 &&
      minSilence >= 0 && minSilence <= 3,
    `zoom=${punchScale} nháy=${flashAmount} nhấn=${keywordShare} lặng=${minSilence}`,
  );
}

console.log("\nBộ dáng nằm trong dải cho phép");
for (const pack of STYLE_PACKS) {
  const { maxScale, lineHeight } = pack.density;
  check(
    `"${pack.label}" maxScale trong [0.11, 0.16] và lineHeight trong [1.0, 1.4]`,
    maxScale >= 0.11 &&
      maxScale <= 0.16 &&
      lineHeight >= 1 &&
      lineHeight <= 1.4,
    `maxScale=${maxScale} lineHeight=${lineHeight}`,
  );
}

/*
 * NẮN MÀU nằm trong dải đo được trên khung hình thật.
 *
 * Trần tương phản 1,12 không phải chọn cho đẹp: `eq=contrast` xoay quanh mức xám
 * giữa, mà video quay bằng điện thoại trong nhà nằm quanh 0,14 — ở đó mọi mức
 * cao hơn đều kéo ảnh TỐI đi chứ không làm nó mạnh lên. Đo được: `1.2` hạ độ
 * sáng trung bình từ 37,8 xuống 27,9.
 *
 * Sàn ấm/lạnh 0,25 thì ngược lại — dưới mức đó không ai nhìn ra bộ dáng có nắn
 * màu. Bản đầu để quanh 0,2 với hệ số 10%, in mười khung ra gần như một màu.
 */
console.log("\nNắn màu nằm trong dải đo được");
for (const pack of STYLE_PACKS) {
  const grade = pack.grade;
  if (!grade) continue;
  const { brightness, contrast, saturation, warmth } = grade;
  check(
    `"${pack.label}" nắn màu trong dải`,
    brightness >= 1 &&
      brightness <= 1.15 &&
      contrast >= 0.85 &&
      contrast <= 1.12 &&
      saturation >= 0.6 &&
      saturation <= 1.25 &&
      Math.abs(warmth) <= 0.5,
    `sáng=${brightness} tương phản=${contrast} bão hoà=${saturation} ấm=${warmth}`,
  );
}

check(
  "có bộ ẤM rõ và bộ LẠNH rõ, cách nhau ít nhất 0,6",
  (() => {
    const warmths = STYLE_PACKS.map((pack) => pack.grade?.warmth ?? 0);
    return Math.max(...warmths) - Math.min(...warmths) >= 0.6;
  })(),
  "hai đầu ấm/lạnh gần nhau thì mười bộ đọc ra một màu",
);

/*
 * EMOJI — vốn từ, tệp ảnh, và chỗ đứng.
 *
 * Phép quan trọng nhất là phép cuối: `clampEmojiTop` là chốt chặn cuối cùng để
 * emoji không nhô ra khỏi lề an toàn, mà một chốt chặn CÓ NỔ thì hai đường vẽ
 * lệch nhau — trang xem không cài chốt đó (nó không có số đo tuyệt đối để cài).
 * Nên chốt phải là thứ không bao giờ nổ với hình học có thật, và đây là chỗ canh
 * điều đó thay vì tin.
 */
console.log("\nEmoji");
check(
  `vốn từ ${EMOJI_VOCAB.length} hình, không trùng`,
  new Set(EMOJI_VOCAB.map((entry) => entry.char)).size === EMOJI_VOCAB.length,
  "trùng hình là hai dòng cùng nghĩa cho mô hình chọn",
);
{
  const missing = EMOJI_VOCAB.filter(
    (entry) =>
      !existsSync(join(PROJECT_ROOT, "assets", "emoji", emojiFileName(entry.char))),
  );
  check(
    "mọi hình trong vốn từ đều có tệp ảnh",
    missing.length === 0,
    // Thiếu tệp không làm mất mỗi cái emoji — ffmpeg chết cả lượt xuất.
    missing.map((entry) => entry.char).join(" ") ||
      "chạy scripts/emoji/fetch-emoji-assets.ts",
  );
}
check(
  'ba bộ nhóm "Gọn" đều TẮT emoji',
  STYLE_PACKS.filter((pack) => pack.theme === "gon").every(
    (pack) => pack.emoji === null,
  ),
  "khoảng thở là thứ nhóm này bán; một hình nảy lên giữa khung phá đúng nó",
);
for (const pack of STYLE_PACKS) {
  if (!pack.emoji) continue;
  // Ca xấu nhất: khối chạm trần dòng ở cỡ chữ trần.
  const font = pack.density.maxScale * OUT_WIDTH;
  const blockHeight =
    MAX_LINES * font * (pack.density.lineHeight + boxPadShareY(pack) * 2);
  const bands: Band[] = ["top", "middle", "bottom"];
  const fits = bands.every((band) => {
    const anchor = BAND_ANCHOR[band];
    const top =
      anchor.edge === "top"
        ? OUT_HEIGHT * anchor.at
        : anchor.edge === "bottom"
          ? OUT_HEIGHT * anchor.at - blockHeight
          : OUT_HEIGHT * anchor.at - blockHeight / 2;
    const spot = emojiSpot(band, font, pack)!;
    const want =
      spot.side === "above" ? top - spot.gap - spot.size : top + blockHeight + spot.gap;
    return (
      clampEmojiTop(Math.round(want), Math.round(spot.size), OUT_HEIGHT, SAFE) ===
      Math.round(want)
    );
  });
  check(
    `"${pack.label}" emoji nằm gọn trong lề ở mọi dải, không cần kẹp`,
    fits,
    "chốt kẹp mà nổ là trang xem và bản xuất đặt emoji ở hai chỗ",
  );
}

console.log(`\n${passed} đạt, ${failed} trượt`);
process.exit(failed === 0 ? 0 : 1);
