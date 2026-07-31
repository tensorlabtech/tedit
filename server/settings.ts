import { db } from "./db";

/**
 * CÀI ĐẶT của người dùng — mặc định cho mọi dự án về sau.
 *
 * Chỉ đưa vào đây những con số MÁY THẬT SỰ ĐỌC. Một trang cài đặt đầy nút không
 * nối vào đâu còn tệ hơn không có trang nào: người dùng chỉnh, thấy không đổi gì,
 * rồi thôi không tin cả những nút có tác dụng thật.
 *
 * Mỗi mục dưới đây đều có một chỗ đọc cụ thể, ghi ngay trong chú thích của nó.
 *
 * Cài đặt là MẶC ĐỊNH LÚC TẠO DỰ ÁN, không phải lệnh áp ngược. Dự án đã dựng rồi
 * mà đổi cài đặt thì không có gì tự chạy lại — nếu áp ngược thì một lần chỉnh nút
 * sẽ lặng lẽ đổi bản dựng người dùng đã ngồi sửa cả buổi.
 */

export type Settings = {
  /** Quãng lặng dài hơn ngần này giây thì tự rút. `0` = đừng rút. Đọc ở `auto-trim-silence.ts`. */
  minSilence: number;
  /** Trung bình bao nhiêu giây phim thì có một cú nhấn ở chỗ nối. Đọc ở `ai-effects.ts`. */
  secondsPerEffect: number;
  /** Mỗi phút lời thì nhắm bao nhiêu lần chèn tư liệu. Đọc ở `ai-broll-place.ts`. */
  placesPerMinute: number;
  /** Mức to nhất của nhạc nền dưới lời nói. Đọc ở `ai-music.ts`. */
  musicVolume: number;
  /** Có sinh chữ từ lời không. Đọc lúc tạo dự án. */
  wantCaptions: boolean;
  /** Có tự chọn nhạc nền không. Đọc ở chặng `music`. */
  wantMusic: boolean;
  /**
   * Chặng tự ghép tư liệu được phép lấy từ đâu.
   *
   * · `project` — chỉ tư liệu đã thêm vào dự án, như trước khi có kho.
   * · `starred` — thêm cả tư liệu bạn đã đánh dấu sao. Đây là nấc dùng hàng ngày:
   *   mấy clip bàn phím, cảnh văn phòng, con dấu công ty thì video nào cũng dùng,
   *   gắn sao một lần là mọi dự án về sau tự có.
   * · `library` — cả kho.
   *
   * Mặc định là `starred` chứ không phải `project`: kho mà máy không với tới được
   * thì nó chỉ là một thư mục để nhìn. Và mặc định này KHÔNG bất ngờ — nó chỉ đụng
   * tới thứ người dùng đã chủ động gắn sao, chưa gắn cái nào thì hành xử y như cũ.
   */
  insertSource: "project" | "starred" | "library";
  /**
   * LỜI DẶN CHUNG cho mọi dự án — tên riêng, thuật ngữ, cách xưng hô.
   *
   * Nối vào trước lời dặn riêng của từng dự án. Tên công ty hay tên sản phẩm thì
   * lần nào cũng thế, gõ lại ở từng dự án là việc thừa mà quên một lần là máy
   * nghe sai lần đó.
   */
  profile: string;
};

export const DEFAULTS: Settings = {
  minSilence: 0.8,
  secondsPerEffect: 10,
  placesPerMinute: 3,
  musicVolume: 0.18,
  insertSource: "starred",
  wantCaptions: true,
  wantMusic: true,
  profile: "",
};

/** Kẹp về khoảng có nghĩa. Người dùng gõ tay được nên phải chặn ở máy chủ. */
function clamp(value: unknown, min: number, max: number, fallback: number) {
  const so = Number(value);
  if (!Number.isFinite(so)) return fallback;
  return Math.min(max, Math.max(min, so));
}

/** Kẹp một vật bất kỳ về đúng khoảng. MỘT bản luật, dùng cho cả lúc đọc và ghi. */
function normalize(raw: Partial<Settings>): Settings {
  return {
    minSilence: clamp(raw.minSilence, 0, 3, DEFAULTS.minSilence),
    secondsPerEffect: clamp(
      raw.secondsPerEffect,
      3,
      60,
      DEFAULTS.secondsPerEffect,
    ),
    placesPerMinute: clamp(
      raw.placesPerMinute,
      0,
      12,
      DEFAULTS.placesPerMinute,
    ),
    musicVolume: clamp(raw.musicVolume, 0.02, 0.4, DEFAULTS.musicVolume),
    insertSource:
      raw.insertSource === "project" || raw.insertSource === "library"
        ? raw.insertSource
        : DEFAULTS.insertSource,
    wantCaptions: raw.wantCaptions !== false,
    wantMusic: raw.wantMusic !== false,
    profile: String(raw.profile ?? "").slice(0, 600),
  };
}

export function readSettings(userId: string): Settings {
  const row = db
    .prepare("SELECT data FROM user_settings WHERE user_id=?")
    .get(userId) as { data: string } | undefined;
  if (!row) return { ...DEFAULTS };
  try {
    return normalize(JSON.parse(row.data) as Partial<Settings>);
  } catch {
    // Hàng hỏng thì trả mặc định chứ không ném: cài đặt hỏng không được làm chết
    // cả lượt dựng, vì mọi giá trị ở đây đều có mặc định dùng được.
    return { ...DEFAULTS };
  }
}

export function writeSettings(userId: string, patch: Partial<Settings>) {
  const next = { ...readSettings(userId), ...patch };
  const clean = normalize(next);
  db.prepare(
    `INSERT INTO user_settings (user_id, data, updated_at) VALUES (?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
  ).run(userId, JSON.stringify(clean), Date.now());
  return clean;
}

/**
 * Cài đặt của CHỦ một dự án.
 *
 * Các chặng AI chỉ cầm mã dự án, không cầm người gọi — chúng chạy trong một việc
 * nền, sau khi request đã đóng từ lâu. Nên phải tra ngược qua chủ dự án.
 *
 * Dự án chưa có chủ (dữ liệu cũ) thì dùng mặc định.
 */
export function settingsForProject(projectId: string): Settings {
  const row = db
    .prepare("SELECT owner_id FROM projects WHERE id=?")
    .get(projectId) as { owner_id: string | null } | undefined;
  if (!row?.owner_id) return { ...DEFAULTS };
  return readSettings(row.owner_id);
}
