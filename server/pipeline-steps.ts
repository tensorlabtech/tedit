import { db } from "./db";

/**
 * Từng chặng của lượt dựng.
 *
 * MÁY LÀM XONG HẾT RỒI MỚI TỚI LƯỢT NGƯỜI DÙNG — nên bàn dựng đóng cho tới khi
 * `pipelineState` trả `settled`. Vì không ai sửa trong lúc máy ghi nên máy không
 * bao giờ đè mất việc người dùng đã làm; đó là cả lý do chọn chạy tuần tự.
 */

export type StepStatus = "waiting" | "running" | "done" | "failed";

export type Step = {
  key: string;
  position: number;
  status: StepStatus;
  /** Thứ chặng này ĐẺ RA — "219 đoạn" nói được nhiều hay ít, dấu tích thì không */
  result: string | null;
  /** Vì sao hỏng — chỉ có ở chặng hỏng */
  error: string | null;
  /** Hỏng chặng này thì có ra được sản phẩm không */
  required: boolean;
  /** Mốc đổi trạng thái; với chặng đang chạy đây là lúc nó bắt đầu */
  updatedAt: number;
};

type StepRow = {
  key: string;
  position: number;
  status: string;
  result: string | null;
  error: string | null;
  required: number;
  updated_at: number;
};

/**
 * Thứ tự các chặng có thật hôm nay. Tên hiện ra nằm ở client
 * (`src/routes/pipeline/pipeline-page.tsx`) — chữ trên màn là tiếng Việt và
 * thuộc về chỗ vẽ, máy chủ chỉ cần biết khoá và thứ tự.
 *
 * Ba chặng đầu nằm gọn trong MỘT job `transcribe` chạy một mạch — tách ra thành
 * ba dòng là để NHÌN, không phải để chạy lại riêng từng cái. Các lượt AI sẽ nối
 * vào cuối danh sách này, và chúng mới là thứ chạy lại riêng được.
 */
export const STEP_PLAN: Array<{ key: string; required: boolean }> = [
  { key: "prepare", required: true },
  // Đọc tư liệu chèn TRƯỚC khi nghe: nó không cần bản chép lời, mà từ vựng nó
  // sinh ra ("hợp đồng", "bàn phím cơ"…) lại mồi được cho máy nghe. Đặt sau thì
  // phí mất cả một kênh chống nghe nhầm.
  { key: "describe", required: false },
  { key: "transcribe", required: true },
  // Sửa lời chạy TRƯỚC khi sinh chữ: sinh xong rồi mới sửa thì phải dựng lại
  // toàn bộ chữ, mà chữ lúc ấy có thể đã mang lựa chọn của người dùng.
  { key: "fix", required: false },
  { key: "captions", required: true },
  // Từ đây là các lượt AI. Tất cả `required: false` — chúng LÀM ĐẸP chứ không
  // dựng nên sản phẩm, nên hỏng thì bỏ qua rồi đi tiếp. Giam người dùng lại vì
  // một lượt chọn từ khoá gãy là đổi một video xem được lấy không gì cả.
  // Cắt lặng KHÔNG cần mô hình nên không bao giờ hỏng vì hết khoá hay mạng —
  // nhưng vẫn để `required: false` cho cùng luật với các chặng làm đẹp khác.
  { key: "silence", required: false },
  { key: "cuts", required: false },
  { key: "keywords", required: false },
  { key: "emoji", required: false },
  { key: "place", required: false },
  { key: "effects", required: false },
  { key: "music", required: false },
];

/** Dựng lại danh sách chặng từ đầu — gọi lúc bắt đầu một lượt dựng. */
export function resetSteps(projectId: string) {
  const now = Date.now();
  db.transaction(() => {
    db.prepare("DELETE FROM steps WHERE project_id=?").run(projectId);
    for (const [index, step] of STEP_PLAN.entries()) {
      db.prepare(
        `INSERT INTO steps (project_id, key, position, status, required, updated_at)
         VALUES (?,?,?,'waiting',?,?)`,
      ).run(projectId, step.key, index, step.required ? 1 : 0, now);
    }
  })();
}

