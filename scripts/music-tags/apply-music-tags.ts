/**
 * Gán BA TRỤC NHÃN cho mọi bài trong kho nhạc, ghi vào `library_tracks`.
 *
 * Ba trục lấy bằng chứng từ ba nguồn khác nhau, và mỗi nguồn được dùng đúng ở
 * chỗ nó đáng tin:
 *
 * - **năng lượng** ← nhãn của người soạn kho (`kho.json`), rơi về phép đo độ
 *   sáng khi bài không có nhãn nào. Người soạn nghe rồi mới gắn "dồn dập" hay
 *   "ru êm", còn phép đo chỉ biết phổ — nên chữ thắng số ở trục này.
 * - **độ dày** ← phép đo. "Dày" là nhiều lớp chồng nhau, và đó đúng là thứ
 *   `rolloff` với `flatness` đo được; không ai gắn nhãn dày/thưa bằng tai một
 *   cách nhất quán qua 55 bài.
 * - **có lời** ← chạy nhận dạng giọng nói lên chính bài đó. Không đo bằng phổ:
 *   giọng hát và nhạc cụ chồng lên nhau trong cùng dải tần.
 *
 * Chạy lại được và cho cùng kết quả — đó là điều một buổi gán nhãn bằng tai
 * không làm được, mà kho thì sẽ còn lớn lên.
 *
 *   node scripts/music-tags/measure-tracks.mjs > plans/.../music-features.json
 *   node scripts/music-tags/detect-vocals.mjs  > plans/.../music-vocals.json
 *   npx tsx scripts/music-tags/apply-music-tags.ts <features.json> <vocals.json>
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { db } from "../../server/db";
import { AUDIO, LIBRARY } from "../../server/music-library";
import type { Density, Energy, Vocal } from "../../server/music-tags";

type Features = {
  file: string;
  rms: number | null;
  crest: number | null;
  centroid: number | null;
  flatness: number | null;
  rolloff: number | null;
};
type Vocals = { file: string; vocal: Vocal };

const [featuresPath, vocalsPath] = process.argv.slice(2);
if (!featuresPath || !vocalsPath) {
  console.error("Cần hai đường dẫn: <features.json> <vocals.json>");
  process.exit(1);
}

const features = new Map(
  (JSON.parse(readFileSync(featuresPath, "utf8")) as Features[]).map((row) => [
    row.file,
    row,
  ]),
);
const vocals = new Map(
  (JSON.parse(readFileSync(vocalsPath, "utf8")) as Vocals[]).map((row) => [
    row.file,
    row.vocal,
  ]),
);

/** Nhãn của người soạn kho, đi kèm mấy bài tải sẵn. */
function readCuratorTags(): Map<string, string[]> {
  const path = join(LIBRARY, "kho.json");
  if (!existsSync(path)) return new Map();
  const raw = JSON.parse(readFileSync(path, "utf8")) as {
    tracks?: Array<{ file?: string; tags?: string[] }>;
  };
  return new Map(
    (raw.tracks ?? [])
      .filter((track) => track.file)
      .map((track) => [track.file!, (track.tags ?? []).map((t) => t.toLowerCase())]),
  );
}

/** Từ khoá của người soạn kho, quy về trục năng lượng. */
const ENERGY_WORDS: Record<Energy, string[]> = {
  manh: ["mạnh", "dồn dập", "năng lượng", "phonk", "energetic", "intense"],
  vua: [
    "vui",
    "tươi sáng",
    "phiêu lưu",
    "game",
    "chiptune",
    "công nghệ",
    "happy",
    "bright",
    "kể chuyện",
  ],
  em: [
    "thư giãn",
    "thư thái",
    "chậm",
    "tĩnh",
    "ru êm",
    "buồn",
    "trầm lắng",
    "nhẹ nhàng",
    "nhẹ nhõm",
    "lo-fi",
    "lofi",
    "chill",
    "relax",
    "relaxed",
    "relaxing",
    "calm",
    "peaceful",
    "soft",
    "sad",
    "dreamy",
    "reflection",
  ],
};

/**
 * Ngưỡng ĐỘ SÁNG cho bài không có nhãn nào, chia theo phân vị đo được của chính
 * kho này (p33 ≈ 1208 Hz, p66 ≈ 1776 Hz) chứ không theo một con số chung chung:
 * ngưỡng tuyệt đối lấy từ đâu đó khác sẽ dồn cả kho lo-fi này vào một ô.
 */
const BRIGHT_HIGH = 1776;
const BRIGHT_LOW = 1208;

/** Ngưỡng ĐỘ DÀY — trung vị `rolloff` của kho. */
const THICK_ROLLOFF = 2688;

function energyOf(file: string, curator: string[]): Energy {
  for (const level of ["manh", "vua", "em"] as Energy[]) {
    if (curator.some((tag) => ENERGY_WORDS[level].includes(tag))) return level;
  }
  const centroid = features.get(file)?.centroid ?? 0;
  if (centroid >= BRIGHT_HIGH) return "manh";
  if (centroid >= BRIGHT_LOW) return "vua";
  return "em";
}

function densityOf(file: string): Density {
  const row = features.get(file);
  if (!row?.rolloff) return "thua";
  return row.rolloff >= THICK_ROLLOFF ? "day" : "thua";
}

/*
 * `title` và `tags` để RỖNG, không điền lại.
 *
 * `listLibrary` xếp ba nguồn mô tả chồng lên nhau và hàng CSDL là lớp trên cùng
 * (`music-library.ts`). Điền tên tệp vào `title` ở đây là đè mất tiêu đề đẹp
 * trong `kho.json` cho cả 55 bài — một hàng thêm vào để gán nhãn không được
 * phép cướp chỗ của lớp mô tả bên dưới.
 */
const upsert = db.prepare(
  `INSERT INTO library_tracks (file, title, tags, seconds, created_at, energy, density, vocal)
   VALUES (?, NULL, NULL, NULL, ?, ?, ?, ?)
   ON CONFLICT(file) DO UPDATE SET
     energy=excluded.energy, density=excluded.density, vocal=excluded.vocal`,
);

const curatorTags = readCuratorTags();
const files = readdirSync(LIBRARY).filter((name) => AUDIO.test(name));
const counts = { manh: 0, vua: 0, em: 0, day: 0, thua: 0, coLoi: 0 };

db.transaction(() => {
  for (const file of files) {
    const energy = energyOf(file, curatorTags.get(file) ?? []);
    const density = densityOf(file);
    // Không dò được thì để KHÔNG LỜI: kho này toàn nhạc nền, và nhầm một bài có
    // lời thành không lời chỉ làm nó lọt vào tập chọn — còn nhầm chiều ngược lại
    // là loại oan một bài dùng được.
    const vocal = vocals.get(file) ?? "khong-loi";
    upsert.run(file, Date.now(), energy, density, vocal);
    counts[energy] += 1;
    counts[density] += 1;
    if (vocal === "co-loi") counts.coLoi += 1;
  }
})();

console.log(`Đã gán nhãn ${files.length} bài`);
console.log(`  năng lượng: mạnh ${counts.manh} · vừa ${counts.vua} · êm ${counts.em}`);
console.log(`  độ dày:     dày ${counts.day} · thưa ${counts.thua}`);
console.log(`  có lời:     ${counts.coLoi} bài`);
