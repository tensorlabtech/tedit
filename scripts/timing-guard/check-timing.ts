/**
 * Kiểm LUẬT THỜI GIAN. Chạy:
 *
 *   npm run check:timing
 *
 * Ba phần, và phần thứ ba là phần đáng giá nhất:
 *
 * 1. **Bộ dáng khai đúng dải.** Mọi con số vào/ra/chuyển màn trong catalog phải
 *    nằm trong dải đo được từ video mẫu.
 * 2. **Thiết bị luôn có mốc tắt.** Một thiết bị không khai lúc tắt là thiết bị
 *    bật suốt phim — đúng ba lỗi đã mắc trong một buổi, và cả ba đều im lặng.
 * 3. **Phép kiểm phải BẮT được lỗi.** Dựng vài lịch màn cố ý sai rồi đòi
 *    `checkSchedule` báo đúng luật bị vi phạm. Một phép kiểm không bao giờ đỏ
 *    thì không kiểm gì cả — hôm nay tôi đã viết một cái như thế và chỉ phát hiện
 *    khi thử phá nó.
 */
import {
  CUT_MAX,
  ENTER_MAX,
  HERO_MAX,
  SCENE_HARD_MAX,
  SCENE_MAX,
  sceneLengthAt,
  checkMotion,
  checkSchedule,
  type ScheduledScene,
} from "../../server/timing";
import { STYLE_PACKS } from "../../server/style-pack-catalog";
import {
  scheduleScenes,
  type PlacedSegment,
} from "../../server/layout-schedule";
import { HEADLINE_FADE } from "../../server/style-pack";

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

console.log("\nBộ dáng khai vào/ra trong dải đo được");
for (const pack of STYLE_PACKS) {
  const bad: string[] = [];
  if (pack.behindText) {
    bad.push(
      ...checkMotion({ exit: HEADLINE_FADE }).map((v) => `${v.rule} ${v.detail}`),
    );
    if (pack.behindText.seconds < 1 || pack.behindText.seconds > HERO_MAX) {
      bad.push(`R3 chữ sau người sống ${pack.behindText.seconds}s`);
    }
  }
  if (pack.sweep) {
    bad.push(
      ...checkMotion({ cut: pack.sweep.seconds }).map((v) => `${v.rule} ${v.detail}`),
    );
  }
  check(`"${pack.label}" khai đúng dải`, bad.length === 0, bad.join(" · "));
}

console.log("\nThiết bị nổi luôn có mốc TẮT");
/*
 * Thiết bị nào bật mà không bao giờ tắt thì nó thôi là thiết bị.
 *
 * `subjectEdge` khai `share` — phần thời lượng nó chiếm — nên `1` nghĩa là bật
 * suốt. `behindText` khai `seconds`. Cái nào thiếu mốc tắt thì trượt ở đây chứ
 * không đợi ai xem video mới nhận ra.
 */
for (const pack of STYLE_PACKS) {
  const always: string[] = [];
  if (pack.subjectEdge && pack.subjectEdge.share >= 1) always.push("viền quanh người");
  if (pack.behindText && pack.behindText.seconds > SCENE_HARD_MAX) {
    always.push(`chữ sau người (${pack.behindText.seconds}s)`);
  }
  check(`"${pack.label}" không thiết bị nào bật suốt phim`, always.length === 0, always.join(", "));
}

console.log("\nPhép kiểm BẮT được lỗi (thử phá)");
const ok: ScheduledScene[] = [
  { start: 0, end: 4.0, layout: "o-don", hero: "chu-khoi", heroSeconds: 2.6 },
  { start: 4.0, end: 8.5, layout: "toan-khung", hero: null },
  { start: 8.5, end: 12.5, layout: "o-lech", hero: "vien-nguoi", heroSeconds: 3.0 },
  { start: 32.0, end: 38.0, layout: "o-don", hero: null },
];
check("lịch đúng thì không báo gì", checkSchedule(ok).length === 0, JSON.stringify(checkSchedule(ok)));

