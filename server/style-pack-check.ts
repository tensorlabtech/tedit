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
import { DATA_ROOT } from "./paths";
import { layoutHeadline } from "./headline";
import {
  HEADLINE_MAX_CHARS,
  contentRect,
  headlineRoom,
  packForElement,
  withFontRole,
  type StylePack,
  type StylePackId,
  type Tone,
} from "./style-pack";
import { BASE_PACK, STYLE_PACKS, findStylePack } from "./style-pack-catalog";
import { SAFE, textWidth, usableWidthOf } from "./text-layout";
import { readStylePack } from "./style-pack-store";

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

/**
 * Bóc ghi chú trước khi quét.
 *
 * Không bóc thì chính đoạn ghi chú giải thích *"tệp này KHÔNG gọi `layoutText`"*
 * làm phép kiểm trượt — và cách sửa dễ nhất lúc đó là xoá lời giải thích đi, tức
 * là phép kiểm vừa trừng phạt đúng thứ đáng giữ nhất.
 */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

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
  .filter((rel) =>
    /\.defaults\b/.test(stripComments(readFileSync(join(projectRoot, rel), "utf8"))),
  );

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

console.log("\nHai vai chữ: tệp có thật, và trang xem khai đúng họ");
/*
 * Ba điều kiểm ở đây, và cả ba đều là loại lỗi KHÔNG có triệu chứng:
 *
 * 1. Tệp `.ttf` không tồn tại → ffmpeg dựng hỏng giữa lượt xuất, sau khi người
 *    dùng đã chờ xong phần chép lời.
 * 2. `cssStack` không có `@font-face` tương ứng → trình duyệt LẶNG LẼ rơi về
 *    `sans-serif`. Bố cục vẫn đúng, chỉ dáng chữ sai hẳn — và đúng ở khung xem,
 *    nơi người dùng quyết định chọn bộ nào.
 * 3. Độ đậm hoặc thể nghiêng lệch → trình duyệt tự tổng hợp một thể giả
 *    (`faux bold`, `faux italic`) trông na ná mà không phải thứ ffmpeg in.
 */
const FONT_CSS = readFileSync(
  join(projectRoot, "src", "style-pack-fonts.css"),
  "utf8",
);

