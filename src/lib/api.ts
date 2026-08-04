/**
 * Rỗng nghĩa là CÙNG GỐC với trang — Vite chuyển tiếp `/api` và `/files` về
 * Fastify lúc phát triển (xem `vite.config.ts`), còn lúc chạy thật thì Fastify
 * trả luôn bản build nên vốn đã cùng gốc.
 *
 * Trước đây chỗ này trỏ thẳng `http://127.0.0.1:5190`, tức là khác gốc với trang
 * ở `5173`: trình duyệt không gửi cookie phiên kèm request, nên đăng nhập xong
 * mọi lệnh vẫn trả về 401.
 */
import { Upload as TusUpload } from "tus-js-client";

import type { StylePackId } from "../../server/style-pack";
import type { MusicTags } from "../../server/music-tags";

const BASE = import.meta.env.VITE_API ?? "";

export type ApiFile = {
  id: string;
  name: string;
  size: number;
  role: "main" | "insert";
  position: number;
  duration: number | null;
  width: number | null;
  height: number | null;
  has_audio: number;
  /**
   * Ảnh hay video — máy chủ chốt theo đuôi đường dẫn thật trên đĩa.
   *
   * Không tự đoán bằng `name`: đó là chữ người dùng đặt, và tệp lấy từ kho mang
   * luôn tiêu đề nên có thể không còn đuôi nào để mà đoán.
   */
  kind: "image" | "video";
  thumb_path: string | null;
  /**
   * Tệp này MÁY LẤY TỪ KHO chứ không phải người dùng tải lên cho dự án.
   *
   * Cần nói ra: mở bàn dựng thấy một clip mình không nhớ đã thêm, mà không có
   * gì đánh dấu, thì đọc ra như máy bịa ra tệp.
   */
  from_library?: number;
  /** Tên tệp trong kho mà bản này chép ra; `null` với tệp người dùng tự tải lên */
  library_file?: string | null;
  /** Cảnh báo từ máy chủ: codec tiếng lạ, nhịp khung thay đổi, video bị xoay */
  warnings?: string[];
  /**
   * Nội dung tư liệu chèn — người dùng viết, hoặc máy đọc khi người dùng để trống.
   * Chặng đặt tư liệu khớp nó với lời để chọn chỗ đặt.
   */
  description?: string | null;
};

export type ApiSentence = {
  id: string;
  position: number;
  text: string;
  start_sec: number;
  end_sec: number;
  removed: number;
};

export type ApiWord = {
  id: string;
  sentence_id: string;
  position: number;
  text: string;
  start_sec: number;
  end_sec: number;
  confidence: number | null;
};

export type ApiElement = {
  /** Cụm này tự đè trục viết hoa; rỗng là theo bộ dáng của dự án */
  letter_case?: string | null;
  /** Cụm này tự đè màu nhấn; rỗng là theo bộ dáng của dự án */
  key_color?: string | null;
  id: string;
  kind: "text" | "insert";
  /** Rỗng với chữ tự do — nó neo theo `start_sec`/`end_sec` */
  from_word_id: string | null;
  to_word_id: string | null;
  /** Neo theo GIỜ của chữ tự do — rỗng với phần tử neo theo từ */
  start_sec: number | null;
  end_sec: number | null;
  content: string | null;
  position_band: string | null;
  media_file_id: string | null;
  /** Trục CĂN — `null` với phần tử tạo trước khi tách hai trục */
  align: string | null;
  /** Trục NHẤN — `null` nghĩa là còn dùng `layout` gộp kiểu cũ */
  emphasis: string | null;
  /** Cách tư liệu chèn hiện ra */
  reveal: string | null;
  /** Hình dáng khung tư liệu */
  shape: string | null;
  /** Giá trị gộp kiểu cũ, chỉ để đổi sang hai trục khi đọc */
  layout: string | null;
  keywords: string | null;
};

export type ApiJob = {
  kind: string;
  /**
   * `queued` = máy chủ ĐÃ NHẬN việc nhưng đang bận, việc đang chờ tới lượt.
   *
   * Khác `error` ở chỗ không có gì hỏng, và khác `running` ở chỗ chưa tốn tài
   * nguyên nào. Xem `server/job-queue.ts`.
   */
  status: "queued" | "running" | "done" | "error";
  progress: number;
  message: string | null;
  /** Đứng thứ mấy trong hàng, tính từ 1. `null` khi không chờ. */
  queuePosition?: number | null;
};

/**
 * Việc còn ĐANG DIỄN RA — nghĩa là màn hình phải hỏi tiếp.
 *
 * Bốn chỗ hỏi tiến độ (bàn dựng ×2, màn nạp tệp, màn dựng) đều từng viết
 * `status !== "running"` để dừng hỏi. Thêm `queued` mà không sửa cả bốn thì việc
 * xếp hàng bị bỏ rơi: máy chủ chạy nó xong xuôi mà màn hình không bao giờ hỏi
 * lại. Để luật ở MỘT chỗ thì không có chỗ thứ hai để quên.
 */
export const isJobActive = (status: string | undefined | null) =>
  status === "running" || status === "queued";

/** Câu hiện cho người dùng khi việc đang chờ tới lượt. */
export const queueLabel = (job: Pick<ApiJob, "queuePosition">) =>
  job.queuePosition && job.queuePosition > 1
    ? `Đang xếp hàng — thứ ${job.queuePosition}`
    : "Đang xếp hàng";

