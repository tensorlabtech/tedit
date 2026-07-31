import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { db } from "./db";
import { ask, object } from "./llm";
import { addMusic, listMusic, mainDuration } from "./music-tracks";
import { DATA_ROOT } from "./paths";
import { settingsForProject } from "./settings";

/**
 * Chọn nhạc nền trong số nhạc NGƯỜI DÙNG ĐÃ TẢI LÊN.
 *
 * Nhạc người dùng tự tải lên đi THẲNG vào `music_tracks` (qua
 * `POST /api/projects/:id/music`), nên không hề có một kho "đã tải nhưng chưa
 * đặt" để mà chọn. Kho ở đây là một THƯ MỤC trên máy chủ:
 *
 *     server/data/music/*.mp3|m4a|wav|ogg|flac
 *
 * Thả bài vào đó là mọi dự án dùng chung. Thư mục rỗng thì chặng này bỏ qua —
 * đó là kết quả ĐÚNG, không phải hỏng.
 */

/** Kho nhạc dùng chung cho mọi dự án. */
const LIBRARY = join(DATA_ROOT, "music");
const AUDIO = /\.(mp3|m4a|aac|wav|ogg|flac)$/i;

/** Nhạc nền dưới lời nói. To hơn là át tiếng người, đó là lỗi hay gặp nhất. */
const MIN_VOLUME = 0.06;
const MAX_VOLUME = 0.22;

type Proposal = {
  /** Mã bài chọn, hoặc chuỗi rỗng nếu không bài nào hợp */
  fileId: string;
  volume: number;
  reason: string;
};

const SCHEMA = object({
  fileId: { type: "string" },
  volume: { type: "number" },
  reason: { type: "string" },
});

const INSTRUCTIONS = `Bạn chọn nhạc nền cho một video nói tiếng Việt.

Bạn được xem nội dung lời và danh sách bài nhạc đã có. Mỗi bài kèm TÔNG NHẠC —
hãy chọn dựa vào tông đó, đừng đoán theo tên bài. Bài nào bỏ trống phần tông thì
chỉ còn cái tên để đoán, và nên nhường bài có tông ghi rõ.

Chọn MỘT bài hợp với giọng điệu của lời, rồi chọn mức âm lượng 0.06–0.22:
- gần 0.06 khi lời dày, nói liên tục — nhạc chỉ để lấp nền
- gần 0.22 khi có nhiều quãng lặng, nhạc được phép nghe rõ hơn

Không bài nào hợp thì trả fileId rỗng. Thà không có nhạc còn hơn có nhạc chỏi
với nội dung.`;

/**
 * Tông nhạc của từng bài, đọc từ `kho.json` nằm cạnh các tệp.
 *
 * Vì sao phải có bảng riêng: mô hình KHÔNG nghe được nhạc, nó chỉ đọc chữ ta đưa.
 * Trước đây chữ ấy là tên tệp, nên kho phải đặt tên kiểu "nhe-nhang.mp3" mới chọn
 * đúng — mà tên đặt theo tông thì kho không lớn lên được: thêm nghệ sĩ khác, đổi
 * nguồn, hay đối chiếu lại giấy phép đều cần TÊN GỐC.
 *
 * Bài nào không có trong bảng thì vẫn dùng được, chỉ là mô hình chỉ còn cái tên
 * để đoán. Thả một tệp vào thư mục là chạy — đó là lời hứa của kho này, và một
 * bảng bắt buộc sẽ phá lời hứa ấy.
 */
function readTags(): Map<string, string> {
  const path = join(LIBRARY, "kho.json");
  if (!existsSync(path)) return new Map();
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      tracks?: Array<{ file?: string; tags?: string[]; seconds?: number }>;
    };
    return new Map(
      (raw.tracks ?? [])
        .filter((track) => track.file)
        .map((track) => [track.file!, (track.tags ?? []).join(", ")]),
    );
  } catch {
    // Bảng hỏng KHÔNG được làm chết chặng chọn nhạc: mất bảng thì mô hình quay về
    // đoán bằng tên tệp, vẫn ra một bài nghe được.
    return new Map();
  }
}

export async function pickMusic(projectId: string): Promise<{
  applied: number;
  note: string;
}> {
  // Đã có nhạc thì thôi: đây là chặng THÊM VÀO, không phải chặng thay nhạc
  // người dùng đã chọn.
  if (listMusic(projectId).length > 0)
    return { applied: 0, note: "đã có nhạc" };

  if (!existsSync(LIBRARY)) {
    return { applied: 0, note: "chưa có kho nhạc" };
  }
  const tags = readTags();
  const files = readdirSync(LIBRARY)
    .filter((name) => AUDIO.test(name))
    .map((name) => ({
      id: name,
      name,
      // Tên tệp giữ nguyên TÊN GỐC của bài để kho còn lớn lên được — đổi nguồn hay
      // đối chiếu lại giấy phép đều cần tên thật. Nhưng "Ocean Memory" thì không
      // nói lên tông nhạc, nên tông nằm ở `kho.json` và được ghép vào đây.
      tags: tags.get(name) ?? "",
      stored_path: join(LIBRARY, name),
    }));
  if (files.length === 0) return { applied: 0, note: "kho nhạc rỗng" };

  const sentences = db
    .prepare("SELECT text FROM sentences WHERE project_id=? ORDER BY position")
    .all(projectId) as Array<{ text: string }>;
  if (sentences.length === 0) return { applied: 0, note: "chưa có lời" };

  const proposal = await ask<Proposal>({
    instructions: INSTRUCTIONS,
    input:
      `Bài nhạc (mã|tên|tông):\n` +
      files.map((file) => `${file.id}|${file.name}|${file.tags}`).join("\n") +
      `\n\nLời:\n${sentences.map((s) => s.text).join(" ")}`,
    schemaName: "music",
    // Việc này không cần suy luận sâu — dùng bậc mô hình rẻ.
    cheap: true,
    schema: SCHEMA,
  });

  const chosen = files.find((file) => file.id === proposal.fileId);
  if (!chosen) return { applied: 0, note: "không bài nào hợp" };

  const duration = mainDuration(projectId);
  if (!(duration > 0)) return { applied: 0, note: "chưa đo được thời lượng" };

  // Kẹp âm lượng bằng CODE. Mô hình trả 0.8 là chuyện có thật, và 0.8 thì nhạc
  // át hẳn tiếng người — không ai nghe ra lời nữa.
  //
  // Trần lấy từ Cài đặt của người dùng, nhưng không bao giờ vượt trần cứng ở trên:
  // cài đặt là để hạ xuống cho nhẹ hơn, không phải để mở đường át tiếng.
  const tran = Math.min(MAX_VOLUME, settingsForProject(projectId).musicVolume);
  const volume = Math.min(
    tran,
    Math.max(MIN_VOLUME, Number(proposal.volume) || MIN_VOLUME),
  );

  // Độ dài bài lấy bằng chính độ dài video: `addMusic` cắt nhạc theo mốc, và
  // cho nó bằng thời lượng phim thì bài phủ trọn rồi dừng đúng đuôi.
  const track = addMusic(
    projectId,
    chosen.name,
    chosen.stored_path,
    duration,
    duration,
    0,
  );
  if (!track) return { applied: 0, note: "không đặt được" };
  db.prepare("UPDATE music_tracks SET volume=? WHERE id=?").run(
    volume,
    track.id,
  );

  return { applied: 1, note: `${chosen.name} · ${volume.toFixed(2)}` };
}