/** Các `@font-face` đã khai: `họ|độ đậm|thể`. */
const declaredFaces = new Set(
  [...FONT_CSS.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((block) => {
    const field = (name: string) =>
      block[1].match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1].trim() ?? "";
    const family = field("font-family").replace(/^["']|["']$/g, "");
    return `${family}|${field("font-weight")}|${field("font-style")}`;
  }),
);

/** Họ chữ đầu tiên của một `cssStack`, đã bóc dấu nháy — thứ trình duyệt thử trước. */
const primaryFamily = (cssStack: string) =>
  cssStack.split(",")[0].replace(/['"]/g, "").trim();

for (const pack of STYLE_PACKS) {
  for (const role of ["voice", "accent"] as const) {
    const font = pack.fonts[role];
    check(
      `"${pack.label}" · ${role}: có tệp ${font.file}`,
      existsSync(join(projectRoot, font.file)),
    );
    check(
      `"${pack.label}" · ${role}: ${primaryFamily(font.cssStack)} có @font-face khớp`,
      declaredFaces.has(
        `${primaryFamily(font.cssStack)}|${font.cssWeight}|${font.italic ? "italic" : "normal"}`,
      ),
      `cần "${primaryFamily(font.cssStack)}|${font.cssWeight}|${font.italic ? "italic" : "normal"}"`,
    );
  }
}

/*
 * DANH SÁCH DUYỆT cho bộ dáng dùng hai họ chữ.
 *
 * Bộ nào không có tên ở đây phải khai `accent` TRÙNG `voice`. Đây là thứ giữ
 * cho các bộ ngoài phạm vi xuất ra khung hình y hệt trước khi có trục này —
 * chúng là nhóm đối chứng, và nhóm đối chứng mà trôi thì không còn gì để so.
 *
 * Thêm tên vào đây là một quyết định về DÁNG, không phải một bước dọn kiểu.
 */
const TWO_FACE_PACKS: StylePackId[] = [
  // Hẹp ↔ rộng, cả hai đều sans: trục BỀ NGANG.
  "dung-dung",
  // Sans rộng bản ↔ serif nghiêng: trục NHÓM CHỮ.
  "nhan-xanh",
  // Sans hình học nghiêng ↔ serif chân thẳng tương phản mạnh.
  "nghieng-tron",
];

for (const pack of STYLE_PACKS) {
  const paired = pack.fonts.accent.file !== pack.fonts.voice.file;
  check(
    `"${pack.label}" ${TWO_FACE_PACKS.includes(pack.id) ? "được phép" : "chưa được phép"} dùng hai họ chữ`,
    paired === TWO_FACE_PACKS.includes(pack.id),
    paired
      ? `dùng ${pack.fonts.voice.file} + ${pack.fonts.accent.file} mà không có trong danh sách duyệt`
      : "có trong danh sách duyệt nhưng hai vai vẫn trùng nhau",
  );
}

console.log("\nPhép ĐO bám theo vai chữ, không bám theo bộ dáng");
/*
 * Phép kiểm quan trọng nhất của trục này, và là thứ duy nhất bắt được lỗi
 * "chữ tràn khung mà không lệnh nào sai".
 *
 * `textWidth` đo bằng ImageMagick với ĐÚNG tệp font sẽ in. Cụm vẽ bằng vai
 * `accent` mà đo bằng vai `voice` thì cả hệ `SAFE`/`MAX_BLOCK_SHARE` vẫn báo
 * "vừa" — luật không sai, chỉ phép đo hỏi nhầm font.
 *
 * Dựng một bộ dáng thử với hai họ rộng hẹp khác hẳn nhau (Anton hẹp và cao ↔
 * Archivo rộng bản), rồi khẳng định bề rộng ĐỔI theo vai.
 */
const probe: StylePack = {
  ...BASE_PACK,
  fonts: {
    voice: {
      file: "assets/fonts/Anton-Regular.ttf",
      cssStack: "Anton, sans-serif",
      cssWeight: 400,
      italic: false,
    },
    accent: {
      file: "assets/fonts/Archivo-ExpandedBlack.ttf",
      cssStack: "'Archivo Expanded', sans-serif",
      cssWeight: 900,
      italic: false,
    },
  },
};
const SAMPLE = "Nghĩ khác đi";
const asVoice = await textWidth(SAMPLE, 100, packForElement(probe, null, []));
const asAccent = await textWidth(
  SAMPLE,
  100,
  packForElement(probe, null, ["nghĩ"]),
);
check(
  "cụm KHÔNG từ khoá đo bằng vai phụ đề",
  packForElement(probe, null, []).font.file === probe.fonts.voice.file,
);
check(
  "cụm CÓ từ khoá đo bằng vai cảm xúc",
  packForElement(probe, null, ["nghĩ"]).font.file === probe.fonts.accent.file,
);
check(
  "bề rộng ĐỔI theo vai chữ",
  // Ngưỡng 5%: hai họ này chênh nhau hàng chục phần trăm, nên sát ngưỡng nghĩa
  // là phép đo đang bám vào một font duy nhất chứ không bám vai.
  Math.abs(asAccent - asVoice) / asVoice > 0.05,
  `phụ đề=${asVoice.toFixed(1)} cảm xúc=${asAccent.toFixed(1)}`,
);

console.log("\nHình dán: có trong manifest, không trùng chữ ký, không cãi nhau");
{
  const manifest = JSON.parse(
    readFileSync(join(projectRoot, "assets", "graphics", "manifest.json"), "utf8"),
  ) as { graphics: Record<string, { kind: string; excludes: string[] }> };

  /** Chữ ký đồ hoạ của một bộ: hình nào, màu nào. */
  const signature = (pack: StylePack) =>
    (pack.graphics ?? []).map((g) => `${g.id}:${g.color}`).join("+");

  for (const pack of STYLE_PACKS) {
    for (const item of pack.graphics ?? []) {
      const entry = manifest.graphics[item.id];
      check(
        `"${pack.label}" dùng hình "${item.id}" có trong manifest`,
        Boolean(entry),
        `chỉ có: ${Object.keys(manifest.graphics).join(" · ")}`,
      );
      check(
        `"${pack.label}" · ${item.id}: loại phải là \`plate\``,
        entry?.kind === "plate",
        `loại "${entry?.kind}" chưa có đường vẽ ở chặng này`,
      );
      check(
        `"${pack.label}" · ${item.id}: màu dạng #RRGGBB`,
        /^#[0-9A-Fa-f]{6}$/.test(item.color),
        item.color,
      );
      /*
       * `onDark` phải CAO HƠN `onLight`.
       *
       * Nền tối nuốt hình, nền sáng làm hình chói. Khai ngược là dấu hiệu chép
       * nhầm hai con số — và nó không gây lỗi nào, chỉ làm đồ hoạ biến mất đúng
       * ở loại cảnh hay gặp nhất (video quay trong nhà, thiếu sáng).
       */
      check(
        `"${pack.label}" · ${item.id}: đục ở cảnh tối > ở cảnh sáng`,
        item.opacity.onDark > item.opacity.onLight,
        `tối=${item.opacity.onDark} sáng=${item.opacity.onLight}`,
      );
      check(
        `"${pack.label}" · ${item.id}: độ đục trong (0, 1]`,
        [item.opacity.onDark, item.opacity.onLight].every((v) => v > 0 && v <= 1),
        JSON.stringify(item.opacity),
      );
      /*
       * LUẬT LOẠI TRỪ, đọc từ manifest.
       *
       * Ngược với `defaults` — chỗ đó canh GIỐNG, chỗ này canh KHÔNG CÃI NHAU.
       * Ba lỗi thiết kế đầu tiên của phiên brainstorm đều cùng một dạng: đồ hoạ
       * và chữ tranh nhau cùng một việc.
       */
      for (const banned of entry?.excludes ?? []) {
        check(
          `"${pack.label}" · ${item.id} loại trừ \`${banned}\``,
          !(banned === "box" ? pack.box : banned === "frame" ? pack.frame : pack.plate),
          `hai lớp cùng nhấn một việc thì triệt tiêu nhau`,
        );
      }
    }
  }

  /*
   * KHÔNG hai bộ nào trùng chữ ký đồ hoạ.
   *
   * Đây là phép kiểm ngược hẳn với "defaults giống hệt nhau" ở trên: đồ hoạ tồn
   * tại để TÁCH các bộ ra, nên hai bộ cùng một hình cùng một màu là một bộ đã
   * tiêu một trục mà không đổi lấy gì.
   */
  const seen = new Map<string, string>();
  for (const pack of STYLE_PACKS) {
    const key = signature(pack);
    if (!key) continue;
    check(
      `"${pack.label}" chữ ký đồ hoạ không trùng bộ nào`,
      !seen.has(key),
      `trùng "${seen.get(key)}" — cùng ${key}`,
    );
    seen.set(key, pack.label);
  }
}

console.log("\nHình bám chữ: không cãi nhau, và co đúng ba lát");
for (const pack of STYLE_PACKS) {
  const wrap = pack.wrap;
  if (!wrap) continue;
  const manifest = JSON.parse(
    readFileSync(join(projectRoot, "assets", "graphics", "manifest.json"), "utf8"),
  ) as { graphics: Record<string, { kind: string; nominal?: { w: number; h: number }; cap?: number; excludes: string[] }> };
  const entry = manifest.graphics[wrap.id];
  check(`"${pack.label}" hình bám chữ "${wrap.id}" có trong manifest`, Boolean(entry));
  check(
    `"${pack.label}" · ${wrap.id}: loại phải là \`wrap\``,
    entry?.kind === "wrap",
    `loại "${entry?.kind}"`,
  );
  check(
    `"${pack.label}" · ${wrap.id}: có khổ danh nghĩa và bề rộng hai đầu`,
    Boolean(entry?.nominal && entry.cap !== undefined),
    "thiếu `nominal`/`cap` thì không cắt ba lát được",
  );
  /*
   * Hai đầu cộng lại phải NHỎ HƠN khổ danh nghĩa.
   *
   * Bằng hoặc lớn hơn thì khúc giữa có bề rộng âm, `crop` từ chối, và cả lượt
   * xuất video hỏng — ở đúng cụm đầu tiên có hình bám chữ.
   */
  if (entry?.nominal && entry.cap !== undefined) {
    check(
      `"${pack.label}" · ${wrap.id}: hai đầu (${entry.cap}×2) nhỏ hơn khổ ${entry.nominal.w}`,
      entry.cap * 2 < entry.nominal.w,
    );
  }
  check(
    `"${pack.label}" · ${wrap.id}: màu dạng #RRGGBB`,
    /^#[0-9A-Fa-f]{6}$/.test(wrap.color),
    wrap.color,
  );
  check(
    `"${pack.label}" · ${wrap.id}: đục ở cảnh tối > ở cảnh sáng`,
    wrap.opacity.onDark > wrap.opacity.onLight,
    `tối=${wrap.opacity.onDark} sáng=${wrap.opacity.onLight}`,
  );
  /*
   * LUẬT LOẠI TRỪ — ca đã hỏng thật ở phiên brainstorm: vòng khoanh vàng vẽ đè
   * lên nền chữ vàng, hai lớp triệt tiêu nhau và đọc ra như lỗi vẽ.
   * Xem `../260802-2130-do-hoa-cho-bo-dang-chu/anh/ba-bo-thu-tren-footage-that.jpg`.
   */
  for (const banned of entry?.excludes ?? []) {
    check(
      `"${pack.label}" · ${wrap.id} loại trừ \`${banned}\``,
      !(banned === "box" ? pack.box : banned === "plate" ? pack.plate : pack.frame),
      "hai lớp cùng nhấn một việc thì triệt tiêu nhau",
    );
  }
  // Cùng màu với nền chữ cũng là triệt tiêu, kể cả khi manifest không cấm.
  if (pack.box) {
    check(
      `"${pack.label}" hình bám chữ khác màu nền chữ`,
      wrap.color.toUpperCase() !== pack.box.tone.color.toUpperCase(),
      `cả hai đều ${wrap.color}`,
    );
  }
  check(
    `"${pack.label}" · ${wrap.id}: đệm trong [0, 0.6] cỡ chữ`,
    wrap.padShare >= 0 && wrap.padShare <= 0.6,
    `${wrap.padShare} — đệm quá tay thì hình khoanh chạm mép khung`,
  );
}

console.log("\nBản chép bề rộng hai đầu ở trang xem khớp manifest");
/*
 * `overlay-render.tsx` chép `cap` của từng hình bám chữ, vì nó chạy ở trình duyệt
 * và không đọc được manifest bằng `node:fs`. Bản chép nào cũng trôi được — trừ
 * khi có một phép kiểm giữ nó.
 *
 * Lệch con số này thì hai đầu vòng khoanh co khác nhau ở hai đường vẽ, mà đó là
 * đúng thứ phép cắt ba lát sinh ra để tránh.
 */
{
  const source = readFileSync(
    join(projectRoot, "src", "dev", "overlays", "overlay-render.tsx"),
    "utf8",
  );
  const block = /const WRAP_CAPS: Record<string, number> = \{([^}]*)\}/.exec(source)?.[1] ?? "";
  const copied = new Map(
    [...block.matchAll(/"([^"]+)":\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]),
  );
  const manifest = JSON.parse(
    readFileSync(join(projectRoot, "assets", "graphics", "manifest.json"), "utf8"),
  ) as { graphics: Record<string, { kind: string; cap?: number }> };
  const wraps = Object.entries(manifest.graphics).filter(([, e]) => e.kind === "wrap");
  for (const [id, entry] of wraps) {
    check(
      `"${id}" bề rộng hai đầu ở trang xem = ${entry.cap}`,
      copied.get(id) === entry.cap,
      `trang xem chép ${copied.get(id) ?? "(thiếu)"}`,
    );
  }
  check(
    "trang xem không chép thừa hình nào",
    [...copied.keys()].every((id) => wraps.some(([name]) => name === id)),
    [...copied.keys()].join(", "),
  );
}

console.log("\nKhung bao quanh hình");
/*
 * Lề quá tay thì vùng hình nhỏ tới mức mặt người không còn đọc được — mà video
 * này bán đúng cái mặt người đang nói. Trần 0,25 mỗi phía và 0,4 mỗi trục là
 * chỗ vùng hình còn giữ được ít nhất 60% bề rộng.
 */
for (const pack of STYLE_PACKS) {
  const frame = pack.frame;
  if (!frame) continue;
  const { top, right, bottom, left } = frame.inset;
  check(
    `"${pack.label}" lề mỗi phía trong [0, 0.25]`,
    [top, right, bottom, left].every((v) => v >= 0 && v <= 0.25),
    JSON.stringify(frame.inset),
  );
  check(
    `"${pack.label}" tổng lề mỗi trục dưới 0,4`,
    left + right < 0.4 && top + bottom < 0.4,
    `ngang=${(left + right).toFixed(2)} dọc=${(top + bottom).toFixed(2)}`,
  );
}

console.log("\nVùng hình: chẵn, và nằm trọn trong khung");
{
  const W = 1080;
  const H = 1920;
  // Bộ KHÔNG khai khung phải trả về đúng cả khung — đây là điều giữ cho bảy bộ
  // đối chứng đi qua nhánh y hệt trước khi có trục này.
  const plain = contentRect({ frame: null }, W, H);
  check(
    "không khai khung thì vùng hình = cả khung",
    plain.x === 0 && plain.y === 0 && plain.w === W && plain.h === H,
    JSON.stringify(plain),
  );
  for (const pack of STYLE_PACKS) {
    const rect = contentRect(pack, W, H);
    check(
      `"${pack.label}" vùng hình ${rect.w}×${rect.h} chẵn và nằm trong khung`,
      rect.w % 2 === 0 &&
        rect.h % 2 === 0 &&
        rect.x >= 0 &&
        rect.y >= 0 &&
        rect.x + rect.w <= W &&
        rect.y + rect.h <= H,
      JSON.stringify(rect),
    );
  }
  // Lề lẻ là ca dễ lọt nhất: `Math.round` ra số lẻ thì ffmpeg từ chối cả luồng,
  // và lỗi chỉ lộ ra lúc xuất video chứ không lúc kiểm.
  const odd = contentRect(
    { frame: { inset: { top: 0.037, right: 0.037, bottom: 0.037, left: 0.037 }, background: { color: "#000000", alpha: 1 } } },
    W,
    H,
  );
  check(
    `lề lẻ vẫn ra cạnh chẵn (${odd.w}×${odd.h})`,
    odd.w % 2 === 0 && odd.h % 2 === 0,
  );
}

console.log("\nMảng màu nằm ngoài dải an toàn");
/*
 * Mảng màu KHÔNG được chạm vào chỗ chữ phụ đề sống.
 *
 * `SAFE` là hằng của sản phẩm; cho mảng màu lấn vào rồi bắt chữ né là mở một
 * đường cho chữ nhảy chỗ giữa hai lần dựng. Nên mảng bám mép trên thì dày nhiều
 * nhất bằng `SAFE.top`, bám mép dưới thì nhiều nhất bằng `SAFE.bottom`.
 */
for (const pack of STYLE_PACKS) {
  const plate = pack.plate;
  if (!plate) continue;
  check(
    `"${pack.label}" mảng màu đặt ở mép, không đặt giữa`,
    plate.band !== "middle",
    `band=${plate.band} — dải giữa là chỗ mặt người nói`,
  );
  const room = plate.band === "top" ? SAFE.top : SAFE.bottom;
  check(
    `"${pack.label}" mảng màu không lấn dải an toàn`,
    plate.heightShare > 0 && plate.heightShare <= room,
    `dày ${plate.heightShare}, lề ${plate.band} chỉ có ${room}`,
  );
}

console.log("\nLuật loại trừ: hai lớp không cùng nhấn một việc");
/*
 * Bài học từ ba bộ thử hỏng ở phiên brainstorm
 * (`anh/ba-bo-thu-tren-footage-that.jpg`): nền chữ thường và nền chữ đang-nói
 * đều nhấn cùng một thứ — "chỗ này đáng chú ý". Khai cùng lúc CÙNG MỘT MÀU thì
 * ô sáng chạy qua không để lại dấu vết nào, và cả trục tô sáng biến mất trong
 * khi vẫn tốn một lượt vẽ cho mỗi tiếng.
 *
 * Đây là loại lỗi chỉ lộ ra khi xem ở khổ thật: ở bản thu nhỏ hai lớp cùng màu
 * trông y hệt một lớp cố ý.
 */
for (const pack of STYLE_PACKS) {
  if (!pack.box || !pack.highlight?.box) continue;
  check(
    `"${pack.label}" nền chữ và nền tiếng-đang-nói khác màu`,
    pack.box.tone.color !== pack.highlight.box.color,
    `cả hai đều ${pack.box.tone.color} — vệt sáng chạy qua mà không thấy gì`,
  );
}

console.log("\nChữ trên nền khối đủ tương phản");
/*
 * Đo bằng ĐỘ CHÓI TƯƠNG ĐỐI, và đo ở CA XẤU NHẤT.
 *
 * Nền khối trong suốt một phần nên màu thật của nó phụ thuộc khung hình phía
 * sau. Lấy đúng màu khai báo mà tính là tính cho một video không tồn tại. Nên
 * trộn nền khối lên cả nền đen lẫn nền trắng rồi lấy kết quả tệ hơn — đó là hai
 * đầu mà mọi khung hình thật nằm giữa.
 *
 * Ngưỡng 3,0:1 chọn từ SỐ ĐO, không từ bảng chuẩn: chỗ thấp nhất trong mười bộ
 * hiện nay là 3,96:1 (bộ "Lửa", nền đen 0,8 trên khung hình sáng). Đặt 3,0 thì
 * mọi bộ đang chạy đều qua với 32% dư địa, mà một cặp màu thật sự không đọc nổi
 * thì trượt. Đây cũng đúng bằng mức WCAG cho chữ khổ lớn — phụ đề luôn là chữ
 * khổ lớn.
 */
const CONTRAST_FLOOR = 3;

/** Độ chói tương đối theo sRGB. */
function luminance(hex: string) {
  const channel = (at: number) => {
    const value = Number.parseInt(hex.replace("#", "").slice(at, at + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** Màu THẬT của một lớp trong suốt khi nó nằm trên một nền cho trước. */
function overBackground(tone: Tone, background: string) {
  const mix = (at: number) => {
    const front = Number.parseInt(tone.color.replace("#", "").slice(at, at + 2), 16);
    const back = Number.parseInt(background.replace("#", "").slice(at, at + 2), 16);
    return Math.round(front * tone.alpha + back * (1 - tone.alpha))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${mix(0)}${mix(2)}${mix(4)}`;
}

function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

for (const pack of STYLE_PACKS) {
  const layers: Array<{ what: string; box: Tone; texts: string[] }> = [];
  if (pack.box) {
    layers.push({
      what: "nền chữ",
      box: pack.box.tone,
      texts: [pack.color.main.color, pack.color.dim.color, pack.color.key.color],
    });
  }
  if (pack.highlight?.box) {
    layers.push({
      what: "nền tiếng đang nói",
      box: pack.highlight.box,
      texts: [pack.highlight.tone.color],
    });
  }
  if (pack.plate) {
    /*
     * Mảng màu đo với màu TIÊU ĐỀ, không đo với màu phụ đề.
     *
     * Chữ nằm trong mảng chỉ có thể là tiêu đề — phụ đề sống trong `SAFE`, mảng
     * màu sống ngoài `SAFE`, nên chúng không bao giờ chồng nhau. Đo bằng màu
     * phụ đề là đo một cặp màu không bao giờ gặp nhau trên khung hình, và nó
     * chặn nhầm đúng dáng "chữ đảo màu trong mảng" mà trục này sinh ra để làm.
     */
    layers.push({
      what: "mảng màu",
      box: pack.plate.tone,
      texts: [(pack.title?.tone ?? pack.color.main).color],
    });
  }
  for (const layer of layers) {
    // Hai đầu: khung hình tối thui và khung hình trắng xoá. Mọi video thật nằm giữa.
    const worst = Math.min(
      ...["#000000", "#FFFFFF"].flatMap((background) => {
        const effective = overBackground(layer.box, background);
        return layer.texts.map((text) => contrast(text, effective));
      }),
    );
    check(
      `"${pack.label}" ${layer.what}: tương phản ${worst.toFixed(2)}:1`,
      worst >= CONTRAST_FLOOR,
      `dưới sàn ${CONTRAST_FLOOR}:1 ở ca xấu nhất`,
    );
  }
}

console.log("\nĐường xuất video chốt định dạng, không để đồ thị tự đàm phán");
/*
 * Không chốt thì định dạng đầu ra là thứ chuỗi lọc TÌNH CỜ đàm phán được, và nó
 * đổi theo từng bộ dáng. Đo thật trên chính repo này trước khi sửa:
 *
 * - phần lớn bộ ra `yuv444p` → **H.264 High 4:4:4 Predictive**, mà Chrome,
 *   Safari và Firefox đều KHÔNG giải mã được
 * - bộ có hình bám chữ ra thẳng `gbrp`, trình phát đọc RGB phẳng như YUV nên cả
 *   video **ám tím**
 *
 * Cả hai không có triệu chứng ở máy phát triển: `ffprobe` báo tệp hợp lệ, thời
 * lượng đúng, QuickTime mở được. Chỉ người xem bằng trình duyệt mới thấy.
 *
 * Quét mã nguồn chứ không dựng thử: dựng một video để kiểm mất vài phút, mà đây
 * là ràng buộc về CHỖ GỌI — một dòng trong chuỗi lọc.
 */
{
  const source = stripComments(readFileSync(join(projectRoot, "server/render.ts"), "utf8"));
  check(
    "chuỗi lọc có bước chuẩn hoá `format=yuv420p`",
    /scale=out_range=tv,format=yuv420p/.test(source),
    "thiếu nó thì mỗi bộ dáng ra một định dạng khác nhau",
  );
  check(
    "đầu ra chốt `-pix_fmt yuv420p`",
    /"-pix_fmt",\s*\n?\s*"yuv420p"/.test(source),
  );
}

console.log("\nHai đường vẽ chữ KHÔNG lẫn vào nhau");
/*
 * Bất biến quan trọng nhất của trục tiêu đề, và nó là ràng buộc về CHỖ GỌI nên
 * chỉ đọc mã mới thấy được — cùng cách canh `pack.defaults` ở trên.
 *
 * Phụ đề mang lời hứa "chữ không bao giờ tràn khung", do `SAFE` ·
 * `MAX_BLOCK_SHARE` · `MAX_LINES` · `MIN_SCALE` giữ. Tiêu đề thì tràn mép là
 * DÁNG. Cho hai loại chữ đi chung một đường rồi thêm một cờ "cái này được tràn"
 * là mất lời hứa kia MỘT LẦN CHO TẤT CẢ — từ đó không ai còn khẳng định được
 * phụ đề nằm trong khung, vì đường bố cục đã có một nhánh nói không.
 */
const headlineSource = stripComments(
  readFileSync(join(projectRoot, "server/headline.ts"), "utf8"),
);
for (const forbidden of ["layoutText(", "placeWords(", "fitLines("]) {
  check(
    `đường tiêu đề không gọi \`${forbidden}\``,
    !headlineSource.includes(forbidden),
    "tiêu đề phải có đường dựng riêng, không đi qua bố cục phụ đề",
  );
}
for (const file of ["server/text-layout.ts", "server/word-layout.ts"]) {
  const source = stripComments(readFileSync(join(projectRoot, file), "utf8"));
  check(
    `${file} không đọc \`pack.title\``,
    !/\btitle\b/.test(source),
    "đường phụ đề mà biết tới tiêu đề là hai đường đã bắt đầu lẫn nhau",
  );
}

console.log("\nMảng màu phải có chữ nằm trong nó");
/*
 * Mảng màu TRỐNG đọc ra như lỗi vẽ, không đọc ra như một mảng màu — bài học từ
 * ba bộ thử ở phiên brainstorm (`anh/ba-bo-thu-tren-footage-that.jpg`).
 *
 * Chữ nằm trong mảng KHÔNG phải phụ đề: phụ đề sống trong `SAFE`, mảng màu sống
 * ngoài `SAFE`, nên chúng không bao giờ chồng nhau — cố ý. Thứ nằm trong mảng là
 * dòng TIÊU ĐỀ, và nó chỉ rơi vào đó khi hai bên khai cùng một dải.
 */
for (const pack of STYLE_PACKS) {
  if (!pack.plate) continue;
  check(
    `"${pack.label}" mảng màu có tiêu đề nằm trong`,
    pack.title?.band === pack.plate.band,
    pack.title
      ? `tiêu đề ở dải ${pack.title.band}, mảng màu ở dải ${pack.plate.band}`
      : "có mảng màu mà không khai tiêu đề — mảng sẽ trống",
  );
}

console.log("\nDòng tiêu đề: rỗng không vẽ, dài không vỡ");
{
  const probeTitle: StylePack = {
    ...BASE_PACK,
    plate: { band: "bottom", heightShare: 0.12, tone: { color: "#2B5CE6", alpha: 1 } },
    title: {
      font: "voice",
      sizeShare: 0.09,
      band: "bottom",
      tone: { color: "#FFFFFF", alpha: 1 },
      bleed: false,
    },
  };
  const shown = withFontRole(probeTitle, probeTitle.title!.font);
  const W = 1080;
  const H = 1920;

  check(
    "bộ không khai `title` thì không vẽ gì",
    (await layoutHeadline("Có chữ hẳn hoi", withFontRole(BASE_PACK, "voice"), W, H)) === null,
  );
  for (const empty of ["", "   ", null, undefined]) {
    check(
      `tiêu đề rỗng (${JSON.stringify(empty)}) thì không vẽ gì`,
      (await layoutHeadline(empty, shown, W, H)) === null,
    );
  }

  // Dài BẤT THƯỜNG: chốt một hành vi rồi kiểm đúng cái đã chốt. Ở đây là THU CỠ
  // — mất một tiếng trong sáu tiếng là mất một phần sáu ý, còn nhỏ đi 15% thì
  // không ai nhận ra. Trần ký tự chỉ chặn ca bệnh hoạn trước khi tới phép thu.
  const long =
    "Ba năm mới hiểu ra một điều mà đáng lẽ ai cũng nên biết từ rất sớm rồi";
  const drawn = (await layoutHeadline(long, shown, W, H))!;
  check("tiêu đề dài vẫn vẽ ra được", Boolean(drawn));
  check(
    "tiêu đề dài bị THU CỠ, không bị cắt giữa tiếng",
    drawn.shrunk && !drawn.text.endsWith("…") && long.startsWith(drawn.text),
    `"${drawn.text}"`,
  );
  const room = headlineRoom(probeTitle.title!, W, usableWidthOf("top", W));
  const drawnWidth = await textWidth(drawn.text, drawn.fontSize, shown);
  check(
    `tiêu đề dài nằm trong chỗ nó có (${Math.round(drawnWidth)} ≤ ${Math.round(room)})`,
    drawnWidth <= room + 1,
  );

  /*
   * HAI phép chặn, và chúng giữ hai thứ khác nhau — nên kiểm riêng từng cái:
   *
   * - `HEADLINE_MAX_CHARS` chặn SỐ KÝ TỰ. Nó là hàng rào chống lạm dụng, cắt ở
   *   biên giới tiếng. Câu 69 ký tự ở trên nằm dưới trần nên nó KHÔNG bị cắt —
   *   đó là chỗ chứng minh phép thu cỡ đứng một mình cũng đủ.
   * - Phép thu cỡ chặn BỀ RỘNG PIXEL. Trần ký tự không thay được nó: một câu 20
   *   ký tự toàn chữ hoa ở bộ dáng khai `sizeShare` lớn vẫn tràn.
   */
  check(
    "câu dưới trần ký tự thì KHÔNG bị cắt chữ nào",
    drawn.text === long,
    `${drawn.text.length}/${long.length} ký tự`,
  );
  const abuse = `${long} ${long} ${long}`;
  const cut = (await layoutHeadline(abuse, shown, W, H))!;
  check(
    "câu vượt trần ký tự bị cắt ở BIÊN GIỚI TIẾNG",
    cut.text.length <= HEADLINE_MAX_CHARS &&
      abuse.startsWith(cut.text) &&
      abuse[cut.text.length] === " ",
    `"${cut.text}"`,
  );
  check(
    "tiêu đề nằm giữa mảng màu, không nằm ngoài",
    drawn.y >= H * (1 - probeTitle.plate!.heightShare) - 1 &&
      drawn.y + drawn.fontSize <= H + 1,
    `y=${drawn.y} cỡ=${drawn.fontSize}, mảng bắt đầu ở ${Math.round(H * 0.88)}`,
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
  pack.fonts.voice.file,
  pack.fonts.accent.file,
  // Hai trục của đợt đồ hoạ. Chúng đổi hẳn hình dạng cả khung hình chứ không chỉ
  // đổi màu mực, nên chúng phải nằm trong phép đếm khác biệt — không thì hai bộ
  // chỉ khác nhau ở mảng màu vẫn bị coi là trùng nhau.
  pack.plate ? `mang:${pack.plate.band}:${pack.plate.tone.color}` : "mang:none",
  pack.title ? `tieu-de:${pack.title.band}:${pack.title.sizeShare}` : "tieu-de:none",
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
/*
 * KHÔNG bộ dáng nào được khai `grade`.
 *
 * Nắn màu là quyết định của NGƯỜI DÙNG, không phải một trục của bộ dáng. Đo
 * trên footage thật: hai bộ khai bão hoà 1,2 và 0,92 ra hai bản mà người xem
 * chỉ đọc được là "cái này ám hơn cái kia" — họ không đọc ra đó là hai phong
 * cách khác nhau. Trục ấy tiêu tiền của người xem vào thứ rẻ nhất mà bộ dáng
 * có thể khác nhau, rồi che mất chuyện nó KHÔNG khác nhau ở chỗ đáng khác.
 *
 * Máy vẫn giữ nguyên bộ lọc (`gradeFilter`, `gradeChannels`) cho lúc người dùng
 * tự chỉnh. Chỉ có chuyện tự nắn theo bộ dáng là bỏ.
 */
const graded = STYLE_PACKS.filter((pack) => pack.grade).map((pack) => pack.label);
check(
  "không bộ dáng nào tự nắn màu",
  graded.length === 0,
  graded.join(", "),
);

/*
 * BẢNG ẢNH PHẢI DỰNG TRẠNG THÁI ĐÃ YÊN, không dựng lối vào.
 *
 * Đồ hoạ của bộ dáng có phần hiện dần / trượt vào, tính từ giây 0. Mà bảng ảnh
 * dựng đúng MỘT khung ở `t=0` của đồ thị lọc — nên để mặc định thì bảng bày ra
 * hình dán trong suốt và mảng màu nằm ngoài khung, tức bày ra một dáng KHÔNG
 * tồn tại. Đây là biến thể thứ năm của cùng một lỗi: bảng nói khác video.
 *
 * Bắt bằng cách đọc mã chứ không bằng cách nhìn ảnh: nhìn ảnh thì phải có người
 * nhìn, mà lỗi này lộ ra đúng ở chỗ không ai nhìn.
 */
const SHEET_SCRIPTS = [
  "scripts/style-packs/render-pack-sheets.ts",
  "scripts/style-packs/render-real-frames.ts",
];
for (const rel of SHEET_SCRIPTS) {
  const source = stripComments(readFileSync(join(projectRoot, rel), "utf8"));
  for (const [fn, still] of [
    ["plateFilter", /plateFilter\([^)]*,\s*false\s*\)/],
    ["graphicsSteps", /graphicsSteps\([^)]*,\s*false\s*(?:,[^)]*)?\)/],
    ["wrapSteps", /wrapSteps\([^)]*,\s*null\s*\)/],
  ] as const) {
    if (!new RegExp(`\\b${fn}\\(`).test(source)) continue;
    check(
      `${rel.split("/").pop()} gọi \`${fn}\` ở trạng thái đã yên`,
      still.test(source),
      "bảng đang dựng lối vào chứ không dựng thứ người xem thấy suốt phim",
    );
  }
}

console.log(`\n${passed} đạt, ${failed} trượt`);
process.exit(failed === 0 ? 0 : 1);