/** Một chặng của lượt dựng — xem `server/pipeline-steps.ts`. */
export type ApiStep = {
  key: string;
  position: number;
  status: "waiting" | "running" | "done" | "failed";
  /** Thứ chặng này đẻ ra, vd "219 đoạn · 189 chữ" */
  result: string | null;
  error: string | null;
  /** Hỏng chặng này thì có ra được sản phẩm không */
  required: boolean;
  /** Mốc đổi trạng thái; với chặng đang chạy đây là lúc nó bắt đầu */
  updatedAt: number;
};

export type ApiPipeline = {
  steps: ApiStep[];
  /** Máy đã buông tay chưa — chặng bỏ qua vẫn tính là xong */
  settled: boolean;
  /** Có chặng BẮT BUỘC hỏng: chưa có sản phẩm để mà sửa */
  blocked: boolean;
  skipped: number;
  /**
   * Cổng nào đang mở chờ người, `null` là không cổng nào.
   *
   * Mạch dựng dừng hai lần: `soat-cat` sau khi đề xuất chỗ cắt, `soat-chu` sau
   * khi sửa chỗ nghe nhầm. Cổng mở thì `settled` luôn sai, nên bàn dựng vẫn
   * đóng — người dùng phải đi qua cổng chứ không lách được.
   */
  awaiting: string | null;
};

export type ProjectSummary = {
  id: string;
  title: string;
  status: string;
  created_at: number;
  file_count: number;
  sentence_count: number;
  /** Tổng thời lượng video chính; `null` khi chưa có tệp nào đo được */
  duration: number | null;
  /** Khung mở đầu của video chính đầu tiên; `null` khi chưa tải tệp nào lên */
  thumb_path: string | null;
};

/** Một bài nhạc nền — mốc ghi theo thời gian NGUỒN, cùng trục với mọi thứ trên dải */
export type ApiMusicTrack = {
  id: string;
  position: number;
  name: string;
  stored_path: string;
  start_sec: number;
  end_sec: number;
  volume: number;
};

/**
 * Một bài trong KHO DÙNG CHUNG — chưa đặt vào dự án nào.
 *
 * Khác `ApiMusicTrack` ở trên: cái đó là bài ĐÃ ĐẶT, có mốc và âm lượng riêng
 * trong một dự án. Còn đây mới là món hàng trên kệ.
 */
export type ApiLibraryTrack = {
  /** Tên tệp — cũng là mã của bài trong kho */
  file: string;
  title: string;
  tags: string[];
  /**
   * Ba trục nhãn CÓ KIỂM SOÁT — khác `tags` tự do ở chỗ máy lọc được theo chúng.
   * Trường nào `null` là chưa gán; bài chưa gán vẫn hiện trong kho.
   */
  labels: MusicTags;
  seconds: number;
  /** Người đang đăng nhập tự tải lên, chứ không phải bài đi kèm sẵn */
  mine: boolean;
  starred: boolean;
};

/** Một tư liệu (ảnh/video chèn) trong KHO DÙNG CHUNG — chưa thuộc dự án nào. */
export type ApiLibraryAsset = {
  file: string;
  title: string;
  kind: "image" | "video";
  tags: string[];
  /** Mô tả cho AI đọc — thiếu nó thì chặng ghép tư liệu bỏ qua tấm này */
  description: string;
  seconds: number;
  bytes: number;
  mine: boolean;
  starred: boolean;
};

/** Cài đặt của người dùng — mặc định cho dự án tạo về sau. */
export type ApiSettings = {
  minSilence: number;
  secondsPerEffect: number;
  placesPerMinute: number;
  musicVolume: number;
  insertSource: "project" | "starred" | "library";
  wantCaptions: boolean;
  autoGrade: boolean;
  wantMusic: boolean;
  profile: string;
};

/**
 * Dung lượng ổ chứa dữ liệu của máy chủ.
 *
 * `unavailable` khi máy chủ không đo được — hiếm, nhưng có thật trên vài loại
 * ổ gắn mạng. Lúc ấy màn hình im lặng chứ không bịa ra số 0.
 */
export type ApiStorage =
  | { totalBytes: number; freeBytes: number; usedBytes: number }
  | { unavailable: true };

export type ApiSegment = {
  id: string;
  position: number;
  start_sec: number;
  end_sec: number;
  label: string | null;
  removed: number;
};

