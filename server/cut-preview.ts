import { createHash } from "node:crypto";
import { existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ffmpeg, probe } from "./media-tools";
import { workDir } from "./paths";
import { keptRanges } from "./pipeline";

/**
 * BẢN XEM TRƯỚC ĐÃ CẮT — ghép sẵn các đoạn còn giữ thành MỘT tệp liền mạch.
 *
 * ## Vì sao cần, dù màn cắt đã phát được bản đã cắt
 *
 * Màn cắt vốn phát tệp GỐC rồi nhảy qua từng khoảng bỏ. Cách ấy đúng và luôn
 * đúng, nhưng nó không bao giờ mượt bằng một video liền: mỗi mối nối là một cú
 * seek, và trình duyệt mất chừng một khung để dựng lại luồng giải mã. Đo trên
 * trang thử: 19ms mỗi mối nối ở máy rảnh — nhỏ, nhưng có, và người dùng nghe/thấy
 * ra ngay khi các mối nối nằm gần nhau.
 *
 * Ghép sẵn thì không còn mối nối nào để mà vấp: thứ đang phát LÀ một video liền.
 *
 * ## Vì sao rẻ
 *
 * `preview.mp4` là all-intra (mỗi khung một keyframe), nên cắt đúng từng khung mà
 * KHÔNG phải mã hoá lại — chỉ chép byte. Đo thật: **0,52 giây** cho một bản 70,5
 * giây ghép từ 5 đoạn. Với video thường thì `-c copy` không cắt đúng khung được
 * (phải rơi về keyframe gần nhất), và cả cách này sẽ vô dụng.
 *
 * ## Vì sao đặt tên theo VÂN TAY
 *
 * Người dùng còn sửa các khoảng cắt liên tục. Đặt tên cố định thì phải biết lúc
 * nào tệp cũ hết hạn, mà "hết hạn" ở đây phụ thuộc dữ liệu chứ không phụ thuộc
 * thời gian. Lấy vân tay của chính danh sách khoảng giữ làm tên: trùng vân tay là
 * dùng lại được, khác vân tay là một tệp khác — không có trạng thái nào để lỡ.
 */

/** Vân tay của một danh sách khoảng giữ — đổi một mép là đổi tên tệp. */
function vanTay(kept: ReadonlyArray<{ start: number; end: number }>): string {
  const text = kept.map((r) => `${r.start.toFixed(3)}-${r.end.toFixed(3)}`).join("|");
  return createHash("sha1").update(text).digest("hex").slice(0, 12);
}

const tenTep = (dau: string) => `cut-preview-${dau}.mp4`;

/**
 * Đường dẫn bản đã cắt cho trạng thái HIỆN TẠI của dự án, dựng nếu chưa có.
 *
 * Trả `null` khi không có gì để cắt (chưa bỏ đoạn nào) — lúc ấy màn cắt cứ phát
 * thẳng `preview.mp4`, không cần bản ghép nào cả.
 */
export async function ensureCutPreview(
  projectId: string,
): Promise<{ path: string; kept: Array<{ start: number; end: number }> } | null> {
  const work = workDir(projectId);
  const nguon = join(work, "preview.mp4");
  if (!existsSync(nguon)) return null;

  /*
   * Dùng ĐÚNG hàm mà bản xuất dùng (`keptRanges`), không tự tính lại.
   *
   * Nếu bản xem trước cắt theo một phép tính khác bản xuất thì người dùng duyệt
   * một thứ rồi nhận một thứ khác — mà lệch kiểu ấy chỉ lộ ra sau khi xuất xong.
   */
  const { duration } = await probe(nguon);
  const kept = keptRanges(projectId, duration).map((r) => ({
    start: r.start,
    end: r.end,
  }));
  if (kept.length === 0) return null;
  const tong = kept.reduce((sum, r) => sum + (r.end - r.start), 0);
  if (tong <= 0.1) return null;
  /*
   * Chưa bỏ gì thì ĐỪNG ghép: bản ra sẽ trùng hệt bản gốc, tốn thêm chừng ấy đĩa
   * và nửa giây máy, đổi lại đúng không gì cả. Nhận ra bằng "một khoảng duy nhất
   * phủ gần hết" chứ không bằng `kept.length === 0` — không bỏ đoạn nào thì
   * `keptRanges` trả về một khoảng trọn video, chứ không trả về mảng rỗng.
   */
  if (kept.length === 1 && tong >= duration - 0.2) return null;

  const dau = vanTay(kept);
  const dich = join(work, tenTep(dau));
  if (existsSync(dich)) return { path: dich, kept };

  // Dọn các bản của lần sửa TRƯỚC: chúng không bao giờ được dùng lại (vân tay đã
  // khác), mà mỗi bản là vài chục MB.
  for (const ten of readdirSync(work)) {
    if (ten.startsWith("cut-preview-") && ten !== tenTep(dau)) {
      rmSync(join(work, ten), { force: true });
    }
  }

  /*
   * Cắt từng đoạn giữ rồi nối bằng concat demuxer, tất cả `-c copy`.
   *
   * `-ss`/`-to` đặt TRƯỚC `-i` để ffmpeg nhảy thẳng tới chỗ cần thay vì đọc từ
   * đầu — với tệp all-intra thì vẫn đúng từng khung, mà nhanh hơn hẳn.
   */
  const phan: string[] = [];
  for (const [i, r] of kept.entries()) {
    const p = join(work, `cut-part-${i}.mp4`);
    await ffmpeg([
      "-ss",
      r.start.toFixed(3),
      "-to",
      r.end.toFixed(3),
      "-i",
      nguon,
      "-c",
      "copy",
      "-y",
      p,
    ]);
    phan.push(p);
  }
  const danhSach = join(work, "cut-parts.txt");
  writeFileSync(
    danhSach,
    phan.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
  );
  await ffmpeg([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    danhSach,
    "-c",
    "copy",
    // `+faststart` để trình duyệt phát được từ byte đầu, không phải tải hết tệp
    // rồi mới thấy hình — cùng lý do với bản xuất.
    "-movflags",
    "+faststart",
    "-y",
    dich,
  ]);
  for (const p of phan) rmSync(p, { force: true });
  rmSync(danhSach, { force: true });

  return { path: dich, kept };
}
