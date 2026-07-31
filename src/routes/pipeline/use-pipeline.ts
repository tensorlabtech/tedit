import { useCallback, useEffect, useRef, useState } from "react";

import { api, type ApiPipeline } from "@/lib/api";

import type { StylePackId } from "../../../server/style-pack";

/** Nhịp hỏi lại. Đủ nhanh để thấy chặng đổi, đủ chậm để không quấy máy chủ. */
const POLL_MS = 1500;

/**
 * Chữ mẫu cho ô chọn dáng khi CHƯA có lời.
 *
 * Ngắn và có dấu chồng dấu: ô mẫu chỉ rộng chừng 80px nên câu dài co lại thành
 * vệt xám, còn dấu chồng dấu là chỗ các font khác nhau nhiều nhất.
 */
const SAMPLE_FALLBACK = "Nghĩ kỹ rồi bắt đầu";

/**
 * Lấy cụm đầu tiên của người dùng làm chữ cho ô mẫu.
 *
 * Bảy tiếng: đủ để thấy bẻ dòng và mật độ chữ, chưa đủ để cụm co lại thành vệt.
 * Lấy từ bảng `words` chứ không từ `elements` — chặng `captions` chạy SAU
 * `transcribe`, nên lúc người dùng đang chọn thì chưa có phần tử chữ nào.
 */
function sampleFromWords(words: Array<{ text: string }>) {
  const spoken = words
    .slice(0, 7)
    .map((word) => word.text.trim())
    .filter(Boolean);
  return spoken.length >= 3 ? spoken.join(" ") : SAMPLE_FALLBACK;
}

export type PipelineView = {
  title: string;
  pipeline: ApiPipeline | null;
  /** Mã bộ dáng đang lưu; rỗng với dự án dựng trước khi có cột này. */
  stylePack: string | null;
  /** Chữ vẽ trong ô mẫu — lời thật của người dùng khi đã chép xong. */
  sampleText: string;
  /**
   * Khung hình THẬT làm nền cho ô mẫu; `null` khi chưa dựng xong ảnh thu nhỏ.
   *
   * Chữ trắng trên nền đen thì người dùng chỉ so được font. Chữ đè lên chính
   * khuôn mặt họ vừa quay thì họ thấy được thứ sẽ ra — đó là khác biệt giữa
   * "chọn phong cách" và "chọn font".
   */
  posterUrl: string | null;
  /** Ghi bộ dáng ngay, không cần nút xác nhận. */
  chooseStylePack: (next: StylePackId) => Promise<void>;
  /** Lời máy chủ đang nói về việc đang chạy — dùng làm dòng chạy của chặng */
  message: string | null;
  /** Lượt dựng CHẾT hẳn: hiện ra để người dùng biết mà bấm lại */
  jobError: string | null;
  loading: boolean;
  error: string | null;
  /** Chạy lại một chặng; bỏ trống khoá thì dựng lại cả mạch từ đầu. */
  retry: (key?: string) => Promise<void>;
};

export function usePipeline(projectId: string | undefined): PipelineView {
  const [title, setTitle] = useState("Dự án");
  const [pipeline, setPipeline] = useState<ApiPipeline | null>(null);
  const [stylePack, setStylePack] = useState<string | null>(null);
  const [sampleText, setSampleText] = useState(SAMPLE_FALLBACK);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Giữ trong ref chứ không cho vào mảng phụ thuộc: cho vào thì mỗi lần hỏi
  // xong là effect dựng lại và đặt một hẹn giờ mới chồng lên cái cũ.
  const settledRef = useRef(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api.getProject(projectId);
      setTitle(data.project.title);
      setPipeline(data.pipeline ?? null);
      setStylePack(data.project.style_pack ?? null);
      setSampleText(sampleFromWords(data.words));
      // Ảnh thu nhỏ của cảnh chính ĐẦU TIÊN — dựng xong ngay ở chặng chuẩn bị,
      // tức là có trước cả lời chép.
      const main = data.files.find(
        (file) => file.role === "main" && file.thumb_path,
      );
      setPosterUrl(main?.thumb_path ? api.fileUrl(main.thumb_path) : null);
      const job = data.jobs.find((item) => item.kind === "transcribe");
      setMessage(job?.status === "running" ? (job.message ?? null) : null);
      setJobError(job?.status === "error" ? (job.message ?? "Lỗi") : null);
      settledRef.current = data.pipeline?.settled ?? false;
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không mở được dự án");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await load();
      // DỪNG hỏi khi máy đã buông tay. Hỏi tiếp thì trang này ngốn một lượt
      // truy vấn mỗi giây rưỡi cho tới khi người dùng đóng tab, mà chẳng còn gì
      // đổi để mà thấy.
      if (alive && !settledRef.current) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [load]);

  const retry = useCallback(
    async (key?: string) => {
      if (!projectId) return;
      // Chạy lại MỘT chặng khi biết chặng nào: dựng lại cả mạch mất vài phút nghe và
      // chép lời, chỉ để làm lại một chặng phụ như chọn hiệu ứng.
      if (key) {
        await api.retryStep(projectId, key);
        settledRef.current = false;
        return;
      }
      await api.startTranscribe(projectId);
      settledRef.current = false;
      await load();
    },
    [projectId, load],
  );

  /**
   * Ghi NGAY, không có nút xác nhận: thao tác này rẻ và đảo ngược được, mà một
   * nút xác nhận sẽ biến thẻ chọn dáng thành một việc phải làm cho xong.
   *
   * Đặt luôn vào state trước khi gọi máy chủ — trang tự hỏi lại mỗi 1,5 giây,
   * chờ lượt hỏi sau mới thấy viền nhảy sang ô mới thì bấm xong như không ăn.
   * Máy chủ trả 400 với tên lạ, và lúc đó lượt hỏi kế tiếp kéo giá trị thật về.
   */
  const chooseStylePack = useCallback(
    async (next: StylePackId) => {
      if (!projectId) return;
      setStylePack(next);
      await api.updateProject(projectId, { stylePack: next });
    },
    [projectId],
  );

  return {
    title,
    pipeline,
    stylePack,
    sampleText,
    posterUrl,
    chooseStylePack,
    message,
    jobError,
    loading,
    error,
    retry,
  };
}