export type ApiProject = {
  project: {
    id: string;
    title: string;
    status: string;
    /** Lời dặn của người dùng: video nói về gì, có tên riêng nào */
    profile?: string | null;
    /** Lời dặn tại lúc chép lời — khác `profile` là bản chép đã cũ */
    profile_at_transcribe?: string | null;
    /** Mạch cảnh tại lúc chép lời (id nối bằng dấu phẩy) — khác hiện tại là lời đã cũ */
    main_files_at_transcribe?: string | null;
    /** Quãng lặng dài hơn ngần này giây thì tự rút; 0 là không tự rút */
    min_silence?: number | null;
    /**
     * Có gieo chữ từ bản chép lời hay không. Máy chủ đọc cờ này ở chặng `captions`;
     * CHƯA có ô nào ở giao diện bật tắt nó, nên thực tế luôn là mặc định (bật).
     */
    want_captions?: number | null;
    /** Tự cân hình (sáng, màu, nhiễu) và tiếng (độ to). Rỗng = bật. */
    auto_grade?: number | null;
    /** Như `want_captions`, cho chặng `music`. Cũng chưa có ô nào bật tắt. */
    want_music?: number | null;
    /** Máy được lấy tư liệu ở đâu: project | starred | library */
    insert_source?: string | null;
    /** Chiều nhấn zoom ở các chỗ nối đoạn: none | in | out */
    zoom_punch?: string | number;
    /**
     * BỘ DÁNG CHỮ của cả dự án. Rỗng với dự án dựng trước khi có cột này — chỗ
     * đọc phải rơi về bộ gốc, xem `findStylePack`.
     */
    style_pack?: string | null;
    /** Dòng tiêu đề của cả video — một cột trên `projects`, không nằm trong `elements`. */
    headline?: string | null;
    /** Bộ dáng đang dùng lúc chặng hiệu ứng chạy lần cuối; `null` là chưa chạy. */
    effects_style_pack?: string | null;
    /**
     * Số giây dải ảnh biểu diễn — chia bề rộng ảnh cho nó ra thang vẽ.
     * `null` với dự án dựng bằng bản cũ; khi đó suy ra từ thời lượng.
     */
    strip_seconds?: number | null;
    /** Thang gốc của dải ảnh — px mỗi giây khi vẽ đúng chiều cao dải */
    strip_native_second_width?: number | null;
  };
  /**
   * Bản CHẤT LƯỢNG đã dựng xong chưa — thứ lượt xuất video cần.
   *
   * Nó dựng NỀN sau lượt chép lời, nên có một quãng bàn dựng mở được mà xuất thì
   * chưa. Nút Xuất đọc cờ này để mờ đi kèm lý do.
   */
  masterReady: boolean;
  music: ApiMusicTrack[];
  files: ApiFile[];
  /** Đoạn do máy chủ dựng — máy chủ vẫn trả về, chỉ là kiểu này thiếu khai báo */
  segments: ApiSegment[];
  sentences: ApiSentence[];
  words: ApiWord[];
  elements: ApiElement[];
  jobs: ApiJob[];
  /** Tiến trình dựng, để màn chờ và cổng vào bàn dựng đọc chung một nguồn */
  pipeline?: ApiPipeline;
  /** Hiệu ứng người dùng đặt tay — quãng theo giây BẢN GỐC */
  effects?: Array<{
    id: string;
    start_sec: number;
    end_sec: number;
    kind: string;
  }>;
  /** Mã những lời nhắc người dùng đã bỏ qua ở hàng soát */
  dismissed?: string[];
};

/**
 * Lỗi từ máy chủ, mang theo MÃ TRẠNG THÁI.
 *
 * Bên gọi cần phân biệt được "dự án không còn" (404 — hỏng vĩnh viễn, phải dựng
 * lại từ đầu) với "máy chủ đang lỗi" (5xx — thử lại là được). Chỉ có câu chữ thì
 * phải so chuỗi tiếng Việt, mà câu chữ ở máy chủ đổi lúc nào không ai biết.
 */
export class ApiError extends Error {
  // Gán trong thân hàm, không dùng `readonly` trên tham số: cấu hình
  // `erasableSyntaxOnly` không cho phép cú pháp đó.
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Câu thay cho lỗi mặc định của Fastify.
 *
 * Chúng ra thẳng màn hình người dùng: mở một dự án đã xoá thì màn báo lỗi hiện
 * đúng chữ "Not Found" — tiếng Anh, và không nói được người dùng nên làm gì.
 */
const CAU_THEO_MA: Record<number, string> = {
  400: "Lời gọi không hợp lệ",
  401: "Phiên đăng nhập đã hết hạn",
  403: "Dự án này không thuộc tài khoản của bạn",
  404: "Không tìm thấy — có thể dự án đã bị xoá",
  413: "Tệp lớn quá mức cho phép",
  500: "Máy chủ gặp lỗi khi xử lý",
};

/**
 * Bóc câu tiếng Việt trong thân lỗi.
 *
 * Lỗi do DỰ ÁN viết chỉ có `{"error":"câu tiếng Việt"}`. Lỗi mặc định của
 * Fastify thì kèm `statusCode` — đó là cách phân biệt hai loại, và loại thứ
 * hai phải thay bằng câu của mình chứ không bày nguyên văn tiếng Anh.
 */
function errorMessage(body: string, status: number) {
  try {
    const parsed = JSON.parse(body) as { error?: string; statusCode?: number };
    if (parsed?.error && parsed.statusCode === undefined) return parsed.error;
  } catch {
    /* không phải JSON thì xét tiếp bên dưới */
  }
  return CAU_THEO_MA[status] ?? (body || `Máy chủ trả về ${status}`);
}

/**
 * Máy chủ nói chưa đăng nhập thì đưa người dùng về `/`.
 *
 * `/` tự phân nhánh: chưa có phiên thì nó là trang giới thiệu, và ở đó có cửa
 * đăng nhập. Không còn `/login` riêng — nó chỉ là bản sao nghèo hơn của trang ấy.
 *
 * Cần vì phiên hết hiệu lực Ở MÁY CHỦ mà trình duyệt không hay biết. Rõ nhất là
 * khi một email bị gỡ khỏi `TEDDIT_ALLOWED_EMAILS`: Better Auth vẫn trả lời "phiên
 * này còn hạn" nên `RequireSession` cho vào màn, còn cổng chặn ở máy chủ thấy email
 * ngoài danh sách nên trả 401 cho mọi lời gọi — người dùng ngồi trước một màn dựng
 * ra đủ nhưng không nạp được gì, và không có chỗ nào để bấm cho thoát. Phiên quá
 * hạn ba mươi ngày cũng cùng một cảnh.
 *
 * Đặt ở đây chứ không ở từng màn: đây là cửa duy nhất mọi lời gọi đi qua.
 *
 * `location.assign` chứ không `navigate` của router: hàm này không nằm trong React
 * nên không với tới router, mà tải lại cả trang cũng là điều nên làm — nó xoá sạch
 * mọi thứ đã nhớ từ phiên cũ.
 */
function bounceToLogin() {
  if (window.location.pathname !== "/") {
    window.location.assign("/");
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: init?.body
      ? { "content-type": "application/json", ...init.headers }
      : init?.headers,
  });
  if (!response.ok) {
    if (response.status === 401) bounceToLogin();
    const detail = await response.text();
    throw new ApiError(errorMessage(detail, response.status), response.status);
  }
  return response.json() as Promise<T>;
}

