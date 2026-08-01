import { db } from "./db";

/**
 * BỐI CẢNH DỰ ÁN cho các chặng AI — thứ người dùng đã gõ mà máy chưa đọc.
 *
 * Ô "Video nói về gì" ở màn nạp tệp là chỗ người dùng viết những thứ như
 * *"mình lập công ty TensorLab, làm Golang với Redis"*. Nó đang được dùng ở
 * đúng hai chỗ: mồi từ vựng cho máy nghe, và chặng sửa chỗ nghe nhầm.
 *
 * Còn bốn chặng chọn lựa thì không đọc nó, nên chúng làm việc mù:
 *
 * · chọn từ khoá — không biết "TensorLab" là tên riêng, nên không nhấn
 * · chọn nhạc    — không biết giọng điệu chung của video
 * · đặt tư liệu  — không biết chủ đề để khớp cảnh
 * · chọn hiệu ứng— không biết video này gắt hay êm
 *
 * Chi phí thêm bối cảnh gần bằng không: vài chục chữ vào mỗi lượt gọi. Còn
 * chênh lệch thì lớn — một mô hình biết chủ đề chọn khác hẳn một mô hình chỉ
 * nhìn thấy chuỗi chữ rời.
 *
 * CẮT NGẮN có chủ ý: lời dặn là ô tự do, có người dán cả một trang. Ba trăm
 * chữ đủ cho tên riêng và chủ đề — phần còn lại chỉ làm loãng đúng thứ đang
 * cần nổi bật trong lời nhắc.
 */
export function boiCanhDuAn(projectId: string): string | null {
  const row = db
    .prepare("SELECT title, profile FROM projects WHERE id=?")
    .get(projectId) as { title?: string | null; profile?: string | null } | undefined;
  if (!row) return null;

  const phan: string[] = [];
  const ten = String(row.title ?? "").trim();
  // Tên tự sinh ("Dự án 31/7") không nói gì về nội dung — bỏ qua, không thì nó
  // thành nhiễu ở mọi lời nhắc.
  if (ten && !/^Dự án \d/.test(ten)) phan.push(`Tên video: ${ten}`);

  const loiDan = String(row.profile ?? "").trim().slice(0, 300);
  if (loiDan) phan.push(`Người làm video nói về nội dung: ${loiDan}`);

  return phan.length > 0 ? phan.join("\n") : null;
}

/**
 * Ghép bối cảnh vào phần đầu lời nhắc, hoặc trả nguyên lời nhắc khi không có gì.
 *
 * Đặt ở ĐẦU chứ không ở cuối: mô hình đọc nhiệm vụ với bối cảnh đã có sẵn
 * trong đầu thì nó áp bối cảnh ấy vào từng luật bên dưới. Đặt ở cuối thì nó
 * đọc xong luật rồi mới biết video nói về gì, và phải quay lại xét lại từ đầu.
 */
export function voiBoiCanh(instructions: string, projectId: string): string {
  const boiCanh = boiCanhDuAn(projectId);
  if (!boiCanh) return instructions;
  return `${boiCanh}\n\n---\n\n${instructions}`;
}
