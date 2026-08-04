/**
 * KIỂM BỘ NHỚ CÂU TRẢ LỜI MÔ HÌNH. Chạy:
 *
 *   npm run check:llm-cache
 *
 * Bộ nhớ này tồn tại vì `seed` KHÔNG cho lặp lại — đo được: hai lượt dựng gpt-5
 * cùng seed 7 ra "3 lượt · gạt 107" và "2 lượt · gạt 41". Nên nó phải đúng,
 * không thì nó chỉ đổi một nguồn dao động này lấy một nguồn dao động khác.
 *
 * Lỗi nguy nhất ở đây là **dùng lại nhầm câu trả lời**: khoá thiếu một thứ đi
 * vào câu hỏi thì hai câu hỏi khác nhau trúng cùng một ô nhớ, và sai kiểu ấy im
 * lặng tuyệt đối — video vẫn xuất, chỉ là nhấn sai từ.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TEDDIT_DATA_ROOT = mkdtempSync(join(tmpdir(), "nho-"));

const { cacheKey, cacheSpend, readCache, writeCache } = await import(
  "../../server/llm-cache"
);

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

const BASE = {
  model: "openai/gpt-5",
  schemaName: "tu-nhan",
  instructions: "Chọn từ nhấn.",
  input: "Mình bị layoff hồi tháng ba.",
  images: [] as { mimeType: string; base64: string }[],
  effort: undefined as string | undefined,
};

console.log("\nCùng câu hỏi → cùng khoá");
check("khoá lặp lại được", cacheKey(BASE) === cacheKey({ ...BASE }));
check(
  "khoá là chuỗi băm 64 ký tự",
  /^[0-9a-f]{64}$/.test(cacheKey(BASE)),
  cacheKey(BASE).slice(0, 20),
);

/*
 * ══ ĐỔI BẤT KỲ THỨ GÌ ĐI VÀO CÂU HỎI → PHẢI ĐỔI KHOÁ ══
 *
 * Đây là phần đáng giá nhất của tệp. Thiếu một trường trong khoá thì hai câu
 * hỏi khác nhau dùng chung một câu trả lời — mà mọi phép kiểm khác vẫn xanh, vì
 * bộ nhớ *có* trả về một giá trị hợp lệ, chỉ là của câu hỏi khác.
 *
 * `model` nằm trong đây vì chính chuyện so hai mô hình là lý do bộ nhớ này ra
 * đời: thiếu nó thì đổi sang DeepSeek sẽ nhận lại nguyên câu trả lời của gpt-5,
 * và bảng so sánh ra hai cột giống hệt nhau.
 */
console.log("\nĐổi một thứ trong câu hỏi thì khoá phải đổi");
const different: Array<[string, Partial<typeof BASE>]> = [
  ["mô hình", { model: "deepseek/deepseek-v4-flash" }],
  ["tên schema", { schemaName: "chỗ-nối" }],
  ["lời nhắc hệ thống", { instructions: "Chọn chỗ cắt." }],
  ["đầu vào", { input: "Mình bị layoff hồi tháng tư." }],
  ["mức suy luận", { effort: "low" }],
  ["ảnh kèm", { images: [{ mimeType: "image/png", base64: "AAAA" }] }],
];
for (const [name, patch] of different) {
  check(
    `đổi ${name} → khoá khác`,
    cacheKey({ ...BASE, ...patch }) !== cacheKey(BASE),
  );
}
// Hai ảnh KHÁC NỘI DUNG cùng kiểu tệp cũng phải ra hai khoá.
check(
  "hai ảnh khác nội dung → khoá khác",
  cacheKey({ ...BASE, images: [{ mimeType: "image/png", base64: "AAAA" }] }) !==
    cacheKey({ ...BASE, images: [{ mimeType: "image/png", base64: "BBBB" }] }),
);

console.log("\nGhi rồi đọc lại ra đúng thứ đã ghi");
const key = cacheKey(BASE);
check("chưa ghi thì đọc ra null", readCache(key) === null);
const value = { keywords: ["layoff", "tháng ba"], rounds: 2 };
writeCache(key, value, BASE.model);
check("đọc lại đúng giá trị", JSON.stringify(readCache(key)) === JSON.stringify(value));
check("đếm được lần trúng", cacheSpend.hits === 1, `${cacheSpend.hits}`);
check("đếm được lần trượt", cacheSpend.misses === 1, `${cacheSpend.misses}`);

/*
 * Tệp hỏng thì HỎI LẠI mô hình, không ném lỗi.
 *
 * Bộ nhớ đệm hỏng không được phép làm sập một lượt dựng — người dùng mất hai
 * mươi phút vì một tệp JSON cụt là cái giá không đáng.
 */
console.log("\nTệp hỏng thì coi như chưa có, không ném lỗi");
const bad = cacheKey({ ...BASE, input: "hỏng" });
writeCache(bad, { a: 1 }, BASE.model);
writeFileSync(
  join(process.env.TEDDIT_DATA_ROOT!, "llm-cache", bad.slice(0, 2), `${bad}.json`),
  "{ cụt",
  "utf8",
);
let threw = false;
let got: unknown = "chưa chạy";
try {
  got = readCache(bad);
} catch {
  threw = true;
}
check("không ném lỗi", !threw);
check("trả về null", got === null, String(got));

console.log("\nTắt được bằng biến môi trường");
process.env.TEDDIT_LLM_CACHE = "0";
const fresh = await import(`../../server/llm-cache?tat=${Date.now()}`);
const k2 = fresh.cacheKey(BASE);
fresh.writeCache(k2, { x: 1 }, BASE.model);
check("TEDDIT_LLM_CACHE=0 thì không ghi và không đọc", fresh.readCache(k2) === null);

console.log(`\n${passed} đạt, ${failed} trượt`);
process.exit(failed === 0 ? 0 : 1);
