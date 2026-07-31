/**
 * Đo hai cụm chữ NGHE có giống nhau không.
 *
 * Sửa lời bằng LLM có một kiểu hỏng đã được ghi nhận trong tài liệu:
 * *over-correction* — mô hình thấy một câu đọc lên hơi lạ liền viết lại thành
 * câu xuôi tai hơn, mà câu xuôi ấy chẳng liên quan gì tới thứ người ta đã nói.
 * Nó không sửa lỗi nghe, nó bịa lại nội dung.
 *
 * Cách chặn: một chỗ sửa ĐÚNG thì bản cũ và bản mới phải nghe gần giống nhau —
 * "nem quốc" và "network" khác mặt chữ nhưng cùng một chuỗi âm. Còn thay cả một
 * câu bằng câu khác hẳn thì âm cũng khác hẳn, và luật này bắt được.
 *
 * Cố tình làm THÔ. Đây không phải bộ chuyển tự chuẩn — chỉ cần đủ để phân biệt
 * "sửa một từ nghe nhầm" với "viết lại một câu".
 */

/** Bỏ dấu thanh và dấu phụ, đưa về chữ Latin trần. */
function stripDiacritics(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d");
}

/**
 * Gom những âm mà tai người Việt nghe lẫn nhau về cùng một ký hiệu.
 *
 * Đây là chỗ quyết định luật có dùng được không: "nem quốc" → `nemkuok`,
 * "network" → `netuok`. Không gom thì hai chuỗi này khác nhau quá nhiều và
 * chính chỗ sửa ĐÚNG lại bị loại.
 */
function toPhonetic(text: string) {
  let out = stripDiacritics(text.toLowerCase());
  const rules: Array<[RegExp, string]> = [
    [/ph/g, "f"],
    [/gh|gi/g, "g"],
    [/kh/g, "k"],
    [/ngh|ng/g, "n"],
    [/nh/g, "n"],
    [/th/g, "t"],
    [/tr|ch/g, "c"],
    [/qu/g, "k"],
    [/[ckq]/g, "k"],
    [/[sx]/g, "s"],
    [/[dgrv]/g, "z"],
    [/[yi]/g, "i"],
    [/[ou]/g, "o"],
    [/[ae]/g, "a"],
    [/w/g, "o"],
    [/[^a-z]/g, ""],
  ];
  for (const [pattern, replacement] of rules) out = out.replace(pattern, replacement);
  // Nuốt phụ âm đôi: "netuork" và "netuok" phải ra cùng một chuỗi.
  return out.replace(/(.)\1+/g, "$1");
}

/** Khoảng cách sửa chuỗi, chuẩn hoá về 0–1 (0 = trùng khít). */
function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length || !b.length) return 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length] / Math.max(a.length, b.length);
}

/** Ngắn hơn ngần này thì phép đo không còn nói lên điều gì — xem `soundsAlike`. */
const TOO_SHORT = 8;

/**
 * Hai cụm có nghe đủ giống để coi là "sửa lỗi nghe" không.
 *
 * CHỈ xét khi cụm đủ dài. Việc của luật này là chặn mô hình VIẾT LẠI CẢ CÂU,
 * mà câu viết lại thì bao giờ cũng dài. Với cụm một hai từ, đổi một âm đã
 * chiếm tỉ lệ rất lớn nên phép đo loại nhầm chính những chỗ sửa đúng — đo thật:
 * "ép" → "dev" và "chọn" → "chạm" đều bị loại oan. Đổi một từ thì rủi ro vốn
 * đã nhỏ, không đáng đánh đổi.
 *
 * Lấy độ dài LỚN NHẤT của hai bên: "Bye bye" ngắn nhưng nếu bị thay bằng cả
 * một câu thì vẫn phải chặn.
 */
export function soundsAlike(before: string, after: string, limit = 0.45) {
  const a = toPhonetic(before);
  const b = toPhonetic(after);
  if (!a || !b) return true;
  if (Math.max(a.length, b.length) < TOO_SHORT) return true;
  return editDistance(a, b) <= limit;
}
