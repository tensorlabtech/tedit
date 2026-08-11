import type { JunctionId } from "@/dev/overlays/overlay-model";
import type { CaptionBlock } from "../../../server/style-pack";
/**
 * Dữ liệu mẫu cho màn Editor — nội dung lấy từ video sinh nhật thật.
 *
 * Mốc thời gian của TỪ được suy ra từ mốc của CÂU, chia đều theo số từ. Đủ thật
 * để thử thao tác mà không phải nhúng cả một bản chép lời có mốc từng từ.
 */

export type Word = {
  id: string;
  text: string;
  start: number;
  end: number;
  sentenceId: string;
  /** Máy nghe không chắc — gạch chấm dưới, và vào danh sách soát */
  unsure?: boolean;
  /**
   * Xác suất Whisper trả về, 0–1. Giữ nguyên con số chứ không chỉ giữ cờ:
   * `unsure` nói CÓ đáng soát không, còn con số nói soát cái nào TRƯỚC.
   */
  confidence?: number;
};

export type Sentence = {
  id: string;
  text: string;
  start: number;
  end: number;
  /** Gạch ngang — bỏ khỏi video */
  removed?: boolean;
};

/** Một mảnh video chính. Gọt mép nó thì phần sau dồn lên. */
export type Clip = {
  id: string;
  start: number;
  end: number;
  label: string;
  /** Đoạn đã bỏ — vẫn vẽ trên dải nhưng mờ và gạch, để còn giữ lại được */
  removed?: boolean;
};

/**
 * Nhạc nền — một khối trên dải, có mốc riêng.
 *
 * Mốc theo thời gian NGUỒN như mọi thứ khác trên dải. Lúc xuất, máy chủ quy
 * sang thời gian của bản đã cắt, nên bỏ một quãng ở giữa thì nhạc đặt sau đó
 * cũng lùi lên đúng bấy nhiêu.
 */
export type MusicTrack = {
  id: string;
  name: string;
  start: number;
  end: number;
  volume: number;
  /** Đường dẫn trên máy chủ — chỉ để đặt lại được sau khi gỡ */
  storedPath: string;
  position: number;
  /** Tệp thật để nghe thử ngay trên bàn dựng */
  url: string;
};

/** Tư liệu chèn — đè lên video chính, gọt mép KHÔNG làm dồn. */
export type Insert = {
  /** Cách tư liệu hiện ra — khớp `RevealId` của hệ style */
  reveal: RevealId;
  /** Hình dáng khung tư liệu */
  shape: ShapeId;
  /** Bố cục hiện b-roll — `undefined` là để máy tự chọn (xoay vòng họ hai-ô). */
  insertLayout?: string;
  /** Tên tệp đầy đủ — chỉ để hiện khi trỏ chuột vào, nhãn trên dải đã rút ngắn */
  fullName?: string;
  id: string;
  start: number;
  end: number;
  label: string;
  /** Đường dẫn tệp thật để xem trước đúng thứ sẽ lên phim */
  url?: string;
  /** Ảnh thu nhỏ do máy chủ dựng — dùng làm mặt của khối trên dải */
  thumbUrl?: string;
  isVideo?: boolean;
  /** Neo vào từ nào — cần để dựng lại phần tử khi hoàn tác việc gỡ */
  fromWordId: string;
  toWordId: string;
  mediaFileId?: string;
  /** Tệp lấy từ kho dùng chung — hiện nhãn để phân biệt với tệp tự tải lên */
  fromLibrary?: boolean;
};

import type {
  AlignId,
  EmphasisId,
  RevealId,
  ShapeId,
} from "@/dev/overlays/overlay-model";

export type { AlignId, EmphasisId, RevealId, ShapeId };

export type TextElementPosition = "top" | "middle" | "bottom";

