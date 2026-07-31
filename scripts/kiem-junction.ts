/**
 * Kiểm VỐN TỪ CHUYỂN CẢNH: mỗi kiểu phải dựng được chuỗi lọc mà ffmpeg chạy
 * trót lọt.
 *
 *   npx tsx scripts/kiem-junction.ts
 *
 * ── Vì sao KHÔNG kiểm luôn "hình có đổi không" ──
 *
 * Đã thử: lấy một khung ở đỉnh xung và một khung ngoài quãng, rồi so với khung
 * gốc bằng `magick compare`. Phép ấy báo cả chín kiểu hình học đều "rò ra
 * ngoài" với con số y hệt nhau — mà con số giống hệt nhau ở chín ca khác nhau
 * là dấu hiệu phép đo hỏng, không phải chín lỗi giống nhau.
 *
 * Kiểm tay ba lần, kể cả với đúng biểu thức xung mà `junctionFilter` sinh ra:
 * khung ngoài quãng khác khung gốc `0 (0)` — tức y hệt. Chuỗi lọc đúng.
 *
 * Nên phần đo ảnh bị gỡ thay vì để lại: một phép kiểm báo động giả còn tệ hơn
 * không có phép kiểm nào — nó dạy người đọc bỏ qua kết quả đỏ. Ai làm tiếp
 * phần này thì bắt đầu từ chỗ đó: nguồn phải TĨNH (`smptebars`, không phải
 * `testsrc2`), và phải tìm cho ra vì sao chạy trong script lại khác chạy tay.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { JUNCTION_SPECS } from "../server/junction-kinds";
import { junctionFilter } from "../server/render";

const run = promisify(execFile);
const pack = { intensity: { punchScale: 0.08, flashAmount: 0.7 } } as never;

async function main() {
  let ok = 0;
  const hong: string[] = [];
  for (const spec of JUNCTION_SPECS) {
    const chain = junctionFilter([{ start: 0.4, end: 1, peak: 0.7 }], spec.id, pack);
    if (!chain) {
      console.log(`  (không có bộ lọc)  ${spec.id}`);
      continue;
    }
    try {
      await run(
        "ffmpeg",
        ["-hide_banner", "-f", "lavfi", "-i", "smptebars=size=270x480:rate=25:duration=1.4",
         "-vf", chain, "-frames:v", "10", "-f", "null", "-"],
        { timeout: 40000 },
      );
      console.log(`  OK                 ${spec.id}`);
      ok++;
    } catch (e) {
      const line = String((e as { stderr?: string }).stderr ?? e)
        .split("\n")
        .filter((l) => /Error|Invalid|No such|failed/i.test(l))[0];
      console.log(`  HỎNG               ${spec.id} — ${(line ?? "").trim().slice(0, 110)}`);
      hong.push(spec.id);
    }
  }
  console.log(`\n${ok} kiểu chạy được · ${hong.length} hỏng${hong.length ? ": " + hong.join(", ") : ""}`);
  if (hong.length > 0) process.exitCode = 1;
}

void main();
