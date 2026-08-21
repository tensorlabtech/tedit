/**
 * GÓC NGHIÊNG "DÁN TAY" — một chuỗi góc, mọi đường vẽ dùng chung.
 *
 * Ô tư liệu nổi trên nền trang được xoay vài độ như ảnh polaroid dán lệch tay,
 * xoay vòng theo thứ tự ô để hai ô cạnh nhau lệch NGƯỢC chiều — thẳng hàng đều
 * nhau thì đọc ra là máy xếp, không phải tay dán.
 *
 * ## Vì sao nó phải nằm ở MỘT chỗ
 *
 * Ba đường vẽ cùng cần con số này: khung xem của bàn dựng (CSS `rotate`), bản
 * xuất Remotion (CSS `rotate`), và đường ffmpeg cũ (`rotate` theo radian). Mỗi
 * bên chép một bản thì lệch câm lặng: đã xảy ra — khung xem xoay `[-4, 3.5,
 * -2.5, 3]` còn bản xuất xoay `[-2, 1.75, -1.25, 1.5]`, tức người dùng canh độ
 * lệch trên màn rồi xuất ra được một video nghiêng bằng NỬA thứ họ đã canh.
 *
 * Biên độ ~2° là mức đã chốt: thấy rõ là lệch tay, chưa tới mức đọc ra là hỏng.
 * `captionTilt` của bộ Phấn bám đúng biên độ này — chữ và ảnh dán trên cùng một
 * trang phải lệch cùng một mức, lệch hơn là đọc ra hai bàn tay.
 */
export const HANDMADE_TILT_DEG = [-2, 1.75, -1.25, 1.5];

/** Góc của ô thứ `at` (xoay vòng). */
export const handmadeTiltAt = (at: number) =>
  HANDMADE_TILT_DEG[at % HANDMADE_TILT_DEG.length];
