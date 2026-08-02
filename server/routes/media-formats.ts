/**
 * Đuôi tệp mà các route NHẬN VÀO DỰ ÁN.
 *
 * Tách ra vì ba nhóm route dùng chung: nhận tệp vào dự án, kho tư liệu, kho nhạc.
 *
 * CỐ Ý KHÔNG dùng `IMAGE`/`VIDEO` mà `asset-library.ts` đã export, dù trông y
 * hệt: bản ở đó nhận thêm `gif`, bản này thì không. Trỏ chung vào một bản là
 * lặng lẽ đổi hành vi nhận tệp của dự án — mà đây chỉ là cú chuyển tệp, không
 * phải chỗ đổi luật.
 *
 * Hai bản lệch nhau là một lỗi nhỏ có thật: cùng một tấm `.gif` vào được kho
 * chung nhưng không vào thẳng dự án được. Chọn bên nào là một quyết định riêng,
 * không thuộc cú tách này.
 */

export const VIDEO = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;
export const IMAGE = /\.(jpe?g|png|webp|heic)$/i;
export const AUDIO = /\.(mp3|m4a|aac|wav|ogg|flac)$/i;
