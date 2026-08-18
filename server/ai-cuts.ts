import { db } from "./db";
import { ask, object } from "./llm";
import { listSegments, removeRange, removedCount } from "./segments";

/**
 * Tìm chỗ nên bỏ: ề à, vấp, lặp lại, câu bỏ dở.
 *
 * Mô hình chỉ ĐỀ XUẤT theo mã từ; mọi ràng buộc do code giữ. Bảo mô hình tự
 * nhớ "đừng bỏ quá nhiều, đừng bỏ trùng nhau, đừng bỏ hết một câu" thì mỗi lần
 * nó quên một điều là ra một bản dựng cụt lủn, mà lỗi ấy chỉ lộ ở khâu xuất.
 */

/** Không bao giờ bỏ quá ngần này lời — quá tay thì video mất mạch. */
const MAX_SHARE = 0.25;
/** Quãng ngắn hơn thì cắt ra nghe cộc, dài hơn thì gần như chắc chắn cắt nhầm. */
const MIN_SECONDS = 0.25;
const MAX_SECONDS = 6;

type Word = { id: string; text: string; start_sec: number; end_sec: number };

type Proposal = {
  cuts: Array<{ fromWordId: string; toWordId: string; reason: string }>;
};

const SCHEMA = object({
  cuts: {
    type: "array",
    items: object({
      fromWordId: { type: "string" },
      toWordId: { type: "string" },
      reason: {
        type: "string",
        enum: ["e-a", "vap", "lap", "bo-do", "lac-de", "ngoai-canh", "chep-hong"],
      },
    }),
  },
});

const INSTRUCTIONS = `Bạn cắt thô bản chép lời của một video nói trực tiếp bằng tiếng Việt.

Người nói đang nói VỚI NGƯỜI XEM. Mọi câu không nhắm vào người xem đều là rác
trong bản dựng, dù nó nghe rất tự nhiên lúc quay.

CHỈ chọn những quãng bỏ đi mà người xem KHÔNG mất thông tin nào:
- ngoai-canh: nói với người quay phim, với chính mình, hoặc điều khiển buổi quay
  ("Được chưa?", "Đúng chưa?", "Quay chưa?", "Xong rồi mình quay tiếp cảnh khác",
  "Để mình làm lại"). Đây là loại HAY BỊ BỎ SÓT nhất — hãy soi kỹ.
- chep-hong: TOÀN BỘ quãng vô nghĩa, thường chỉ một hai từ rời rạc
  ("Dòng tiếng", "Có nem quốc ổn định").
  KHÔNG dùng cho câu có ý rõ mà chỉ sai một từ — "hành trình của một ép trở
  thành một CEO" sai chữ "ép" nhưng ý vẫn đọc ra được, phải GIỮ.
- e-a: tiếng đệm ("ừm", "à", "ờ", "kiểu là") không mang nghĩa
- vap: nói vấp rồi nói lại chính ý đó ngay sau
- lap: lặp nguyên một ý vừa nói xong
- bo-do: câu bỏ dở giữa chừng rồi làm lại hoặc chuyển ý. HAI DẤU HIỆU CHẮC CHẮN:
  (a) một từ kết thúc bằng "--" (bị ngắt giữa chừng, vd "cái--", "phần--");
  (b) một cụm nói dở rồi NGAY SAU nói lại gần như cùng chữ (vd "Các bạn có thể,
  ờ, duyệt những cái--" rồi restart "Các bạn có..."). Gặp một trong hai thì cắt
  CẢ cụm dẫn tới chỗ ngắt (gồm cả tiếng đệm bên trong), mạnh tay như ngoai-canh.
- lac-de: lạc hẳn khỏi mạch, bỏ đi vẫn liền

TUYỆT ĐỐI KHÔNG cắt: ý chính, ví dụ minh hoạ, câu chuyển mạch, câu mở, câu chốt,
lời chào, lời kêu gọi theo dõi.
KHÔNG cắt một vế của câu ghép: bỏ vế "Nếu…" thì vế "Thì…" còn lại trơ ra vô
nghĩa. Muốn bỏ thì bỏ CẢ HAI vế, hoặc không bỏ gì.

Với "ngoai-canh", "chep-hong", và "bo-do" có dấu ngắt "--" hoặc restart thì cứ
mạnh tay — chúng không mang tin gì cả.
Với các trường hợp còn lại, không chắc thì bỏ qua.
Mỗi quãng phải nằm gọn trong một câu.`;