export const api = {
  createProject: (title: string) =>
    request<{ id: string }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  /**
   * Đổi tên hoặc LỜI DẶN của dự án — chỉ gửi trường nào muốn đổi.
   *
   * Tên rỗng thì máy chủ trả về mặc định "Dự án mới". Lời dặn là chỗ người dùng
   * khai video nói về gì và có tên riêng nào; máy nghe lấy nó làm mồi từ vựng,
   * còn chặng sửa lời tin nó hơn mọi suy đoán khác.
   */
  updateProject: (
    id: string,
    patch: {
      title?: string;
      profile?: string;
      minSilence?: number;
      wantCaptions?: boolean;
      autoGrade?: boolean;
      wantMusic?: boolean;
      insertSource?: ApiSettings["insertSource"];
      /**
       * Mã bộ dáng chữ. Tên không có trong danh sách thì máy chủ trả 400 chứ
       * không lặng lẽ rơi về mặc định — màn chọn phải biết mình vừa lưu hụt.
       */
      stylePack?: StylePackId;
      /** Dòng tiêu đề của cả video. Chuỗi rỗng là XOÁ, không phải "giữ nguyên". */
      headline?: string;
    },
  ) =>
    request<{
      id: string;
      title: string;
      profile: string | null;
      min_silence: number | null;
      want_captions: number | null;
      want_music: number | null;
      insert_source: string | null;
      style_pack: string | null;
      headline: string | null;
    }>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  /** Chạy lại ĐÚNG MỘT chặng AI — không dựng lại cả mạch từ đầu. */
  retryStep: (projectId: string, key: string) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/steps/${key}/retry`,
      { method: "POST" },
    ),

  listProjects: () => request<ProjectSummary[]>("/api/projects"),

  getProject: (id: string) => request<ApiProject>(`/api/projects/${id}`),

  /** Đặt hoặc sửa MỘT hiệu ứng — cùng một cửa, màn hình tự sinh mã */
  setEffect: (
    projectId: string,
    effectId: string,
    body: { start: number; end: number; kind: string },
  ) =>
    request<{ ok: true }>(`/api/projects/${projectId}/effects/${effectId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteEffect: (projectId: string, effectId: string) =>
    request<{ ok: true }>(`/api/projects/${projectId}/effects/${effectId}`, {
      method: "DELETE",
    }),

  /**
   * Ba câu mở gợi ý cho "3 giây đầu". Mảng rỗng nghĩa là chưa có lời hoặc chưa
   * có khoá mô hình — hai đường xử lý kia của màn đó vẫn chạy được.
   */
  suggestOpeningLines: (
    projectId: string,
    /** `headline` cho chữ IN LÊN khung hình — 3–6 tiếng, không phải câu để nói. */
    mode: "opening" | "headline" = "opening",
  ) =>
    request<{ lines: string[] }>(`/api/projects/${projectId}/opening-lines`, {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),

  /** Bỏ qua một lời nhắc ở hàng soát — ghi xuống máy chủ để tải lại không hỏi lại */
  dismissIssue: (projectId: string, issueId: string) =>
    request<{ ok: true }>(`/api/projects/${projectId}/dismissed`, {
      method: "POST",
      body: JSON.stringify({ issueId }),
    }),

  undismissIssue: (projectId: string, issueId: string) =>
    request<{ ok: true }>(
      `/api/projects/${projectId}/dismissed/${encodeURIComponent(issueId)}`,
      { method: "DELETE" },
    ),

  /**
   * Tải MỘT tệp lên, cắt mảnh và nối lại được sau khi đứt (giao thức tus).
   *
   * Trước đây đây là một request `multipart/form-data` duy nhất mang cả tệp.
   * Hai chuyện giết cách đó:
   *
   * 1. Cloudflare đứng trước máy chủ CHỐI mọi thân request quá 100 MB — đo thật
   *    ngày 03/08/2026. Nó trả 413 giữa lúc trình duyệt còn đang gửi, mà XHR
   *    trong tình huống ấy không bắn `load` cũng không bắn `error`: ô video đứng
   *    im ở vài phần trăm cho tới khi người dùng bỏ cuộc. Đúng lỗi đã nhận được
   *    từ người dùng thật.
   * 2. Đứt là mất trắng. Tệp 800 MB rơi mạng ở phút thứ mười hai phải tải lại từ
   *    số không — chuyện xảy ra bất kể có Cloudflare hay không.
   *
   * Mảnh nhỏ hơn trần kia rất nhiều nên chuyện (1) hết đường xảy ra, và tus giữ
   * mốc đã gửi tới đâu nên (2) chỉ còn là tải nốt phần thiếu.
   *
   * Chữ ký giữ NGUYÊN dạng cũ — vẫn nhận một mảng, vẫn trả `{saved, rejected}` —
   * để `use-upload.ts` không phải biết bên dưới đã đổi giao thức.
   */
  uploadFiles(
    projectId: string,
    files: File[],
    onProgress: (percent: number) => void,
    /**
     * Chỗ tệp này đứng trong danh sách người dùng đang thấy.
     *
     * Máy chủ không tự suy ra được: nó chỉ biết tệp nào tới trước, tức tệp nào
     * nhẹ nhất, chứ không biết người dùng xếp cảnh nào trước cảnh nào.
     */
    order?: number,
    /** Gọi ngay khi lượt tải bắt đầu, để nơi gọi còn đường huỷ nửa chừng. */
    onStart?: (control: { abort: () => void }) => void,
  ) {
    return new Promise<{
      saved: ApiFile[];
      rejected: Array<{ name: string; reason: string }>;
    }>((resolve, reject) => {
      const file = files[0];
      if (!file) {
        resolve({ saved: [], rejected: [] });
        return;
      }

      /**
       * Đứng im quá lâu thì COI NHƯ HỎNG, đừng đợi mãi.
       *
       * Đây là chỗ vá lỗi đã ngốn của một người dùng mười lăm phút: Cloudflare
       * cắt luồng giữa chừng, socket không đóng, và XHR không bắn sự kiện nào —
       * thanh tiến độ nằm ở 5% cho tới khi người ta bỏ cuộc. Không sự kiện nào
       * tới thì phải có người đi hỏi, nên có cái đồng hồ này.
       *
       * 90 giây vì `onProgress` bắn theo từng nhịp byte của một mảnh, kể cả trên
       * đường truyền chậm — im lặng suốt ngần ấy nghĩa là không còn byte nào đi
       * qua, chứ không phải đi chậm.
       */
      const STALL_MS = 90_000;
      let lastMoved = Date.now();
      let watchdog: ReturnType<typeof setInterval> | undefined;
      const stopWatchdog = () => {
        if (watchdog !== undefined) clearInterval(watchdog);
        watchdog = undefined;
      };

      const upload = new TusUpload(file, {
        endpoint: `${BASE}/api/projects/${projectId}/uploads`,
        /**
         * 8 MB — nhỏ hơn TRẦN 100 MB của Cloudflare rất nhiều, và đủ nhỏ để một
         * lần thử lại chỉ tốn vài giây.
         *
         * Không chọn sát trần: trần đó là của gói hiện tại và đổi gói là đổi số,
         * còn mảnh nhỏ thì lúc mạng chập chờn mới là thứ cứu được lượt tải. Đổi
         * lại là nhiều request hơn — không đáng kể so với thời gian truyền.
         */
        chunkSize: 8 * 1024 * 1024,
        /**
         * Tự thử lại theo bậc thang, rồi mới chịu thua.
         *
         * Mỗi lần thử lại nối tiếp từ mốc đã gửi chứ không quay về đầu, nên năm
         * lần thử vẫn rẻ. Đây chính là thứ biến "mạng chập một cái là mất cả
         * lượt" thành một quãng khựng người dùng không nhận ra.
         */
        retryDelays: [0, 1000, 3000, 5000, 10000],
        metadata: {
          filename: file.name,
          filetype: file.type,
          ...(order === undefined ? {} : { order: String(order) }),
        },
        /**
         * Nhớ mốc dở dang qua cả lần TẢI LẠI TRANG.
         *
         * `tus-js-client` ghi dấu vào `localStorage`, nên đóng tab giữa chừng rồi
         * mở lại vẫn tải tiếp được thay vì bắt đầu lại. Xong thì xoá dấu, không
         * để `localStorage` phình mãi theo số tệp từng tải.
         */
        storeFingerprintForResuming: true,
        removeFingerprintOnSuccess: true,
        onProgress: (sent, total) => {
          lastMoved = Date.now();
          if (total > 0) onProgress(Math.round((sent / total) * 100));
        },
        onSuccess: ({ lastResponse }) => {
          stopWatchdog();
          try {
            resolve(
              JSON.parse(lastResponse.getBody()) as {
                saved: ApiFile[];
                rejected: Array<{ name: string; reason: string }>;
              },
            );
          } catch {
            // Máy chủ nhận xong mà thân trả về đọc không ra: tệp CÓ THỂ đã vào
            // nơi vào chốn, nhưng ở đây không có gì để dựng ô video cả. Nói thật
            // là hỏng còn hơn để một ô xanh không có dữ liệu phía sau.
            reject(new ApiError("Máy chủ trả lời không đọc được", 0));
          }
        },
        onError: (error) => {
          stopWatchdog();
          const status =
            (error as { originalResponse?: { getStatus(): number } })
              .originalResponse?.getStatus() ?? 0;
          // 413 vẫn còn đường xảy ra nếu ai đó dựng thêm một lớp chặn ở giữa với
          // trần thấp hơn cỡ mảnh. Nói thẳng ra thay vì để nó đội lốt lỗi mạng —
          // đó đúng là chỗ đã ngốn của người dùng mười lăm phút.
          if (status === 413) {
            reject(new ApiError("Tệp bị chặn ở đường truyền vì quá lớn", 413));
            return;
          }
          reject(
            new ApiError(
              status ? errorMessage(error.message, status) : "Mất kết nối tới máy chủ",
              status,
            ),
          );
        },
      });

      /**
       * Có mốc cũ thì NỐI TIẾP, không tải lại từ đầu.
       *
       * `findPreviousUploads` tra dấu đã ghi ở lần trước cho đúng tệp này. Bỏ
       * bước này thì `storeFingerprintForResuming` chỉ là ghi chép cho vui.
       */
      const begin = () => {
        onStart?.({
          abort: () => {
            stopWatchdog();
            void upload.abort();
          },
        });
        lastMoved = Date.now();
        watchdog = setInterval(() => {
          if (Date.now() - lastMoved < STALL_MS) return;
          stopWatchdog();
          void upload.abort();
          reject(
            new ApiError("Đường truyền đứng im quá lâu — thử lại giúp mình", 0),
          );
        }, 5_000);
        upload.start();
      };

      void upload
        .findPreviousUploads()
        .then((previous) => {
          if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
          begin();
        })
        .catch(begin);
    });
  },

  setFileRole: (fileId: string, role: "main" | "insert") =>
    request<ApiFile>(`/api/files/${fileId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  setFilePosition: (fileId: string, position: number) =>
    request<ApiFile>(`/api/files/${fileId}`, {
      method: "PATCH",
      body: JSON.stringify({ position }),
    }),

  setFileDescription: (fileId: string, description: string) =>
    request<ApiFile>(`/api/files/${fileId}`, {
      method: "PATCH",
      body: JSON.stringify({ description }),
    }),

  deleteFile: (fileId: string) =>
    request<{ ok: boolean }>(`/api/files/${fileId}`, { method: "DELETE" }),

  setSentenceText: (sentenceId: string, text: string) =>
    request<ApiSentence>(`/api/sentences/${sentenceId}`, {
      method: "PATCH",
      body: JSON.stringify({ text }),
    }),

  setWordText: (wordId: string, text: string) =>
    request<ApiWord>(`/api/words/${wordId}`, {
      method: "PATCH",
      body: JSON.stringify({ text }),
    }),

  setSentenceRemoved: (sentenceId: string, removed: boolean) =>
    request<ApiSentence>(`/api/sentences/${sentenceId}`, {
      method: "PATCH",
      body: JSON.stringify({ removed }),
    }),

  createElement: (
    projectId: string,
    body: {
      kind: "text" | "insert";
      /** Neo theo TỪ — chữ chép lời và tư liệu chèn */
      fromWordId?: string;
      toWordId?: string;
      /** Neo theo GIỜ — chữ tự do; dùng thay cho cặp mã từ, không dùng cùng */
      start?: number;
      end?: number;
      content?: string;
      band?: string;
      mediaFileId?: string;
    },
  ) =>
    request<ApiElement>(`/api/projects/${projectId}/elements`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateElement: (
    elementId: string,
    body: {
      content?: string;
      band?: string;
      /** Trục CĂN: các hàng nằm đâu theo bề ngang */
      align?: string;
      /** Trục NHẤN: tiếng nào to hơn trong cụm */
      emphasis?: string;
      /** Cách tư liệu chèn hiện ra */
      reveal?: string;
      /** Hình dáng khung tư liệu */
      shape?: string;
      /** Kéo hai đầu khối chữ tự do trên dải */
      start?: number;
      end?: number;
      keywords?: string[];
      /**
       * Hai trục cụm này TỰ ĐÈ. `null` = bỏ đè, quay về theo bộ dáng của dự án;
       * bỏ trống trường = không đụng tới.
       */
      letterCase?: "as-typed" | "upper" | null;
      keyColor?: string | null;
      /** Neo lại vào câu khác, giữ nguyên mọi thứ đã chỉnh */
      sentenceId?: string;
      /** Kéo mép: neo lại vào từ khác */
      fromWordId?: string;
      toWordId?: string;
    },
  ) =>
    request<ApiElement>(`/api/elements/${elementId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  /**
   * Áp một kiểu cho MỌI chữ chạy theo lời — trả về số cụm đã đổi.
   *
   * Chữ tự do không nằm trong phạm vi này: nó là tiêu đề, con số, nhãn mà người
   * dùng đặt tay từng cái với ý riêng.
   */
  applyTextStyleToAll: (
    projectId: string,
    style: { band?: string; align?: string; emphasis?: string },
  ) =>
    request<{ changed: number }>(`/api/projects/${projectId}/elements/style`, {
      method: "PATCH",
      body: JSON.stringify(style),
    }),

  deleteElement: (elementId: string) =>
    request<{ ok: boolean }>(`/api/elements/${elementId}`, {
      method: "DELETE",
    }),

  /** Đặt một bài nhạc TẠI VẠCH — `at` tính bằng giây bản gốc */
  uploadMusic(projectId: string, file: File, at: number) {
    const form = new FormData();
    form.append("file", file, file.name);
    return fetch(
      `${BASE}/api/projects/${projectId}/music?at=${at.toFixed(3)}`,
      {
        method: "POST",
        body: form,
      },
    ).then((response) => {
      if (!response.ok) throw new Error("Máy chủ không nhận tệp nhạc");
      return response.json() as Promise<ApiMusicTrack>;
    });
  },

  /** Kho TƯ LIỆU dùng chung — ảnh và video chèn cho mọi dự án */
  listAssets: () => request<ApiLibraryAsset[]>("/api/library/assets"),

  /**
   * Thêm tư liệu vào kho. Trả về cả những tệp bị BỎ vì trùng nội dung — thả mười
   * tệp mà chỉ thấy bảy cái hiện ra thì người dùng phải biết ba cái kia đi đâu.
   */
  uploadAssets(files: File[], title = "", tags = "", description = "") {
    const form = new FormData();
    form.append("title", title);
    form.append("tags", tags);
    form.append("description", description);
    for (const file of files) form.append("file", file, file.name);
    return fetch(`${BASE}/api/library/assets`, {
      method: "POST",
      credentials: "include",
      body: form,
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          errorMessage(await response.text(), response.status) ||
            "Máy chủ không nhận tệp",
        );
      }
      return response.json() as Promise<{
        assets: ApiLibraryAsset[];
        added: number;
        duplicates: Array<{ name: string; sameAs: string }>;
      }>;
    });
  },

  starAsset: (file: string, on: boolean) =>
    request<{ ok: boolean }>(
      `/api/library/assets/${encodeURIComponent(file)}/star`,
      { method: "PUT", body: JSON.stringify({ on }) },
    ),

  updateAsset: (
    file: string,
    patch: { title?: string; tags?: string[]; description?: string },
  ) =>
    request<{ ok: boolean }>(
      `/api/library/assets/${encodeURIComponent(file)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    ),

  /** Đĩa của máy chủ còn bao nhiêu — con số để biết lúc nào phải dọn */
  getStorage: () => request<ApiStorage>("/api/storage"),

  /** Đặt một tư liệu TỪ KHO vào dự án — máy chủ chép một bản sang thư mục dự án */
  addAssetFromLibrary: (projectId: string, file: string) =>
    request<ApiFile>(`/api/projects/${projectId}/assets/from-library`, {
      method: "POST",
      body: JSON.stringify({ file }),
    }),

  /** Cài đặt của người đang đăng nhập — mặc định cho dự án tạo về sau */
  getSettings: () => request<ApiSettings>("/api/settings"),
  saveSettings: (patch: Partial<ApiSettings>) =>
    request<ApiSettings>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  /** Danh mục nhạc DÙNG CHUNG — khác `music` của dự án, vốn là bài đã đặt vào dải */
  listMusicLibrary: () => request<ApiLibraryTrack[]>("/api/library/music"),

  /** Đánh dấu một bài. Dấu là của RIÊNG người đang đăng nhập. */
  starMusic: (file: string, on: boolean) =>
    request<{ ok: boolean }>(
      `/api/library/music/${encodeURIComponent(file)}/star`,
      { method: "PUT", body: JSON.stringify({ on }) },
    ),

  /** Thêm một bài vào KHO dùng chung — mọi dự án về sau đều chọn được nó */
  uploadToMusicLibrary(file: File, title: string, tags: string) {
    const form = new FormData();
    form.append("title", title);
    form.append("tags", tags);
    form.append("file", file, file.name);
    return fetch(`${BASE}/api/library/music`, {
      method: "POST",
      credentials: "include",
      body: form,
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          errorMessage(await response.text(), response.status) ||
            "Máy chủ không nhận tệp nhạc",
        );
      }
      return response.json() as Promise<ApiLibraryTrack>;
    });
  },

  /** Đặt một bài TỪ KHO vào dự án, tại vạch. Chỉ gửi TÊN — đường dẫn do máy chủ ghép. */
  addMusicFromLibrary: (projectId: string, file: string, at: number) =>
    request<ApiMusicTrack>(`/api/projects/${projectId}/music/from-library`, {
      method: "POST",
      body: JSON.stringify({ file, at }),
    }),

  /** Sửa một bài nhạc — mức âm lượng, hoặc mốc hai đầu trên dải */
  updateMusic: (
    trackId: string,
    body: { volume?: number; start?: number; end?: number },
  ) =>
    request<ApiMusicTrack>(`/api/music/${trackId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  /** Gỡ một bài khỏi dải — tệp vẫn nằm lại để còn đặt lại được */
  deleteMusic: (trackId: string) =>
    request<ApiMusicTrack>(`/api/music/${trackId}`, { method: "DELETE" }),

  restoreMusic: (
    projectId: string,
    track: {
      id: string;
      position: number;
      name: string;
      storedPath: string;
      start: number;
      end: number;
      volume: number;
    },
  ) =>
    request<ApiMusicTrack>(`/api/projects/${projectId}/music/restore`, {
      method: "POST",
      body: JSON.stringify(track),
    }),

  deleteProject: (projectId: string) =>
    request<{ ok: boolean }>(`/api/projects/${projectId}`, {
      method: "DELETE",
    }),

  layoutText: (
    content: string,
    band: string,
    projectId?: string,
    /** Từ khoá của cụm — chốt vai chữ, nên chốt luôn cỡ và chỗ bẻ dòng. */
    keywords?: string[],
  ) =>
    request<{
      lines: string[];
      truncated: boolean;
      /** Cụm dài hơn trần 3 dòng: phải tách thành nhiều chữ, không co chữ */
      needsSplit: boolean;
      fontRatio: number;
      topRatio: number;
      lineHeightRatio: number;
    }>("/api/layout", {
      method: "POST",
      body: JSON.stringify({ content, band, projectId, keywords }),
    }),

  listSegments: (projectId: string) =>
    request<ApiSegment[]>(`/api/projects/${projectId}/segments`),

  splitSegment: (projectId: string, at: number) =>
    request<ApiSegment[]>(`/api/projects/${projectId}/segments/split`, {
      method: "POST",
      body: JSON.stringify({ at }),
    }),

  /** Lấp chữ cho một câu đang trống — chỉ ở những khoảng chưa có chữ */
  createCaptions: (projectId: string, sentenceId?: string) =>
    request<{ created: string[] }>(`/api/projects/${projectId}/captions`, {
      method: "POST",
      body: JSON.stringify({ sentenceId }),
    }),

  mergeSegment: (segmentId: string) =>
    request<ApiSegment[]>(`/api/segments/${segmentId}/merge`, {
      method: "POST",
    }),

  updateSegment: (
    segmentId: string,
    body: {
      removed?: boolean;
      label?: string;
      edge?: "start" | "end";
      at?: number;
    },
  ) =>
    request<ApiSegment>(`/api/segments/${segmentId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  /** Chiều nhấn zoom ở các chỗ nối: none | in | out */
  setZoomPunch: (projectId: string, punch: string) =>
    request<{ zoom_punch: string }>(`/api/projects/${projectId}/zoom-punch`, {
      method: "PATCH",
      body: JSON.stringify({ punch }),
    }),

  /** Bỏ một quãng theo giây — máy chủ tách đoạn ở hai đầu rồi bỏ đoạn giữa. */
  removeRange: (projectId: string, start: number, end: number) =>
    request<ApiSegment[]>(`/api/projects/${projectId}/segments/remove-range`, {
      method: "POST",
      body: JSON.stringify({ start, end }),
    }),

  /** Những quãng sẽ không vào video: đoạn đã bỏ, và hở do gọt mép đoạn. */
  listSkipped: (projectId: string) =>
    request<
      Array<{
        id: string;
        start: number;
        end: number;
        kind: "segment" | "gap";
        label: string | null;
      }>
    >(`/api/projects/${projectId}/skipped`),

  startTranscribe: (projectId: string) =>
    request<{ status: string }>(`/api/projects/${projectId}/transcribe`, {
      method: "POST",
    }),

  startExport: (projectId: string) =>
    request<{ status: string }>(`/api/projects/${projectId}/export`, {
      method: "POST",
    }),

  getJob: (projectId: string, kind: string) =>
    request<ApiJob>(`/api/projects/${projectId}/jobs/${kind}`),

  fileUrl: (storedPath: string) => {
    const marker = "/data/";
    const index = storedPath.indexOf(marker);
    return index === -1
      ? storedPath
      : `${BASE}/files/${storedPath.slice(index + marker.length)}`;
  },

  /** Tệp tư liệu để xem trước — phục vụ qua đường tĩnh của máy chủ */
  mediaUrl: (fileId: string) => `${BASE}/api/files/${fileId}/raw`,

  /**
   * Dải ảnh thu nhỏ, gộp trong một tệp sprite.
   *
   * `version` đổi mỗi lần dựng lại dải: thiếu nó thì trình duyệt giữ bản cũ
   * trong bộ nhớ đệm và người dùng vẫn thấy đúng dải mờ vừa dựng lại xong.
   */
  filmstripUrl: (projectId: string, version?: number | null) =>
    `${BASE}/files/projects/${projectId}/thumbs/strip.jpg` +
    (version ? `?v=${version}` : ""),

  /**
   * Đường bao âm lượng để vẽ dải sóng — mỗi ô 20ms, mức 0–1.
   *
   * Máy chủ tự dựng nếu dự án chép lời bằng bản chưa có tệp này.
   */
  getEnvelope: (projectId: string) =>
    request<{ hop: number; values: number[]; speechLevel: number }>(
      `/api/projects/${projectId}/envelope`,
    ),

  /** Dựng lại dải ảnh cho dự án đã có — trả về thang của bản vừa dựng */
  rebuildFilmstrip: (projectId: string) =>
    request<{
      secondWidth: number;
      seconds: number;
      nativeSecondWidth: number;
    }>(`/api/projects/${projectId}/filmstrip`, { method: "POST" }),

  /**
   * Video cho khung xem trước — bản NHẸ, không phải bản dựng cho bản xuất.
   *
   * Trước đây trỏ thẳng `/files/.../work/base.mp4`: 212 MB, 10,5 Mbps, `moov` ở
   * cuối tệp và khung khoá cách nhau 6–7 giây — kéo thanh thời gian là hình giật.
   * Máy chủ tự chọn `preview.mp4` khi có, rơi về `base.mp4` với dự án dựng bằng
   * bản cũ.
   */
  baseVideoUrl: (projectId: string) =>
    `${BASE}/api/projects/${projectId}/preview`,

  exportUrl: (projectId: string) =>
    `${BASE}/files/projects/${projectId}/out/final.mp4`,
};
