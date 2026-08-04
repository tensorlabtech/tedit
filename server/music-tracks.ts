import { db, newId } from "./db";

/**
 * Nhạc nền — mỗi bài một hàng, có mốc riêng trên dải.
 *
 * Mốc ghi theo thời gian NGUỒN (cùng trục với lời, đoạn, tư liệu). Lúc xuất mới
 * quy sang thời gian của bản đã cắt: xem `keptBefore` ở `render.ts`.
 */
export type MusicTrack = {
  id: string;
  project_id: string;
  position: number;
  name: string;
  stored_path: string;
  start_sec: number;
  end_sec: number;
  volume: number;
};

/** Mức mặc định: nhạc chỉ nên làm nền, quá 60% là nuốt mất giọng nói. */
export const DEFAULT_MUSIC_VOLUME = 0.18;

/** Bài ngắn hơn hai giây thì không còn là nhạc nền, chỉ là một tiếng bụp. */
const MIN_LENGTH = 2;

export function listMusic(projectId: string) {
  return db
    .prepare(
      "SELECT * FROM music_tracks WHERE project_id=? ORDER BY position, start_sec",
    )
    .all(projectId) as MusicTrack[];
}

/** Tổng thời lượng video chính — mốc kết thúc mặc định của một bài mới. */
export function mainDuration(projectId: string) {
  // Độ dài VIDEO HIỆN TẠI, không phải tổng các tệp cảnh gốc. Sau `commit-cut`
  // video ngắn lại (118s → 52s) mà tệp cảnh vẫn giữ độ dài gốc, nên cộng chúng
  // lại thì nhạc phủ dài gấp đôi video — dải nhạc thò ra tận trục cũ. Đọc
  // `video_seconds` (đo từ tệp); dự án cũ chưa có thì rơi về tổng tệp — đúng vì
  // chúng chưa cắt.
  const row = db
    .prepare(
      `SELECT video_seconds AS video,
              (SELECT COALESCE(SUM(duration),0) FROM media_files
               WHERE project_id=p.id AND role='main') AS files
       FROM projects p WHERE p.id=?`,
    )
    .get(projectId) as { video: number | null; files: number };
  return row.video ?? row.files;
}

/**
 * Đặt một bài nhạc — TẠI VẠCH, dài đúng bằng bài hát.
 *
 * Bản trước cho bài mới phủ CẢ video, lý lẽ là "lần đặt đầu tiên ai cũng muốn
 * thế". Đúng cho bài đầu tiên, sai cho mọi bài sau: muốn mỗi đoạn một bài khác
 * nhau thì bài nào cũng bắt đầu ở giây 0 và đè lên nhau, phải kéo tay từng cái
 * mới tách ra được. Mà nhạc cũng là một lớp có quãng như chữ, như tư liệu — nó
 * nghe theo vạch chạy thì mới cùng một luật với cả bàn dựng.
 *
 * Không bao giờ đẻ ra khối chồng nhau — chồng nhau thì dải vẽ hai khối lên cùng
 * một hàng và cái sau che mất cái trước. Hai luật:
 *
 * · Đuôi cụt lại ở chỗ bài kế tiếp bắt đầu (và ở cuối video).
 * · Vạch đang nằm GIỮA một bài thì bài cũ DỪNG ở đúng vạch, bài mới chạy tiếp từ
 *   đó. Đây chính là việc "thay nhạc từ đây" — thứ người ta định làm khi kéo vạch
 *   tới giữa một bài rồi bấm thêm nhạc.
 *
 *   Bản đầu tôi cho bài mới nhảy xuống SAU bài cũ. Thử thật thì bấm ở giây 20 mà
 *   bài rơi xuống giây 66 — dời 46 giây khỏi chỗ người dùng vừa chỉ, không ai đoán
 *   được vì sao. Tránh chồng khối mà đổi lấy một cú dời câm thì lỗ.
 */