const cases: Array<[string, string, ScheduledScene[]]> = [
  [
    "R1",
    "màn dài quá trần cứng",
    [{ start: 0, end: SCENE_HARD_MAX + 1, layout: "o-don", hero: "chu-khoi" }],
  ],
  [
    "R1",
    "màn ngắn hơn sàn",
    [
      { start: 0, end: 1.0, layout: "o-don", hero: "chu-khoi", heroSeconds: 1.0 },
      { start: 1.0, end: 5.0, layout: "toan-khung", hero: null },
    ],
  ],
  [
    "R3",
    "thiết bị bật SUỐT màn dài",
    [
      // Không khai `heroSeconds` → hiểu là sống hết màn 12 giây. Đây đúng là
      // lỗi "bật suốt" đã mắc ba lần trong một buổi.
      { start: 0, end: 4.0, layout: "o-don", hero: "a", heroSeconds: 2.5 },
      { start: 32.0, end: 38.0, layout: "o-lech", hero: "vien-nguoi" },
    ],
  ],
  [
    "R4",
    "hai màn nổi dính nhau",
    [
      { start: 0, end: 4.0, layout: "o-don", hero: "chu-khoi", heroSeconds: 2.5 },
      { start: 4.0, end: 8.0, layout: "hai-o", hero: "vien-nguoi", heroSeconds: 2.5 },
    ],
  ],
  [
    "R7",
    "mở màn không có gì",
    [
      { start: 0, end: 4.0, layout: "toan-khung", hero: null },
      { start: 4.0, end: 8.0, layout: "o-don", hero: "chu-khoi", heroSeconds: 2.5 },
    ],
  ],
];
for (const [rule, name, scenes] of cases) {
  const hits = checkSchedule(scenes);
  check(
    `bắt được "${name}" (${rule})`,
    hits.some((v) => v.rule === rule),
    hits.length === 0 ? "không báo gì" : hits.map((v) => v.rule).join(","),
  );
}

console.log("\nDải vào/ra/chuyển màn");
check(`vào quá trần ${ENTER_MAX}s bị bắt`, checkMotion({ enter: ENTER_MAX + 0.5 }).length > 0);
check(`ra quá trần bị bắt`, checkMotion({ exit: 1.2 }).length > 0);
check(`chuyển màn quá ${CUT_MAX}s bị bắt`, checkMotion({ cut: CUT_MAX + 0.2 }).length > 0);
// `volt` chuyển bằng một khung hình (1/24 s) — không được coi là lỗi.
check("chuyển màn một khung hình vẫn đạt", checkMotion({ cut: 1 / 24 }).length === 0);
// Trung vị đo trên bảy mẫu dài là 8,8 giây — dải 7–15 phải bao được nó.
// Nhịp giảm dần: khối 15 giây, mỗi khối thưa hơn khối trước nửa bậc.
check("khối 0 dày (3,0s)", Math.abs(sceneLengthAt(5) - 3.0) < 0.01);
check("khối 1 thưa hơn 1,5 lần (4,5s)", Math.abs(sceneLengthAt(20) - 4.5) < 0.01);
check("khối 2 thưa gấp đôi (6,0s)", Math.abs(sceneLengthAt(35) - 6.0) < 0.01);
check("chạm trần 15s ở phim dài", sceneLengthAt(300) === SCENE_MAX);
check("quanh trung vị 8,8s đo được ở khối 4", Math.abs(sceneLengthAt(65) - 9.0) < 0.01);

/*
 * ══ ENGINE THƯA: chỉ segment ĐÃ ĐẶT, KHÔNG lấp khoảng ══
 *
 * Mô hình mới: toàn-khung là mặc định (không sinh màn), chỉ chỗ khác mặc định
 * mới là segment. `scheduleScenes` không còn "xếp" — nó nhận segment đã đặt rồi
 * kẹp/xếp/bỏ-chồng và trả về. Khoảng trống giữa các segment KHÔNG được lấp: bản
 * dựng vẽ video phủ kín ở đó. Đây là điều bảo đảm không còn "auto-tile" lẻn về.
 */
console.log("\nEngine THƯA: chỉ segment đã đặt, không lấp khoảng");
const placed: PlacedSegment[] = [
  { start: 20, end: 24, layout: "o-lech" }, // khai trước nhưng ra SAU
  { start: 4, end: 7, layout: "hai-o", insert: 0 }, // b-roll
  { start: 6, end: 9, layout: "o-don" }, // CHỒNG lên b-roll → bỏ
  { start: 100, end: 130, layout: "o-don" }, // ngoài phim (total=60) → bỏ
  { start: 30, end: 20, layout: "o-don" }, // end<start → bỏ
];
const sched = scheduleScenes(60, placed);
check(
  "xếp theo mốc bắt đầu",
  sched.map((s) => s.start).join(",") === "4,20",
  sched.map((s) => s.start).join(","),
);
check("bỏ đoạn chồng, hỏng, ngoài phim", sched.length === 2, `còn ${sched.length}`);
check("giữ chỉ số tư liệu b-roll", sched[0]?.insert === 0);
check(
  "khoảng trống KHÔNG lấp (thưa)",
  sched.reduce((sum, s) => sum + (s.end - s.start), 0) < 60,
);
check("mọi màn hero=null (thiết bị nhấn để dành)", sched.every((s) => s.hero === null));
check("không segment nào chồng nhau", sched.every((s, i) => i === 0 || s.start >= sched[i - 1].end));
check("tổng rỗng → lịch rỗng", scheduleScenes(60, []).length === 0);

console.log(`\n${passed} đạt, ${failed} trượt`);
process.exit(failed === 0 ? 0 : 1);
