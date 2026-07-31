import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { db } from "./db";
import { ask, object, type ImagePart } from "./llm";
import { probe, run } from "./media-tools";
import { workDir } from "./paths";

/**
 * Đọc nội dung từng tệp tư liệu chèn để về sau còn biết đặt nó vào đâu.
 *
 * ĐỌC MỘT LẦN cho mỗi tệp rồi lưu lại: ảnh không tự đổi, nên đọc lại ở lượt
 * dựng sau là trả tiền hai lần cho cùng một câu trả lời.
 *
 * Video lấy BA khung chứ không một: một khung đầu clip rất hay rơi vào lúc còn
 * tối hoặc còn mờ, và mô tả sai ngay từ đây thì chặng đặt tư liệu sai theo mà
 * không có gì mâu thuẫn để lộ ra.
 */

const FRAMES = 3;
/** Cạnh dài của khung gửi đi. To hơn không mô tả đúng thêm, chỉ tốn thêm. */
const LONG_EDGE = 512;

type Row = {
  id: string;
  name: string;
  stored_path: string;
  duration: number | null;
};

const SCHEMA = object({
  summary: { type: "string" },
  tags: { type: "array", items: { type: "string" } },
  hasPeople: { type: "boolean" },
});

type Description = {
  summary: string;
  tags: string[];
  hasPeople: boolean;
};

const INSTRUCTIONS = `Bạn mô tả một tư liệu chèn để về sau ghép vào video nói.

Trả về bằng TIẾNG VIỆT:
- summary: một câu ngắn tả thứ NHÌN THẤY được. Cụ thể, không văn vẻ.
  Tốt: "màn hình laptop đang mở bảng tính". Tệ: "khoảnh khắc làm việc đầy cảm hứng".
- tags: 3-6 danh từ hoặc cụm danh từ ngắn, dùng để dò tìm về sau.
- hasPeople: có thấy rõ mặt người không.

Nhiều khung ảnh là NHIỀU LÁT của CÙNG một clip — tả cả clip, đừng tả riêng từng khung.`;

/**
 * Lấy `FRAMES` khung rải đều, giữ nguyên tỉ lệ khung hình.
 *
 * `key` đi vào TÊN TỆP tạm và phải là duy nhất cho mỗi tư liệu. Bản trước đặt tên
 * theo mỗi số thứ tự khung (`broll-frame-0.jpg`), tức cả dự án dùng chung một tên
 * — chạy tuần tự thì không sao, nhưng từ khi năm tệp chạy cùng lúc thì chúng ghi
 * đè lên nhau rồi `rm` xoá mất khung của nhau. Đo thật ngay lần chạy song song đầu
 * tiên: 5 tệp thì 4 tệp lỗi.
 */
async function grabFrames(
  source: string,
  duration: number,
  dir: string,
  key: string,
) {
  const parts: ImagePart[] = [];
  for (let index = 0; index < FRAMES; index += 1) {
    const at = duration * ((index + 0.5) / FRAMES);
    const target = join(dir, `broll-frame-${key}-${index}.jpg`);
    await run("ffmpeg", [
      "-y",
      "-ss",
      at.toFixed(2),
      "-i",
      source,
      "-frames:v",
      "1",
      // KHÔNG cắt về 9:16 như ảnh đại diện: tư liệu ngang bị cắt mất hai bên
      // thì mô tả nói về phần giữa, còn thứ đáng nói lại nằm ngoài rìa.
      "-vf",
      `scale=${LONG_EDGE}:${LONG_EDGE}:force_original_aspect_ratio=decrease`,
      target,
    ]);
    parts.push({
      mimeType: "image/jpeg",
      base64: (await readFile(target)).toString("base64"),
    });
    await rm(target, { force: true });
  }
  return parts;
}

export async function describeInserts(projectId: string): Promise<{
  described: number;
  failed: number;
}> {
  const rows = db
    .prepare(
      `SELECT id, name, stored_path, duration FROM media_files
       WHERE project_id=? AND role='insert'
         AND (description IS NULL OR description='')`,
    )
    .all(projectId) as Row[];
  if (rows.length === 0) return { described: 0, failed: 0 };

  const save = db.prepare("UPDATE media_files SET description=? WHERE id=?");
  let described = 0;
  let failed = 0;

  /**
   * Mỗi tệp một lượt, CÙNG LÚC.
   *
   * Trước đây xếp hàng chờ nhau: đo trên một dự án 5 tệp là 40,1 giây cho việc
   * lẽ ra tốn khoảng 8 — mỗi tệp một lời gọi riêng, không tệp nào cần biết tệp
   * kia mô tả ra gì, mà vẫn đứng chờ đủ bốn lượt trước mình xong.
   *
   * `allSettled` chứ không `all`: một tệp hỏng thì những tệp còn lại vẫn phải về
   * đủ. `all` gãy ngay ở cái đầu tiên hỏng và ném đi cả những kết quả đã có.
   */
  const runs = rows.map(async (row) => {
    try {
      const isStill = !row.duration || row.duration < 0.05;
      const images = isStill
        ? [
            {
              mimeType: "image/jpeg",
              base64: (await readFile(row.stored_path)).toString("base64"),
            },
          ]
        : await grabFrames(
            row.stored_path,
            row.duration ?? (await probe(row.stored_path)).duration,
            workDir(projectId),
            row.id,
          );

      const result = await ask<Description>({
        instructions: INSTRUCTIONS,
        input: `Tên tệp: ${row.name}`,
        schemaName: "broll_description",
        // Việc này không cần suy luận sâu — dùng bậc mô hình rẻ.
        cheap: true,
        schema: SCHEMA,
        images,
      });

      // Gộp thành MỘT chuỗi: chặng đặt tư liệu chỉ cần đọc, không cần truy vấn
      // theo từng trường, nên một cột chữ là đủ và khỏi thêm bảng.
      save.run(
        [
          result.summary,
          result.tags.join(", "),
          result.hasPeople ? "có người" : "",
        ]
          .filter(Boolean)
          .join(" · "),
        row.id,
      );
      described += 1;
    } catch {
      // Một tệp hỏng KHÔNG được làm hỏng cả chặng: tệp khác vẫn mô tả được, và
      // chặng này vốn không bắt buộc.
      failed += 1;
    }
  });
  await Promise.allSettled(runs);

  return { described, failed };
}