export function addMusic(
  projectId: string,
  name: string,
  storedPath: string,
  /** Độ dài VIDEO — không cho nhạc chạy quá đuôi phim */
  duration: number,
  /** Độ dài bài hát */
  length: number,
  /** Vạch chạy, tính bằng giây bản gốc */
  at: number,
) {
  const position =
    (
      db
        .prepare(
          "SELECT COALESCE(MAX(position),-1) AS p FROM music_tracks WHERE project_id=?",
        )
        .get(projectId) as { p: number }
    ).p + 1;
  const id = newId("mus");

  const exists = db
    .prepare(
      "SELECT start_sec, end_sec FROM music_tracks WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<{ start_sec: number; end_sec: number }>;

  const covering = db
    .prepare(
      "SELECT id, start_sec, end_sec FROM music_tracks WHERE project_id=? AND start_sec<=? AND ?<end_sec",
    )
    .get(projectId, at, at) as
    | { id: string; start_sec: number; end_sec: number }
    | undefined;

  let start = Math.max(0, at);
  if (covering) {
    // Cắt bài cũ lại tại vạch — trừ khi cắt xong nó ngắn hơn mức tối thiểu, lúc
    // đó thà đẩy bài mới xuống sau còn hơn để lại một mẩu 0,3 giây kêu bụp một
    // cái rồi tắt.
    if (at - covering.start_sec >= MIN_LENGTH) {
      db.prepare("UPDATE music_tracks SET end_sec=? WHERE id=?").run(
        at,
        covering.id,
      );
    } else {
      start = covering.end_sec;
    }
  }
  const neighbour = exists.find((row) => row.start_sec > start);
  let end = Math.min(
    start + Math.max(length, MIN_LENGTH),
    neighbour?.start_sec ?? Infinity,
    duration,
  );
  // Cuối video mà không còn chỗ thì lùi hẳn ra sau: thà thò quá đuôi phim một
  // chút — chỗ đó vốn không vào bản xuất — còn hơn đẻ ra một khối bề rộng 0 mà
  // người dùng không nhìn thấy cũng không bấm được.
  if (end - start < MIN_LENGTH) {
    start = Math.max(0, Math.min(start, duration - MIN_LENGTH));
    end = start + MIN_LENGTH;
  }

  db.prepare(
    `INSERT INTO music_tracks (id, project_id, position, name, stored_path, start_sec, end_sec, volume)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(id, projectId, position, name, storedPath, start, end, DEFAULT_MUSIC_VOLUME);
  return db.prepare("SELECT * FROM music_tracks WHERE id=?").get(id) as
    MusicTrack | undefined;
}

/** Dựng lại một bài đã gỡ — tệp vẫn nằm nguyên trên đĩa nên chỉ cần hàng mới. */
export function restoreMusic(
  projectId: string,
  track: Omit<MusicTrack, "project_id">,
) {
  db.prepare(
    `INSERT OR REPLACE INTO music_tracks (id, project_id, position, name, stored_path, start_sec, end_sec, volume)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(
    track.id,
    projectId,
    track.position,
    track.name,
    track.stored_path,
    track.start_sec,
    track.end_sec,
    track.volume,
  );
  return db.prepare("SELECT * FROM music_tracks WHERE id=?").get(track.id) as
    MusicTrack | undefined;
}

export function updateMusic(
  trackId: string,
  patch: { volume?: number; start?: number; end?: number },
) {
  const current = db
    .prepare("SELECT * FROM music_tracks WHERE id=?")
    .get(trackId) as MusicTrack | undefined;
  if (!current) return undefined;

  const volume =
    patch.volume === undefined
      ? current.volume
      : Math.min(Math.max(patch.volume, 0), 1);
  // Chặn hai mép vào nhau: kéo quá tay là bài dài 0 giây, mà 0 giây thì lúc xuất
  // `atrim` ra luồng rỗng và cả lệnh trộn hỏng.
  const start =
    patch.start === undefined
      ? current.start_sec
      : Math.min(Math.max(patch.start, 0), current.end_sec - MIN_LENGTH);
  const end =
    patch.end === undefined
      ? current.end_sec
      : Math.max(patch.end, start + MIN_LENGTH);

  db.prepare(
    "UPDATE music_tracks SET volume=?, start_sec=?, end_sec=? WHERE id=?",
  ).run(volume, start, end, trackId);
  return db.prepare("SELECT * FROM music_tracks WHERE id=?").get(trackId) as
    MusicTrack | undefined;
}

/**
 * Gỡ một bài khỏi dải — KHÔNG xoá tệp.
 *
 * Tệp nhạc là thứ người dùng phải đi tìm và tải lên; xoá nó đi thì "hoàn tác"
 * chỉ còn là lời hứa suông. Vài trăm KB nằm lại rẻ hơn nhiều.
 */
export function deleteMusic(trackId: string) {
  const row = db
    .prepare("SELECT * FROM music_tracks WHERE id=?")
    .get(trackId) as MusicTrack | undefined;
  db.prepare("DELETE FROM music_tracks WHERE id=?").run(trackId);
  return row;
}

/**
 * Đổi nhạc kiểu cũ (hai cột trên `projects`) thành một hàng ở bảng này.
 *
 * Chạy một lần cho mỗi dự án, đặt ở cửa mà mọi màn đều đi qua — giống
 * `absorbManualCuts`. Xoá `music_path` sau khi đổi để không nhập lại lần sau.
 */
export function absorbLegacyMusic(projectId: string) {
  const row = db
    .prepare("SELECT music_path, music_volume FROM projects WHERE id=?")
    .get(projectId) as
    { music_path: string | null; music_volume: number | null } | undefined;
  if (!row?.music_path) return;

  const duration = mainDuration(projectId);
  const path = row.music_path;
  // MỘT giao dịch: dựng hàng mới rồi mới xoá đường dẫn cũ. Tách ra thì một lỗi
  // ở giữa là xoá mất đường dẫn mà chưa có hàng nào thay — nhạc biến mất hẳn và
  // không còn dấu vết nào để lần lại.
  db.transaction(() => {
    // Nhạc kiểu cũ vốn PHỦ CẢ VIDEO — giữ nguyên như thế. Đặt nó tại vạch như
    // nhạc mới thì bản dựng cũ tự dưng cụt tiếng, mà người dùng không đụng gì.
    const track = addMusic(
      projectId,
      path.split("/").pop() ?? "nhạc nền",
      path,
      duration,
      duration,
      0,
    );
    if (track && row.music_volume != null) {
      updateMusic(track.id, { volume: row.music_volume });
    }
    db.prepare("UPDATE projects SET music_path=NULL WHERE id=?").run(projectId);
  })();
}
