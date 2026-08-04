/**
 * Đổi dữ liệu THÔ của máy chủ thành hình dạng bàn dựng làm việc.
 *
 * Tách khỏi `use-editor.ts` vì đây là phép biến đổi THUẦN — không hook, không
 * trạng thái, không gọi mạng. Để chung với hook thì mọi tệp cần `shape` đều phải
 * kéo theo cả cái hook ba nghìn dòng, và đó là đường dẫn tới import vòng.
 */
import {
  api,
  type ApiMusicTrack,
  type ApiProject,
} from "@/lib/api";
import { fromLegacyLayout } from "@/dev/overlays/overlay-legacy";
import type {} from "../../../server/style-pack";
import { silenceLabel, shortMediaLabel } from "./editor-data";
import type {} from "./timeline-audio-lane";
import type {
  Clip,
  Insert,
  MusicTrack,
  Sentence,
  TextElement,
  TextElementPosition,
  Word,
} from "./editor-data";
import type { AlignId, EmphasisId, RevealId, ShapeId } from "./editor-data";
import {
  type JunctionId,
} from "@/dev/overlays/overlay-model";

/** Thứ tự của một tệp trong danh sách tư liệu chèn — dùng để đặt tên phân biệt. */
export function insertOrder(data: ApiProject, fileId: string) {
  const list = data.files
    .filter((item) => item.role === "insert")
    .sort((a, b) => a.position - b.position);
  const i = list.findIndex((item) => item.id === fileId);
  return i === -1 ? undefined : i;
}

/**
 * Nhãn của một đoạn: LỜI nó đang chứa, không phải số thứ tự.
 *
 * Từ khi đoạn cắt theo cụm chữ thì một video một phút có bảy chục đoạn — "Đoạn
 * 47" không nói được gì và cũng không ai đếm tới đó. Lấy chính cụm chữ nằm
 * trong đoạn thì dải phim đọc ra như bản chép lời; đoạn không có lời nào là
 * khoảng lặng, nói thẳng nó dài bao nhiêu.
 */
export function segmentLabel(
  start: number,
  end: number,
  texts: Array<{
    start: number;
    end: number;
    content: string;
    byTime?: boolean;
  }>,
) {
  const mid = (start + end) / 2;
  // Chỉ lấy nhãn từ chữ CHÉP LỜI. Đoạn là một khúc người ta NÓI, nên nhãn của
  // nó phải là lời nói ở đó; một cái tiêu đề vắt ngang sẽ cướp nhãn của cụm lời
  // thật và khối trên dải đọc ra một thứ chẳng ai nói.
  const inside = texts.find(
    (item) => !item.byTime && mid >= item.start && mid < item.end,
  );
  if (inside?.content.trim()) {
    const text = inside.content.trim();
    return text.length > 28 ? `${text.slice(0, 27)}…` : text;
  }
  return silenceLabel(end - start);
}

/** Đổi một hàng nhạc của máy chủ sang kiểu của bàn dựng. */
export function toMusicTrack(row: ApiMusicTrack): MusicTrack {
  return {
    id: row.id,
    name: row.name,
    start: row.start_sec,
    end: row.end_sec,
    volume: row.volume,
    storedPath: row.stored_path,
    position: row.position,
    url: api.fileUrl(row.stored_path),
  };
}

