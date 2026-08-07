import { db } from "./db";
import { composeProfile, settingsForProject } from "./settings";

/**
 * Mồi từ vựng cho máy nghe — `initial_prompt` của whisper.
 *
 * Whisper nhận một đoạn mồi và thiên về nhả ra những từ có trong đó. Đây là
 * cách RẺ NHẤT để chữa lỗi nghe nhầm, vì nó chặn lỗi từ đầu thay vì sửa sau:
 * mồi có sẵn "network" thì máy khó lòng chép ra "nem quốc".
 *
 * Trước đây mồi là một câu chung chung không chứa từ vựng nào — tức là bỏ trống
 * hẳn kênh này. Tài liệu gọi kỹ thuật này là *contextual biasing*, và nó là thứ
 * đầu tiên nên làm trước khi nghĩ tới sửa lỗi bằng LLM.
 *
 * Ba nguồn từ vựng, xếp theo độ đáng tin:
 *   1. Người dùng tự khai (ngành nghề, giới thiệu) — chắc nhất
 *   2. Mô tả tư liệu chèn của chính dự án này
 *   3. Thuật ngữ lạ rút từ các dự án TRƯỚC của cùng máy chủ
 */

/**
 * Trần ký tự của đoạn mồi.
 *
 * Whisper chỉ nhận 224 token cho phần mồi, thừa ra bị cắt cụt ÂM THẦM — mà cắt
 * cụt thì phần từ vựng quý nhất (xếp sau câu dẫn) là phần rụng đầu tiên. Để
 * ngắn hơn hẳn ngưỡng cho chắc.
 */
const MAX_CHARS = 600;

/** Câu dẫn: whisper bắt chước cả VĂN PHONG của mồi, nên mồi phải là văn xuôi thật. */
const LEAD =
  "Đây là một video tiếng Việt, người nói tự quay và kể chuyện của mình.";

/**
 * Âm cuối hợp lệ của một âm tiết tiếng Việt.
 *
 * Tiếng Việt chỉ đóng âm tiết bằng ngần này. Từ kết thúc bằng chữ khác —
 * "network", "job", "dev", "all", "series" — chắc chắn không phải tiếng Việt.
 */
const VIET_FINALS = /(?:[aeiouy]|ch|nh|ng|[cmnpt])$/;

/** Phụ âm đầu hợp lệ. Cụm ngoài danh sách này ("st", "sc", "pr") là từ mượn. */
const VIET_ONSETS =
  /^(?:ngh|ng|nh|ch|gh|gi|kh|ph|th|tr|qu|[bcdghklmnprstvx]|đ)?[aeiouy]/;

/**
 * Từ đáng đưa vào mồi: những từ whisper HAY NGHE NHẦM.
 *
 * Bản trước chỉ loại từ CÓ DẤU, nên lọt cả rổ âm tiết tiếng Việt không dấu —
 * "ban", "con", "tay", "qua", "trong". Mồi bằng những từ ấy vừa vô ích (whisper
 * vốn nghe đúng) vừa có hại: chỗ trong đoạn mồi có hạn, chúng chiếm mất chỗ của
 * đúng những từ cần mồi.
 *
 * Giờ lọc theo CẤU ÂM: giữ lại từ mà tiếng Việt không phát âm được như thế.
 */
function isRareTerm(word: string) {
  // Gọt dấu câu dính hai đầu — không gọt thì "nay." và "nay" thành hai mục.
  const clean = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (clean.length < 2 || clean.length > 24) return false;
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(clean)) return false;

  // Có dấu tiếng Việt -> thuần Việt, whisper không cần mồi.
  if (
    /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(
      word,
    )
  )
    return false;

  // Chữ tiếng Việt không dùng: chắc chắn từ mượn.
  if (/[fjwz]/i.test(clean)) return true;
  // VIẾT HOA giữa câu -> tên riêng, tên sản phẩm.
  if (/[A-Z]/.test(clean.slice(1)) || /^[A-Z]/.test(clean)) return true;

  const lower = clean.toLowerCase();
  // Kết thúc bằng âm tiếng Việt không đóng được, hoặc mở đầu bằng cụm lạ.
  return !VIET_FINALS.test(lower) || !VIET_ONSETS.test(lower);
}

function uniqueTerms(source: string, into: Set<string>) {
  for (const word of source.split(/[\s,.;:()"'“”/–—-]+/)) {
    const clean = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (isRareTerm(word)) into.add(clean);
  }
}

/**
 * Dựng đoạn mồi cho một dự án.
 *
 * Trả về câu dẫn khi không có gì để mồi — đúng bằng hành vi cũ, nên dự án không
 * khai gì cũng không tệ đi.
 */
export function buildAsrPrompt(projectId: string): string {
  const project = db
    .prepare("SELECT title, profile FROM projects WHERE id=?")
    .get(projectId) as { title: string; profile: string | null } | undefined;

  const terms = new Set<string>();

  // Mô tả tư liệu chèn của CHÍNH dự án này. Đọc tư liệu không cần bản chép lời
  // nên chặng ấy chạy được trước, và từ vựng của nó nói đúng về video này.
  const descriptions = (
    db
      .prepare(
        `SELECT description FROM media_files
         WHERE project_id=? AND description IS NOT NULL AND description<>''`,
      )
      .all(projectId) as Array<{ description: string }>
  ).map((row) => row.description);
  for (const text of descriptions) uniqueTerms(text, terms);

  // Thuật ngữ từ các dự án TRƯỚC: người làm video thường quay quanh một chủ đề,
  // nên tên sản phẩm và từ chuyên môn lặp lại giữa các video của họ.
  const earlier = db
    .prepare(
      `SELECT w.text FROM words w
       WHERE w.project_id <> ?
       GROUP BY w.text HAVING COUNT(*) >= 2
       LIMIT 400`,
    )
    .all(projectId) as Array<{ text: string }>;
  for (const row of earlier) if (isRareTerm(row.text)) terms.add(row.text);

  const parts = [LEAD];
  // HỒ SƠ CHUNG (ngành, tên riêng — từ onboarding/Cài đặt): tên riêng ở đây là
  // thứ whisper hay nghe sai nhất, nên mồi trước. Bơm lúc chạy thay vì seed vào
  // `projects.profile` (cột đó là đề bài per-dự-án của luồng).
  const hoSo = composeProfile(settingsForProject(projectId)).trim();
  if (hoSo) parts.push(hoSo);
  // Lời tự khai đặt TRƯỚC danh sách từ: nó là văn xuôi thật nên whisper bám
  // được cả văn phong, còn danh sách từ rời chỉ mồi được mặt từ vựng.
  if (project?.profile?.trim()) parts.push(project.profile.trim());
  // Tên do MÁY đặt thì không mồi được gì: "Video tên là Dự án 30/7" không giúp máy
  // nghe đúng chữ nào, lại còn đẩy hai con số vô nghĩa vào đoạn mồi.
  const machineTitle = /^Dự án( mới| \d{1,2}\/\d{1,2})?$/.test(
    project?.title?.trim() ?? "",
  );
  if (project?.title?.trim() && !machineTitle) {
    parts.push(`Video tên là "${project.title.trim()}".`);
  }
  if (terms.size > 0) {
    parts.push(`Có nhắc tới: ${[...terms].slice(0, 60).join(", ")}.`);
  }

  return parts.join(" ").slice(0, MAX_CHARS);
}
