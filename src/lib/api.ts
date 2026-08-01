/**
 * Rỗng nghĩa là CÙNG GỐC với trang — Vite chuyển tiếp `/api` và `/files` về
 * Fastify lúc phát triển (xem `vite.config.ts`), còn lúc chạy thật thì Fastify
 * trả luôn bản build nên vốn đã cùng gốc.
 *
 * Trước đây chỗ này trỏ thẳng `http://127.0.0.1:5190`, tức là khác gốc với trang
 * ở `5173`: trình duyệt không gửi cookie phiên kèm request, nên đăng nhập xong
 * mọi lệnh vẫn trả về 401.
 */
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
  status: "running" | "done" | "error";
  progress: number;
  message: string | null;
};

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
  suggestOpeningLines: (projectId: string) =>
    request<{ lines: string[] }>(
      `/api/projects/${projectId}/opening-lines`,
      { method: "POST" },
    ),

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
   * Tải tệp lên kèm báo tiến độ. Dùng XHR chứ không dùng `fetch` vì `fetch`
   * không cho biết đã gửi được bao nhiêu byte — mà một video 500MB thì thanh
   * tiến độ là thứ duy nhất giữ người dùng khỏi tưởng máy treo.
   */
  uploadFiles(
    projectId: string,
    files: File[],
    onProgress: (percent: number) => void,
    /**
     * Chỗ tệp này đứng trong danh sách người dùng đang thấy.
     *
     * BẮT BUỘC khi các tệp được gửi song song — mà màn nạp tệp thì gửi song song.
     * Máy chủ không tự suy ra được: nó chỉ biết tệp nào tới trước, tức tệp nào
     * nhẹ nhất, chứ không biết người dùng xếp cảnh nào trước cảnh nào.
     */
    order?: number,
  ) {
    return new Promise<{
      saved: ApiFile[];
      rejected: Array<{ name: string; reason: string }>;
    }>((resolve, reject) => {
      const form = new FormData();
      // Trường `order` đi TRƯỚC tệp: máy chủ đọc multipart theo luồng, gặp phần
      // nào xử lý phần ấy — đặt sau tệp thì lúc ghi hàng nó chưa thấy số này.
      if (order !== undefined) form.append("order", String(order));
      for (const file of files) form.append("file", file, file.name);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}/api/projects/${projectId}/files`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          // Đây là chỗ chuỗi JSON thô từng đổ ra tận nhãn dưới ô video: người
          // dùng đọc được đúng thế này — {"error":"Không có dự án này"}.
          reject(
            new ApiError(
              errorMessage(xhr.responseText, xhr.status),
              xhr.status,
            ),
          );
        }
      };
      xhr.onerror = () => reject(new ApiError("Mất kết nối tới máy chủ", 0));
      xhr.send(form);
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

  layoutText: (content: string, band: string, projectId?: string) =>
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
      body: JSON.stringify({ content, band, projectId }),
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

  /** Bản đã ghép và chuẩn hoá 9:16 — dựng ở bước chép lời, dùng luôn để xem trước. */
  baseVideoUrl: (projectId: string) =>
    `${BASE}/files/projects/${projectId}/work/base.mp4`,

  exportUrl: (projectId: string) =>
    `${BASE}/files/projects/${projectId}/out/final.mp4`,
};
