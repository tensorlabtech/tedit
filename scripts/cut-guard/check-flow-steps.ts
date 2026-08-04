/**
 * KIỂM VỐN TỪ TÁM BƯỚC. Chạy:
 *
 *   npm run check:steps
 *
 * Bước hiện tại SUY RA từ trạng thái thật chứ không lưu cột nào — nên phép suy
 * ấy là chỗ duy nhất có thể sai, và sai thì người dùng đứng ở bước 6 mà sidebar
 * tô bước 3, không ai gỡ được.
 *
 * Phần cuối cố tình phá: một phép suy không bao giờ ra sai thì nó không suy gì.
 */
import {
  FLOW_STEPS,
  ONE_WAY_AFTER,
  canGoBack,
  STAGES_OF,
  currentStep,
  stepIndex,
  type FlowState,
  type FlowStepId,
} from "../../server/flow-steps";

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

const TRONG: FlowState = {
  hasMain: false,
  hasBrief: false,
  awaiting: null,
  settled: false,
  started: false,
};

console.log("\nVốn từ đủ và không trùng");
check("có đúng tám bước", FLOW_STEPS.length === 8, `${FLOW_STEPS.length}`);
check(
  "không mã nào trùng",
  new Set(FLOW_STEPS.map((s) => s.id)).size === FLOW_STEPS.length,
);
check("mọi bước có nhãn tiếng Việt", FLOW_STEPS.every((s) => s.label.trim().length > 0));
/*
 * Xen kẽ NGƯỜI và MÁY.
 *
 * Không phải luật thẩm mỹ: hai bước máy liền nhau nghĩa là người dùng ngồi chờ
 * hai lượt mà sidebar chỉ nhích một dòng, và lúc ấy họ không biết còn bao lâu.
 * Gộp hai lượt máy vào một dòng thì thanh tiến độ nói được thật.
 */
let lienTiepMay = 0;
for (const step of FLOW_STEPS) {
  lienTiepMay = step.actor === "machine" ? lienTiepMay + 1 : 0;
  check(
    `"${step.label}" không nối tiếp một bước máy khác`,
    lienTiepMay <= 1,
    "hai bước máy liền nhau — gộp lại thành một dòng",
  );
}

console.log("\nSuy đúng bước từ trạng thái");
const cases: Array<[string, Partial<FlowState>, FlowStepId]> = [
  ["dự án trống", {}, "main-footage"],
  // Chưa có đề bài thì đứng ở CẢNH PHỤ, không nhảy cóc sang đề bài.
  ["có cảnh chính, chưa có đề bài", { hasMain: true }, "b-roll"],
  ["có đề bài rồi", { hasMain: true, hasBrief: true }, "brief"],
  ["mạch đang chạy", { hasMain: true, hasBrief: true, started: true }, "preparing"],
  ["cổng cắt mở", { started: true, awaiting: "review-cut" }, "cut"],
  ["cổng chữ mở", { started: true, awaiting: "review-text" }, "proofread"],
  ["chạy xong", { started: true, settled: true }, "studio"],
];
for (const [name, patch, want] of cases) {
  const got = currentStep({ ...TRONG, ...patch });
  check(`${name} → ${want}`, got === want, `ra "${got}"`);
}

console.log("\nĐúng MỘT cửa một chiều");
check(
  `cửa nằm sau "${ONE_WAY_AFTER}"`,
  stepIndex(ONE_WAY_AFTER) >= 0,
);
check("từ soát lời KHÔNG về được cắt đoạn", !canGoBack("proofread", "cut"));
check("từ bàn dựng KHÔNG về được cắt đoạn", !canGoBack("studio", "cut"));
/*
 * Bảy chỗ còn lại phải về được.
 *
 * Khoá hết là chặt hơn dữ liệu đòi hỏi — chỉ chốt lát cắt mới xoá bản chép cũ.
 * Người dùng va vào cái khoá vô cớ đầu tiên là mất tin vào cả cái sidebar.
 */
check("từ đề bài về được cảnh chính", canGoBack("brief", "main-footage"));
check("từ cắt đoạn về được đề bài", canGoBack("cut", "brief"));
check("từ bàn dựng về được soát lời", canGoBack("studio", "proofread"));
check("đi TỚI thì luôn được", canGoBack("main-footage", "studio"));

