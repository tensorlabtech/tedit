const BASE = import.meta.env.VITE_API ?? "http://127.0.0.1:5190";

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
  thumb_path: string | null;
  /** Cảnh báo từ máy chủ: codec tiếng lạ, nhịp khung thay đổi, video bị xoay */
  warnings?: string[];
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
    /** Chiều nhấn zoom ở các chỗ nối đoạn: none | in | out */
    zoom_punch?: string | number;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: init?.body
      ? { "content-type": "application/json", ...init.headers }
      : init?.headers,
  });
  if (!response.ok) {
    // Bóc lấy câu tiếng Việt trong thân lỗi, đừng ném cả JSON ra màn hình.
    //
    // Máy chủ luôn trả `{"error":"..."}`. Ném nguyên chuỗi đó thì người dùng
    // đọc được đúng thế này: {"error":"Không có dự án này"} — dấu ngoặc, dấu
    // nháy và tên trường đều là rác với họ.
    const detail = await response.text();
    let loi = detail;
    try {
      const body = JSON.parse(detail) as { error?: string };
      if (body?.error) loi = body.error;
    } catch {
      /* không phải JSON thì dùng nguyên văn */
    }
    throw new Error(loi || `Máy chủ trả về ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  createProject: (title: string) =>
    request<{ id: string }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  /** Đổi tên dự án — tên rỗng thì máy chủ trả về mặc định "Dự án mới" */
  renameProject: (id: string, title: string) =>
    request<{ id: string; title: string }>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),

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
  ) {
    return new Promise<{
      saved: ApiFile[];
      rejected: Array<{ name: string; reason: string }>;
    }>((resolve, reject) => {
      const form = new FormData();
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
          reject(new Error(xhr.responseText || `Máy chủ trả về ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Mất kết nối tới máy chủ"));
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

  deleteElement: (elementId: string) =>
    request<{ ok: boolean }>(`/api/elements/${elementId}`, {
      method: "DELETE",
    }),

  /** Đặt một bài nhạc TẠI VẠCH — `at` tính bằng giây bản gốc */
  uploadMusic(projectId: string, file: File, at: number) {
    const form = new FormData();
    form.append("file", file, file.name);
    return fetch(`${BASE}/api/projects/${projectId}/music?at=${at.toFixed(3)}`, {
      method: "POST",
      body: form,
    }).then((response) => {
      if (!response.ok) throw new Error("Máy chủ không nhận tệp nhạc");
      return response.json() as Promise<ApiMusicTrack>;
    });
  },

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

  layoutText: (content: string, band: string) =>
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
      body: JSON.stringify({ content, band }),
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
