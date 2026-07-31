import { useCallback, useEffect, useRef, useState } from "react";

import type { PickerItem } from "@/components/media-picker-item";
import { toast } from "@/components/ui/toast";
import { ApiError, api, type ApiSettings } from "@/lib/api";

import type { StylePackId } from "../../../server/style-pack";
import {
  DEFAULT_STYLE_PACK_ID,
  findStylePack,
} from "../../../server/style-pack-catalog";

import { makeThumbnail } from "./make-thumbnail";
import {
  isVideo,
  mainRoleRejection,
  rejectionReason,
  type MediaFile,
  type MediaRole,
  suggestedTitle,
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
/** Nơi nhớ phong cách đã chọn lần trước, để dự án sau không phải chọn lại. */
const LAST_STYLE_KEY = "teddit-style-pack";

export function useUpload(openingProjectId?: string) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [projectId, setProjectId] = useState<string | null>(
    openingProjectId ?? null,
  );
  /** Đang lấy lại dự án dở — chưa biết mạch có gì nên đừng vội bày ô rỗng */
  const [restoring, setRestoring] = useState(Boolean(openingProjectId));
  /**
   * LỜI DẶN: video nói về gì, có tên riêng nào.
   *
   * Hai chặng đọc nó — mồi từ vựng cho máy nghe và chặng sửa lời — và với tên
   * riêng thì đây là nguồn duy nhất. Đo khi ô này còn rỗng: "TensorLab" chép ra
   * "Tensolab", còn chặng sửa lời không có gì để mà tin.
   */
  const [profile, setProfileState] = useState("");
  const [title, setTitle] = useState(suggestedTitle());
  /**
   * Quãng lặng dài hơn ngần này giây thì chặng `silence` tự rút lại.
   *
   * `0` là một lựa chọn THẬT — "đừng tự rút, tôi tự cắt ở bàn dựng" — nên đừng
   * coi nó là chưa đặt.
   */
  const [minSilence, setMinSilence] = useState(0.8);
  /**
   * Phong cách của dự án. Mở màn thì lấy lại lựa chọn LẦN TRƯỚC.
   *
   * Người làm kênh dùng một phong cách cho mọi video; bắt họ chọn lại ở từng dự
   * án là bắt trả giá cho một quyết định họ đã ra rồi.
   */
  const [stylePack, setStylePackState] = useState<StylePackId>(() => {
    try {
      return findStylePack(localStorage.getItem(LAST_STYLE_KEY)).id;
    } catch {
      return DEFAULT_STYLE_PACK_ID;
    }
  });
  /**
   * Máy được lấy tư liệu ở đâu cho DỰ ÁN NÀY.
   *
   * `null` khi chưa nạp xong dự án — khác hẳn với "chỉ tư liệu của dự án". Vẽ ô
   * chọn bằng một giá trị đoán trước rồi đổi khi dữ liệu về là ô nhảy một nhịp
   * ngay trước mắt người dùng, và ai bấm đúng lúc đó thì ghi đè mất lựa chọn cũ.
   */
  const [insertSource, setInsertSource] = useState<
    ApiSettings["insertSource"] | null
  >(null);
  // Bản sao đồng bộ: `ensureProject` chạy trong một lời hứa đã đóng băng giá trị
  // của lượt dựng cũ, mà nó cần cái tên VỪA gõ.
  const titleRef = useRef(suggestedTitle());
  // Bản sao đồng bộ: nhịp hỏi tiến độ chạy trong `setInterval` nên nó nhìn thấy
  // `profile` của lượt dựng đã đóng băng, không phải giá trị vừa gõ.
  const profileRef = useRef("");
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
      // Tên ĐANG hiện trên đầu trang, không phải chữ "Dự án mới" cứng: đặt tên
      // trước khi thả tệp là chuyện thường (nhất là từ khi máy nghe đọc cái tên
      // làm mồi từ vựng), mà lúc đó chưa có dự án nào để ghi vào. Ghi cứng thì tên
      // vừa gõ mất lặng lẽ, trong khi đầu trang vẫn bày nó ra.
      creating.current = api.createProject(titleRef.current).then(({ id }) => {
        projectRef.current = id;
        setProjectId(id);
        // Lời dặn gõ TRƯỚC khi thả tệp cũng phải theo vào dự án vừa tạo. Ô đó hiện
        // ngay từ đầu và người ta hay gõ nó lúc đang chờ tệp, nên `saveProfile` lúc
        // ấy chưa có dự án nào để ghi vào — chỉ giữ trong `profileRef`.
        if (profileRef.current.trim()) {
          void api
            .updateProject(id, { profile: profileRef.current })
            .catch(() => {
              /* ô vẫn còn chữ, rời ô lần nữa là ghi lại */
            });
        }
        return id;
      });
    }
    return creating.current;
  }, []);

  /**
   * Dự án trên máy chủ KHÔNG CÒN — bỏ mã cũ và dựng một dự án mới tại chỗ.
   *
   * Xảy ra thật: một tab để mở sẵn ở `/upload/:id`, dự án bị xoá ở nơi khác, rồi
   * người dùng thả tệp vào. Mã cũ vẫn nằm trong tay màn hình nên mọi lượt tải
   * đều rơi vào hư không, và cả sáu ô video hiện một dòng đỏ *"Không có dự án
   * này"* — một câu chỉ đúng về mặt máy móc, còn người đọc thì không có việc gì
   * làm với nó.
   *
   * Không đá người dùng về trang chủ: tệp họ vừa thả vẫn còn trong tay, dựng lại
   * mã dự án rồi tải tiếp là xong, và họ không mất gì cả.
   */
  const remakeProject = useCallback(async () => {
    projectRef.current = null;
    creating.current = null;
    // Mã trên đường dẫn cũng phải đổi theo, không thì tải lại trang là quay về
    // đúng cái dự án đã chết.
    setTranscribe(null);
    setSentenceCount(null);
    const id = await ensureProject();
    window.history.replaceState(null, "", `/upload/${id}`);

    // Mọi tệp đã tải lên dự án cũ CŨNG chết theo nó.
    //
    // Bỏ qua bước này thì màn hình bày sáu ô "đã xong" cho một dự án chỉ có một
    // tệp: đo được ngay sau lần dựng lại đầu tiên — khung xem đếm "Cảnh 1/2"
    // trong khi máy chủ chỉ giữ đúng một cảnh, và bản xuất ra sẽ thiếu.
    //
    // Còn `File` gốc trong tay thì tải lại — người dùng không mất gì. Không còn
    // (mở lại một dự án cũ thì trong trình duyệt chỉ có đường dẫn máy chủ) thì
    // nói thẳng là mất, chứ đừng để một ô xanh nói dối.
    for (const item of latest.current) {
      if (!item.serverId) continue;
      const source = sources.current.get(item.id);
      if (source) {
        patch(item.id, {
          status: "uploading",
          progress: 0,
          serverId: undefined,
          error: undefined,
        });
        void uploadRef.current?.(
          { ...item, status: "uploading", progress: 0, serverId: undefined },
          source,
          item.role,
        );
      } else {
        patch(item.id, {
          status: "error",
          serverId: undefined,
          error: "Dự án cũ đã mất, thả lại tệp này",
        });
      }
    }
    return id;
  }, [ensureProject, patch]);

  /**
   * `upload` khai báo sau `remakeProject` mà `remakeProject` phải gọi được nó —
   * một vòng tròn, nên đi qua một ref thay vì xếp lại thứ tự khai báo (xếp lại
   * thì `upload` mất `remakeProject` trong tay và vòng tròn chỉ đổi chiều).
   */
  const uploadRef = useRef<
    | ((item: MediaFile, file: File, forcedRole?: MediaRole) => Promise<void>)
    | null
  >(null);

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
              description: file.description ?? undefined,
              libraryFile: file.library_file ?? undefined,
              kind: file.kind,
            };
          });
        commit(restored);
        // Số câu đọc luôn từ bản vừa lấy về: mở lại một dự án đã chép lời rồi
        // thì lời nhắc "không nghe được câu nào" phải có mặt ngay, chứ không
        // đợi tới lần chép sau mới hiện.
        setSentenceCount(data.sentences.length);
        setTitle(data.project.title);
        setMinSilence(data.project.min_silence ?? 0.8);
        // Dự án đang mở lại thì lấy phong cách CỦA NÓ, không lấy lựa chọn lần
        // trước — lựa chọn lần trước chỉ dành cho dự án mới.
        setStylePackState(findStylePack(data.project.style_pack).id);
        setInsertSource(
          (data.project.insert_source as ApiSettings["insertSource"]) ??
            "starred",
        );
        titleRef.current = data.project.title;
        setProfileState(data.project.profile ?? "");
        profileRef.current = data.project.profile ?? "";
        setTranscribedProfile(data.project.profile_at_transcribe ?? null);
        // Mốc mạch cảnh đã chép, do máy chủ đóng — nhờ nó mà lời nhắc "mạch đổi sau
        // khi chép lời" sống qua lần tải trang.
        if (data.project.main_files_at_transcribe) {
          transcribedKey.current = data.project.main_files_at_transcribe;
        }
      })
      .catch((error) => {
        if (!alive) return;
        // Dự án ĐÃ MẤT là chuyện khác hẳn máy chủ đang lỗi: tải lại trang bao
        // nhiêu lần cũng không dựng lại được nó. Dọn mã chết đi và mời làm mạch
        // mới, ngay tại đây — nếu không thì mọi tệp thả vào sau đó đều rơi vào hư
        // không, và mỗi ô video hiện một dòng đỏ "Không có dự án này".
        if (error instanceof ApiError && error.status === 404) {
          projectRef.current = null;
          window.history.replaceState(null, "", "/upload");
          toast.add({
            title: "Dự án này không còn",
            description: "Thả tệp vào để bắt đầu một mạch mới",
            type: "warning",
          });
          return;
        }
        toast.add({
          title: "Không mở lại được dự án",
          description: "Máy chủ không trả lời — thử tải lại trang",
          type: "error",
        });
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
    async (
      item: MediaFile,
      file: File,
      forcedRole?: MediaRole,
      /**
       * Chỗ tệp này đứng trong danh sách đang hiện. Phải gửi kèm vì các lượt tải
       * chạy SONG SONG — thiếu nó thì thứ tự cảnh trong phim thành thứ tự tệp nào
       * tải xong trước, tức tệp nào nhẹ nhất.
       */
      order?: number,
    ) => {
      const send = (id: string) =>
        api.uploadFiles(
          id,
          [file],
          (percent) => {
            if (cancelled.current.has(item.id)) return;
            patch(item.id, { progress: percent, status: "uploading" });
          },
          order,
        );
      try {
        const id = await ensureProject();
        // Dự án chết thì dựng lại rồi gửi tiếp — MỘT lần, không lặp: dựng lại mà
        // vẫn 404 nghĩa là lỗi ở chỗ khác, thử mãi chỉ làm ô video treo.
        const result = await send(id).catch(async (error) => {
          if (!(error instanceof ApiError) || error.status !== 404) throw error;
          return send(await remakeProject());
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
          description: saved.description ?? undefined,
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
    [ensureProject, patch, remakeProject],
  );

  uploadRef.current = upload;

  /**
   * @param forcedRole Cột người dùng thả vào. Bỏ trống thì để máy tự xếp theo
   * định dạng và việc có tiếng hay không.
   */
  /**
   * Lấy tư liệu TỪ KHO DÙNG CHUNG về dự án đang nạp.
   *
   * Không đi qua đường tải lên: tệp đã nằm trên đĩa máy chủ rồi, máy chủ chỉ chép
   * một bản sang thư mục dự án và mang theo luôn MÔ TẢ đã viết. Nên ở đây không
   * có nhịp `uploading`, không có thanh tiến độ — ô hiện ra là đã xong.
   *
   * Chép TỪNG TỆP MỘT chứ không `Promise.all`: thứ tự trong dự án là thứ tự
   * người dùng vừa bấm, mà chạy song song thì tệp nào máy chủ xong trước sẽ giành
   * chỗ đứng trước.
   */
  const addFromLibrary = useCallback(
    async (chosen: string[]) => {
      const id = await ensureProject();
      const added: MediaFile[] = [];
      const failed: string[] = [];

      for (const file of chosen) {
        try {
          const row = await api.addAssetFromLibrary(id, file);
          nextId.current += 1;
          added.push({
            id: `f${nextId.current}`,
            name: row.name,
            size: row.size,
            thumbnail: row.thumb_path ? api.fileUrl(row.thumb_path) : undefined,
            remoteUrl: api.mediaUrl(row.id),
            role: row.role,
            status: "done",
            progress: 100,
            serverId: row.id,
            duration: row.duration ?? undefined,
            hasAudio: row.has_audio === 1,
            width: row.width ?? undefined,
            height: row.height ?? undefined,
            description: row.description ?? undefined,
            libraryFile: row.library_file ?? undefined,
            kind: row.kind,
          });
        } catch {
          failed.push(file);
        }
      }

      if (added.length > 0) commit([...latest.current, ...added]);
      if (failed.length > 0) {
        toast.add({
          title: `Không lấy được ${failed.length} tư liệu`,
          description: failed.join(", "),
          type: "error",
        });
      }
    },
    [ensureProject],
  );

  const addFiles = useCallback(
    (incoming: File[], forcedRole?: MediaRole): IntakeResult => {
      const rejected: IntakeResult["rejected"] = [];
      const before = latest.current.length;
      const next = [...latest.current];
      const queued: Array<[MediaFile, File, number]> = [];

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
        // Chỗ đứng trong danh sách ĐANG HIỆN, tính cả tệp có từ trước — đây chính
        // là thứ tự người dùng nhìn thấy, và là thứ tự phải giữ tới lúc ghép phim.
        queued.push([item, file, next.length - 1]);
      }

      commit(next);

      for (const [item, file, order] of queued) {
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
        void upload(item, file, forcedRole, order);
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
  const removeFile = useCallback(
    (id: string) => {
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
        if (source)
          void upload(
            { ...gone, status: "uploading", progress: 0 },
            source,
            gone.role,
          );
      };
    },
    [upload],
  );

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

  /**
   * Ghi lời dặn xuống máy chủ.
   *
   * Chỉ ghi lúc RỜI Ô, không ghi từng phím: mỗi lần ghi là một lượt gọi máy chủ,
   * mà ô này người ta gõ liền một câu dài.
   */
  const saveProfile = useCallback(async (next: string) => {
    setProfileState(next);
    profileRef.current = next;
    const id = projectRef.current;
    if (!id) return;
    await api.updateProject(id, { profile: next }).catch(() => {
      toast.add({
        title: "Không lưu được lời dặn",
        description: "Máy chủ không trả lời — thử lại giúp mình",
        type: "error",
      });
    });
  }, []);

  /**
   * Ghi nội dung một tư liệu chèn.
   *
   * Xoá trắng cũng là một ý kiến: nó trả tệp về cho máy đọc ở lượt dựng sau.
   */
  const saveDescription = useCallback(
    async (itemId: string, description: string) => {
      const clean = description.trim();
      patch(itemId, { description: clean || undefined });
      const serverId = latest.current.find(
        (entry) => entry.id === itemId,
      )?.serverId;
      if (!serverId) return;
      await api.setFileDescription(serverId, clean).catch(() => {
        toast.add({
          title: "Không lưu được mô tả",
          description: "Máy chủ không trả lời — thử lại giúp mình",
          type: "error",
        });
      });
    },
    [patch],
  );

  /** Ghi ngưỡng tự rút khoảng lặng. Kéo xong mới ghi, không ghi từng nhịp kéo. */
  const saveMinSilence = useCallback(async (next: number) => {
    setMinSilence(next);
    const id = projectRef.current;
    if (!id) return;
    await api.updateProject(id, { minSilence: next }).catch(() => {
      toast.add({
        title: "Không lưu được cài đặt",
        description: "Máy chủ không trả lời — thử lại giúp mình",
        type: "error",
      });
    });
  }, []);

  /** Ghi nguồn tư liệu máy được lấy. Ô chọn nên ghi ngay, không có nhịp kéo nào. */
  const saveInsertSource = useCallback(
    async (next: ApiSettings["insertSource"]) => {
      const truoc = insertSource;
      setInsertSource(next);
      const id = projectRef.current;
      if (!id) return;
      await api.updateProject(id, { insertSource: next }).catch(() => {
        // Trả về giá trị CŨ khi ghi hỏng: để ô hiện lựa chọn mới trong khi máy
        // chủ vẫn giữ cái cũ là nói dối, và lượt dựng sau sẽ không theo cái đang
        // hiện trên màn.
        setInsertSource(truoc);
        toast.add({
          title: "Không lưu được cài đặt",
          description: "Máy chủ không trả lời — thử lại giúp mình",
          type: "error",
        });
      });
    },
    [insertSource],
  );

  /** Ghi tên dự án. Cũng chỉ ghi lúc RỜI Ô, cùng lý do như lời dặn. */
  /**
   * Chọn PHONG CÁCH ở màn nạp tệp — trước khi máy chạy.
   *
   * Đây là lúc DUY NHẤT lựa chọn còn lái được cả mạch: chặng `captions` là chặng
   * thứ năm trong mười một và nó chạy ngay sau khi chép lời xong, nên chọn ở màn
   * chờ là một cuộc đua với chính cái máy. Thua cuộc đua thì bố cục chữ đã sinh
   * theo bộ gốc, và từ đó đổi phong cách chỉ còn vẽ lại được font với màu.
   *
   * Ghi kèm NGƯỠNG RÚT LẶNG của phong cách đó, và ghi ở phía màn hình chứ không
   * ở máy chủ: thanh kéo ngay bên cạnh nhảy theo trước mắt người dùng, nên họ
   * thấy nguyên nhân và kéo lại được. Máy chủ ghi đè lặng lẽ thì họ mất một lựa
   * chọn mà không biết vì sao.
   */
  const saveStylePack = useCallback(
    async (next: StylePackId) => {
      setStylePackState(next);
      const pack = findStylePack(next);
      setMinSilence(pack.intensity.minSilence);
      // Nhớ cho LẦN SAU: người làm kênh dùng một phong cách cho mọi video, mà
      // mỗi dự án mới lại quay về bộ gốc thì họ phải chọn lại mỗi lần.
      try {
        localStorage.setItem(LAST_STYLE_KEY, next);
      } catch {
        // Trình duyệt chặn lưu trữ — mất trí nhớ giữa các dự án, không sao.
      }
      // `ensureProject` chứ không đọc mã có sẵn: người dùng chọn phong cách được
      // NGAY khi mở màn, trước cả tệp đầu tiên — mà lúc đó dự án chưa tồn tại.
      const id = await ensureProject();
      await api
        .updateProject(id, {
          stylePack: next,
          minSilence: pack.intensity.minSilence,
        })
        .catch(() => {});
    },
    [ensureProject],
  );

  const saveTitle = useCallback(async (next: string) => {
    const clean = next.trim() || suggestedTitle();
    setTitle(clean);
    titleRef.current = clean;
    const id = projectRef.current;
    if (!id) return;
    await api.updateProject(id, { title: clean }).catch(() => {
      toast.add({
        title: "Không lưu được tên dự án",
        description: "Máy chủ không trả lời — thử lại giúp mình",
        type: "error",
      });
    });
  }, []);

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
  /**
   * Tư liệu chèn nắn về dạng lưới của hộp chọn dùng chung.
   *
   * Nắn ở đây chứ không dùng `pickerItemFromApiFile`: màn này giữ tệp ở dạng
   * RIÊNG của nó (`MediaFile`) vì tệp còn có thể đang tải dở, và ảnh thu nhỏ thì
   * dựng ngay trong trình duyệt từ `File` gốc — không đợi máy chủ.
   */
  const insertItems: PickerItem[] = insertFiles.map((item) => ({
    key: item.id,
    thumbUrl: item.thumbnail,
    // Ảnh thu nhỏ ở màn này do trình duyệt tự dựng từ `File` gốc — luôn là ảnh.
    thumbKind: "image" as const,
    previewUrl: item.remoteUrl ?? item.thumbnail ?? "",
    name: item.name,
    isVideo: item.kind ? item.kind === "video" : isVideo(item.name),
    seconds: item.duration ?? 0,
    width: item.width,
    height: item.height,
    search: `${item.name} ${item.description ?? ""}`.toLowerCase(),
  }));
  /** Tệp kho đã nằm trong dự án — hộp chọn từ kho lấy để đánh dấu "đã có". */
  const libraryFilesInProject = files
    .map((item) => item.libraryFile)
    .filter((file): file is string => !!file);
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
      sum +
      (item.status === "done" ? item.size : item.size * (item.progress / 100)),
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
  /**
   * Lời dặn tại lúc chép lời, do MÁY CHỦ đóng mốc.
   *
   * Sửa lời dặn xong thì bản chép CŨ vẫn còn nguyên chỗ nghe sai, mà không có gì
   * báo: người ta gõ đúng tên công ty vào rồi mở bàn dựng, và thấy y nguyên cái
   * tên viết sai. Đo được lời dặn đổi đúng cái đó: cùng một đoạn tiếng,
   * "Tensolab" thành "TensorLab" — nhưng chỉ khi chép lại.
   *
   * Mốc nằm ở máy chủ chứ không ở một `ref` trong màn hình: sửa lời dặn rồi tải
   * lại trang thì mọi thứ giữ trong bộ nhớ đều mất, và lời nhắc "chép lại" biến
   * mất đúng lúc nó còn đúng.
   */
  const [transcribedProfile, setTranscribedProfile] = useState<string | null>(
    null,
  );
  /**
   * Chìa khoá mạch cảnh — dùng ID MÁY CHỦ, không phải id tạm của màn hình.
   *
   * Máy chủ đóng mốc `main_files_at_transcribe` bằng chính id của nó; so hai chuỗi
   * khác hệ id thì lần nào cũng "khác nhau" và lời nhắc kêu oan mãi.
   */
  const mainKeyOf = (list: MediaFile[]) =>
    list
      .filter(
        (item) =>
          item.role === "main" && item.status === "done" && item.serverId,
      )
      .map((item) => item.serverId)
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
          setTranscribedProfile(profileRef.current);
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
    insertItems,
    libraryFilesInProject,
    readyMainFiles,
    mainDuration,
    projectId,
    restoring,
    title,
    saveTitle,
    saveDescription,
    profile,
    saveProfile,
    stylePack,
    saveStylePack,
    minSilence,
    /**
     * Đổi con số TRONG LÚC kéo, chưa ghi xuống máy chủ.
     *
     * Thanh kéo cần số nhảy theo tay để người ta thấy mình đang chọn gì; ghi thì
     * đợi thả tay, vì một lượt kéo là hàng chục nhịp.
     */
    setMinSilenceDraft: setMinSilence,
    saveMinSilence,
    insertSource,
    saveInsertSource,
    /** Máy chép lời chạy xong mà không nghe ra câu nào */
    noSpeechFound: transcribe?.status === "done" && sentenceCount === 0,
    transcribe,
    addFiles,
    addFromLibrary,
    removeFile,
    setRole,
    moveFile,
    moveFileTo,
    cancelUpload,
    retryUpload,
    startTranscribe,
    /** Lời dặn đã sửa sau khi chép lời — chép lại thì tên riêng ra đúng hơn */
    briefStale:
      transcribe?.status === "done" &&
      transcribedProfile !== null &&
      transcribedProfile !== profile,
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