console.log("\nBa bước nạp KHÔNG chặn");
/*
 * Tải tệp chạy nền, còn ba bước đầu là quyết định của người — chẳng động tới
 * byte nào. Bắt đợi ở đó là bịa ra một khoảng chờ, và đẩy chỗ đợi thật ("Chuẩn
 * bị") thành một thanh tiến độ giả vì lúc ấy đã hết gì để đợi.
 */
for (const id of ["main-footage", "b-roll", "brief"] as const) {
  const step = FLOW_STEPS.find((s) => s.id === id)!;
  check(`"${step.label}" không chặn`, !step.blocks);
}
check(
  '"Chuẩn bị" thì CHẶN',
  FLOW_STEPS.find((s) => s.id === "preparing")!.blocks,
);

/*
 * ══ MÃ ĐỊNH DANH PHẢI LÀ TIẾNG ANH ══
 *
 * `CLAUDE.md`: "Dùng full Tiếng Anh (tên hàm, biến, đường dẫn, ... tất cả mọi
 * thứ), chỉ có cái text hiện lên UI là tiếng Việt thôi."
 *
 * Tôi vi phạm ở cả tám mã bước, ba khoá chặng, một trạng thái và một đường dẫn
 * — và không có gì hỏng nên không phép kiểm nào thấy. Chỉ người đọc mã thấy.
 *
 * Dò bằng DẤU TIẾNG VIỆT không đủ: "soat-cat" không dấu nào mà vẫn là tiếng
 * Việt. Nên dò bằng danh sách chữ cái hay gặp trong mã tiếng Việt viết không
 * dấu — thô, nhưng nó bắt được đúng loại tên tôi vừa đặt sai.
 */
console.log("\nMã định danh là tiếng Anh, nhãn mới là tiếng Việt");
const VIETNAMESE = /^(canh|de|chuan|cat|soat|dung|ban|nguoi|may|nap|chinh|phu|chot|cho)(-|$)/;
for (const step of FLOW_STEPS) {
  check(`mã "${step.id}" không phải tiếng Việt`, !VIETNAMESE.test(step.id));
  check(`nhóm "${step.group}" không phải tiếng Việt`, !VIETNAMESE.test(step.group));
}
check("vai người/máy dùng từ tiếng Anh", FLOW_STEPS.every((s) => s.actor === "user" || s.actor === "machine"));

/*
 * ══ MỖI CHẶNG MÁY THUỘC ĐÚNG MỘT BƯỚC ══
 *
 * Bản đầu bước "Chuẩn bị" bày cả mười bốn chặng, kể cả những chặng chạy sau khi
 * người dùng soát cắt xong — người xem đọc ra là "máy làm hết mọi thứ", rồi tới
 * bước 7 lại thấy y nguyên danh sách ấy.
 *
 * Sót một chặng thì nó không hiện ở đâu cả; xếp nó vào hai bước thì nó hiện hai
 * lần. Cả hai đều im lặng.
 */
console.log("\nMỗi chặng máy thuộc đúng một bước");
const { STEP_PLAN } = await import("../../server/pipeline-steps");
const owned = Object.values(STAGES_OF).flat();
for (const step of STEP_PLAN) {
  check(
    `chặng "${step.key}" có bước nhận`,
    owned.filter((key) => key === step.key).length === 1,
    `${owned.filter((key) => key === step.key).length} bước nhận nó`,
  );
}
check(
  "không bước nào nhận chặng không có thật",
  owned.every((key) => STEP_PLAN.some((step) => step.key === key)),
  owned.filter((key) => !STEP_PLAN.some((s) => s.key === key)).join(", "),
);

console.log("\nPhép kiểm BẮT được lỗi (thử phá)");
// Cổng mở mà mạch báo đã xong: trạng thái mâu thuẫn, và `settled` phải thắng
// vì `pipelineState` không bao giờ trả cả hai — cổng làm `settled` sai.
check(
  "trạng thái mâu thuẫn không làm sập phép suy",
  currentStep({ ...TRONG, settled: true, awaiting: "review-cut" }) === "studio",
);
check(
  "mã bước lạ trả -1 chứ không ném",
  stepIndex("khong-co-that" as FlowStepId) === -1,
);

console.log(`\n${passed} đạt, ${failed} trượt`);
process.exit(failed === 0 ? 0 : 1);