/**
 * Ghi trạng thái một chặng.
 *
 * `result` chỉ ghi khi có: gọi lúc chuyển sang `running` mà cũng xoá luôn
 * `result` thì con số vừa hiện ra lại biến mất giữa chừng.
 */
export function setStep(
  projectId: string,
  key: string,
  status: StepStatus,
  extra?: { result?: string; error?: string },
) {
  db.prepare(
    `UPDATE steps
     SET status=?, result=COALESCE(?,result), error=?, updated_at=?
     WHERE project_id=? AND key=?`,
  ).run(
    status,
    extra?.result ?? null,
    extra?.error ?? null,
    Date.now(),
    projectId,
    key,
  );
}

/** Đánh hỏng chặng đang chạy — dùng khi cả lượt dựng ném lỗi. */
export function failRunningStep(projectId: string, message: string) {
  db.prepare(
    `UPDATE steps SET status='failed', error=?, updated_at=?
     WHERE project_id=? AND status='running'`,
  ).run(message, Date.now(), projectId);
}

/**
 * Đánh hỏng những chặng KHÔNG CÒN AI CHẠY — gọi khi cả mạch đã đi hết.
 *
 * Chặng `waiting` trên màn chờ không có con quay và không có nút Thử lại: nó
 * trông y hệt một chặng sắp tới. Nhưng mạch đã đi hết mà nó vẫn `waiting` thì
 * không còn lượt nào đánh thức nó nữa, `settled` mãi không đạt, và cổng vào bàn
 * dựng khoá vĩnh viễn — người dùng không có một đường nào để mở ra.
 *
 * Nguyên nhân không phải chuyện lý thuyết: `STEP_PLAN` và danh sách phép chạy ở
 * `pipeline.ts` là HAI danh sách, chỉ cần một chặng có tên trong bảng mà không
 * có phép chạy là nó nằm chờ mãi. Đo thật: một dự án treo ở 10/11 vì chặng
 * `music` có hàng trong bảng nhưng tiến trình đang chạy chưa có phép chạy.
 *
 * Đánh `failed` là đúng trạng thái: chặng làm đẹp bị bỏ, kèm lý do đọc được, và
 * có nút Thử lại.
 */
export function failStrandedSteps(projectId: string, message: string) {
  db.prepare(
    `UPDATE steps SET status='failed', error=?, updated_at=?
     WHERE project_id=? AND status IN ('waiting','running')`,
  ).run(message, Date.now(), projectId);
}

export function listSteps(projectId: string): Step[] {
  const rows = db
    .prepare(
      "SELECT key, position, status, result, error, required, updated_at FROM steps WHERE project_id=? ORDER BY position",
    )
    .all(projectId) as StepRow[];
  return rows.map((row) => ({
    key: row.key,
    position: row.position,
    status: row.status as StepStatus,
    result: row.result,
    error: row.error,
    required: row.required === 1,
    // Mốc đổi trạng thái. Với chặng đang chạy, đây là lúc nó bắt đầu — màn chờ lấy
    // nó để nói "đang chạy 12s", thứ duy nhất người đang chờ chưa biết.
    updatedAt: row.updated_at,
  }));
}

/**
 * Máy đã buông tay chưa — tức là mở được bàn dựng chưa.
 *
 * Chặng BỎ QUA vẫn tính là xong việc: nó không chặn, và giam người dùng lại chờ
 * một thứ họ không cần là vô nghĩa. Chặng bắt buộc mà hỏng thì KHÔNG xong —
 * lúc ấy chưa có sản phẩm để mà sửa.
 */
export function pipelineState(projectId: string): {
  steps: Step[];
  settled: boolean;
  blocked: boolean;
  skipped: number;
} {
  const steps = listSteps(projectId);
  const blocked = steps.some(
    (step) => step.status === "failed" && step.required,
  );
  const settled =
    steps.length > 0 &&
    steps.every((step) => step.status === "done" || step.status === "failed");
  return {
    steps,
    settled,
    blocked,
    skipped: steps.filter((step) => step.status === "failed" && !step.required)
      .length,
  };
}
