/**
 * NEO TƯ LIỆU THEO LỜI — tìm chỗ đặt bằng KHỚP CHUỖI, không hỏi mô hình.
 *
 * ## Vì sao cần, khi đã có một bước AI làm đúng việc này
 *
 * Người dùng viết mô tả tư liệu theo hai kiểu, và họ trộn chúng trong cùng một dự
 * án mà không nghĩ là mình đang trộn:
 *
 * · MÔ TẢ HÌNH — "Ngồi làm việc, gõ phím", "Vẽ biểu đồ trên điện thoại".
 * · TRÍCH LỜI — "Không biết gì về code cả", "Người mới biết Vibe Code". Đây thực
 *   chất là **chỉ chỗ**: họ đang nói "đặt vào chỗ tôi nói câu này".
 *
 * Kiểu thứ hai không cần đoán gì cả — câu ấy nằm sẵn trong bản chép lời, tìm là
 * ra. Giao nó cho mô hình là biến một phép tra cứu chắc chắn thành một phép đoán:
 * đo trên dự án thật, cùng bộ dữ liệu mà ba lượt gọi cho ra 3/8, 5/9 rồi 1/8 chỗ
 * khớp — dao động ấy đến từ mô hình, không từ dữ liệu.
 *
 * ## Cách khớp
 *
 * Bỏ dấu, bỏ hoa thường, rồi trượt một cửa sổ dài bằng mô tả dọc bản chép và chấm
 * theo LCS trên chuỗi TIẾNG. Chấm theo tiếng chứ không theo ký tự vì bản chép hay
 * sai chính tả một hai chữ ("vai code" ↔ "vibe code"), mà sai một chữ thì điểm ký
 * tự tụt hẳn còn điểm tiếng chỉ mất một phần nhỏ.
 *
 * Ngưỡng cao (`MIN_SCORE`) là cố ý: mô tả hình không được phép khớp bừa vào một
 * câu chỉ vì trùng vài tiếng vô nghĩa. Không đủ điểm thì trả `null` và để bước AI
 * lo — đúng việc của nó.
 */

/**
 * Điểm khớp tối thiểu để coi là NGƯỜI DÙNG ĐANG CHỈ CHỖ, không phải trùng ngẫu nhiên.
 *
 * `0,7` chứ không `0,6`: đo trên dự án thật, "Người mới biết Vibe Code" khớp đúng
 * 0,60 vào câu "người chả biết gì về code" — ba tiếng chung (người · biết · code)
 * trên năm, mà ý thì ngược hẳn. Neo sai còn tệ hơn không neo, vì nó CHIẾM chỗ và
 * đẩy bước AI ra khỏi quyết định.
 */
const MIN_SCORE = 0.7;
/** Mô tả ngắn hơn ngần này thì không đủ đặc trưng để neo ("Teamwork"). */
const MIN_WORDS = 2;

/** Bỏ dấu tiếng Việt, hạ hoa thường, gộp khoảng trắng. */
export function chuanHoa(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Độ dài chuỗi con chung dài nhất, tính theo TIẾNG. */
function lcs(a: string[], b: string[]): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export type AnchorHit = {
  /** Chỉ số tiếng ĐẦU và CUỐI của quãng lời khớp nhất. */
  from: number;
  to: number;
  /** 0–1; càng cao càng chắc là người dùng đang chỉ đúng chỗ này. */
  score: number;
};

/**
 * Tìm quãng lời khớp nhất với `moTa`. `null` = không đủ chắc, để AI lo.
 *
 * `words` là toàn bộ bản chép theo thứ tự; trả về CHỈ SỐ để nơi gọi tự tra mốc
 * giây — bước đặt b-roll vốn làm việc bằng chỉ số tiếng.
 */
export function neoTheoLoi(
  moTa: string,
  words: ReadonlyArray<{ text: string }>,
): AnchorHit | null {
  const can = chuanHoa(moTa);
  if (can.length < MIN_WORDS) return null;
  const kho = words.map((w) => chuanHoa(w.text)[0] ?? "");

  // Cửa sổ rộng hơn mô tả một chút: bản chép hay chèn thêm tiếng đệm ("à", "thì")
  // vào giữa câu, nên quãng thật thường dài hơn quãng người dùng gõ.
  const rong = Math.min(kho.length, Math.round(can.length * 1.6) + 2);
  let best: AnchorHit | null = null;
  for (let i = 0; i + 1 <= kho.length; i += 1) {
    const j = Math.min(kho.length, i + rong);
    const diem = lcs(can, kho.slice(i, j)) / can.length;
    if (!best || diem > best.score) best = { from: i, to: j - 1, score: diem };
    if (diem === 1) break; // khớp trọn thì không có gì hơn được nữa
  }
  if (!best || best.score < MIN_SCORE) return null;

  /*
   * Thu gọn hai mép về đúng tiếng khớp đầu và cuối.
   *
   * Cửa sổ nới rộng ở trên cốt để BẮT được quãng; giữ nguyên nó thì b-roll bắt
   * đầu sớm vài tiếng trước câu người dùng chỉ, và kết thúc muộn hơn chừng ấy.
   */
  const trong = new Set(can);
  let from = best.from;
  let to = best.to;
  while (from < to && !trong.has(kho[from])) from += 1;
  while (to > from && !trong.has(kho[to])) to -= 1;
  return { from, to, score: best.score };
}
