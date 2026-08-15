import { db } from "./db";
import { setJob } from "./pipeline";
import { failRunningStep } from "./pipeline-steps";

/**
 * MỘT hàng đợi cho cả máy — không phải một khoá cho mỗi dự án.
 *
 * Trước đây phép ngăn việc chạy trùng chỉ soi bảng `jobs` theo `(project_id, kind)`,
 * nên năm người bấm Xuất video trên năm dự án khác nhau là năm ffmpeg cùng lúc,
 * cộng năm lượt máy nghe trên CPU. Trên VPS dùng chung, đó là cách nhanh nhất để
 * cả hai stack cùng chết.
 *
 * ĐIỀU KIỆN của cách làm này: Tedit chạy ĐÚNG MỘT tiến trình Node (xem
 * `deploy/docker-compose.yml` — chỉ một service, không replica). Nhờ vậy một
 * `Map` trong bộ nhớ biết chính xác việc nào đang chạy. Chạy nhiều tiến trình
 * hay nhiều bản sao thì khoá này mất tác dụng và phải chuyển sang khoá trong
 * CSDL — đọc lại chỗ này trước khi làm điều đó.
 */

/** Bao nhiêu việc nặng được chạy cùng lúc trên cả máy. */
const MAX_CONCURRENT = Math.max(
  1,
  Number(process.env.TEDDIT_MAX_JOBS ?? 1) || 1,
);

type JobKey = string;
const keyOf = (projectId: string, kind: string) => `${projectId}:${kind}`;

type QueuedJob = {
  key: JobKey;
  projectId: string;
  kind: string;
  /** Nhận `signal` để tự dừng khi người dùng bấm Huỷ; việc cũ bỏ qua tham số này. */
  run: (signal: AbortSignal) => Promise<unknown>;
};

/** Việc đang chạy thật. Đây là NGUỒN SỰ THẬT, không phải bảng `jobs`. */
const running = new Map<JobKey, Promise<void>>();

/** Bộ ngắt của mỗi việc ĐANG chạy — để `cancelJob` gọi `abort()` mà dừng nó. */
const controllers = new Map<JobKey, AbortController>();

/** Việc đã nhận nhưng chưa tới lượt, theo thứ tự tới trước chạy trước. */
const waiting: QueuedJob[] = [];

export type EnqueueResult = "started" | "queued" | "duplicate";

/**
 * Chạm `updated_at` để bên ngoài biết việc còn sống.
 *
 * Giữ NGUYÊN trạng thái và tiến độ đang có, chỉ đổi mốc thời gian. Lượt xuất
 * video đi một mạch từ tiến độ 60 tới 85 mà không báo gì ở giữa — toàn bộ pass
 * in chữ và chèn tư liệu nằm trong quãng đó, và trên CPU nó lâu hơn mọi ngưỡng
 * "chắc là chết rồi" mà ta dám đặt. Nhịp tim trả lời đúng câu cần hỏi: tiến
 * trình còn sống không. Còn "tới đâu rồi" thì để các chặng tự nói.
 */
const HEARTBEAT_MS = 30_000;

function beat(projectId: string, kind: string) {
  const row = db
    .prepare(
      "SELECT status, progress, message FROM jobs WHERE project_id=? AND kind=?",
    )
    .get(projectId, kind) as
    | { status: string; progress: number; message: string | null }
    | undefined;
  // Việc đã chuyển sang xong/hỏng thì thôi — đập nhịp tiếp chỉ làm một việc đã
  // chết trông như đang sống.
  if (!row || row.status !== "running") return;
  setJob(projectId, kind, row.status, row.progress, row.message ?? undefined);
}

/**
 * Việc còn sót lại trạng thái `running` từ LƯỢT CHẠY TRƯỚC.
 *
 * Gọi đúng một lần lúc khởi động, khi `running` còn rỗng — nên mọi hàng
 * `status='running'` trong bảng chắc chắn là của tiến trình đã chết. Đánh hỏng
 * ngay thay vì chờ hết một mốc thời gian: chờ nghĩa là người dùng ngồi nhìn con
 * quay của một việc đã chết từ lúc container khởi động lại.
 */
export function reapOrphans() {
  const orphans = db
    .prepare("SELECT project_id, kind FROM jobs WHERE status='running'")
    .all() as Array<{ project_id: string; kind: string }>;
  for (const job of orphans) {
    setJob(
      job.project_id,
      job.kind,
      "error",
      0,
      "Máy chủ khởi động lại giữa chừng",
    );
    failRunningStep(job.project_id, "Máy chủ khởi động lại giữa chừng");
  }
  return orphans.length;
}