/**
 * Đề xuất chỗ bỏ rồi ÁP luôn.
 *
 * Trả về số quãng thật sự bỏ được — nơi gọi so với số mô hình đề xuất để biết
 * đã gạt bao nhiêu. Gạt có báo, không lặng lẽ.
 */
export async function proposeCuts(projectId: string): Promise<{
  applied: number;
  rejected: number;
}> {
  // Cùng lẽ với `autoTrimSilence`: không có đoạn thì mọi đề xuất rơi vào im
  // lặng, và chặng vẫn xanh. Thà hỏng có tiếng.
  if (listSegments(projectId).length === 0) {
    throw new Error("Chưa gieo đoạn nào — không có gì để cắt");
  }

  const words = db
    .prepare(
      "SELECT id, text, start_sec, end_sec FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Word[];
  if (words.length < 20) return { applied: 0, rejected: 0 };

  const sentences = db
    .prepare(
      "SELECT id, text FROM sentences WHERE project_id=? ORDER BY position",
    )
    .all(projectId) as Array<{ id: string; text: string }>;

  // Gửi kèm MÃ từ chứ không chỉ chữ: mô hình phải trỏ vào một từ cụ thể, không
  // phải mô tả "chỗ nói ừm lần thứ ba" rồi mình đi dò.
  const listing = words
    .map((word, index) => `${index}|${word.id}|${word.text}`)
    .join("\n");

  const proposal = await ask<Proposal>({
    instructions: INSTRUCTIONS,
    input: `Toàn văn:\n${sentences.map((s) => s.text).join(" ")}\n\nTừng từ (thứ tự|mã|chữ):\n${listing}`,
    schemaName: "cuts",
    schema: SCHEMA,
  });

  const index = new Map(words.map((word, at) => [word.id, at]));
  const total = words.at(-1)!.end_sec - words[0].start_sec;
  let budget = total * MAX_SHARE;
  let applied = 0;
  let rejected = 0;

  // Xếp theo mốc GIẢM DẦN rồi mới bỏ: `removeRange` tách đoạn nên bỏ từ cuối
  // lên đầu thì các mốc phía trước chưa bị đụng tới.
  const spans = proposal.cuts
    .map((cut) => ({
      from: index.get(cut.fromWordId),
      to: index.get(cut.toWordId),
    }))
    .filter(
      (span): span is { from: number; to: number } =>
        span.from !== undefined && span.to !== undefined && span.to >= span.from,
    )
    .map((span) => ({
      start: words[span.from].start_sec,
      end: words[span.to].end_sec,
    }))
    .sort((a, b) => b.start - a.start);

  const taken: Array<{ start: number; end: number }> = [];
  for (const span of spans) {
    const length = span.end - span.start;
    if (length < MIN_SECONDS || length > MAX_SECONDS) {
      rejected += 1;
      continue;
    }
    if (length > budget) {
      rejected += 1;
      continue;
    }
    // Chồng lên quãng đã nhận thì bỏ: hai lần bỏ chồng nhau làm `removeRange`
    // tách đoạn ở những mốc không còn tồn tại.
    if (taken.some((item) => span.start < item.end && item.start < span.end)) {
      rejected += 1;
      continue;
    }
    const was = removedCount(projectId);
    removeRange(projectId, span.start, span.end);
    // Bỏ không ăn thì tính là bị GẠT, đừng tính là đã bỏ.
    if (removedCount(projectId) === was) {
      rejected += 1;
      continue;
    }
    taken.push(span);
    budget -= length;
    applied += 1;
  }

  return { applied, rejected: rejected + (proposal.cuts.length - spans.length) };
}
