import { useCallback, useEffect, useRef, useState } from "react";

import { api, type ApiPipeline } from "@/lib/api";

/** Nhịp hỏi lại. Đủ nhanh để thấy chặng đổi, đủ chậm để không quấy máy chủ. */
const POLL_MS = 1500;

export type PipelineView = {
  title: string;
  pipeline: ApiPipeline | null;
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

  return { title, pipeline, message, jobError, loading, error, retry };
}