function launch(job: QueuedJob) {
  setJob(job.projectId, job.kind, "running", 0, "Đang chuẩn bị");

  const timer = setInterval(
    () => beat(job.projectId, job.kind),
    HEARTBEAT_MS,
  );
  // Nhịp tim không được giữ tiến trình sống chỉ vì nó còn hẹn giờ.
  timer.unref?.();

  const controller = new AbortController();
  controllers.set(job.key, controller);

  const task = job
    .run(controller.signal)
    .then(() => {
      // Việc chạy xong mà bảng vẫn ghi `running` nghĩa là phép chạy quên tự
      // đóng. Đóng hộ ở đây, vì hậu quả nằm ở phía người dùng: màn hình hỏi
      // tiến độ theo trạng thái, nên một hàng kẹt `running` là một con quay
      // quay mãi trên một việc đã xong từ lâu. Đã gặp thật ở nút Thử lại.
      const row = db
        .prepare("SELECT status FROM jobs WHERE project_id=? AND kind=?")
        .get(job.projectId, job.kind) as { status: string } | undefined;
      if (row?.status === "running") {
        setJob(job.projectId, job.kind, "done", 100, "Xong");
      }
    })
    .catch((error: Error) => {
      setJob(job.projectId, job.kind, "error", 0, error.message.slice(0, 300));
      // Đánh hỏng luôn chặng đang chạy, không thì màn chờ để nó quay mãi.
      failRunningStep(job.projectId, error.message.slice(0, 200));
    })
    .finally(() => {
      clearInterval(timer);
      running.delete(job.key);
      controllers.delete(job.key);
      pump();
    });

  running.set(job.key, task);
}

/** Lấp cho đủ chỗ trống. Gọi sau mỗi lần nhận việc và sau mỗi lần một việc xong. */
function pump() {
  while (running.size < MAX_CONCURRENT && waiting.length > 0) {
    launch(waiting.shift()!);
  }
}

/**
 * Nhận một việc nặng.
 *
 * - `duplicate`: dự án này đã có việc cùng loại đang chạy hoặc đang chờ. Đây là
 *   hành vi cũ và giữ nguyên — hai lượt chép lời trên cùng một dự án ghi đè lên
 *   nhau ở cùng những bảng.
 * - `queued`: đã nhận, đang chờ chỗ. KHÔNG phải lỗi — người dùng chỉ cần biết
 *   mình đang xếp hàng.
 * - `started`: chạy ngay.
 */
export function enqueue(
  projectId: string,
  kind: string,
  run: (signal: AbortSignal) => Promise<unknown>,
): EnqueueResult {
  const key = keyOf(projectId, kind);
  if (running.has(key) || waiting.some((job) => job.key === key)) {
    return "duplicate";
  }

  const job: QueuedJob = { key, projectId, kind, run };

  if (running.size < MAX_CONCURRENT) {
    launch(job);
    return "started";
  }

  waiting.push(job);
  setJob(projectId, kind, "queued", 0, "Đang xếp hàng");
  return "queued";
}

/**
 * Đứng thứ mấy trong hàng, tính từ 1. `null` nếu không chờ.
 *
 * CHỈ trả về một con số. Route hỏi nó là route mọi người dùng đều gọi được cho
 * dự án của mình, nên đừng để lộ mã dự án hay ai đang đứng trước.
 */
export function queuePosition(projectId: string, kind: string): number | null {
  const index = waiting.findIndex((job) => job.key === keyOf(projectId, kind));
  return index === -1 ? null : index + 1;
}

/**
 * HUỶ một việc — đang chờ thì rút khỏi hàng, đang chạy thì `abort()` bộ ngắt để
 * phép chạy tự dừng (vd Remotion nhận `cancelSignal`). Trả `true` nếu có gì để huỷ.
 *
 * Đánh `error` "Đã huỷ" NGAY cho việc đang chờ; việc đang chạy để phép chạy tự
 * throw rồi `launch` ghi `error` (một nguồn ghi trạng thái, khỏi tranh nhau).
 */
export function cancelJob(projectId: string, kind: string): boolean {
  const key = keyOf(projectId, kind);
  const controller = controllers.get(key);
  if (controller) {
    controller.abort();
    return true;
  }
  const index = waiting.findIndex((job) => job.key === key);
  if (index !== -1) {
    waiting.splice(index, 1);
    setJob(projectId, kind, "error", 0, "Đã huỷ");
    return true;
  }
  return false;
}

/** Số việc đang chạy và đang chờ — cho `/api/health` và lúc gỡ lỗi. */
export function queueStats() {
  return { running: running.size, waiting: waiting.length, max: MAX_CONCURRENT };
}
