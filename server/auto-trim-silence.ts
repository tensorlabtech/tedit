import { type AudioEnvelope } from "./audio-envelope";
import { db } from "./db";
import { listSegments, removeRange, removedCount } from "./segments";

/**
 * Rút ngắn các quãng KHÔNG AI NÓI GÌ.
 *
 * KHÔNG dùng mô hình, và đó là chủ ý. Khoảng lặng không có chữ nào để mà đọc —
 * `ai-cuts.ts` chỉ nhận danh sách từ nên nó không hề nhìn thấy chỗ lặng, và đó
 * là lý do lượt đầu nó chỉ cắt được 3 giây trong một video có 53 giây im lặng.
 * Ở đây đã có sẵn mốc thời gian từng từ, nên một phép trừ là đủ: thêm mô hình
 * vào chỉ tốn tiền, chậm hơn, và cho kết quả dao động giữa các lượt.
 *
 * RÚT chứ không XOÁ HẲN: cắt sạch thì các câu dính liền nhau thành một tràng
 * dồn dập không có chỗ thở, và mỗi mối nối lại là một cú giật hình.
 */

/**
 * Lặng ngắn hơn thì là nhịp thở tự nhiên, đụng vào là hỏng.
 *
 * Đây là mức mặc định; mỗi dự án đặt lại được ở màn nạp tệp
 * (`projects.min_silence`). Người kể chuyện chậm cần ngưỡng cao hơn, còn video
 * hướng dẫn nhanh thì hạ xuống cắt được nhiều hơn.
 */
const MIN_SILENCE = 0.8;
/**
 * Chừa lại ngần này ở mỗi chỗ lặng — đủ nghe ra một nhịp ngắt.
 *
 * Phải LỚN HƠN `MIN_LENGTH` (0,3s) của `segments.ts`: đoạn ngắn hơn thế thì
 * `splitAt` từ chối tách, và vì mẩu dư không nằm TRỌN trong khoảng bỏ nên
 * `removeRange` nuốt luôn cả nó. Đo thật với 0,32 chia đôi hai bên (0,16 mỗi
 * bên): 15 chỗ rút mà chỉ còn 2,3 giây nghỉ trong cả video — nghe dồn không
 * kịp thở.
 */
const KEEP = 0.45;
/**
 * Chừa hai đầu video.
 *
 * Cắt sát từ đầu tiên thì video mở ra là người đã đang nói dở; cắt sát từ cuối
 * thì hết phim ngay lúc âm còn chưa tắt.
 */
const HEAD = 0.35;
const TAIL = 0.6;

/**
 * Ba chỗ lặng KHÔNG phải nhịp thở, nên không được chừa `KEEP`.
 *
 * · **Đầu và cuối video** — đó là lúc người ta với tay bật rồi tắt máy quay.
 *   `HEAD`/`TAIL` đã chừa sẵn phần cần chừa; cộng thêm `KEEP` nữa thành 0,8 giây
 *   mở màn không ai nói gì, mà mở màn mới là chỗ người xem quyết định lướt tiếp
 *   hay không.
 *
 * · **Mép nối giữa hai tệp quay** — hai lần bấm máy khác nhau ghép lại. Chỗ ấy
 *   ĐÃ là một cú cắt hình rồi, nên không cần thêm nhịp nghỉ nào để đỡ giật; thứ
 *   duy nhất nằm trong đó là cảnh với tay ra bấm máy.
 *
 * Đo trên một dự án ba tệp: lặng đầu 0,96s, lặng cuối 1,34s, hai mép nối mỗi
 * chỗ chừng một giây — cộng lại hơn bốn giây chết mà chặng cũ để nguyên.
 */
const KEEP_JOIN = 0;