/**
 * Chữ trên màn. Hai kiểu NEO, và đó là điểm khác nhau duy nhất giữa chúng.
 *
 * · Neo theo TỪ (`fromWordId`/`toWordId`) — chữ chép lời. Nó thuộc về mấy tiếng
 *   cụ thể, nên bỏ một câu phía trước thì nó vẫn dính đúng chỗ.
 * · Neo theo GIỜ (`theoGio`) — chữ tự do: tiêu đề, con số, nhãn. Nó thuộc về một
 *   KHOẢNH KHẮC và không chép tiếng nào, nên hai mã từ để rỗng.
 *
 * Vẫn là MỘT khái niệm: cùng kiểu dáng, cùng khung sửa, cùng cách in ra video.
 */
export type TextElement = {
  id: string;
  fromWordId: string;
  toWordId: string;
  /** Neo theo giờ — mốc dưới đây là của chính nó, không suy từ từ nào */
  byTime?: boolean;
  /** Mốc trên dải: suy từ khoảng từ đã neo, hoặc chính mốc đã lưu nếu theo giờ */
  start: number;
  end: number;
  content: string;
  position: TextElementPosition;
  /** Trục CĂN: các hàng nằm đâu theo bề ngang */
  align: AlignId;
  /** Trục NHẤN: tiếng nào to hơn trong cụm */
  emphasis: EmphasisId;
  /** Tiếng được đánh dấu từ khoá — đậm hơn, và là tiếng được phóng to */
  keywords: string[];
  /**
   * Hai trục cụm này TỰ ĐÈ, `null` là theo bộ dáng của dự án.
   *
   * Đè chứ không phải giá trị: đổi bộ dáng không bao giờ ghi vào chúng, nên cụm
   * chưa đè thì đổi theo dáng mới còn cụm đã đặt tay thì giữ nguyên.
   */
  letterCase?: "as-typed" | "upper" | null;
  keyColor?: string | null;
  /** Phong cách chữ riêng cụm này; `null` là theo mặc định của dự án. */
  fontStyle?: string | null;
  /** Look chữ ĐÃ ĐÓNG DẤU của cụm (`element.caption_block`) — cụm tự mang look. */
  captionBlock?: CaptionBlock | null;
  pinned?: boolean;
};

const RAW_SENTENCES: Array<[string, number, number, boolean?]> = [
  ["Mình muốn ghi lại dấu mốc ngày hôm nay", 0, 3.2],
  ["Chúc mừng sinh nhật mình", 3.4, 6],
  ["Còn đúng một năm nữa là mình chạm 30 tuổi", 6.2, 10.8],
  ["Ờ thì à nhầm", 11, 12.6, true],
  ["Ngày trước mình nghĩ 30 tuổi là lớn lắm", 13, 18.6],
  ["Mình lập một công ty phần mềm tên là TensorLab", 19, 25.4],
  ["có một cái nền tảng con em gốc ổn định", 26, 31.5],
  ["Nhưng mà nhìn lại thì mình vẫn thấy còn non lắm", 32, 38],
  ["Có những việc nho nhỏ mà mãi mình chưa làm xong", 38.5, 44.2],
  ["Năm nay mình muốn bớt trì hoãn lại", 44.6, 49.4],
  ["Câu chuyện bắt đầu từ mình thôi", 54, 58.6],
  ["Mình từng nghĩ phải có network thật rộng", 59, 64.8],
  ["phải all-in vào một thứ gì đó", 65.2, 70],
  ["Giờ thì mình thấy làm đều mỗi ngày là đủ", 70.5, 77],
  ["Cảm ơn mọi người đã ở đây với mình", 77.5, 83],
  ["Hẹn gặp lại ở tuổi 30", 83.5, 88.2],
];

export const TOTAL_DURATION = 88.2;

function buildTranscript() {
  const sentences: Sentence[] = [];
  const words: Word[] = [];
  const unsureAt = new Set(["s6-8", "s7-6", "s12-5"]);

  RAW_SENTENCES.forEach(([text, start, end, removed], index) => {
    const sentenceId = `s${index + 1}`;
    sentences.push({ id: sentenceId, text, start, end, removed });

    const parts = text.split(" ");
    const step = (end - start) / parts.length;
    parts.forEach((part, wordIndex) => {
      const id = `${sentenceId}-${wordIndex}`;
      words.push({
        id,
        text: part,
        start: start + step * wordIndex,
        end: start + step * (wordIndex + 1),
        sentenceId,
        unsure: unsureAt.has(id) || undefined,
      });
    });
  });

  return { sentences, words };
}

