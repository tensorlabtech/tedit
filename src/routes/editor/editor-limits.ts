/**
 * Sàn độ dài của từng loại khối trên dải thời gian.
 *
 * Tách ra vì cả `use-editor.ts` lẫn `use-trim-drag.ts` đều kẹp theo chúng — mà
 * hai bản khác nhau của cùng một con số thì kéo mép ở hai chỗ cho hai kết quả.
 */

/**
 * Khoảng nhạc ngắn hơn hai giây không còn là nhạc nền, chỉ là một tiếng bụp.
 * Máy chủ chặn cùng con số này — xem `music-tracks.ts`.
 */
export const MIN_MUSIC_LENGTH = 2;

/** Sàn khi kéo hai đầu khối chữ; máy chủ chặn cùng con số này. */
export const MIN_TEXT_LENGTH = 0.4;

/**
 * Hiệu ứng ngắn nhất — dưới mức này thì cú nhấn rơi gọn trong một hai khung
 * hình, xem ra chỉ như một cái giật chứ không đọc được là chủ ý.
 */
export const MIN_EFFECT_LENGTH = 0.15;

/** Đoạn ngắn hơn mức này thì kéo mép qua nhau, không còn là một đoạn. */
export const MIN_SEGMENT = 0.3;
