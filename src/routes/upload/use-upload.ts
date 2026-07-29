import { useCallback, useEffect, useRef, useState } from "react";

import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";

import { makeThumbnail } from "./make-thumbnail";
import {
  isVideo,
  mainRoleRejection,
  rejectionReason,
  type MediaFile,
  type MediaRole,
} from "./upload-data";
import { useWorkInProgressGuards } from "./use-work-in-progress-guards";

export type IntakeResult = {
  accepted: number;
  rejected: Array<{ name: string; reason: string }>;
};

/**
 * @param openingProjectId Dự án đang mở dở, lấy từ đường dẫn. Có nó thì màn này
 * dựng lại từ máy chủ thay vì bắt đầu bằng một mạch rỗng.
 */
export function useUpload(openingProjectId?: string) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [projectId, setProjectId] = useState<string | null>(
    openingProjectId ?? null,
  );
  /** Đang lấy lại dự án dở — chưa biết mạch có gì nên đừng vội bày ô rỗng */
  const [restoring, setRestoring] = useState(Boolean(openingProjectId));
  /**
   * Chép lời xong thì ra bao nhiêu câu; `null` là chưa hỏi.
   *
   * Bằng 0 nghĩa là máy không nghe ra lời nào — video chỉ có nhạc hoặc tiếng ồn.
   * Phải nói ra ngay tại màn này: nút ở đầu trang vẫn mời "Mở bàn dựng", mà
   * sang tới nơi là một bảng Lời trống trơn không ai giải thích.
   */
  const [sentenceCount, setSentenceCount] = useState<number | null>(null);
  const [transcribe, setTranscribe] = useState<{
    status: string;
    message: string;
    progress: number;
  } | null>(null);

  const nextId = useRef(0);
  // Bản sao đồng bộ của `files`: `addFiles` phải trả kết quả ngay tại chỗ gọi,
  // mà updater của setState thì React gọi trễ.
  const latest = useRef<MediaFile[]>([]);
  // Giữ File gốc để còn tải lại khi người dùng bấm "Thử lại".
  const sources = useRef(new Map<string, File>());
  const cancelled = useRef(new Set<string>());
  const projectRef = useRef<string | null>(null);
  // Giữ chính LỜI HỨA đang chạy, không chỉ giữ id đã có: thả hai tệp một lúc thì
  // hai lần tải chạy song song, cả hai đều thấy id còn rỗng và mỗi bên tạo một
  // dự án riêng — video chính rơi vào dự án này, ảnh rơi vào dự án kia.
  const creating = useRef<Promise<string> | null>(null);

  const commit = (next: MediaFile[]) => {
    latest.current = next;
    setFiles(next);
  };

  const patch = useCallback((id: string, changes: Partial<MediaFile>) => {
    commit(
      latest.current.map((item) =>
        item.id === id ? { ...item, ...changes } : item,
      ),
    );
  }, []);

  /**
   * Tạo dự án ở lần thả tệp đầu tiên, không tạo sẵn lúc mở trang: mở rồi bỏ đi
   * mà vẫn đẻ ra dự án thì danh sách sau này toàn dự án rỗng.
   */
  const ensureProject = useCallback(async () => {
    if (projectRef.current) return projectRef.current;
    if (!creating.current) {
      creating.current = api.createProject("Dự án mới").then(({ id }) => {
        projectRef.current = id;
        setProjectId(id);
        return id;
      });
    }
    return creating.current;
  }, []);

  /**
   * Dựng lại màn từ dự án đã có trên máy chủ.
   *
   * Trước đây `/upload` không mang mã dự án: tải lại trang giữa chừng là mất
   * sạch mạch vừa xếp, trong khi các tệp vẫn nằm nguyên trên đĩa — dự án đó
   * thành một mục "Chưa chép lời" không ai còn đường quay lại. Mã dự án nằm
   * trên đường dẫn nên trang tự tìm lại được việc đang làm dở.
   */
  useEffect(() => {
    if (!openingProjectId) return;
    // Mã vừa do CHÍNH màn này sinh ra (thả tệp đầu tiên xong là nó nhảy lên
    // đường dẫn): lúc đó trong tay đã có danh sách thật, đang tải dở, và bản
    // trên máy chủ còn thiếu — lấy về đè lên là xoá mất mấy ô đang chạy.
    if (latest.current.length > 0 || creating.current) {
      setRestoring(false);
      return;
    }
    let alive = true;
    projectRef.current = openingProjectId;
    api
      .getProject(openingProjectId)
      .then((data) => {
        if (!alive) return;
        const restored = [...data.files]
          .sort((a, b) =>
            a.role === b.role
              ? a.position - b.position
              : a.role === "main"
                ? -1
                : 1,
          )
          .map<MediaFile>((file) => {
            nextId.current += 1;
            return {
              id: `f${nextId.current}`,
              name: file.name,
              size: file.size,
              thumbnail: file.thumb_path
                ? api.fileUrl(file.thumb_path)
                : undefined,
              remoteUrl: api.mediaUrl(file.id),
              role: file.role,
              status: "done",
              progress: 100,
              serverId: file.id,
              duration: file.duration ?? undefined,
              hasAudio: file.has_audio === 1,
              width: file.width ?? undefined,
              height: file.height ?? undefined,
            };
          });
        commit(restored);
        // Số câu đọc luôn từ bản vừa lấy về: mở lại một dự án đã chép lời rồi
        // thì lời nhắc "không nghe được câu nào" phải có mặt ngay, chứ không
        // đợi tới lần chép sau mới hiện.
        setSentenceCount(data.sentences.length);
      })
      .catch(() => {
        if (alive) {
          toast.add({
            title: "Không mở lại được dự án",
            description: "Máy chủ không trả lời — thử tải lại trang",
            type: "error",
          });
        }
      })
      .finally(() => alive && setRestoring(false));
    return () => {
      alive = false;
    };
  }, [openingProjectId]);

  /** Việc chép lời có thể đang chạy từ phiên trước — bắt lại nhịp hỏi tiến độ. */
  useEffect(() => {
    if (!openingProjectId) return;
    let alive = true;
    api
      .getJob(openingProjectId, "transcribe")
      .then((job) => {
        if (!alive) return;
        setTranscribe({
          status: job.status,
          message: job.message ?? "",
          progress: job.progress ?? 0,
        });
      })
      .catch(() => {
        /* chưa chạy lần nào — không có gì để bắt lại */
      });
    return () => {
      alive = false;
    };
  }, [openingProjectId]);

  const upload = useCallback(
    async (item: MediaFile, file: File, forcedRole?: MediaRole) => {
      try {
        const id = await ensureProject();
        const result = await api.uploadFiles(id, [file], (percent) => {
          if (cancelled.current.has(item.id)) return;
          patch(item.id, { progress: percent, status: "uploading" });
        });
        if (cancelled.current.has(item.id)) return;
        const saved = result.saved[0];
        if (!saved) {
          patch(item.id, {
            status: "error",
            error: result.rejected[0]?.reason ?? "Máy chủ không nhận tệp",
          });
          return;
        }
        const measured: Partial<MediaFile> = {
          status: "done",
          progress: 100,
          serverId: saved.id,
          duration: saved.duration ?? undefined,
          hasAudio: saved.has_audio === 1,
          width: saved.width ?? undefined,
          height: saved.height ?? undefined,
        };

        // Cảnh báo không chặn việc dựng, nhưng phải nói ra: mất tiếng vì codec
        // lạ là thứ người dùng chỉ phát hiện sau khi đã xuất xong video.
        for (const warning of saved.warnings ?? []) {
          toast.add({
            title: file.name,
            description: warning,
            type: "warning",
          });
        }

        // Thả vào cột nào thì ở lại cột đó, kể cả khi máy chủ tự xếp khác:
        // người dùng đã nói ý mình bằng chỗ thả rồi. Chỉ chiều theo máy chủ khi
        // ý đó bất khả thi — tệp câm thì không làm video chính được.
        let wanted = saved.role;
        if (forcedRole === "insert") {
          wanted = "insert";
        } else if (
          forcedRole === "main" &&
          !mainRoleRejection({ ...item, ...measured } as MediaFile)
        ) {
          wanted = "main";
        }
        if (wanted !== saved.role) {
          void api.setFileRole(saved.id, wanted).catch(() => {});
        }
        patch(item.id, { ...measured, role: wanted });
      } catch (error) {
        if (cancelled.current.has(item.id)) return;
        patch(item.id, {
          status: "error",
          error: (error as Error).message.slice(0, 120),
        });
      }
    },
    [ensureProject, patch],
  );

  /**
   * @param forcedRole Cột người dùng thả vào. Bỏ trống thì để máy tự xếp theo
   * định dạng và việc có tiếng hay không.
   */
  const addFiles = useCallback(
    (incoming: File[], forcedRole?: MediaRole): IntakeResult => {
      const rejected: IntakeResult["rejected"] = [];
      const before = latest.current.length;
      const next = [...latest.current];
      const queued: Array<[MediaFile, File]> = [];

      for (const file of incoming) {
        const reason = rejectionReason(file.name, file.size);
        if (reason) {
          rejected.push({ name: file.name, reason });
          continue;
        }
        // KHÔNG chặn tệp trùng. Một cảnh xuất hiện hai lần trong mạch là chuyện
        // bình thường — mở đầu bằng đúng khung sẽ nhắc lại ở cuối chẳng hạn —
        // mà chặn theo tên thì người dùng không còn cách nào làm việc đó cả.
        nextId.current += 1;
        const item: MediaFile = {
          id: `f${nextId.current}`,
          name: file.name,
          size: file.size,
          role: isVideo(file.name) ? (forcedRole ?? "main") : "insert",
          status: "uploading",
          progress: 0,
        };
        next.push(item);
        sources.current.set(item.id, file);
        queued.push([item, file]);
      }

      commit(next);

      for (const [item, file] of queued) {
        void makeThumbnail(file).then((probe) => {
          // Chỉ ghi đè trường ĐO ĐƯỢC: tệp hỏng trả về rỗng, mà ghi rỗng đè lên
          // thì cỡ khung máy chủ vừa gửi về bị xoá và nhãn hướng khung mất theo.
          const measured: Partial<MediaFile> = {};
          if (probe.thumbnail) measured.thumbnail = probe.thumbnail;
          if (probe.width && probe.height) {
            measured.width = probe.width;
            measured.height = probe.height;
          }
          if (Object.keys(measured).length > 0) patch(item.id, measured);
        });
        void upload(item, file, forcedRole);
      }

      return { accepted: next.length - before, rejected };
    },
    [patch, upload],
  );

  /**
   * Gỡ một tệp, trả về hàm đặt lại chỗ cũ.
   *
   * Bấm nhầm nút gỡ một video 500MB mà không hoàn tác được thì người dùng phải
   * ngồi tải lại từ đầu. Giữ nguyên `File` gốc và vị trí cũ để dựng lại y hệt.
   */
  const removeFile = useCallback((id: string) => {
    const list = latest.current;
    const index = list.findIndex((item) => item.id === id);
    const gone = list[index];
    if (!gone) return () => {};
    const source = sources.current.get(id);

    if (gone.serverId) void api.deleteFile(gone.serverId).catch(() => {});
    cancelled.current.add(id);
    commit(list.filter((item) => item.id !== id));

    return () => {
      // Ảnh xem trước chỉ thu hồi khi người dùng đã bỏ hẳn ý định hoàn tác,
      // nên `URL.revokeObjectURL` không nằm ở nhánh gỡ.
      const current = latest.current;
      if (current.some((item) => item.id === id)) return;
      cancelled.current.delete(id);
      const next = [...current];
      next.splice(Math.min(index, next.length), 0, gone);
      commit(next);
      // Tệp đã lên máy chủ thì bản trên đó vừa bị xoá — phải tải lại.
      if (source) void upload({ ...gone, status: "uploading", progress: 0 }, source, gone.role);
    };
  }, [upload]);

  /** Đổi cột. Trả về `null` nếu đổi được, ngược lại là lý do để hiện cho người dùng. */
  const setRole = useCallback((id: string, role: MediaRole) => {
    const target = latest.current.find((item) => item.id === id);
    if (!target) return "Không còn tệp này";
    const reason = role === "main" ? mainRoleRejection(target) : null;
    if (reason) return reason;
    if (target.serverId) {
      void api.setFileRole(target.serverId, role).catch(() => {});
    }
    commit(
      latest.current.map((item) => (item.id === id ? { ...item, role } : item)),
    );
    return null;
  }, []);

  /** Đẩy lại thứ tự cả cột lên máy chủ — thứ tự ghép chính là nội dung video. */
  const syncPositions = (list: MediaFile[]) => {
    list
      .filter((item) => item.role === "main" && item.serverId)
      .forEach((item, index) => {
        void api.setFilePosition(item.serverId!, index).catch(() => {});
      });
  };

  const moveFile = useCallback((id: string, direction: -1 | 1) => {
    const list = latest.current;
    const target = list.find((item) => item.id === id);
    if (!target) return false;
    const sameRole = list.filter((item) => item.role === target.role);
    const position = sameRole.findIndex((item) => item.id === id);
    const neighbour = sameRole[position + direction];
    if (!neighbour) return false;
    const a = list.findIndex((item) => item.id === id);
    const b = list.findIndex((item) => item.id === neighbour.id);
    const next = [...list];
    [next[a], next[b]] = [next[b], next[a]];
    commit(next);
    syncPositions(next);
    return true;
  }, []);

  const moveFileTo = useCallback((id: string, index: number) => {
    const list = latest.current;
    const target = list.find((item) => item.id === id);
    if (!target) return false;
    const sameRole = list.filter((item) => item.role === target.role);
    const from = sameRole.findIndex((item) => item.id === id);
    if (from === index || index < 0 || index >= sameRole.length) return false;
    const reordered = [...sameRole];
    reordered.splice(from, 1);
    reordered.splice(index, 0, target);
    let cursor = 0;
    const next = list.map((item) =>
      item.role === target.role ? reordered[cursor++] : item,
    );
    commit(next);
    syncPositions(next);
    return true;
  }, []);

  const cancelUpload = useCallback(
    (id: string) => {
      cancelled.current.add(id);
      patch(id, { status: "error", error: "Đã huỷ" });
    },
    [patch],
  );

  const retryUpload = useCallback(
    (id: string) => {
      const item = latest.current.find((entry) => entry.id === id);
      const file = sources.current.get(id);
      if (!item || !file) return;
      cancelled.current.delete(id);
      patch(id, { status: "uploading", progress: 0, error: undefined });
      void upload({ ...item, status: "uploading", progress: 0 }, file);
    },
    [patch, upload],
  );

  const clear = useCallback(() => commit([]), []);

  /**
   * Tệp gốc còn nằm trong bộ nhớ trình duyệt — khung xem trước phát thẳng từ đây.
   *
   * Phát từ tệp gốc chứ không tải lại từ máy chủ: người dùng cần xem NGAY lúc
   * đang tải để biết mình chọn đúng video chưa, mà lúc đó trên máy chủ chưa có gì.
   */
  const sourceOf = useCallback((id: string) => sources.current.get(id), []);

  const mainFiles = files.filter((item) => item.role === "main");
  const insertFiles = files.filter((item) => item.role === "insert");
  /** Video chính đã lên tới nơi và đọc được — chỉ những tệp này mới dựng được. */
  const readyMainFiles = mainFiles.filter((item) => item.status === "done");
  const uploadingFiles = files.filter((item) => item.status === "uploading");
  const uploading = uploadingFiles.length > 0;
  /**
   * Tiến độ chung của cả đợt tải, tính theo BYTE chứ không theo số tệp.
   *
   * Trung bình cộng phần trăm của từng tệp thì một ảnh 200KB xong ngay lập tức
   * đẩy con số lên nửa đường trong khi video 800MB mới đi được vài phần trăm —
   * thanh chạy vọt rồi đứng im hàng phút, đúng kiểu làm người ta tưởng máy treo.
   */
  const totalBytes = files.reduce((sum, item) => sum + item.size, 0);
  const doneBytes = files.reduce(
    (sum, item) =>
      sum + (item.status === "done" ? item.size : item.size * (item.progress / 100)),
    0,
  );
  const uploadProgress =
    totalBytes > 0 ? Math.round((doneBytes / totalBytes) * 100) : 0;
  /**
   * Thời lượng video sẽ ra — chỉ cộng tệp đã đo xong. Đoán theo tệp đang tải sẽ
   * cho một con số nhảy loạn trong lúc tải, tệ hơn là chưa hiện gì.
   */
  const mainDuration = readyMainFiles.reduce(
    (total, item) => total + (item.duration ?? 0),
    0,
  );

  /**
   * Mạch cảnh tại lúc chép lời xong — để biết sau đó người dùng có đổi gì không.
   *
   * Thêm một cảnh sau khi đã chép lời thì phần thêm KHÔNG có lời, mà màn hình
   * vẫn báo "đã chép xong" và mời mở bàn dựng: sang tới nơi mới thấy một quãng
   * video không có chữ nào. Giữ lại chìa khoá này để nói ra ngay tại đây.
   */
  const transcribedKey = useRef<string | null>(null);
  const mainKeyOf = (list: MediaFile[]) =>
    list
      .filter((item) => item.role === "main" && item.status === "done")
      .map((item) => item.id)
      .join(",");

  const startTranscribe = useCallback(async () => {
    const id = projectRef.current;
    if (!id) return;
    transcribedKey.current = null;
    await api.startTranscribe(id);
    setTranscribe({ status: "running", message: "Đang xếp hàng", progress: 0 });
  }, []);

  useEffect(() => {
    if (!projectId || transcribe?.status !== "running") return;
    const timer = window.setInterval(async () => {
      try {
        const job = await api.getJob(projectId, "transcribe");
        if (job.status === "done" && transcribedKey.current === null) {
          transcribedKey.current = mainKeyOf(latest.current);
          // Hỏi luôn xem chép ra được bao nhiêu câu. Không đọc thông báo của
          // việc để đoán: đổi một chữ ở máy chủ là màn hình đọc sai — con số
          // thì không nói dối được.
          api
            .getProject(projectId)
            .then((data) => setSentenceCount(data.sentences.length))
            .catch(() => setSentenceCount(null));
        }
        setTranscribe({
          status: job.status,
          message: job.message ?? "",
          progress: job.progress ?? 0,
        });
      } catch {
        /* việc chưa kịp tạo — hỏi lại ở nhịp sau */
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [projectId, transcribe?.status]);

  useWorkInProgressGuards(uploading);

  return {
    files,
    mainFiles,
    insertFiles,
    readyMainFiles,
    mainDuration,
    projectId,
    restoring,
    /** Máy chép lời chạy xong mà không nghe ra câu nào */
    noSpeechFound: transcribe?.status === "done" && sentenceCount === 0,
    transcribe,
    addFiles,
    removeFile,
    setRole,
    moveFile,
    moveFileTo,
    cancelUpload,
    retryUpload,
    startTranscribe,
    /** Lời đã chép không còn khớp mạch hiện tại — thêm hoặc bớt cảnh sau khi chép xong */
    transcriptStale:
      transcribe?.status === "done" &&
      transcribedKey.current !== null &&
      transcribedKey.current !== mainKeyOf(files),
    sourceOf,
    uploading,
    uploadingFiles,
    uploadProgress,
    totalBytes,
    clear,
  };
}

export type UploadState = ReturnType<typeof useUpload>;