export const { sentences: SENTENCES, words: WORDS } = buildTranscript();

export const WORDS_BY_ID = new Map(WORDS.map((word) => [word.id, word]));

export const CLIPS: Clip[] = [
  { id: "c1", start: 0, end: 12.6, label: "Mở đầu" },
  { id: "c2", start: 12.6, end: 31.5, label: "Kể chuyện" },
  { id: "c3", start: 31.5, end: 54, label: "Nhìn lại" },
  { id: "c4", start: 54, end: 88.2, label: "Kết" },
];

/** Dữ liệu mẫu cho trang thử — neo vào từ để trống vì không có bản chép lời. */
const ANCHOR = { fromWordId: "", toWordId: "" };

export const INSERTS: Insert[] = [
  {
    id: "i1",
    start: 20.4,
    end: 25,
    label: "man-hinh-code.mp4",
    reveal: "none",
    shape: "full",
    ...ANCHOR,
  },
  {
    id: "i2",
    start: 40,
    end: 44,
    label: "so-tay.jpg",
    reveal: "none",
    shape: "full",
    ...ANCHOR,
  },
  {
    id: "i3",
    start: 66,
    end: 70,
    label: "bounds-do-thi.mp4",
    reveal: "none",
    shape: "full",
    ...ANCHOR,
  },
  {
    id: "i4",
    start: 31.5,
    end: 35,
    label: "anh-ky-niem.jpg",
    reveal: "none",
    shape: "full",
    ...ANCHOR,
  },
];

/** Chữ mẫu chỉ ghi khoảng TỪ; mốc giây suy ra ngay dưới đây. */
const TEXT_ELEMENT_SEEDS: Array<Omit<TextElement, "start" | "end">> = [
  {
    id: "t1",
    fromWordId: "s1-0",
    toWordId: "s1-5",
    content: "Ghi lại dấu mốc của ngày hôm nay thật kỹ",
    position: "middle",
    align: "center",
    emphasis: "even",
    keywords: [],
  },
  {
    id: "t2",
    fromWordId: "s2-0",
    toWordId: "s2-3",
    content: "Chúc mừng sinh nhật mình",
    position: "top",
    align: "center",
    emphasis: "even",
    keywords: [],
    pinned: true,
  },
  {
    id: "t3",
    fromWordId: "s3-0",
    toWordId: "s3-4",
    content: "1 năm còn lại",
    position: "top",
    align: "center",
    emphasis: "even",
    keywords: [],
  },
  {
    id: "t4",
    fromWordId: "s5-3",
    toWordId: "s5-7",
    content: "Mình nghĩ 30 tuổi lớn lắm",
    position: "top",
    align: "center",
    emphasis: "even",
    keywords: [],
    pinned: true,
  },
  {
    id: "t5",
    fromWordId: "s6-1",
    toWordId: "s6-8",
    content: "Lập công ty phần mềm",
    position: "middle",
    align: "center",
    emphasis: "even",
    keywords: [],
  },
  {
    id: "t6",
    fromWordId: "s10-1",
    toWordId: "s10-5",
    content: "Bớt trì hoãn",
    position: "bottom",
    align: "center",
    emphasis: "even",
    keywords: [],
  },
  {
    id: "t7",
    fromWordId: "s12-4",
    toWordId: "s12-6",
    content: "Có network",
    position: "middle",
    align: "center",
    emphasis: "even",
    keywords: [],
  },
  {
    id: "t8",
    fromWordId: "s13-1",
    toWordId: "s13-3",
    content: "All-in",
    position: "middle",
    align: "center",
    emphasis: "even",
    keywords: [],
  },
];

