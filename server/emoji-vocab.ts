/**
 * VỐN TỪ EMOJI — đóng, 36 hình.
 *
 * Đóng chứ không mở, cùng lý do với `music-tags.ts`: một danh sách đóng thì mô
 * hình chọn TRONG đó, còn danh sách mở thì mô hình bịa ra hình lạ và mỗi video
 * lại có một bộ hình khác nhau — đúng thứ làm video trông như máy ghép.
 *
 * Đóng còn có một cái lợi rất cụ thể: chỉ phải mang theo 36 tệp ảnh thay vì ba
 * nghìn rưỡi. Xem `scripts/emoji/fetch-emoji-assets.ts`.
 *
 * Vì sao là ẢNH chứ không phải chữ: `drawtext` của ffmpeg từ chối font emoji màu
 * của Apple thẳng thừng ("Monocromatic (1bpp) fonts are not supported"), và font
 * emoji màu nói chung là chỗ vênh giữa các trình dựng. Dán ảnh thì hai đường vẽ
 * dùng CHUNG một tệp — không phải hai bộ vẽ chữ cùng cố ra một kết quả, mà là
 * đúng một tấm ảnh. Đó là mức khớp mạnh nhất có thể có.
 */

export type EmojiEntry = {
  /** Ký tự emoji — thứ lưu vào CSDL và thứ mô hình trả về */
  char: string;
  /** Nghĩa, viết cho MÔ HÌNH đọc để chọn, không phải cho người dùng */
  hint: string;
};

/**
 * Xếp theo nhóm nghĩa để lúc đọc còn soát được là có bị thiếu mảng nào không.
 * Thứ tự trong mảng không mang ý nghĩa gì với phần chạy.
 */
export const EMOJI_VOCAB: EmojiEntry[] = [
  // Tiền · làm ăn
  { char: "💰", hint: "tiền, thu nhập, giá" },
  { char: "📈", hint: "tăng, tốt lên, phát triển" },
  { char: "📉", hint: "giảm, tệ đi, thua lỗ" },
  { char: "🎯", hint: "mục tiêu, đúng trọng tâm" },
  { char: "⏰", hint: "thời gian, gấp, deadline" },
  { char: "💼", hint: "công việc, nghề nghiệp" },

  // Cảm xúc
  { char: "🔥", hint: "mạnh, hot, ấn tượng" },
  { char: "😅", hint: "ngại ngùng, cười trừ" },
  { char: "😭", hint: "buồn, tiếc, quá đáng thương" },
  { char: "😱", hint: "sốc, bất ngờ, sợ" },
  { char: "🤯", hint: "choáng, khó tin, vỡ đầu" },
  { char: "😍", hint: "thích, mê" },
  { char: "😤", hint: "quyết tâm, bực" },
  { char: "🥺", hint: "năn nỉ, tủi" },

  // Phán xét
  { char: "✅", hint: "đúng, nên làm, xong" },
  { char: "❌", hint: "sai, đừng làm, hỏng" },
  { char: "⚠️", hint: "cảnh báo, cẩn thận" },
  { char: "👍", hint: "tốt, đồng ý" },
  { char: "👎", hint: "dở, không đồng ý" },
  { char: "💯", hint: "tuyệt đối, hoàn toàn đúng" },

  // Người · hành động
  { char: "🧠", hint: "suy nghĩ, tư duy, kiến thức" },
  { char: "👀", hint: "chú ý, nhìn kỹ, để ý" },
  { char: "💪", hint: "cố gắng, mạnh mẽ, kiên trì" },
  { char: "🤝", hint: "hợp tác, thoả thuận, quan hệ" },
  { char: "🏃", hint: "nhanh, chạy, hành động ngay" },
  { char: "🙋", hint: "hỏi, tự nhận, xung phong" },

  // Đồ vật · nơi chốn
  { char: "📱", hint: "điện thoại, mạng xã hội" },
  { char: "💻", hint: "máy tính, làm online" },
  { char: "🏠", hint: "nhà, chỗ ở" },
  { char: "🚗", hint: "xe, đi lại" },
  { char: "☕", hint: "cà phê, nghỉ, đời thường" },

  // Ý niệm
  { char: "💡", hint: "ý tưởng, mẹo, cách làm" },
  { char: "🔑", hint: "mấu chốt, chìa khoá vấn đề" },
  { char: "⭐", hint: "điểm nổi bật, đáng nhớ" },
  { char: "🚀", hint: "bứt phá, nhanh vượt bậc" },
  { char: "🎉", hint: "ăn mừng, thành công" },
];

const BY_CHAR = new Map(EMOJI_VOCAB.map((entry) => [entry.char, entry]));

/** Emoji này có trong vốn từ không. Ngoài vốn từ là KHÔNG có tệp ảnh để dán. */
export function isKnownEmoji(char: string | null | undefined): boolean {
  return typeof char === "string" && BY_CHAR.has(char);
}

/**
 * Tên tệp ảnh của một emoji, theo cách đặt tên của kho Noto: mã điểm viết hệ 16,
 * nối bằng gạch dưới.
 *
 * BỎ `U+FE0F` — nó là dấu "hãy vẽ kiểu emoji", không phải một phần của hình, và
 * kho Noto không đưa nó vào tên tệp. Thiếu bước này thì `⚠️` và `❤️` tra ra tệp
 * không tồn tại, trong khi mọi emoji khác vẫn chạy — một lỗi chỉ lộ ra ở đúng
 * vài hình.
 */
export function emojiFileName(char: string): string {
  const points = [...char]
    .map((symbol) => symbol.codePointAt(0)!)
    .filter((point) => point !== 0xfe0f)
    .map((point) => point.toString(16));
  return `emoji_u${points.join("_")}.png`;
}

/**
 * Đường dẫn ảnh cho trang xem — khớp tiền tố tĩnh khai ở `server/main.ts`.
 *
 * `/emoji/` chứ không `/assets/emoji/`: `/assets/` là chỗ bản dựng của Vite đổ
 * tệp ra, và hai bộ phục vụ tĩnh chung một tiền tố chỉ hỏng ở môi trường thật.
 */
export function emojiUrl(char: string): string {
  return `/emoji/${emojiFileName(char)}`;
}

/** Danh sách cho mô hình đọc: mỗi dòng một hình kèm nghĩa. */
export function emojiMenu(): string {
  return EMOJI_VOCAB.map((entry) => `${entry.char} ${entry.hint}`).join("\n");
}