/**
 * Nhịp nghỉ được giữ phải THẬT SỰ im.
 *
 * Chỗ không có chữ nào không có nghĩa là chỗ không có tiếng: máy nghe bỏ qua
 * tiếng hắng giọng, tiếng "ậm", tiếng với tay chạm vào máy quay — chúng không
 * thành từ nên không vào bản chép, nhưng người xem thì nghe rõ.
 *
 * Đo đường bao trong đúng phần định giữ của mười bốn quãng lặng ở một dự án
 * thật, lấy mức giọng làm mốc 100%: đầu này 1344%, 987%, 791%, 672% — to hơn cả
 * giọng nói — trong khi đầu kia của chính quãng ấy chỉ 59%, 32%, 47%. Gần như
 * quãng nào cũng có một đầu sạch và một đầu bẩn.
 *
 * Nên: giữ ĐẦU NÀO SẠCH HƠN, và nếu cả hai đầu đều kêu thì không giữ gì. Lấy
 * mốc là `speechLevel` của chính bản ghi, cùng mốc mà `hasSpeech` dùng — to
 * ngang giọng nói mà lại nằm ngoài mọi từ thì đó là tiếng động, không phải nhịp
 * thở.
 */
const ON_MAX = 1;

/**
 * Ngưỡng riêng cho hai MÉP video — nhỏ hơn hẳn `minSilence`.
 *
 * `minSilence` trả lời câu hỏi "quãng lặng này có phải nhịp thở không". Giữa
 * hai từ thì đó là câu hỏi đúng. Ở đầu và cuối video thì không: trước từ đầu
 * tiên chưa có câu nào để mà thở, và sau từ cuối cùng thì hết bài rồi.
 *
 * Đo được ca này: lặng đầu 0,96 giây, trừ `HEAD` còn 0,61 — không chạm 0,8 nên
 * chặng cũ để nguyên cả 0,96 giây đứng hình mở màn. Đuôi còn sát hơn: 0,74 so
 * với 0,8, hụt sáu phần trăm giây.
 *
 * Lấy đúng mức sàn của phép cắt bên dưới: cắt được bao nhiêu thì cắt.
 */
const MIN_EDGE = 0.12;

