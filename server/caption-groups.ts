import { db } from "./db";
import { skippedSpans } from "./segments";
import { OUT_HEIGHT, OUT_WIDTH } from "./render";
import { layoutText, type Band } from "./text-layout";

/** Một từ trong bản chép lời, mang theo mã để chữ còn neo vào được. */
type CaptionWord = {
  id: string;
  text: string;
  start_sec: number;
  end_sec: number;
  sentence_id: string;
};

/**
 * Một cụm chữ chia ra từ lời nói.
 *
 * Giữ nguyên DANH SÁCH TỪ chứ không chỉ giữ chuỗi chữ: cụm sẽ thành một chữ
 * trên màn, mà chữ trên màn neo vào KHOẢNG TỪ (xem đặc tả §1). Có mã từ ở đây
 * thì cụm mới đi tiếp được; chỉ có chuỗi chữ thì tới lúc dựng phần tử lại phải
 * dò ngược theo thời gian và dò sai là chữ trôi sang câu khác.
 */
export type CaptionGroup = {
  words: CaptionWord[];
  text: string;
  start: number;
  end: number;
  /** Mốc bắt đầu của TỪNG TIẾNG — để chữ hiện đúng lúc tiếng được nói ra */
  wordStarts: number[];
};

const build = (words: CaptionWord[]): CaptionGroup => ({
  words,
  text: words.map((word) => word.text).join(" "),
  start: words[0].start_sec,
  end: words[words.length - 1].end_sec,
  wordStarts: words.map((word) => word.start_sec),
});

/**
 * Tối đa 5 tiếng một cụm.
 *
 * Đây là ràng buộc CỐ Ý, không phải cho dễ đọc: hệ Oversize in chữ ở ~17% chiều
 * cao khung, nên quá 5 tiếng là hết chỗ và phép đo buộc phải co chữ về cỡ chú
 * thích — mất luôn phong cách. Ít chữ to hơn nhiều chữ nhỏ.
 */
const MAX_WORDS = 5;
/** Cụm dài quá thì chữ đứng lâu, mất cảm giác chạy theo lời. */
const MAX_SPAN = 2.2;
/**
 * Trần KÝ TỰ, tính cả dấu cách — ràng buộc thật, còn trần số tiếng chỉ là ước.
 *
 * Suy ra từ trần 3 dòng: bề rộng dùng được ≈ 77% của 1080 = 832px, cỡ sàn 15% bề
 * rộng = 162px, một ký tự rộng ≈ 0.6 cỡ ≈ 97px → chừng 8,5 ký tự một dòng, ba
 * dòng là 26.
 *
 * Vì sao cần cả hai trần: "Mình" và "nghiêng" đều là một tiếng nhưng dài gấp đôi
 * nhau, nên 5 tiếng có thể ra 15 ký tự mà cũng có thể ra 35 — đếm tiếng một mình
 * thì cụm dài vẫn lọt qua rồi bị co chữ ở bước in.
 */
const MAX_CHARS = 26;

/**
 * Gom từ thành cụm chữ chạy theo lời.
 *
 * Gom theo TỪ chứ không lấy nguyên câu: một câu 15 từ in ra là bốn dòng chữ
 * đứng im 6 giây, người xem đọc xong từ lâu rồi mới sang câu sau. Cắt cụm ở
 * chỗ nghỉ tự nhiên khi có, không thì cắt theo số từ.
 */
export async function buildCaptionGroups(
  projectId: string,
  band: Band = "bottom",
): Promise<CaptionGroup[]> {
  const words = db
    .prepare(
      `SELECT w.id, w.text, w.start_sec, w.end_sec, w.sentence_id
       FROM words w
       JOIN sentences s ON s.id = w.sentence_id
       WHERE w.project_id = ? AND s.removed = 0
       ORDER BY w.start_sec`,
    )
    .all(projectId) as CaptionWord[];

  // Mốc các quãng bị bỏ: cụm không được vắt qua chỗ cắt, vì hai đầu cụm sẽ rơi
  // vào hai bên của mối nối và chữ đứng lì suốt cả quãng bị bỏ.
  // Truyền mốc cuối là từ cuối cùng: `skippedSpans` sẽ coi phần dư sau đoạn cuối
  // là một quãng bỏ, mà ở đây không có gì sau từ cuối để bỏ.
  const lastEnd = words.length > 0 ? words[words.length - 1].end_sec : 0;
  const cuts = skippedSpans(projectId, lastEnd).flatMap((span) => [
    span.start,
    span.end,
  ]);

  const groups: CaptionGroup[] = [];
  let current: CaptionWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    groups.push(build(current));
    current = [];
  };

  /** Số ký tự của cụm nếu thêm từ này vào, tính cả dấu cách nối. */
  const charsWith = (word: { text: string }) =>
    current.reduce((sum, w) => sum + w.text.length + 1, 0) + word.text.length;

  for (const word of words) {
    if (current.length > 0) {
      const span = word.end_sec - current[0].start_sec;
      const previous = current[current.length - 1];
      const gap = word.start_sec - previous.end_sec;
      // Không bao giờ gộp hai câu vào một cụm. Câu sau viết hoa nên cụm ra thành
      // "còn quá non Mỗi năm" — đọc lên là hai mẩu ý dính nhau, vô nghĩa.
      const newSentence = word.sentence_id !== previous.sentence_id;
      const crossesCut = cuts.some(
        (at) => previous.end_sec <= at + 0.01 && word.start_sec >= at - 0.01,
      );
      // Nghỉ trên 0,35 giây là ranh giới ý — cắt ở đó nghe tự nhiên hơn là cắt
      // giữa dòng vì đủ 5 từ.
      if (
        current.length >= MAX_WORDS ||
        charsWith(word) > MAX_CHARS ||
        span > MAX_SPAN ||
        gap > 0.35 ||
        newSentence ||
        crossesCut
      )
        flush();
    }
    current.push(word);
  }
  flush();

  // Đo rồi mới chốt: trần tiếng và trần ký tự chỉ là ước, còn vừa hay không vừa
  // phải hỏi phép đo bằng đúng tệp font sẽ in — mà cùng một cụm ở dải dưới hẹp
  // hơn dải trên 12% bề rộng, nên vừa ở trên chưa chắc vừa ở dưới.
  const fitted: CaptionGroup[] = [];
  for (const group of groups) fitted.push(...(await fitGroup(group, band)));
  return fitted;
}

/**
 * Tách đôi cho tới khi mỗi cụm nằm gọn trong trần dòng.
 *
 * Tách ở ranh giới TỪ, nên hai nửa vẫn neo được vào từ đầu và từ cuối của chính
 * nó — co chữ thì mất phong cách, còn tách cụm chỉ chia lại thời gian của cùng
 * một câu.
 */
async function fitGroup(
  group: CaptionGroup,
  band: Band,
  depth = 0,
): Promise<CaptionGroup[]> {
  const laid = await layoutText(group.text, band, OUT_WIDTH, OUT_HEIGHT);
  // Dừng ở độ sâu 3: cụm một tiếng mà vẫn không vừa thì tách nữa cũng vô ích,
  // và `truncated` sẽ báo lên hàng "Cần bạn xem".
  if (
    (!laid.needsSplit && !laid.truncated) ||
    group.words.length < 2 ||
    depth >= 3
  ) {
    return [group];
  }
  const mid = Math.ceil(group.words.length / 2);
  return [
    ...(await fitGroup(build(group.words.slice(0, mid)), band, depth + 1)),
    ...(await fitGroup(build(group.words.slice(mid)), band, depth + 1)),
  ];
}
