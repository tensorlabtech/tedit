/**
 * KIỂM LUỒNG BA PHA. Chạy:
 *
 *   npm run check:flow
 *
 * Mạch dựng nay dừng hai lần chờ người: sau khi đề xuất chỗ cắt, và sau khi sửa
 * chỗ nghe nhầm. Hai cổng ấy dễ hỏng theo kiểu IM LẶNG nhất trong cả hệ, và
 * chính tệp `pipeline-steps.ts` đã ghi lại lần trước:
 *
 *   "`STEP_PLAN` và danh sách phép chạy ở `pipeline.ts` là HAI danh sách, chỉ
 *    cần một chặng có tên trong bảng mà không có phép chạy là nó nằm chờ mãi.
 *    Đo thật: một dự án treo ở 10/11."
 *
 * Treo kiểu ấy khoá cổng vào bàn dựng vĩnh viễn — người dùng không có đường nào
 * mở ra. Nên phép kiểm đầu tiên ở đây là: mọi chặng trong bảng phải có người
 * chạy nó.
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TEDDIT_DATA_ROOT = mkdtempSync(join(tmpdir(), "luong-"));

const { STEP_PLAN, pipelineState, resetSteps, setStep } = await import(
  "../../server/pipeline-steps"
);
const { db } = await import("../../server/db");

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

const SRC = readFileSync(
  join(import.meta.dirname, "..", "..", "server", "pipeline.ts"),
  "utf8",
);

console.log("\nMọi chặng trong bảng đều có người chạy");
/*
 * Ba nguồn chạy một chặng, và một chặng phải trúng ĐÚNG MỘT trong ba:
 *
 * · `markStepRunning(projectId, "<khoá>")` — chặng viết tay trong một pha
 * · `runAiWaves(..., [... "<khoá>" ...])` — chặng làm đẹp
 * · `setStep(..., "<khoá>", "cho-nguoi")` — cổng chờ người, không ai "chạy" nó
 */
for (const step of STEP_PLAN) {
  const written = SRC.includes(`markStepRunning(projectId, "${step.key}")`);
  const wave = new RegExp(`runAiWaves\\([^)]*"${step.key}"`, "s").test(SRC);
  const gate = SRC.includes(`setStep(projectId, "${step.key}", "cho-nguoi"`);
  check(
    `"${step.key}" có người chạy`,
    written || wave || gate,
    "không chặng nào trong pipeline.ts nhắc tới nó",
  );
}

/*
 * ══ MỌI CHẶNG PHẢI CÓ TÊN TIẾNG VIỆT ══
 *
 * `STEP_LABELS` nằm ở client còn `STEP_PLAN` ở máy chủ — hai danh sách, và
 * thêm một chặng chỉ sửa một bên là chuyện xảy ra ngay lần đầu: ba chặng mới
 * hiện lên màn chờ dưới dạng "soat-cat", "chot", "soat-chu".
 *
 * Không hỏng gì cả, nên không phép kiểm nào thấy — chỉ người dùng thấy.
 */
console.log("\nMọi chặng có tên tiếng Việt trên màn chờ");
const PAGE = readFileSync(
  join(import.meta.dirname, "..", "..", "src", "routes", "pipeline", "pipeline-page.tsx"),
  "utf8",
);
const labels = PAGE.slice(PAGE.indexOf("const STEP_LABELS"), PAGE.indexOf("};", PAGE.indexOf("const STEP_LABELS")));
for (const step of STEP_PLAN) {
  check(
    `"${step.key}" có tên hiện ra`,
    new RegExp(`["']?${step.key}["']?\\s*:`).test(labels),
    "chặng này sẽ hiện ra dưới dạng khoá thô trên màn chờ",
  );
}

console.log("\nHai cổng chờ người mở đúng chỗ");
const gates = STEP_PLAN.filter((s) =>
  SRC.includes(`setStep(projectId, "${s.key}", "cho-nguoi"`),
).map((s) => s.key);
check("có đúng hai cổng", gates.length === 2, gates.join(", "));
check(
  "cổng soát cắt đứng TRƯỚC chặng chốt",
  STEP_PLAN.findIndex((s) => s.key === "soat-cat") <
    STEP_PLAN.findIndex((s) => s.key === "chot"),
);
/*
 * Sửa chính tả phải nằm SAU khi chốt.
 *
 * Chốt là chép lời lại, và chép lại ghi đè sạch bảng từ. Sửa trước là ném đi
 * công sửa — người dùng sửa "TensorLab" rồi thấy máy trả về "Tenso Lab" lần nữa.
 */
check(
  "sửa chỗ nghe nhầm đứng SAU chặng chốt",
  STEP_PLAN.findIndex((s) => s.key === "fix") >
    STEP_PLAN.findIndex((s) => s.key === "chot"),
);
check(
  "cổng soát chính tả đứng TRƯỚC chặng dựng chữ",
  STEP_PLAN.findIndex((s) => s.key === "soat-chu") <
    STEP_PLAN.findIndex((s) => s.key === "captions"),
);
/*
 * Hai lượt cắt phải đứng TRƯỚC chặng dựng chữ.
 *
 * Trước đợt này chúng chạy sau, tức chữ dựng xong rồi mới quyết cắt ở đâu — nên
 * mọi cụm phải neo lại và mọi mốc phải quy đổi giữa hai trục thời gian. Đếm
 * được 29 chỗ quy đổi như thế, và ba lỗi lệch nặng nhất đều từ chúng.
 */
for (const key of ["silence", "cuts"]) {
  check(
    `"${key}" đứng trước chặng dựng chữ`,
    STEP_PLAN.findIndex((s) => s.key === key) <
      STEP_PLAN.findIndex((s) => s.key === "captions"),
  );
}

console.log("\nCổng mở thì bàn dựng ĐÓNG");
const projectId = "prj_kiem_luong";
db.prepare("INSERT INTO projects (id, title, created_at) VALUES (?,?,?)").run(
  projectId,
  "kiểm luồng",
  0,
);
resetSteps(projectId);
for (const step of STEP_PLAN) setStep(projectId, step.key, "done");
const all = pipelineState(projectId);
check("mọi chặng xong → mở được bàn dựng", all.settled && all.awaiting === null);

setStep(projectId, "soat-cat", "cho-nguoi");
const gated = pipelineState(projectId);
check("cổng mở → bàn dựng đóng", !gated.settled, `settled=${gated.settled}`);
check("báo đúng cổng nào đang mở", gated.awaiting === "soat-cat", String(gated.awaiting));

/*
 * `failStrandedSteps` phải CHỪA cổng ra.
 *
 * Nó sinh ra để đánh hỏng chặng không còn ai đánh thức. Mà cổng chờ người đúng
 * là chặng không ai đánh thức — người dùng mới đánh thức được. Không chừa thì
 * cổng vừa mở đã bị đánh hỏng, và mạch chết ngay tại chỗ.
 */
const { failStrandedSteps } = await import("../../server/pipeline-steps");
failStrandedSteps(projectId, "thử");
const afterSweep = pipelineState(projectId);
check(
  "quét chặng mắc kẹt KHÔNG đánh hỏng cổng",
  afterSweep.awaiting === "soat-cat",
  `cổng thành ${afterSweep.steps.find((s) => s.key === "soat-cat")?.status}`,
);

db.prepare("DELETE FROM projects WHERE id=?").run(projectId);
console.log(`\n${passed} đạt, ${failed} trượt`);
process.exit(failed === 0 ? 0 : 1);