export function shape(data: ApiProject) {
  const sentences: Sentence[] = data.sentences.map((row) => ({
    id: row.id,
    text: row.text,
    start: row.start_sec,
    end: row.end_sec,
    removed: row.removed === 1,
  }));

  const words: Word[] = data.words.map((row) => ({
    id: row.id,
    text: row.text,
    start: row.start_sec,
    end: row.end_sec,
    sentenceId: row.sentence_id,
    // Whisper trả xác suất từng từ; dưới 0,6 là chỗ đáng soát lại.
    unsure: (row.confidence ?? 1) < 0.6 || undefined,
    confidence: row.confidence ?? undefined,
  }));

  const wordsById = new Map(words.map((word) => [word.id, word]));

  const textElements: TextElement[] = data.elements
    .filter((element) => element.kind === "text")
    .map((element) => ({
      id: element.id,
      fromWordId: element.from_word_id ?? "",
      toWordId: element.to_word_id ?? "",
      // Chữ TỰ DO neo theo giờ: hai mã từ để rỗng, mốc lấy thẳng từ dữ liệu.
      // Chữ chép lời neo vào KHOẢNG TỪ; mốc giây chỉ là hình chiếu để vẽ lên dải.
      byTime: element.from_word_id === null,
      start:
        element.from_word_id === null
          ? (element.start_sec ?? 0)
          : (wordsById.get(element.from_word_id)?.start ?? 0),
      end:
        element.from_word_id === null
          ? (element.end_sec ?? 0)
          : (wordsById.get(element.to_word_id ?? "")?.end ?? 0),
      content: element.content ?? "",
      position: (element.position_band ?? "top") as TextElementPosition,
      // MỖI TRỤC đọc độc lập, chỉ trục nào còn trống mới lấy từ `layout` gộp cũ.
      // Buộc hai trục vào một điều kiện thì chọn căn mà chưa đụng ô nhấn sẽ mất
      // luôn lựa chọn căn — cùng lỗi phải sửa ở `server/pipeline.ts`.
      ...(() => {
        const cu = fromLegacyLayout(element.layout);
        return {
          align: (element.align ?? cu.align) as AlignId,
          emphasis: (element.emphasis ?? cu.emphasis) as EmphasisId,
        };
      })(),
      keywords: element.keywords ? element.keywords.split("|") : [],
      // Hai trục ĐÈ; rỗng là theo bộ dáng của dự án.
      letterCase:
        element.letter_case === "upper" || element.letter_case === "as-typed"
          ? element.letter_case
          : null,
      keyColor: element.key_color ?? null,
    }));

  const inserts: Insert[] = data.elements
    .filter((element) => element.kind === "insert")
    .map((element) => {
      // Tư liệu chèn LUÔN neo theo từ — chỉ chữ tự do mới bỏ trống hai mã này.
      const from = wordsById.get(element.from_word_id ?? "");
      const to = wordsById.get(element.to_word_id ?? "");
      const file = data.files.find((item) => item.id === element.media_file_id);
      // Số thứ tự trong THƯ VIỆN, không phải trên dải: cùng một tệp chèn hai
      // lần thì hai khối phải mang cùng tên, không thì tưởng là hai tệp khác.
      const order = file ? insertOrder(data, file.id) : undefined;
      return {
        id: element.id,
        start: from?.start ?? 0,
        end: to?.end ?? 0,
        fromWordId: element.from_word_id ?? "",
        toWordId: element.to_word_id ?? "",
        mediaFileId: element.media_file_id ?? undefined,
        fromLibrary: !!file?.from_library,
        label: file ? shortMediaLabel(file.name, order) : "Tư liệu",
        fullName: file?.name,
        // Giá trị cũ (`zoom`, `slide`, `ken`) đổi về kiểu gần nhất còn lại.
        reveal: (["none", "fade", "fade-up"].includes(element.reveal ?? "")
          ? element.reveal
          : element.reveal
            ? "fade-up"
            : "none") as RevealId,
        shape: (element.shape ?? "full") as ShapeId,
        // Xem trước phải là TỆP THẬT, không phải ô màu có tên: ô màu không cho
        // biết tư liệu có che mặt người nói hay không.
        url: file ? api.mediaUrl(file.id) : undefined,
        ...(() => {
          // Máy chủ chốt ảnh-hay-video theo đuôi đường dẫn thật; `name` là chữ
          // người dùng đặt nên có thể chẳng còn đuôi nào để mà đoán.
          const isVideo = file?.kind !== "image";
          return {
            isVideo,
            // Mặt của khối trên dải: ảnh thu nhỏ do máy chủ dựng sẵn lúc tải
            // tệp lên. Với VIDEO thì bắt buộc phải là ảnh thu nhỏ — tải cả tệp
            // 200MB về chỉ để lấy một khung cho ô 32px là quá đắt. Với ẢNH thì
            // lấy thẳng tệp gốc khi chưa có ảnh thu nhỏ: tệp tải lên bằng bản
            // cũ không có ảnh thu nhỏ nào để mà lấy.
            thumbUrl: file?.thumb_path
              ? api.fileUrl(file.thumb_path)
              : !isVideo && file
                ? api.mediaUrl(file.id)
                : undefined,
          };
        })(),
      };
    })
    .filter((item) => item.end > item.start);

  // Khối trên dải giờ là ĐOẠN do máy chủ dựng, không phải từng tệp: đoạn mới là
  // đơn vị người dùng cắt, bỏ và (sau này) gắn effect.
  const segments: Clip[] = (data.segments ?? []).map((row) => ({
    id: row.id,
    start: row.start_sec,
    end: row.end_sec,
    // Nhãn mặc định sinh TẠI ĐÂY — máy chủ không lưu nó, vì mỗi lần tách/gộp/
    // gọt là nó đổi. Cột `label` chỉ còn giữ tên người dùng tự đặt.
    label: row.label ?? segmentLabel(row.start_sec, row.end_sec, textElements),
    removed: row.removed === 1,
  }));

  let cursor = 0;
  const clips: Clip[] = data.files
    .filter((file) => file.role === "main")
    .sort((a, b) => a.position - b.position)
    .map((file, index) => {
      const start = cursor;
      cursor += file.duration ?? 0;
      return {
        id: file.id,
        start,
        end: cursor,
        label: shortMediaLabel(file.name, index),
      };
    });

  const music: MusicTrack[] = (data.music ?? []).map(toMusicTrack);

  return {
    segments,
    sentences,
    words,
    wordsById,
    textElements,
    inserts,
    music,
    /**
     * Bản chất lượng đã dựng xong chưa — nút Xuất video đọc cờ này.
     *
     * Nó dựng NỀN sau lượt chép lời, nên có một quãng bàn dựng đã mở mà tệp
     * nguồn để cắt thì chưa có. Dự án dựng bằng bản cũ không có trường này nên
     * mặc định là ĐÃ CÓ — chúng vốn luôn dựng `base.mp4` ngay trong lượt chép.
     */
    masterReady: data.masterReady ?? true,
    // Kho tư liệu đã tải lên: nguồn để chọn khi chèn, khác với `inserts` là
    // những lần đã đặt lên dải.
    insertLibrary: data.files.filter((file) => file.role === "insert"),
    /**
     * Khung hình thật của cảnh chính đầu tiên — nền cho ô mẫu chọn phong cách.
     *
     * Cùng nguồn với màn nạp tệp (`media_files.thumb_path`). Thiếu nó thì hộp
     * đổi phong cách ở bàn dựng bày mười ô nền đen trơn, trong khi cũng hộp ấy
     * ở màn nạp tệp lại có khung hình — và cái làm nên khác biệt giữa "chọn
     * phong cách" và "chọn font" chính là khung hình đó.
     */
    posterUrl: (() => {
      const first = data.files
        .filter((file) => file.role === "main" && file.thumb_path)
        .sort((a, b) => a.position - b.position)[0];
      return first?.thumb_path ? api.fileUrl(first.thumb_path) : null;
    })(),
    clips,
    duration: cursor || (sentences.at(-1)?.end ?? 0),
    title: data.project.title,
    /** Mã những lời nhắc đã bỏ qua — hàng soát lọc theo danh sách này */
    dismissed: data.dismissed ?? [],
    /** Tiến trình dựng — bàn dựng dùng nó làm CỔNG, xem `editor-page.tsx` */
    pipeline: data.pipeline ?? null,
    /** Hiệu ứng người dùng đặt tay — quãng theo giây bản gốc */
    manualEffects: (data.effects ?? []).map((row) => ({
      id: row.id,
      start: row.start_sec,
      end: row.end_sec,
      kind: row.kind as JunctionId,
    })),
  };
}