export const TEXT_ELEMENTS: TextElement[] = TEXT_ELEMENT_SEEDS.map((seed) => ({
  ...seed,
  start: WORDS_BY_ID.get(seed.fromWordId)?.start ?? 0,
  end: WORDS_BY_ID.get(seed.toWordId)?.end ?? 0,
}));

export function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * Giờ có PHẦN LẺ — cho những thứ ngắn hơn một giây.
 *
 * `formatTime` cắt cụt xuống giây, nên một hiệu ứng dài 0,24 giây hiện ra là
 * "0:03 → 0:03": đọc như hai mốc trùng nhau, mà nó đang có quãng hẳn hoi.
 */
export function formatTimeFine(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest < 10 ? "0" : ""}${rest.toFixed(1)}`;
}

/**
 * Tên của một quãng KHÔNG AI NÓI — một cách viết duy nhất cho cả ứng dụng.
 *
 * Từng có hai: bảng Lời viết `(im lặng 1.5s)`, còn nhãn đoạn trên dải và danh
 * sách chỗ đã cắt viết `lặng 0.6 giây`. Cùng một thứ, hai cách gọi, hai cách
 * viết số — người dùng phải tự đoán ra chúng là một.
 *
 * NGOẶC nằm trong chính cái nhãn, không phải do nơi gọi tự thêm: nó là phần
 * mang nghĩa "đây không phải lời ai nói", nên chỗ nào bày nhãn này ra cũng cần
 * nó. Để nơi gọi tự thêm thì đúng một nơi có ngoặc và hai nơi kia quên.
 *
 * Dấu PHẨY thập phân vì đây là tiếng Việt. `s` chứ không `giây` vì nhãn này hay
 * phải nằm trong một khối hẹp trên dải.
 */
export const silenceLabel = (seconds: number) =>
  `(im lặng ${Math.max(0, seconds).toFixed(1).replace(".", ",")}s)`;

/** Đuôi tệp video mà máy chủ nhận — dùng chung mọi nơi cần phân biệt ảnh/video. */
export const isVideoName = (name: string) =>
  /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(name);

/**
 * Nhãn ngắn cho một tệp tư liệu trên dải.
 *
 * Tên tệp tải từ TikTok/Instagram dài như
 * `1784482898815_6987864449670588964_6987864449670588964.mp4` — in nguyên lên dải
 * thì chiếm hết chỗ mà không nói được gì. Loại tệp là thứ người dùng cần biết
 * trước tiên, tên chỉ để phân biệt khi có nhiều tệp giống loại.
 */
export function shortMediaLabel(name: string, thuTu?: number) {
  const kind = isVideoName(name) ? "Video" : "Ảnh";
  const base = name
    .replace(/\.[^.]+$/, "")
    // Bỏ mọi chuỗi 6 số liền trở lên: đó là mã máy sinh (TikTok, Instagram,
    // WhatsApp đều đặt tên kiểu này), in ra chỉ chiếm chỗ mà không phân biệt được gì.
    .replace(/\d{6,}/g, "")
    .replace(/[_-]{2,}/g, "-")
    .replace(/^[_\s-]+|[_\s-]+$/g, "");
  // Còn dưới 5 ký tự thì coi như không còn gì đáng đọc — "chen", "img", "vid"
  // không giúp phân biệt gì, chỉ làm nhãn dài thêm.
  //
  // Nhưng tên toàn số là chuyện thường ngày (tải từ TikTok, Instagram,
  // WhatsApp), nên nhiều tệp cùng rơi về đúng một chữ "Video" và trên dải có
  // ba khối tên y hệt nhau. Đánh số theo thứ tự trong thư viện để còn gọi tên
  // được — đây là lúc con số vô nghĩa vẫn hơn không có gì.
  if (base.length < 5)
    return thuTu === undefined ? kind : `${kind} ${thuTu + 1}`;
  const short = base.length > 16 ? `${base.slice(0, 15)}…` : base;
  return `${kind} · ${short}`;
}


/** Một bước hoàn tác được — chỉ chứa dữ liệu để còn cất vào localStorage. */
export type UndoEntry =
  // Bỏ một quãng giờ là bỏ ĐOẠN (có thể vài đoạn), không còn bảng cắt riêng.
  | { type: "cut"; label: string; segmentIds: string[] }
  | {
      type: "trim";
      label: string;
      segmentId: string;
      edge: "start" | "end";
      /** Mốc TRƯỚC khi gọt — hoàn tác là đặt mép về đúng chỗ này */
      at: number;
    }
  | { type: "split"; label: string; segmentId: string }
  | {
      type: "segment";
      label: string;
      segmentId: string;
      wasRemoved: boolean;
    }
  | { type: "sentence"; label: string; sentenceId: string; wasRemoved: boolean }
  | {
      type: "music-trim";
      label: string;
      trackId: string;
      edge: "start" | "end";
      /** Mốc TRƯỚC khi kéo */
      at: number;
    }
  // Gỡ một bài nhạc: giữ đủ dữ liệu để đặt lại. Tệp nhạc là thứ người dùng phải
  // đi tìm và tải lên, mất nó thì "hoàn tác" chỉ là lời hứa suông.
  | {
      type: "music-restore";
      label: string;
      track: {
        id: string;
        position: number;
        name: string;
        storedPath: string;
        start: number;
        end: number;
        volume: number;
      };
    }
  | { type: "element"; label: string; elementId: string }
  // MỘT mục cho mọi thao tác trên hiệu ứng — thêm, xoá, đổi kiểu, kéo quãng.
  // Cả bốn đều là "hàng này trước đó trông ra sao", nên một mục là đủ; tách bốn
  // loại thì bốn nhánh hoàn tác viết y hệt nhau.
  | {
      type: "effect";
      label: string;
      effectId: string;
      /** Trạng thái TRƯỚC — `null` là lúc đó chưa có hàng nào (thao tác thêm) */
      was: { start: number; end: number; kind: JunctionId } | null;
    }
  | {
      type: "insert-trim";
      label: string;
      elementId: string;
      edge: "start" | "end";
      /** Mã TỪ mà mép đang neo TRƯỚC khi kéo */
      wordId: string;
    }
  // Ô NGƯỜI cũng neo theo từ như b-roll — cùng dữ liệu hoàn tác, chỉ khác chỗ
  // không cần nạp lại `data` (lịch màn là state riêng, xem `use-scene-layout`).
  | {
      type: "scene-trim";
      label: string;
      elementId: string;
      edge: "start" | "end";
      /** Mã TỪ mà mép đang neo TRƯỚC khi kéo */
      wordId: string;
    }
  // Chữ TỰ DO neo theo giờ, nên hoàn tác trả lại một con GIÂY chứ không phải
  // một mã từ như `insert-trim`.
  | {
      type: "text-trim";
      label: string;
      elementId: string;
      edge: "start" | "end";
      at: number;
    }
  // Tạo chữ từ lời sinh ra hàng chục phần tử một lúc — hoàn tác phải gỡ cả loạt,
  // không thì người dùng phải xoá tay 58 cái.
  | { type: "captions"; label: string; elementIds: string[] }
  // Xoá một chữ hay một tư liệu: giữ đủ dữ liệu để DỰNG LẠI nó. Xoá là việc
  // huỷ hoại nhất trên bàn dựng — người dùng mất công đặt chỗ, chọn kiểu, đánh
  // dấu từ khoá, rồi một cú bấm nhầm là mất sạch mà không có đường lùi.
  | {
      type: "restore";
      label: string;
      element: {
        kind: "text" | "insert" | "layout";
        fromWordId: string;
        toWordId: string;
        /** Chữ TỰ DO dựng lại bằng cặp giây này, vì nó không có mã từ nào */
        start?: number;
        end?: number;
        content?: string;
        band?: string;
        mediaFileId?: string;
        align?: string;
        emphasis?: string;
        reveal?: string;
        shape?: string;
        keywords?: string[];
      };
    };