export function trimSilence(
  projectId: string,
  /**
   * Đường bao tiếng. `null` thì rơi về lối cũ — giữ đầu trước, không soi tiếng.
   *
   * Dự án dựng bằng bản cũ chưa có tệp đường bao, và một chặng rút lặng chạy
   * kém tinh hơn vẫn hơn hẳn một chặng ném lỗi.
   */
  envelope: AudioEnvelope | null = null,
): {
  trimmed: number;
  saved: number;
} {
  const setting = db
    .prepare("SELECT min_silence FROM projects WHERE id=?")
    .get(projectId) as { min_silence: number | null } | undefined;
  // `0` là một lựa chọn THẬT — "đừng tự rút" — nên không được coi là rỗng rồi
  // rơi về mặc định. Chỉ `null` mới là chưa đặt.
  const minSilence = setting?.min_silence ?? MIN_SILENCE;
  if (minSilence <= 0) return { trimmed: 0, saved: 0 };
  const words = db
    .prepare(
      "SELECT start_sec, end_sec FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<{ start_sec: number; end_sec: number }>;
  if (words.length < 2) return { trimmed: 0, saved: 0 };

  const total = (
    db
      .prepare(
        "SELECT COALESCE(SUM(duration),0) AS total FROM media_files WHERE project_id=? AND role='main'",
      )
      .get(projectId) as { total: number }
  ).total;

  /*
   * Mốc nối giữa các tệp quay, tính dồn trên trục đã ghép.
   *
   * Bỏ mốc cuối cùng (hết tệp cuối) — nó không phải mối nối mà là hết phim, và
   * quãng lặng ở đó đã do nhánh `TAIL` lo.
   */
  const boundaries: number[] = [];
  let running = 0;
  for (const file of db
    .prepare(
      "SELECT duration FROM media_files WHERE project_id=? AND role='main' ORDER BY position",
    )
    .all(projectId) as Array<{ duration: number | null }>) {
    running += file.duration ?? 0;
    boundaries.push(running);
  }
  boundaries.pop();

  /** Mọi quãng lặng: hai đầu video, và khe giữa mỗi cặp từ liền nhau. */
  const gaps: Array<{ start: number; end: number; keep: number; least: number }> = [];
  // Hai mép dùng `MIN_EDGE`, khe giữa các từ dùng `minSilence` — xem chỗ khai
  // hai hằng số ấy. Phần `HEAD`/`TAIL` vẫn được chừa nguyên.
  if (words[0].start_sec - HEAD >= MIN_EDGE) {
    gaps.push({ start: 0, end: words[0].start_sec - HEAD, keep: KEEP_JOIN, least: MIN_EDGE });
  }
  for (let index = 0; index < words.length - 1; index += 1) {
    const start = words[index].end_sec;
    const end = words[index + 1].start_sec;
    const atJoin = boundaries.some((mark) => mark > start && mark < end);
    gaps.push({ start, end, keep: atJoin ? KEEP_JOIN : KEEP, least: minSilence });
  }
  const last = words[words.length - 1].end_sec;
  if (total - (last + TAIL) >= MIN_EDGE) {
    gaps.push({ start: last + TAIL, end: total, keep: KEEP_JOIN, least: MIN_EDGE });
  }

  // Bỏ từ CUỐI lên ĐẦU: `removeRange` tách đoạn, nên làm ngược lại thì các mốc
  // phía sau xê dịch hết sau lần bỏ đầu tiên.
  const targets = gaps
    .filter((gap) => gap.end - gap.start >= gap.least)
    .sort((a, b) => b.start - a.start);

  /** Chỗ ồn nhất trong một quãng, lấy mức giọng làm mốc 1. */
  const loudness = (from: number, to: number) => {
    if (!envelope) return 0;
    const { hop, values, speechLevel } = envelope;
    if (speechLevel <= 0) return 0;
    let peak = 0;
    for (let at = Math.floor(from / hop); at <= Math.floor(to / hop); at += 1) {
      peak = Math.max(peak, values[at] ?? 0);
    }
    return peak / speechLevel;
  };

  /*
   * KHÔNG CÓ ĐOẠN THÌ KÊU, ĐỪNG LÀM THINH.
   *
   * `removeRange` chẻ đoạn rồi đánh dấu khúc giữa; bảng đoạn rỗng thì nó chạy
   * trọn vẹn mà không đổi gì. Trước đây hàm này vẫn đếm và vẫn báo "rút 12 chỗ ·
   * 57.4s" trong tình huống ấy — một chặng xanh cho một việc không xảy ra.
   */
  if (listSegments(projectId).length === 0) {
    throw new Error("Chưa gieo đoạn nào — không có gì để cắt lặng");
  }

  let trimmed = 0;
  let saved = 0;
  for (const gap of targets) {
    const length = gap.end - gap.start;
    /*
     * Chừa MỘT KHỐI LIỀN ở một đầu rồi cắt phần còn lại. Chia đôi hai bên thì
     * sinh ra hai mẩu vụn, mà mẩu dưới `MIN_LENGTH` thì không tách được nên mất
     * sạch.
     */
    let keep = gap.keep;
    let atHead = true;
    if (keep > 0) {
      const head = loudness(gap.start, gap.start + keep);
      const tail = loudness(gap.end - keep, gap.end);
      atHead = head <= tail;
      if (Math.min(head, tail) > ON_MAX) keep = 0;
    }
    const cutLength = length - keep;
    if (cutLength < 0.12) continue;
    // Giữ đầu trước thì bỏ phần sau, giữ đầu sau thì bỏ phần trước.
    // Đếm theo HIỆU QUẢ THẬT: `removeRange` bỏ qua trong im lặng khi quãng quá
    // ngắn hoặc không đoạn nào phủ đủ 60%, nên đếm số lần GỌI là báo vống lên.
    const was = removedCount(projectId);
    if (atHead) removeRange(projectId, gap.start + keep, gap.end);
    else removeRange(projectId, gap.start, gap.end - keep);
    if (removedCount(projectId) === was) continue;
    trimmed += 1;
    saved += cutLength;
  }

  return { trimmed, saved };
}
