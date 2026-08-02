import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toast } from "@/components/ui/toast";
import { useMediaIntake } from "./use-media-intake";
import type { RevealId, ShapeId } from "./editor-data";
import { segmentLabel, shape, toMusicTrack } from "./shape-project";
import {
  ApiError,
  api,
  isJobActive,
  queueLabel,
  type ApiProject,
  type ApiPipeline,
  type ApiSegment,
} from "@/lib/api";


import type { StylePackId } from "../../../server/style-pack";
import { findStylePack } from "../../../server/style-pack-catalog";

import { shortMediaLabel } from "./editor-data";
import type { AudioEnvelope } from "./timeline-audio-lane";

import type {
  Clip,
  Insert,
  MusicTrack,
  Sentence,
  TextElement,
  TextElementPosition,
  Word,
} from "./editor-data";
import {
  bandsOverlap,
  effectPeak,
  effectSpan,
  junctionHalves,
  type JunctionId,
} from "@/dev/overlays/overlay-model";

/** Một bước hoàn tác được — chỉ chứa dữ liệu để còn cất vào localStorage. */
type UndoEntry =
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
        kind: "text" | "insert";
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

export type Selection =
  | { kind: "clip"; id: string }
  | { kind: "insert"; id: string }
  | { kind: "text"; id: string }
  | { kind: "music"; id: string }
  // Chỗ nối không có mã riêng — nó LÀ một mốc. Dùng chính giây bản gốc làm mã.
  | { kind: "junction"; id: string }
  | null;

/** Thang phóng: desktop mặc định 200px/giây (xem docs/editor-interaction-spec.md §3) */
export const DEFAULT_PX_PER_SECOND = 200;
const MIN_PX_PER_SECOND = 60;
const MAX_PX_PER_SECOND = 600;

/**
 * Bước phóng của NÚT và PHÍM.
 *
 * Cả thang chỉ rộng 10 lần (60→600), nên bước 1,4 chia ra chưa tới bảy nấc —
 * bấm một cái là nhảy qua đúng mức mình cần. 1,25 cho mười nấc, canh được.
 */
export const ZOOM_STEP = 1.25;

/**
 * Mỗi nửa của một đoạn phải còn ít nhất chừng này thì mới tách được.
 *
 * Khớp `MIN_LENGTH` của `server/segments.ts` — máy chủ là nơi chốt, đây chỉ là
 * bản sao để khoá nút trước khi người dùng bấm vào chỗ không tách được.
 */
export const MIN_SEGMENT = 0.3;

/**
 * Đổi độ lăn thành hệ số phóng — theo ĐỘ LỚN cú lăn, không phải mỗi cú một nấc.
 *
 * Chụm hai ngón bắn ra hàng chục sự kiện nhỏ trong một cử chỉ; nhân 1,15 mỗi sự
 * kiện thì mới nhích ngón đã phóng gấp mấy lần, đó là chỗ "zoom nhạy quá". Hàm
 * mũ làm cú lăn nhỏ ra hệ số nhỏ, và vẫn cho con lăn chuột (mỗi nấc ~100) một
 * bước rõ ràng. Chặn hai đầu để một cú lăn dữ dội không nhảy hết cả thang.
 */
export function zoomFactorFromWheel(deltaY: number) {
  return Math.min(1.5, Math.max(1 / 1.5, Math.exp(-deltaY * 0.0035)));
}

/**
 * Khoảng nhạc ngắn hơn hai giây không còn là nhạc nền, chỉ là một tiếng bụp.
 * Máy chủ chặn cùng con số này — xem `music-tracks.ts`.
 */
const MIN_MUSIC_LENGTH = 2;

/**
 * Bắt lỗi của một lệnh GHI — và nói ra, thay vì nuốt im lặng.
 *
 * Bàn dựng đổi hình ngay khi bấm rồi mới ghi xuống máy chủ (lạc quan). Ghi hỏng
 * mà không báo thì màn hình nói một đằng, dữ liệu một nẻo — người dùng chỉ biết
 * ở lần mở sau, lúc đó công đã mất và không còn manh mối nào.
 *
 * Từng có 25 chỗ viết `.catch(boQuaLoi())`. Một hàm dùng chung thì chỗ nào cũng
 * báo giống nhau, và không ai phải nhớ tự viết lấy.
 */
const boQuaLoi = () => (error: unknown) => {
  toast.add({
    title: "Không lưu được thay đổi",
    description:
      error instanceof Error && error.message
        ? error.message
        : "Máy chủ không trả lời — thử lại giúp mình",
    type: "error",
  });
};

/** Một khung hình ở 30 khung/giây — bước lùi nhỏ nhất còn có nghĩa trên dải. */
const FRAME = 1 / 30;

/** Khối chữ tự do mới đặt dài bao lâu — đủ đọc một dòng tiêu đề. */
const TEXT_DEFAULT_LENGTH = 2;
/** Sàn khi kéo hai đầu khối chữ; máy chủ chặn cùng con số này. */
const MIN_TEXT_LENGTH = 0.4;

/**
 * Hiệu ứng ngắn nhất — dưới mức này thì cú nhấn rơi gọn trong một hai khung
 * hình, xem ra chỉ như một cái giật chứ không đọc được là chủ ý.
 */
const MIN_EFFECT_LENGTH = 0.15;

/** Dựng dữ liệu màn Editor từ dữ liệu máy chủ trả về. */
/**
 * Đếm chữ và tư liệu neo vào một khoảng thời gian.
 *
 * Phần tử neo vào TỪ, nên bỏ câu hay bỏ đoạn chứa nó thì lúc dựng nó không còn chỗ
 * nào để hiện và bị bỏ im lặng. Hàm này để nói trước con số đó.
 */
export function demElement(
  data: {
    textElements: TextElement[];
    inserts: Insert[];
    wordsById: Map<string, Word>;
  },
  from: number,
  to: number,
) {
  const overlaps = (start: number, end: number) =>
    start >= from - 0.01 && end <= to + 0.01;
  // Đếm theo MỐC của phần tử, không tra ngược ra hai đầu từ: chữ tự do không có
  // mã từ nào, mà bỏ đoạn chứa nó thì nó cũng không vào video như mọi thứ khác.
  // Tra theo mã từ là nó không được đếm, và lời cảnh báo trước khi bỏ đoạn nói
  // thiếu đúng những thứ người dùng vừa đặt tay.
  const textCount = data.textElements.filter((item) =>
    overlaps(item.start, item.end),
  ).length;
  const insertCount = data.inserts.filter((item) =>
    overlaps(item.start, item.end),
  ).length;
  return textCount + insertCount;
}

export function useEditor(projectId: string | undefined) {
  const [data, setData] = useState<ReturnType<typeof shape> | null>(null);
  // Bản mới nhất của `data` để đọc trong các hàm callback: đọc từ closure thì có
  // thể là bản của lượt dựng trước.
  const dataRef = useRef<ReturnType<typeof shape> | null>(null);
  dataRef.current = data;
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  /**
   * Vạch chạy, đọc được từ trong các hàm gọi lại mà không phải cho `time` vào
   * danh sách phụ thuộc — cho vào thì mọi hàm ấy dựng lại mỗi khung hình lúc
   * đang phát.
   */
  const timeRef = useRef(time);
  timeRef.current = time;
  /** Cầu nối tới `toOutput`/`toSource` cho những hàm khai TRƯỚC chúng. */
  const timeMapRef = useRef({
    toOutput: (at: number) => at,
    toSource: (at: number) => at,
  });
  const [pxPerSecond, setPxPerSecond] = useState(DEFAULT_PX_PER_SECOND);
  const [selection, setSelection] = useState<Selection>(null);
  const [exportJob, setExportJob] = useState<{
    status: string;
    message: string;
  } | null>(null);
  const durationRef = useRef(0);
  /**
   * Số giây dải ảnh biểu diễn — thang để vẽ nó lên dải thời gian.
   *
   * Trước đây chỗ vẽ ghi cứng 1000 giây, trong khi ảnh chỉ dài bằng video: dải
   * bị kéo giãn hàng chục lần nên khung hình nào cũng nhoè. Con số này phải lấy
   * từ đúng lần dựng ảnh, không đoán.
   */
  const [strip, setStrip] = useState<{
    seconds: number;
    native: number;
  } | null>(null);
  /** Đường bao âm lượng để vẽ dải sóng; `null` khi chưa lấy được. */
  const [envelope, setEnvelope] = useState<AudioEnvelope | null>(null);

  /**
   * Đường bao âm lượng — lấy một lần cho mỗi dự án.
   *
   * Hỏng thì im lặng bỏ qua: dải sóng là thứ đọc thêm, mất nó thì bàn dựng vẫn
   * làm việc được, mà một lời báo lỗi đỏ cho chuyện này chỉ là tiếng ồn.
   */
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    api
      .getEnvelope(projectId)
      .then((data) => alive && setEnvelope(data))
      .catch(() => alive && setEnvelope(null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    api
      .getProject(projectId)
      .then((project) => {
        if (!alive) return;
        const shaped = shape(project);
        durationRef.current = shaped.duration;
        setData(shaped);

        /*
         * Đọc lại TRẠNG THÁI XUẤT từ máy chủ khi mở bàn dựng.
         *
         * `exportJob` vốn chỉ được đặt lúc người dùng bấm nút, nên tải lại trang
         * là nó về rỗng và nút quay lại thành "Xuất video" — dù bản dựng vẫn nằm
         * nguyên trên đĩa. Người dùng không có cách nào biết, nên họ bấm, và chờ
         * thêm cả phút cho một tệp đã có sẵn.
         *
         * Cũng nhặt lại việc đang CHẠY DỞ: đóng tab giữa lúc xuất rồi mở lại thì
         * vòng theo dõi tiến độ bên dưới bắt nhịp tiếp, thay vì đứng im.
         */
        const job = project.jobs?.find((item) => item.kind === "export");
        if (job && (job.status === "done" || job.status === "running")) {
          setExportJob({ status: job.status, message: job.message ?? "" });
        }
        // Dự án dựng bằng bản cũ không ghi lại thang của dải ảnh. Dựng lại một
        // lần ngay tại đây: vừa có con số đúng, vừa lên được bản 2× cho màn
        // Retina. Hỏng thì thôi — bên dưới còn cách suy ra từ thời lượng.
        if (project.project.strip_seconds) {
          setStrip({
            seconds: project.project.strip_seconds,
            native:
              project.project.strip_native_second_width ??
              DEFAULT_PX_PER_SECOND,
          });
        } else if (
          // Chỉ dựng lại khi dự án ĐÃ ghép — dải ảnh cắt từ `base.mp4`, mà tệp
          // đó chỉ có sau bước chép lời. Dự án còn dở dang thì máy chủ trả 409
          // và người dùng nhận một lời báo lỗi đỏ ngay khi vừa mở màn, cho một
          // việc họ không hề làm.
          project.project.status === "ready" &&
          project.files.some((file) => file.role === "main")
        ) {
          void api
            .rebuildFilmstrip(project.project.id)
            .then(
              (next) =>
                alive &&
                setStrip({
                  seconds: next.seconds,
                  native: next.nativeSecondWidth,
                }),
            )
            .catch(boQuaLoi());
        }
        setStylePackState(findStylePack(project.project.style_pack).id);
        setEffectsStylePack(project.project.effects_style_pack ?? null);
        // Giá trị cũ vẫn đọc được: 1 và "in" đều là nhấn zoom vào.
        const raw = project.project.zoom_punch;
        setZoomPunchState(
          raw === "in" || raw === 1 || raw === "1"
            ? "zoom-in"
            : raw === "out"
              ? "zoom-out"
              : ["zoom-in", "zoom-out", "flash", "dip"].includes(String(raw))
                ? (raw as JunctionId)
                : "none",
        );
      })
      .catch((cause: Error) => alive && setError(cause.message));
    return () => {
      alive = false;
    };
  }, [projectId]);

  /**
   * Mốc gốc CAO NHẤT mà vạch được phép đứng.
   *
   * Bằng thời lượng gốc, TRỪ khi đuôi video đã bị bỏ — lúc đó là giây cuối cùng
   * còn vào video. Không kẹp ở đây thì mọi cú kéo/lăn đều đưa vạch vào quãng bỏ
   * ở đuôi rồi bị đẩy ngược ra, và hai bên tranh nhau mỗi khung hình: khung xem
   * chớp nháy liên tục giữa hình thật và chữ "Đoạn này đã bỏ".
   *
   * Chặn ở KHÂU TÍNH thay vì chữa ở khâu hiển thị: đó là chỗ duy nhất mọi đường
   * tua đều đi qua.
   */
  const maxSeekRef = useRef(0);

  const seek = useCallback(
    (next: number) =>
      setTime(Math.min(Math.max(next, 0), maxSeekRef.current || 0)),
    [],
  );

  /**
   * Lăn chuột chạy dải — đi theo giờ XUẤT RA, không phải giờ gốc.
   *
   * Cùng lý do với kéo tay (`use-timeline-drag.ts`): dải vẽ theo giờ xuất ra,
   * nên lăn `deltaX` pixel là đi `deltaX` giây xuất ra. Cộng vào giờ gốc thì
   * vạch chui vào những quãng đã bỏ rồi bị đẩy ra, và nó nhấp nháy ở mọi chỗ cắt.
   *
   * Qua ref vì `toOutput`/`toSource` khai sau chỗ này.
   */
  const scrubByPixels = useCallback(
    (deltaX: number) =>
      setTime((current) => {
        const timeMap = timeMapRef.current;
        const next = timeMap.toSource(
          timeMap.toOutput(current) - deltaX / pxPerSecond,
        );
        return Math.min(Math.max(next, 0), maxSeekRef.current || 0);
      }),
    [pxPerSecond],
  );

  /** Về thang gốc — lối thoát khi phóng quá đà, thay cho Cmd+0 của trình duyệt. */
  const resetZoom = useCallback(
    () => setPxPerSecond(DEFAULT_PX_PER_SECOND),
    [],
  );

  const zoomBy = useCallback((factor: number) => {
    setPxPerSecond((current) =>
      Math.min(
        Math.max(current * factor, MIN_PX_PER_SECOND),
        MAX_PX_PER_SECOND,
      ),
    );
  }, []);

  /**
   * Ngăn hoàn tác lưu DỮ LIỆU, không lưu hàm.
   *
   * Đóng tab rồi mở lại mà mất hết hoàn tác là thứ người dùng không tha — họ
   * vừa gạch nhầm mười câu. Hàm thì không cất vào `localStorage` được, nên mỗi
   * mục chỉ ghi "đã làm gì với cái gì", còn cách đảo ngược tra ở `undo`.
   */
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const undoLabel = undoStack.at(-1)?.label ?? null;
  const storageKey = projectId ? `teddit-undo-${projectId}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setUndoStack(JSON.parse(saved) as UndoEntry[]);
    } catch {
      /* dữ liệu cũ hỏng thì bỏ, đừng để nó chặn cả màn hình */
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: UndoEntry[]) => {
      if (!storageKey) return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* hết chỗ lưu thì thôi, hoàn tác trong phiên vẫn chạy */
      }
    },
    [storageKey],
  );

  const pushUndo = useCallback(
    (entry: UndoEntry) => {
      setUndoStack((current) => {
        // Giữ 50 bước gần nhất: đủ xa để yên tâm, đủ nhỏ để không phình bộ nhớ.
        const next = [...current, entry].slice(-50);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  // `undo` khai báo trước `applySegments`, mà const không hoisted — lấy qua ref.
  const applySegmentsRef = useRef<(rows: ApiSegment[]) => void>(() => {});

  const undo = useCallback(async () => {
    const last = undoStack.at(-1);
    if (!last) return;
    const next = undoStack.slice(0, -1);
    setUndoStack(next);
    persist(next);

    if (last.type === "cut") {
      for (const id of last.segmentIds) {
        await api.updateSegment(id, { removed: false }).catch(boQuaLoi());
      }
      const rows = await api.listSegments(projectId ?? "").catch(() => null);
      if (rows) applySegmentsRef.current(rows);
      return;
    }
    if (last.type === "segment") {
      await api.updateSegment(last.segmentId, { removed: last.wasRemoved });
      setData((current) =>
        current
          ? {
              ...current,
              segments: current.segments.map((item) =>
                item.id === last.segmentId
                  ? { ...item, removed: last.wasRemoved }
                  : item,
              ),
            }
          : current,
      );
      return;
    }
    if (last.type === "trim") {
      await api
        .updateSegment(last.segmentId, { edge: last.edge, at: last.at })
        .catch(boQuaLoi());
      const rows = await api.listSegments(projectId ?? "").catch(() => null);
      if (rows) applySegmentsRef.current(rows);
      return;
    }
    if (last.type === "split") {
      const rows = await api.mergeSegment(last.segmentId).catch(() => null);
      if (rows) applySegmentsRef.current(rows);
      return;
    }
    if (last.type === "sentence") {
      await api.setSentenceRemoved(last.sentenceId, last.wasRemoved);
      setData((current) =>
        current
          ? {
              ...current,
              sentences: current.sentences.map((item) =>
                item.id === last.sentenceId
                  ? { ...item, removed: last.wasRemoved }
                  : item,
              ),
            }
          : current,
      );
      return;
    }
    if (last.type === "captions") {
      for (const id of last.elementIds) {
        await api.deleteElement(id).catch(boQuaLoi());
      }
      setData((current) =>
        current
          ? {
              ...current,
              textElements: current.textElements.filter(
                (item) => !last.elementIds.includes(item.id),
              ),
            }
          : current,
      );
      setSelection(null);
      return;
    }
    if (last.type === "effect") {
      // Một nhánh cho cả thêm / xoá / đổi kiểu / kéo quãng: cả bốn đều là
      // "hàng này trước đó trông ra sao", và `was === null` là "chưa có gì".
      if (last.was) {
        await api
          .setEffect(projectId ?? "", last.effectId, last.was)
          .catch(boQuaLoi());
      } else {
        await api
          .deleteEffect(projectId ?? "", last.effectId)
          .catch(boQuaLoi());
      }
      setData((current) => {
        if (!current) return current;
        const con = current.manualEffects.filter(
          (item) => item.id !== last.effectId,
        );
        return {
          ...current,
          manualEffects: last.was
            ? [...con, { id: last.effectId, ...last.was }]
            : con,
        };
      });
      return;
    }
    if (last.type === "text-trim") {
      await api
        .updateElement(
          last.elementId,
          last.edge === "start" ? { start: last.at } : { end: last.at },
        )
        .catch(boQuaLoi());
      setData((current) =>
        current
          ? {
              ...current,
              textElements: current.textElements.map((item) =>
                item.id === last.elementId
                  ? last.edge === "start"
                    ? { ...item, start: last.at }
                    : { ...item, end: last.at }
                  : item,
              ),
            }
          : current,
      );
      return;
    }
    if (last.type === "insert-trim") {
      await api
        .updateElement(
          last.elementId,
          last.edge === "start"
            ? { fromWordId: last.wordId }
            : { toWordId: last.wordId },
        )
        .catch(boQuaLoi());
      const fresh = await api.getProject(projectId ?? "").catch(() => null);
      if (fresh) {
        const shaped = shape(fresh);
        durationRef.current = shaped.duration;
        setData(shaped);
      }
      return;
    }
    if (last.type === "music-trim") {
      const row = await api
        .updateMusic(
          last.trackId,
          last.edge === "start" ? { start: last.at } : { end: last.at },
        )
        .catch(() => null);
      if (row) {
        setData((current) =>
          current
            ? {
                ...current,
                music: current.music.map((item) =>
                  item.id === row.id ? toMusicTrack(row) : item,
                ),
              }
            : current,
        );
      }
      return;
    }
    if (last.type === "music-restore") {
      const row = await api
        .restoreMusic(projectId ?? "", last.track)
        .catch(() => null);
      if (row) {
        setData((current) =>
          current
            ? { ...current, music: [...current.music, toMusicTrack(row)] }
            : current,
        );
      }
      return;
    }
    if (last.type === "restore") {
      const original = last.element;
      const created = await api
        .createElement(projectId ?? "", {
          kind: original.kind,
          // Neo theo TỪ hay theo GIỜ — gửi đúng một kiểu, máy chủ từ chối nếu
          // thiếu cả hai.
          ...(original.fromWordId
            ? { fromWordId: original.fromWordId, toWordId: original.toWordId }
            : { start: original.start, end: original.end }),
          content: original.content,
          band: original.band,
          mediaFileId: original.mediaFileId,
        })
        .catch(() => null);
      if (created) {
        // Kiểu dáng nằm ở lệnh sửa riêng, không nhét được vào lệnh tạo.
        await api
          .updateElement(created.id, {
            align: original.align,
            emphasis: original.emphasis,
            reveal: original.reveal,
            shape: original.shape,
            keywords: original.keywords,
          })
          .catch(boQuaLoi());
        const fresh = await api.getProject(projectId ?? "").catch(() => null);
        if (fresh) {
          const shaped = shape(fresh);
          durationRef.current = shaped.duration;
          setData(shaped);
        }
      }
      return;
    }
    await api.deleteElement(last.elementId).catch(boQuaLoi());
    setData((current) =>
      current
        ? {
            ...current,
            textElements: current.textElements.filter(
              (item) => item.id !== last.elementId,
            ),
            inserts: current.inserts.filter(
              (item) => item.id !== last.elementId,
            ),
          }
        : current,
    );
  }, [undoStack, persist]);

  /**
   * Bỏ một quãng theo giây, không theo câu.
   *
   * Cần riêng vì bản chép lời không với tới chỗ KHÔNG có từ nào — hít thở, im
   * lặng, tiếng ồn nền đều nằm giữa hai từ. Nhưng làm bằng ĐOẠN: máy chủ tách hai
   * đầu rồi bỏ đoạn giữa, nên chỉ có một cơ chế để hiểu và một chỗ để lấy lại.
   */
  const cutRange = useCallback(
    async (start: number, end: number) => {
      if (!projectId || !(end > start)) return;
      const before = new Set(
        (dataRef.current?.segments ?? [])
          .filter((item) => item.removed)
          .map((item) => item.id),
      );
      const rows = await api.removeRange(projectId, start, end);
      applySegmentsRef.current(rows);
      const added = rows
        .filter((row) => row.removed === 1 && !before.has(row.id))
        .map((row) => row.id);
      pushUndo({ type: "cut", label: "Bỏ một quãng", segmentIds: added });
    },
    [projectId, pushUndo],
  );

  /**
   * Đặt một bài nhạc mới TẠI VẠCH, rồi chọn nó luôn để sửa được ngay.
   *
   * Trước đây bài mới phủ cả video. Đúng cho bài đầu tiên, sai cho mọi bài sau:
   * muốn mỗi đoạn một bài khác nhau thì bài nào cũng bắt đầu ở giây 0 rồi đè lên
   * nhau. Máy chủ lo phần không cho chồng (xem `addMusic`).
   */
  const attachMusic = useCallback(
    async (file: File) => {
      if (!projectId) return;
      const row = await api.uploadMusic(projectId, file, timeRef.current);
      setData((current) =>
        current
          ? { ...current, music: [...current.music, toMusicTrack(row)] }
          : current,
      );
      setSelection({ kind: "music", id: row.id });
    },
    [projectId],
  );

  /**
   * Đặt một bài TỪ KHO DÙNG CHUNG vào dải, tại vạch.
   *
   * Khác `attachMusic` ở trên: cái kia nhận một `File` từ máy người dùng rồi tải
   * lên dự án. Ở đây tệp đã nằm sẵn trên máy chủ, nên chỉ gửi TÊN — không gửi
   * đường dẫn, vì đường dẫn do client đặt là một cửa trỏ vào bất kỳ tệp nào.
   */
  const addMusicFromLibrary = useCallback(
    async (file: string) => {
      if (!projectId) return;
      try {
        const row = await api.addMusicFromLibrary(
          projectId,
          file,
          timeRef.current,
        );
        setData((current) =>
          current
            ? { ...current, music: [...current.music, toMusicTrack(row)] }
            : current,
        );
        setSelection({ kind: "music", id: row.id });
      } catch (loi) {
        // Chỗ này hay hỏng vì một lý do CÓ THẬT và sửa được: vạch đang đứng trong
        // khoảng một bài khác. Nói ra thì người dùng dời vạch rồi bấm lại.
        toast.add({
          title:
            loi instanceof ApiError && loi.status === 409
              ? "Chỗ này đã có nhạc — dời vạch rồi thử lại"
              : "Không đặt được bài này",
          type: "error",
        });
      }
    },
    [projectId],
  );

  const setMusicVolume = useCallback((id: string, volume: number) => {
    // Đổi trên màn NGAY: kéo thanh âm lượng mà phải chờ mạng từng nấc thì không
    // canh được, mà việc này gần như không bao giờ hỏng.
    setData((current) =>
      current
        ? {
            ...current,
            music: current.music.map((item) =>
              item.id === id ? { ...item, volume } : item,
            ),
          }
        : current,
    );
    void api.updateMusic(id, { volume }).catch(boQuaLoi());
  }, []);

  const removeMusic = useCallback(async (id: string) => {
    const track = dataRef.current?.music.find((item) => item.id === id);
    setData((current) =>
      current
        ? { ...current, music: current.music.filter((item) => item.id !== id) }
        : current,
    );
    setSelection(null);
    await api.deleteMusic(id).catch(boQuaLoi());
    if (track) {
      pushUndoRef.current({
        type: "music-restore",
        label: "Gỡ nhạc nền",
        track: {
          id: track.id,
          position: track.position,
          name: track.name,
          storedPath: track.storedPath,
          start: track.start,
          end: track.end,
          volume: track.volume,
        },
      });
    }
  }, []);

  /** Cập nhật màn hình NGAY rồi mới gọi máy chủ: chờ mạng cho một cú gạch chữ
   *  làm giao diện có cảm giác đơ, mà việc này gần như không bao giờ hỏng. */
  // `toggleSentence` không phụ thuộc gì để khỏi dựng lại mỗi lần gõ, nên lấy
  // `pushUndo` qua ref để luôn gọi bản mới nhất.
  const pushUndoRef = useRef(pushUndo);
  pushUndoRef.current = pushUndo;

  /**
   * Đếm chữ và tư liệu neo vào khoảng thời gian này.
   *
   * Dùng cho lời cảnh báo trước/sau khi bỏ: phần tử neo vào TỪ, nên bỏ câu hay bỏ
   * đoạn chứa nó thì nó không còn chỗ nào để hiện và bị bỏ luôn lúc dựng.
   */
  const toggleSentence = useCallback((id: string) => {
    setData((current) => {
      if (!current) return current;
      const sentences = current.sentences.map((item) =>
        item.id === id ? { ...item, removed: !item.removed } : item,
      );
      const target = sentences.find((item) => item.id === id);
      if (target) {
        const nowRemoved = Boolean(target.removed);
        void api.setSentenceRemoved(id, nowRemoved).catch(boQuaLoi());
        // Chữ và tư liệu NEO VÀO TỪ của câu, nên bỏ câu là chúng cũng biến mất.
        // Im lặng thì người dùng tưởng mình vừa mất công đặt chữ vô ích: nói ngay,
        // và nói bao nhiêu cái.
        if (nowRemoved) {
          const held = demElement(current, target.start, target.end);
          if (held > 0) {
            toast.add({
              title: `Đã bỏ câu — ${held} thứ neo vào đây cũng mất`,
              description: "Hoàn tác thì chúng quay lại",
              type: "info",
            });
          }
        }
        pushUndoRef.current({
          type: "sentence",
          label: nowRemoved ? "Bỏ một câu" : "Giữ lại một câu",
          sentenceId: id,
          wasRemoved: !nowRemoved,
        });
      }
      return { ...current, sentences };
    });
  }, []);

  /**
   * Sửa lời chép sai.
   *
   * CHỈ đổi chữ, không đụng vào mốc thời gian của câu hay của từng từ: máy nghe
   * nhầm "chạm" thành "chọn" thì chữ sai chứ mốc vẫn đúng, sửa mốc theo là làm
   * trôi mọi phần tử neo vào đó.
   */
  const updateSentenceText = useCallback((id: string, text: string) => {
    setData((current) =>
      current
        ? {
            ...current,
            sentences: current.sentences.map((item) =>
              item.id === id ? { ...item, text } : item,
            ),
          }
        : current,
    );
    void api.setSentenceText(id, text).catch(boQuaLoi());
  }, []);

  /**
   * Dời một phần tử sang câu liền trước hoặc liền sau.
   *
   * Đặt nhầm câu là lỗi thao tác thường gặp nhất — vạch đang ở đâu thì chữ gắn
   * vào đó, mà vạch lệch một câu là chuyện dễ xảy ra. Không có đường dời thì cách
   * duy nhất là xoá rồi làm lại, mất luôn kiểu căn, kiểu nhấn và từ khoá.
   */
  const moveElement = useCallback(
    async (id: string, direction: -1 | 1) => {
      const current = dataRef.current;
      if (!current || !projectId) return;
      const element = current.textElements.find((item) => item.id === id);
      const insert = current.inserts.find((item) => item.id === id);
      const anchor = element?.fromWordId ?? insert?.fromWordId;
      if (!anchor) return;
      const sentenceId = current.wordsById.get(anchor)?.sentenceId;
      const i = current.sentences.findIndex((item) => item.id === sentenceId);
      const shift = current.sentences[i + direction];
      if (!shift) return;
      await api.updateElement(id, { sentenceId: shift.id }).catch(boQuaLoi());
      const fresh = await api.getProject(projectId).catch(() => null);
      if (fresh) {
        const shaped = shape(fresh);
        durationRef.current = shaped.duration;
        setData(shaped);
      }
    },
    [projectId],
  );

  /**
   * Đổi KIỂU DÁNG một chữ — ghi thẳng, mỗi lần bấm là một lựa chọn dứt khoát.
   *
   * Nội dung KHÔNG đi đường này (xem `draftTextContent` / `commitTextContent`):
   * ghi nội dung là ghi ngược cả vào lời chép, mà gõ dở nửa chừng thì lời chép
   * sẽ nhận đúng cái nửa chừng đó.
   */
  const updateTextElement = useCallback(
    (id: string, patch: Partial<TextElement>) => {
      setData((current) => {
        if (!current) return current;
        void api
          .updateElement(id, {
            band: patch.position,
            align: patch.align,
            emphasis: patch.emphasis,
            keywords: patch.keywords,
            // `null` phải đi qua được: nó nghĩa là BỎ ĐÈ, quay về theo bộ dáng.
            // Dùng `??` ở đây là nuốt mất chính cái ý đó.
            letterCase: patch.letterCase,
            keyColor: patch.keyColor,
          })
          .catch(boQuaLoi());
        return {
          ...current,
          textElements: current.textElements.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        };
      });
    },
    [],
  );

  /** Gõ tới đâu thấy tới đó — chỉ đổi trên màn, chưa ghi xuống máy chủ. */
  const draftTextContent = useCallback((id: string, content: string) => {
    setData((current) =>
      current
        ? {
            ...current,
            textElements: current.textElements.map((item) =>
              item.id === id ? { ...item, content } : item,
            ),
          }
        : current,
    );
  }, []);

  /**
   * Chốt nội dung một chữ: ghi xuống máy chủ rồi NẠP LẠI dự án.
   *
   * Phải nạp lại vì máy chủ có thể sửa cả lời chép theo (khi số tiếng khớp) —
   * không nạp thì bảng từ trên màn còn giữ lời cũ, và mọi thứ suy từ nó (gạch
   * chấm "nghe không chắc", nhịp từng tiếng, lần sinh chữ sau) đều nói ngược.
   */
  const commitTextContent = useCallback(
    async (id: string, content: string) => {
      if (!projectId) return;
      await api.updateElement(id, { content }).catch(boQuaLoi());
      const fresh = await api.getProject(projectId).catch(() => null);
      if (fresh) {
        const shaped = shape(fresh);
        durationRef.current = shaped.duration;
        setData(shaped);
      }
    },
    [projectId],
  );

  /**
   * Nhập cụm chữ này với cụm NGAY SAU nó thành một.
   *
   * Vì sao cần: máy chép lời cắt cụm theo nhịp nói, mà một cái tên nước ngoài
   * thường bị nghe thành hai ba tiếng rời — "TensorLab" ra "Tenso" rồi "Lab",
   * và hai tiếng đó rơi vào HAI cụm khác nhau. Sửa từng cụm thì không bao giờ
   * ghép chúng lại được: cụm trước thành "…tên là TensorLab", cụm sau vẫn còn
   * một chữ "Lab" trơ ra trên màn. Không có việc này thì lối duy nhất là sửa
   * cụm trước rồi XOÁ cụm sau — hai thao tác cho một ý, và người dùng phải tự
   * nghĩ ra.
   *
   * Gộp là: cụm này nới mép cuối tới hết cụm sau, nội dung nối lại, cụm sau
   * biến mất. Lời chép bên dưới KHÔNG đụng tới — số tiếng vẫn khớp nên nó vẫn
   * là thứ người ta đã nói.
   */
  /**
   * Đổi tên dự án.
   *
   * Đổi ngay trên màn rồi mới ghi xuống — như mọi thao tác khác của bàn dựng.
   * Tên rỗng thì để máy chủ quyết (nó trả về "Dự án mới"), đừng tự bịa ở đây:
   * hai nơi cùng đặt một giá trị mặc định là hai chỗ để chúng lệch nhau.
   */
  const renameProject = useCallback(
    async (title: string) => {
      if (!projectId) return;
      setData((current) => (current ? { ...current, title } : current));
      const saved = await api
        .updateProject(projectId, { title })
        .catch(boQuaLoi());
      if (saved) {
        setData((current) =>
          current ? { ...current, title: saved.title } : current,
        );
      }
    },
    [projectId],
  );

  /**
   * Chẻ một cụm chữ làm đôi — việc đối xứng với `mergeTextWithNext`.
   *
   * Gộp mà không tách được thì cú gộp là một chiều: nhập hai cụm lại rồi thấy
   * dài quá cũng không lùi được, ngoài đường hoàn tác một bước. Và cụm dài còn
   * sinh ra từ chỗ khác nữa — người dùng tự gõ thêm chữ vào một cụm ngắn.
   *
   * Chẻ ở giữa DANH SÁCH TỪ, không ở giữa chuỗi chữ: mỗi nửa phải neo được vào
   * từ đầu và từ cuối của chính nó, mà chữ thì có thể đã viết lại nên không còn
   * ứng một-một với lời. Chữ chia theo cùng tỉ lệ — thô nhưng luôn cho ra hai
   * nửa hợp lệ, và người dùng sửa lại từng nửa ngay tại chỗ.
   */
  const splitTextElement = useCallback(
    async (id: string) => {
      const current = dataRef.current;
      if (!projectId || !current) return;
      const chu = current.textElements.find((item) => item.id === id);
      if (!chu || chu.byTime) return;

      const inside = current.words
        .filter(
          (word) =>
            word.start >= chu.start - 0.01 && word.end <= chu.end + 0.01,
        )
        .sort((a, b) => a.start - b.start);
      if (inside.length < 2) return;

      const mid = Math.ceil(inside.length / 2);
      const syllables = chu.content.trim().split(/\s+/).filter(Boolean);
      // Chỗ chẻ chữ suy theo TỈ LỆ số từ, và luôn để mỗi nửa ít nhất một tiếng.
      const cut = Math.min(
        Math.max(1, Math.round((syllables.length * mid) / inside.length)),
        Math.max(1, syllables.length - 1),
      );

      await api
        .updateElement(id, {
          toWordId: inside[mid - 1].id,
          content: syllables.slice(0, cut).join(" "),
        })
        .catch(boQuaLoi());
      const created = await api
        .createElement(projectId, {
          kind: "text",
          fromWordId: inside[mid].id,
          toWordId: inside[inside.length - 1].id,
          content: syllables.slice(cut).join(" ") || inside[mid].text,
          band: chu.position,
        })
        .catch(boQuaLoi());

      if (created) {
        pushUndoRef.current({
          type: "element",
          label: "Tách chữ",
          elementId: created.id,
        });
      }
      const fresh = await api.getProject(projectId).catch(() => null);
      if (fresh) {
        const shaped = shape(fresh);
        durationRef.current = shaped.duration;
        setData(shaped);
      }
      setSelection({ kind: "text", id });
    },
    [projectId],
  );

  /**
   * Lấy kiểu của MỘT cụm làm kiểu chung cho mọi chữ chạy theo lời.
   *
   * Đo trên một dự án thật: 82–90% cụm giữ nguyên mặc định ở cả ba trục. Người
   * dùng không sửa từng cụm — họ muốn đổi phong cách cả video, mà bảng sửa chỉ
   * sửa được một cụm nên việc đó là năm chục cú bấm y hệt nhau.
   *
   * Nạp lại sau khi ghi thay vì tự đoán trạng thái mới: máy chủ là nơi quyết
   * định cụm nào nằm trong phạm vi (chữ tự do thì không), đoán ở đây là hai nơi
   * cùng giữ một luật.
   */
  const applyTextStyleToAll = useCallback(
    async (style: { band?: string; align?: string; emphasis?: string }) => {
      if (!projectId) return 0;
      const saved = await api
        .applyTextStyleToAll(projectId, style)
        .catch(boQuaLoi());
      const fresh = await api.getProject(projectId).catch(() => null);
      if (fresh) {
        const shaped = shape(fresh);
        durationRef.current = shaped.duration;
        setData(shaped);
      }
      return saved?.changed ?? 0;
    },
    [projectId],
  );

  const mergeTextWithNext = useCallback(
    async (id: string) => {
      const current = dataRef.current;
      if (!projectId || !current) return;
      const element = current.textElements.find((item) => item.id === id);
      if (!element || element.byTime) return;
      // Cụm KẾ TIẾP theo thời gian, và phải là chữ chạy theo lời như nó: chữ tự
      // do neo theo giây, gộp vào đây là trộn hai loại neo khác nhau.
      const next = current.textElements
        .filter((item) => !item.byTime && item.start >= element.end - 0.001)
        .sort((a, b) => a.start - b.start)[0];
      if (!next) return;

      const content = `${element.content} ${next.content}`
        .replace(/\s+/g, " ")
        .trim();
      pushUndoRef.current({
        type: "restore",
        label: "Gộp chữ",
        element: {
          kind: "text",
          fromWordId: next.fromWordId,
          toWordId: next.toWordId,
          content: next.content,
          band: next.position,
          align: next.align,
          emphasis: next.emphasis,
          keywords: next.keywords,
        },
      });

      await api.deleteElement(next.id).catch(boQuaLoi());
      await api
        .updateElement(id, { toWordId: next.toWordId, content: content })
        .catch(boQuaLoi());

      // Nạp lại: mép mới của cụm kéo theo cả nhịp hiện từng tiếng lẫn ranh giới
      // đoạn mà chữ được phép nằm trên.
      const fresh = await api.getProject(projectId).catch(() => null);
      if (fresh) {
        const shaped = shape(fresh);
        durationRef.current = shaped.duration;
        setData(shaped);
      }
      setSelection({ kind: "text", id });
    },
    [projectId],
  );

  /**
   * Thêm chữ cho câu đang ở vạch giữa.
   *
   * Neo vào KHOẢNG TỪ của chính câu đó chứ không neo vào giây hiện tại: gạch bỏ
   * một câu phía trước thì chữ này vẫn dính đúng chỗ mà không phải tính lại.
   */
  /**
   * Đặt một khối CHỮ TỰ DO ngay tại vạch — tiêu đề, con số, nhãn.
   *
   * Neo theo GIỜ, không theo từ. Nó không chép lời ai cả, nên bắt nó chọn một
   * câu là bịa ra một quan hệ không có thật — mà bản cũ làm đúng thế: tìm câu ở
   * vạch, ôm cả câu, mồi nội dung bằng chính lời câu đó rồi kéo vạch về đầu câu.
   * Bốn bước ấy chỉ để trả lời một câu hỏi mà chữ tự do không hề đặt ra.
   *
   * Nội dung để RỖNG. Mồi sẵn lời của câu thì nút này chỉ nhân đôi câu đang
   * đứng — thêm vào mà không khác gì, đúng như người dùng đã kêu.
   *
   * Vạch KHÔNG nhúc nhích: bạn đặt chữ ở đâu thì đứng nguyên ở đó mà gõ.
   */
  const addTextAtPlayhead = useCallback(async () => {
    if (!projectId || !data) return;
    const end = Math.min(time + TEXT_DEFAULT_LENGTH, data.duration);
    if (end - time < MIN_TEXT_LENGTH) return;

    const created = await api.createElement(projectId, {
      kind: "text",
      start: time,
      end,
      content: "",
      band: "top",
    });

    setData((current) =>
      current
        ? {
            ...current,
            textElements: [
              ...current.textElements,
              {
                id: created.id,
                fromWordId: "",
                toWordId: "",
                byTime: true,
                start: created.start_sec ?? time,
                end: created.end_sec ?? end,
                content: "",
                position: (created.position_band ??
                  "top") as TextElementPosition,
                // Chữ mới: căn giữa, cỡ đều — dáng an toàn nhất, đổi sau bằng
                // hai hộp chọn ở khung bên phải.
                align: "center",
                emphasis: "even",
                keywords: [],
                letterCase: null,
                keyColor: null,
              },
            ],
          }
        : current,
    );
    setSelection({ kind: "text", id: created.id });
  }, [projectId, data, time]);

  /**
   * Đặt một CÂU MỞ neo vào mấy tiếng đầu video.
   *
   * Ở `useEditor` chứ không ở màn "3 giây đầu": mọi lần thêm phần tử đều phải
   * cập nhật `data` ngay sau khi máy chủ nhận, không thì chữ mới không hiện ra
   * cho tới lúc tải lại trang — người dùng bấm "Dùng câu này" và tưởng hỏng.
   * Đó là việc của tệp giữ state, không phải của một Dialog.
   */
  const addOpeningText = useCallback(
    async (content: string) => {
      if (!projectId || !data) return;
      const span = data.words.slice(0, Math.min(8, data.words.length));
      if (span.length === 0) return;

      const created = await api.createElement(projectId, {
        kind: "text",
        // Neo vào KHOẢNG TỪ, không neo vào giây: bỏ một câu phía trước thì câu
        // mở vẫn dính đúng chỗ. Nhờ vậy nó cũng không bao giờ hiện trước lúc có
        // tiếng nói đầu tiên.
        fromWordId: span[0].id,
        toWordId: span[span.length - 1].id,
        content,
        band: "middle",
      });

      setData((current) =>
        current
          ? {
              ...current,
              textElements: [
                ...current.textElements,
                {
                  id: created.id,
                  fromWordId: span[0].id,
                  toWordId: span[span.length - 1].id,
                  byTime: false,
                  start: span[0].start,
                  end: span[span.length - 1].end,
                  content,
                  position: "middle" as TextElementPosition,
                  align: "center",
                  emphasis: "even",
                  keywords: [],
                  letterCase: null,
                  keyColor: null,
                },
              ],
            }
          : current,
      );
      setSelection({ kind: "text", id: created.id });
    },
    [projectId, data],
  );

  /** Chèn tư liệu vào câu đang ở vạch giữa. */
  const addInsertAtPlayhead = useCallback(
    async (mediaFileId: string) => {
      if (!projectId || !data) return;
      const sentence =
        data.sentences.find((item) => time >= item.start && time < item.end) ??
        data.sentences[0];
      if (!sentence) return;
      const words = data.words.filter(
        (word) => word.sentenceId === sentence.id,
      );
      if (words.length === 0) return;

      const created = await api.createElement(projectId, {
        kind: "insert",
        fromWordId: words[0].id,
        toWordId: words[words.length - 1].id,
        mediaFileId,
      });
      const file = data.insertLibrary.find((item) => item.id === mediaFileId);
      setData((current) =>
        current
          ? {
              ...current,
              inserts: [
                ...current.inserts,
                {
                  id: created.id,
                  start: words[0].start,
                  end: words[words.length - 1].end,
                  fromWordId: words[0].id,
                  toWordId: words[words.length - 1].id,
                  mediaFileId,
                  label: file
                    ? shortMediaLabel(
                        file.name,
                        current.insertLibrary.findIndex(
                          (item) => item.id === file.id,
                        ),
                      )
                    : "Tư liệu",
                  fullName: file?.name,
                  url: file ? api.mediaUrl(file.id) : undefined,
                  thumbUrl: file?.thumb_path
                    ? api.fileUrl(file.thumb_path)
                    : undefined,
                  isVideo: file?.kind !== "image",
                  // Tư liệu mới: cắt thẳng. Hiệu ứng là lựa chọn có ý thức.
                  reveal: "none",
                  // Tư liệu mới đè kín khung — dáng an toàn nhất, đổi sau ở khung
                  // bên phải.
                  shape: "full",
                },
              ],
            }
          : current,
      );
      setSelection({ kind: "insert", id: created.id });
    },
    [projectId, data, time],
  );

  const deleteElement = useCallback(async (id: string) => {
    // Chụp lại phần tử TRƯỚC khi xoá — sau khi xoá thì không còn gì để chụp.
    const previous = dataRef.current;
    const element = previous?.textElements.find((item) => item.id === id);
    const insert = previous?.inserts.find((item) => item.id === id);
    if (element) {
      pushUndoRef.current({
        type: "restore",
        label: "Xoá chữ",
        element: {
          kind: "text",
          fromWordId: element.fromWordId,
          toWordId: element.toWordId,
          // Chữ tự do không có mã từ; thiếu cặp giây này thì lệnh dựng lại
          // thiếu cả hai kiểu neo, máy chủ trả 400 và cú hoàn tác im lặng
          // không làm gì — xoá nhầm một tiêu đề là mất hẳn.
          ...(element.byTime ? { start: element.start, end: element.end } : {}),
          content: element.content,
          band: element.position,
          align: element.align,
          emphasis: element.emphasis,
          keywords: element.keywords,
        },
      });
    } else if (insert) {
      pushUndoRef.current({
        type: "restore",
        label: "Gỡ tư liệu",
        element: {
          kind: "insert",
          fromWordId: insert.fromWordId,
          toWordId: insert.toWordId,
          mediaFileId: insert.mediaFileId,
          reveal: insert.reveal,
          shape: insert.shape,
        },
      });
    }
    await api.deleteElement(id);
    setData((current) =>
      current
        ? {
            ...current,
            textElements: current.textElements.filter((item) => item.id !== id),
            inserts: current.inserts.filter((item) => item.id !== id),
          }
        : current,
    );
    setSelection(null);
  }, []);

  /** Tách đoạn tại vạch giữa — thay cho việc cắt bỏ cứng nửa giây. */
  const splitAtPlayhead = useCallback(async () => {
    if (!projectId) return;
    try {
      const rows = await api.splitSegment(projectId, time);
      applySegments(rows);
      // Ghi id đoạn MỚI để hoàn tác biết gộp cái nào trả lại: đoạn mới luôn là
      // cái nằm ngay sau mốc vừa tách.
      const created = rows.find((row) => Math.abs(row.start_sec - time) < 0.05);
      if (created) {
        pushUndo({ type: "split", label: "Tách đoạn", segmentId: created.id });
      }
    } catch {
      // Im lặng là sai: người dùng bấm mà không thấy gì thì tưởng nút hỏng.
      toast.add({
        title: "Chỗ này không tách được",
        description:
          "Vạch đang ở sát mép đoạn — kéo dải sang giữa đoạn rồi thử lại",
        type: "error",
      });
    }
  }, [projectId, time, pushUndo]);

  const toggleSegment = useCallback(
    async (id: string) => {
      if (!data) return;
      const target = data.segments.find((item) => item.id === id);
      if (!target) return;
      const next = !target.removed;
      setData((current) =>
        current
          ? {
              ...current,
              segments: current.segments.map((item) =>
                item.id === id ? { ...item, removed: next } : item,
              ),
            }
          : current,
      );
      await api.updateSegment(id, { removed: next });
      pushUndo({
        type: "segment",
        label: next ? "Bỏ một đoạn" : "Giữ lại một đoạn",
        segmentId: id,
        wasRemoved: !next,
      });
    },
    [data, pushUndo],
  );

  const applySegments = useCallback((rows: ApiSegment[]) => {
    setData((current) =>
      current
        ? {
            ...current,
            segments: rows.map((row) => ({
              id: row.id,
              start: row.start_sec,
              end: row.end_sec,
              label:
                row.label ??
                segmentLabel(row.start_sec, row.end_sec, current.textElements),
              removed: row.removed === 1,
            })),
          }
        : current,
    );
  }, []);

  applySegmentsRef.current = applySegments;

  /**
   * Gọt mép khối. Kéo thì chỉ đổi hình cho thấy ngay; ghi xuống máy chủ ở
   * `commitTrim` lúc thả tay — mỗi lần kéo bắn hàng chục sự kiện, ghi từng cái
   * là đẻ ra hàng chục đoạn cắt vụn.
   */
  const dragTrim = useRef<{
    /** Mỗi loại một đường ghi khác nhau */
    kind: "clip" | "music" | "insert" | "text" | "effect";
    id: string;
    edge: "start" | "end";
    /** Mốc mới của mép, chốt lúc thả tay */
    at: number;
    /** Mốc cũ, để hoàn tác */
    was: number;
    /** Tư liệu chèn neo vào TỪ, nên mép của nó là một mã từ chứ không phải giây */
    wordId?: string;
    wasWordId?: string;
    /**
     * Có mặt khi lần kéo này BIẾN một hiệu ứng tự suy thành hàng thật. Hoàn tác
     * lúc ấy phải XOÁ hàng đi chứ không phải trả mép về chỗ cũ — trả mép thì còn
     * lại một hàng thật trùng khít cái tự suy, nhìn không ra khác biệt mà lần
     * sau đổi mặc định dự án thì chỗ này trơ ra.
     */
    wasKind?: JunctionId;
  } | null>(null);

  const trim = useCallback(
    (
      kind: "clip" | "music" | "insert" | "text" | "effect",
      id: string,
      edge: "start" | "end",
      nextTime: number,
    ) => {
      setData((current) => {
        if (!current) return current;
        // Hiệu ứng kéo theo GIÂY như chữ tự do. Cái đang TỰ SUY ở vết cắt thì
        // lần kéo đầu tiên hoá nó thành hàng thật — không thì kéo xong buông
        // tay là nó về chỗ cũ, mà chẳng có gì giải thích.
        if (kind === "effect") {
          const manual = current.manualEffects.find((item) => item.id === id);
          const original =
            manual ?? effectsRef.current.find((item) => item.id === id) ?? null;
          if (!original) return current;
          const bounded =
            edge === "start"
              ? Math.min(
                  Math.max(nextTime, 0),
                  original.end - MIN_EFFECT_LENGTH,
                )
              : Math.max(nextTime, original.start + MIN_EFFECT_LENGTH);
          dragTrim.current = {
            kind: "effect",
            id,
            edge,
            at: bounded,
            was:
              dragTrim.current?.was ??
              (edge === "start" ? original.start : original.end),
            wasKind:
              dragTrim.current?.wasKind ?? (manual ? undefined : original.kind),
          };
          const next =
            edge === "start"
              ? { start: bounded, end: original.end }
              : { start: original.start, end: bounded };
          return {
            ...current,
            manualEffects: manual
              ? current.manualEffects.map((item) =>
                  item.id === id ? { ...item, ...next } : item,
                )
              : [
                  ...current.manualEffects,
                  { id, ...next, kind: original.kind },
                ],
          };
        }
        // Chữ TỰ DO kéo theo GIÂY, y như nhạc — nó không neo vào tiếng nào để
        // mà bám ranh giới từ. Chữ chép lời thì không có tay nắm (khoảng của nó
        // là khoảng của cụm lời), nên nhánh này chỉ chạy cho chữ tự do.
        if (kind === "text") {
          const element = current.textElements.find((item) => item.id === id);
          if (!element) return current;
          const bounded =
            edge === "start"
              ? Math.min(Math.max(nextTime, 0), element.end - MIN_TEXT_LENGTH)
              : Math.max(nextTime, element.start + MIN_TEXT_LENGTH);
          dragTrim.current = {
            kind: "text",
            id,
            edge,
            at: bounded,
            was:
              dragTrim.current?.was ??
              (edge === "start" ? element.start : element.end),
          };
          return {
            ...current,
            textElements: current.textElements.map((item) =>
              item.id === id
                ? edge === "start"
                  ? { ...item, start: bounded }
                  : { ...item, end: bounded }
                : item,
            ),
          };
        }
        if (kind === "insert") {
          const insert = current.inserts.find((item) => item.id === id);
          if (!insert) return current;
          const words = current.words;
          const from = words.findIndex((w) => w.id === insert.fromWordId);
          const to = words.findIndex((w) => w.id === insert.toWordId);
          if (from === -1 || to === -1) return current;
          // Mép BÁM RANH GIỚI TỪ, không bám giây: tư liệu chèn neo vào khoảng
          // từ (đặc tả §1), nên "kéo dài thêm" nghĩa là phủ thêm một tiếng nữa.
          // Giữ ít nhất một tiếng — hai mép trùng nhau là khối rộng 0.
          const gan = (from: number, to: number, lay: (w: Word) => number) => {
            let best = from;
            for (let i = from; i <= to; i += 1) {
              if (
                Math.abs(lay(words[i]) - nextTime) <
                Math.abs(lay(words[best]) - nextTime)
              ) {
                best = i;
              }
            }
            return best;
          };
          const pick =
            edge === "start"
              ? gan(0, to, (w) => w.start)
              : gan(from, words.length - 1, (w) => w.end);
          const word = words[pick];
          dragTrim.current = {
            kind: "insert",
            id,
            edge,
            at: edge === "start" ? word.start : word.end,
            was:
              dragTrim.current?.was ??
              (edge === "start" ? insert.start : insert.end),
            wordId: word.id,
            wasWordId:
              dragTrim.current?.wasWordId ??
              (edge === "start" ? insert.fromWordId : insert.toWordId),
          };
          return {
            ...current,
            inserts: current.inserts.map((item) =>
              item.id === id
                ? edge === "start"
                  ? { ...item, start: word.start, fromWordId: word.id }
                  : { ...item, end: word.end, toWordId: word.id }
                : item,
            ),
          };
        }
        if (kind === "music") {
          const track = current.music.find((item) => item.id === id);
          if (!track) return current;
          const bounded =
            edge === "start"
              ? Math.min(Math.max(nextTime, 0), track.end - MIN_MUSIC_LENGTH)
              : Math.max(nextTime, track.start + MIN_MUSIC_LENGTH);
          dragTrim.current = {
            kind: "music",
            id,
            edge,
            at: bounded,
            was:
              dragTrim.current?.was ??
              (edge === "start" ? track.start : track.end),
          };
          return {
            ...current,
            music: current.music.map((item) =>
              item.id === id
                ? edge === "start"
                  ? { ...item, start: bounded }
                  : { ...item, end: bounded }
                : item,
            ),
          };
        }
        // Tay nắm nằm trên ĐOẠN, nên phải sửa `segments`. Bản trước tìm trong
        // `clips` (dải tệp) — không bao giờ khớp id, nên kéo không thấy gì động
        // và lúc thả tay cũng không ghi được gì. Sai im lặng suốt.
        const segment = current.segments.find((item) => item.id === id);
        if (!segment) return current;
        // Chặn LẤN sang đoạn bên cạnh ngay khi đang kéo, đúng luật máy chủ.
        //
        // Thiếu chặn ở đây thì màn hình vẽ khối lấn qua hàng xóm suốt lúc kéo,
        // thả tay xong máy chủ kéo về — người dùng thấy khối giật ngược một cái
        // mà không hiểu vì sao. Chặn ở cả hai nơi thì cái nhìn thấy đúng bằng
        // cái sẽ được ghi.
        const before = current.segments
          .filter((item) => item.end <= segment.start + 0.001)
          .reduce((max, item) => Math.max(max, item.end), 0);
        const after = current.segments
          .filter((item) => item.start >= segment.end - 0.001)
          .reduce(
            (min, item) => Math.min(min, item.start),
            Number.POSITIVE_INFINITY,
          );
        // KHÔNG cần hít mép vào biên láng giềng ở đây, dù nghe như cần.
        //
        // Kéo mép ra khỏi một chỗ đã gọt thì hai phép chặn dưới đây đã cho ra ĐÚNG
        // biên rồi, không sai một phần nghìn giây: mốc kéo đi qua `toSource`, mà
        // `toSource` không bao giờ trả về một giây nằm TRONG quãng đã bỏ — nó nhảy
        // thẳng từ mép này sang mép kia (xem vòng lặp `skipRanges` của nó). Nên chỉ
        // cần nhích chuột ra một điểm ảnh là `nextTime` đã ở bên kia chỗ hở, rồi bị
        // `Math.min(..., after)` ghim đúng vào biên.
        //
        // Nói cách khác: trên dải vẽ theo giờ XUẤT RA, chỗ hở rộng 0 nên không có
        // cách nào kéo vào "giữa" nó. Từng thêm một phép hít 0,45s ở đây và bỏ đi,
        // vì nó không bao giờ đổi được kết quả — chỉ là một hằng số để người đọc sau
        // tưởng có luật gì đó đang chạy.
        const bounded =
          edge === "start"
            ? Math.min(Math.max(nextTime, before), segment.end - MIN_SEGMENT)
            : Math.min(Math.max(nextTime, segment.start + MIN_SEGMENT), after);
        dragTrim.current = {
          kind: "clip",
          id,
          edge,
          at: bounded,
          was:
            dragTrim.current?.was ??
            (edge === "start" ? segment.start : segment.end),
        };
        return {
          ...current,
          segments: current.segments.map((item) =>
            item.id === id
              ? edge === "start"
                ? { ...item, start: bounded }
                : { ...item, end: bounded }
              : item,
          ),
        };
      });
    },
    [],
  );

  /**
   * Chốt việc gọt mép: dịch MÉP CỦA ĐOẠN, không tạo một "vết cắt" riêng.
   *
   * Phần bị gọt thành hở giữa hai đoạn, mà hở không thuộc đoạn nào nên không vào
   * video — cùng một kết quả với cách cũ, nhưng không cần cơ chế thứ hai.
   */
  const commitTrim = useCallback(async () => {
    const pending = dragTrim.current;
    dragTrim.current = null;
    if (!projectId || !pending) return;

    if (pending.kind === "insert") {
      if (pending.wordId) {
        await api
          .updateElement(
            pending.id,
            pending.edge === "start"
              ? { fromWordId: pending.wordId }
              : { toWordId: pending.wordId },
          )
          .catch(boQuaLoi());
      }
      if (pending.wasWordId) {
        pushUndo({
          type: "insert-trim",
          label: "Đổi khoảng tư liệu",
          elementId: pending.id,
          edge: pending.edge,
          wordId: pending.wasWordId,
        });
      }
      return;
    }
    if (pending.kind === "effect") {
      const item = effectsRef.current.find((row) => row.id === pending.id);
      if (item) {
        await api
          .setEffect(projectId, pending.id, {
            start: item.start,
            end: item.end,
            kind: item.kind,
          })
          .catch(boQuaLoi());
      }
      pushUndo({
        type: "effect",
        label: "Đổi quãng hiệu ứng",
        effectId: pending.id,
        was: pending.wasKind
          ? null
          : {
              start:
                pending.edge === "start" ? pending.was : (item?.start ?? 0),
              end: pending.edge === "end" ? pending.was : (item?.end ?? 0),
              kind: item?.kind ?? "zoom-in",
            },
      });
      return;
    }
    if (pending.kind === "text") {
      await api
        .updateElement(
          pending.id,
          pending.edge === "start"
            ? { start: pending.at }
            : { end: pending.at },
        )
        .catch(boQuaLoi());
      pushUndo({
        type: "text-trim",
        label: "Đổi khoảng chữ",
        elementId: pending.id,
        edge: pending.edge,
        at: pending.was,
      });
      return;
    }
    if (pending.kind === "music") {
      const row = await api
        .updateMusic(
          pending.id,
          pending.edge === "start"
            ? { start: pending.at }
            : { end: pending.at },
        )
        .catch(() => null);
      // Máy chủ mới là nơi chốt mốc (nó chặn hai mép vào nhau), nên lấy lại số
      // của nó chứ không giữ số vừa vẽ trên màn.
      if (row) {
        setData((current) =>
          current
            ? {
                ...current,
                music: current.music.map((item) =>
                  item.id === row.id ? toMusicTrack(row) : item,
                ),
              }
            : current,
        );
      }
      pushUndo({
        type: "music-trim",
        label: "Đổi khoảng nhạc",
        trackId: pending.id,
        edge: pending.edge,
        at: pending.was,
      });
      return;
    }

    await api
      .updateSegment(pending.id, { edge: pending.edge, at: pending.at })
      .catch(boQuaLoi());
    const rows = await api.listSegments(projectId).catch(() => null);
    if (rows) applySegmentsRef.current(rows);
    pushUndo({
      type: "trim",
      label: "Gọt mép đoạn",
      segmentId: pending.id,
      edge: pending.edge,
      at: pending.was,
    });
  }, [projectId, pushUndo]);

  /**
   * Những chỗ KHÔNG vào video, suy ra từ ĐOẠN — không có danh sách riêng nào nữa.
   *
   * Ba nguồn, cùng một ý: đoạn bị bỏ, hở giữa hai đoạn (do gọt mép), câu bị gạch.
   * Trước đây "cắt tay" là bảng thứ tư song song với đoạn, nên cùng một chuyện có
   * hai chỗ lưu và hai cách hiện trên dải.
   */
  const cuts = useMemo(() => {
    const segments = [...(data?.segments ?? [])].sort(
      (a, b) => a.start - b.start,
    );
    const out: Array<{
      id: string;
      start: number;
      end: number;
      kind: "segment" | "gap";
      label: string;
    }> = [];
    let cursor = 0;
    for (const segment of segments) {
      if (segment.start > cursor + 0.05) {
        out.push({
          id: `gap-${segment.id}`,
          start: cursor,
          end: segment.start,
          kind: "gap",
          label: "Mép đã gọt",
        });
      }
      if (segment.removed) {
        out.push({
          id: segment.id,
          start: segment.start,
          end: segment.end,
          kind: "segment",
          label: segment.label,
        });
      }
      cursor = Math.max(cursor, segment.end);
    }
    return out;
  }, [data?.segments]);

  const skipRanges = useMemo(() => {
    const raw = [
      ...(data?.sentences ?? [])
        .filter((item) => item.removed)
        .map((item) => ({ start: item.start, end: item.end })),
      ...cuts.map((item) => ({ start: item.start, end: item.end })),
    ].sort((a, b) => a.start - b.start);

    const merged: Array<{ start: number; end: number }> = [];
    for (const span of raw) {
      const last = merged[merged.length - 1];
      if (last && span.start <= last.end) {
        last.end = Math.max(last.end, span.end);
        continue;
      }
      merged.push({ ...span });
    }
    return merged;
  }, [data?.sentences, cuts]);

  /**
   * Bao nhiêu giây được GIỮ LẠI trong khoảng này.
   *
   * Khung xem trước cần nó để đặt kim nhạc: nhạc chạy trên bản ĐÃ CẮT, nên bỏ
   * một quãng ở giữa thì đoạn nhạc sau đó cũng phải kêu sớm lên bấy nhiêu. Cùng
   * một phép tính với `keptBefore` của máy chủ — nếu hai bên lệch nhau thì khung
   * xem đang nói dối.
   */
  const keptSpan = useCallback(
    (from: number, to: number) => {
      let dropped = 0;
      for (const span of skipRanges) {
        const overlap = Math.min(to, span.end) - Math.max(from, span.start);
        if (overlap > 0) dropped += overlap;
      }
      return Math.max(0, to - from - dropped);
    },
    [skipRanges],
  );

  /**
   * Đổi mốc NGUỒN sang mốc trên video sẽ xuất ra, và ngược lại.
   *
   * Dải thời gian vẽ theo mốc XUẤT RA: bỏ một quãng thì mọi thứ phía sau dồn
   * lên đúng bấy nhiêu và quãng đó biến mất khỏi dải — cái nhìn thấy đúng bằng
   * cái sẽ tải về. Trước đây dải vẽ theo mốc nguồn và để lại một mảng xám, nên
   * bàn dựng nói hai điều khác nhau về cùng một video: lúc phát thì vạch nhảy
   * qua chỗ đó, mà dải thì vẫn vẽ nó ra.
   *
   * Còn MỌI THỨ KHÁC vẫn tính theo mốc nguồn — từ, chữ, tư liệu, nhạc, dải ảnh
   * phim. Chỉ lúc VẼ mới quy đổi. Đổi cả kho dữ liệu sang mốc xuất ra thì mỗi
   * lần bỏ một quãng là phải tính lại toàn bộ.
   */
  const toOutput = useCallback((at: number) => keptSpan(0, at), [keptSpan]);

  /** Ngược lại: một mốc trên dải là giây nào của bản gốc. */
  const toSource = useCallback(
    (out: number) => {
      let left = Math.max(0, out);
      let cursor = 0;
      for (const span of skipRanges) {
        const kept = span.start - cursor;
        if (left < kept) return cursor + left;
        left -= kept;
        cursor = span.end;
      }
      return cursor + left;
    },
    [skipRanges],
  );

  // Cắm hai hàm quy đổi vào ref để `scrubByPixels` (khai trước) dùng được.
  timeMapRef.current = { toOutput, toSource };

  /**
   * Quãng đã bỏ đang được NGHE THỬ — tạm treo luật "vạch không vào quãng đã bỏ".
   *
   * Khung xem phát TỆP GỐC (`preview-panel.tsx`) và tua theo giây gốc, còn cú cắt
   * chỉ được mô phỏng bằng phép đẩy vạch ở dưới. Nên nghe thử phần đã bỏ không cần
   * dựng gì cả: treo đúng phép đẩy ấy là hình chạy thẳng qua.
   *
   * Treo có phạm vi — chỉ quãng này, chỉ trong lượt nghe thử này. Mọi quãng bỏ khác
   * vẫn bị nhảy qua như thường, vì người dùng đang muốn nghe MỘT chỗ chứ không phải
   * xem lại bản chưa cắt.
   */
  const [auditSpan, setAuditSpan] = useState<{
    start: number;
    end: number;
  } | null>(null);

  /**
   * Mốc kế tiếp còn giữ lại; trả chính nó nếu đang ở chỗ không bị bỏ.
   *
   * Quãng bỏ ở ĐUÔI video thì phải LÙI, không đẩy tiếp: đẩy tới `span.end` là
   * đẩy tới hết video, mà chỗ đó không thuộc đoạn nào cả — khung xem phủ kín chữ
   * "Đoạn này đã bỏ" trong khi dải vẽ vạch ở mốc cuối cùng của video xuất ra.
   * Đo thật trên một dự án mà chặng tự cắt bỏ 2,2 giây cuối: vạch kẹt ở 0:58/0:58
   * và không có cử chỉ nào gỡ ra được.
   *
   * Lùi một khung hình về trước mép quãng: chỗ đó là giây cuối cùng CÒN vào
   * video, đúng nơi vạch nên đứng khi chạy hết.
   */
  const nextKeptTime = useCallback(
    (at: number) => {
      // Đang nghe thử đúng quãng này thì để vạch đi vào: cả việc nghe thử là để
      // biết phần đã bỏ nghe ra sao.
      if (auditSpan && at >= auditSpan.start && at < auditSpan.end) return at;
      for (const span of skipRanges) {
        if (at >= span.start && at < span.end) {
          const tailCut = span.end >= (durationRef.current || 0) - 0.01;
          return tailCut ? Math.max(0, span.start - FRAME) : span.end;
        }
      }
      return at;
    },
    [skipRanges, auditSpan],
  );

  // Trần tua: đuôi video bị bỏ thì trần là giây cuối cùng còn vào video.
  maxSeekRef.current = (() => {
    const total = durationRef.current || 0;
    // Nghe thử thì trần mở tới hết bản gốc. Giữ trần cũ thì đúng cú cắt ở ĐUÔI
    // video — chỗ hay cắt oan nhất, vì cả lời chào cuối nằm ở đó — lại là chỗ
    // không tua tới được để mà nghe.
    if (auditSpan) return total;
    const tail = skipRanges.find(
      (span) => span.end >= total - 0.01 && span.start < total,
    );
    return tail ? Math.max(0, tail.start - FRAME) : total;
  })();

  /**
   * Vạch KHÔNG BAO GIỜ đứng trong một quãng đã bỏ.
   *
   * Dải vẽ theo mốc xuất ra nên mốc xuất ra không bao giờ trỏ vào quãng đã bỏ —
   * bấm hay kéo ở đâu cũng rơi vào chỗ còn giữ. Nhưng vạch đang đứng yên một
   * chỗ mà chỗ đó VỪA BỊ BỎ thì nó kẹt lại bên trong.
   *
   * Đo thật: bỏ khoảng lặng đầu video (0 → 0,86s) trong khi vạch ở 0. Dải vẽ vạch
   * ở mốc xuất ra 0 — tức ngay đầu đoạn đầu tiên còn giữ — nên nhìn thì thấy
   * "đang ở đầu video", còn khung xem lại phủ kín chữ "Đoạn này đã bỏ". Hai cửa
   * nói hai điều về cùng một khoảnh khắc.
   *
   * Đẩy vạch tới chỗ còn giữ gần nhất là xong, và làm ở ĐÂY thì mọi đường cắt
   * đều được lo: bỏ đoạn, bỏ khoảng, gọt mép, hoàn tác.
   */
  useEffect(() => {
    const ra = nextKeptTime(time);
    if (ra !== time) setTime(Math.min(ra, durationRef.current));
  }, [skipRanges, time, nextKeptTime]);

  const [transcribeJob, setTranscribeJob] = useState<{
    status: string;
    message: string;
  } | null>(null);

  /** Chép lời ngay từ bàn dựng — người dùng vào đây rồi mới thấy chưa có lời. */
  const startTranscribe = useCallback(async () => {
    if (!projectId) return;
    await api.startTranscribe(projectId);
    setTranscribeJob({ status: "running", message: "Đang xếp hàng" });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !isJobActive(transcribeJob?.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const job = await api.getJob(projectId, "transcribe");
        setTranscribeJob({
          status: job.status,
          message:
            job.status === "queued" ? queueLabel(job) : (job.message ?? ""),
        });
        // Chép lời HỎNG thì phải nói ra. Trước đây chỉ ghi vào state rồi thôi:
        // nút quay về chữ "Chép lời" như chưa có gì xảy ra, người dùng bấm mà
        // không thấy động tĩnh gì thì tưởng nút hỏng. Đo thật: dự án chưa có
        // video, máy chủ trả "Chưa có video chính", màn hình im lặng hoàn toàn.
        if (job.status === "error") {
          toast.add({
            title: "Chép lời không xong",
            description: job.message ?? "Máy chủ không nói lý do",
            type: "error",
          });
        }
        // Chép xong thì nạp lại cả dự án để bản chép lời hiện ra ngay.
        if (job.status === "done") {
          const fresh = await api.getProject(projectId);
          const shaped = shape(fresh);
          durationRef.current = shaped.duration;
          setData(shaped);
        }
      } catch {
        /* việc chưa kịp tạo — hỏi lại nhịp sau */
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [projectId, transcribeJob?.status]);

  const { uploading, addAssetsFromLibrary, addMedia } = useMediaIntake(
    projectId,
    setData,
    durationRef,
  );

  const updateWordRef = useRef<(id: string, text: string) => Promise<void>>(
    async () => {},
  );
  const confirmWord = useCallback(async (id: string) => {
    const word = dataRef.current?.wordsById.get(id);
    if (!word) return;
    await updateWordRef.current(id, word.text);
  }, []);

  const updateWord = useCallback(async (id: string, text: string) => {
    if (!text.trim()) return;
    setData((current) => {
      if (!current) return current;
      const words = current.words.map((item) =>
        item.id === id
          ? { ...item, text: text.trim(), unsure: undefined }
          : item,
      );
      const target = words.find((item) => item.id === id);
      const sentences = current.sentences.map((sentence) =>
        sentence.id === target?.sentenceId
          ? {
              ...sentence,
              text: words
                .filter((item) => item.sentenceId === sentence.id)
                .map((item) => item.text)
                .join(" "),
            }
          : sentence,
      );
      return {
        ...current,
        words,
        wordsById: new Map(words.map((item) => [item.id, item])),
        sentences,
      };
    });
    await api.setWordText(id, text.trim()).catch(boQuaLoi());
  }, []);

  // `xacNhanTu` khai báo trước `updateWord` nên phải đi qua ref — nó cần chính
  // đường ghi đó, chỉ khác là ghi lại đúng chữ cũ.
  updateWordRef.current = updateWord;

  /**
   * Trả một chỗ đã bỏ về lại video.
   *
   * Đoạn bị bỏ thì bật lại cờ. Hở do gọt mép thì kéo mép đoạn LIỀN TRƯỚC trở về
   * đúng chỗ hở bắt đầu — hở không phải một thực thể, nó là chỗ trống giữa hai
   * đoạn, nên lấp nó nghĩa là nới đoạn bên cạnh.
   */
  const removeCut = useCallback(
    async (id: string) => {
      if (!projectId) return;
      const span = cuts.find((item) => item.id === id);
      if (!span) return;
      if (span.kind === "segment") {
        // Ghi vết hoàn tác cho CẢ chiều trả lại, không chỉ chiều cắt. Trả lại là
        // một cú sửa video như mọi cú khác — bấm nhầm thì phải lùi được, mà trước
        // đây đường này lặng lẽ không để lại vết nào.
        pushUndoRef.current({
          type: "segment",
          label: "Giữ lại đoạn",
          segmentId: id,
          wasRemoved: true,
        });
        await api.updateSegment(id, { removed: false }).catch(boQuaLoi());
      } else {
        const before = [...(dataRef.current?.segments ?? [])]
          .filter((item) => item.end <= span.start + 0.01)
          .sort((a, b) => b.end - a.end)[0];
        const after = [...(dataRef.current?.segments ?? [])]
          .filter((item) => item.start >= span.end - 0.01)
          .sort((a, b) => a.start - b.start)[0];
        if (before) {
          // Mốc mép CŨ, đọc trước khi ghi đè — đó là thứ duy nhất đưa được cú gọt
          // về đúng chỗ nó đứng, thay vì canh lại bằng mắt.
          pushUndoRef.current({
            type: "trim",
            label: "Trả lại chỗ gọt",
            segmentId: before.id,
            edge: "end",
            at: before.end,
          });
          await api
            .updateSegment(before.id, { edge: "end", at: span.end })
            .catch(boQuaLoi());
        } else if (after) {
          pushUndoRef.current({
            type: "trim",
            label: "Trả lại chỗ gọt",
            segmentId: after.id,
            edge: "start",
            at: after.start,
          });
          await api
            .updateSegment(after.id, { edge: "start", at: span.start })
            .catch(boQuaLoi());
        }
      }
      const rows = await api.listSegments(projectId).catch(() => null);
      if (rows) applySegmentsRef.current(rows);
    },
    [projectId, cuts],
  );

  /**
   * Chỗ gọt nằm sát mép này không — dùng cho phép nhấp đúp trả lại trọn cú gọt.
   *
   * Tra theo MỐC MÉP chứ không theo mã đoạn: chỗ gọt không thuộc đoạn nào (xem
   * nhánh `gap` của `cuts`), nên chẳng có mã nào nối nó với đoạn vừa bị gọt.
   */
  const trimmedEdgeAt = useCallback(
    (at: number) =>
      cuts.find(
        (item) =>
          item.kind === "gap" &&
          (Math.abs(item.start - at) < 0.01 || Math.abs(item.end - at) < 0.01),
      ) ?? null,
    [cuts],
  );

  /**
   * Trả lại quãng chứa mốc này.
   *
   * Bấm "giữ lại" ở một dòng chữ thì người dùng chỉ ra MỘT MỐC, còn thứ phải
   * gỡ là cả quãng đang phủ mốc đó — có thể do bỏ đoạn, do gọt mép, hay do bỏ
   * cả một câu. Tra ngược từ mốc ra quãng, để chỗ gọi không phải biết ba đường
   * cắt khác nhau.
   */
  const restoreRange = useCallback(
    async (at: number) => {
      const span = cuts.find((item) => at >= item.start && at < item.end);
      if (span) {
        await removeCut(span.id);
        return;
      }
      // Không phải quãng cắt thì là câu bị bỏ bằng cách cũ (cờ riêng trên câu).
      const sentence = dataRef.current?.sentences.find(
        (item) => item.removed && at >= item.start && at < item.end,
      );
      if (sentence) toggleSentence(sentence.id);
    },
    [cuts, removeCut, toggleSentence],
  );

  /**
   * Nhấn zoom ở các chỗ nối đoạn — cờ của CẢ dự án, không của từng chỗ.
   *
   * Nó đổi dáng mọi chỗ nối nên phải là một lựa chọn có ý thức; để bật lặng lẽ
   * trong CSDL mà giao diện không có nút nào là người dùng thấy video khác mà
   * không hiểu vì sao.
   */
  const [zoomPunch, setZoomPunchState] = useState<JunctionId>("none");
  /**
   * BỘ DÁNG CHỮ của dự án — font, màu, viền, quầng, mật độ, nhịp.
   *
   * Cấp DỰ ÁN, không phải cấp phần tử: nó không nằm trong `elements` nên đổi nó
   * không đụng một hàng dữ liệu nào. Vì thế nó ở đây chứ không ở Inspector —
   * Inspector là nơi sửa VẬT ĐANG CHỌN.
   */
  const [stylePack, setStylePackState] = useState<StylePackId>("goc");
  /**
   * Bộ dáng ĐANG DÙNG lúc chặng hiệu ứng chạy lần cuối.
   *
   * Khác `stylePack` nghĩa là người dùng đã đổi dáng sau đó — hàng soát mời họ
   * đặt lại. Không tự đặt lại: hiệu ứng và tư liệu chèn nằm trên dải, người dùng
   * nhìn thấy chúng và có thể đã sắp lại bằng tay.
   */
  const [effectsStylePack, setEffectsStylePack] = useState<string | null>(null);

  /** Đổi cách một tư liệu hiện ra, hoặc hình dáng khung của nó. */
  const setInsertStyle = useCallback(
    (id: string, patch: { reveal?: RevealId; shape?: ShapeId }) => {
      setData((current) =>
        current
          ? {
              ...current,
              inserts: current.inserts.map((item) =>
                item.id === id ? { ...item, ...patch } : item,
              ),
            }
          : current,
      );
      void api.updateElement(id, patch).catch(boQuaLoi());
    },
    [],
  );

  const setZoomPunch = useCallback(
    async (punch: JunctionId) => {
      if (!projectId) return;
      setZoomPunchState(punch);
      await api.setZoomPunch(projectId, punch).catch(boQuaLoi());
    },
    [projectId],
  );

  /**
   * Đổi bộ dáng chữ của cả dự án.
   *
   * KHÔNG có dialog xác nhận và KHÔNG có phép đếm "đổi 47 giữ 6": cả năm bộ dáng
   * khai `defaults` giống hệt nhau, nên đổi bộ dáng chỉ đụng phần VẼ — không cụm
   * nào bị mất, không luật merge nào. Nếu thấy mình đang định viết một câu đếm
   * như thế thì nghĩa là `defaults` của các bộ đã lệch nhau, và chỗ phải sửa là
   * `style-pack-catalog.ts` chứ không phải chỗ này.
   *
   * Đặt state trước rồi mới gọi máy chủ: chữ trên bàn dựng vẽ lại ngay, không
   * phải chờ một vòng tải lại.
   */
  /**
   * Chạy lại ĐÚNG chặng hiệu ứng theo bộ dáng hiện tại.
   *
   * Không dựng lại cả mạch: nghe và chép lời mất vài phút, và người dùng chỉ
   * đang xin một việc — đánh dấu lại mấy chỗ nối theo nhịp của dáng mới.
   */
  const redoEffects = useCallback(async () => {
    if (!projectId) return;
    await api.retryStep(projectId, "effects").catch(boQuaLoi());
    // PHẢI báo ra: chặng chạy nền ở máy chủ, còn bàn dựng thì không hỏi lại
    // tiến trình như màn chờ. Không có dòng này thì người dùng bấm xong không
    // thấy gì đổi và bấm tiếp — mỗi lần bấm là một lượt gọi mô hình.
    toast.add({
      title: "Đang đặt lại hiệu ứng",
      description: "Xong thì mở lại dự án để thấy — mất chừng nửa phút.",
    });
  }, [projectId]);

  const setStylePack = useCallback(
    async (next: StylePackId) => {
      if (!projectId) return;
      setStylePackState(next);
      await api
        .updateProject(projectId, { stylePack: next })
        .catch(boQuaLoi());
    },
    [projectId],
  );

  /**
   * Bỏ qua / lấy lại một lời nhắc ở hàng soát.
   *
   * Ghi thẳng xuống máy chủ. Hàng soát dựng lại từ dữ liệu mỗi lần mở dự án,
   * nên nhớ trong bộ nhớ màn hình thì tải lại là lời nhắc mọc lại y nguyên và
   * người dùng bị hỏi lại đúng câu mình vừa trả lời.
   */
  /**
   * Chữ nào đang ĐÈ lên chữ này trên khung hình.
   *
   * Hai điều kiện: trùng THỜI GIAN, và hai dải chạm nhau theo chiều dọc. Phép
   * thử dải suy từ hình học ở `bandsOverlap`, không chép tay thành bảng — bản
   * đầu tôi chép tay và ghi nhầm rằng Sát trên không đụng ai: đúng với Sát đáy
   * (34% hụt dưới 35%) nhưng sai với Trên mặt, dải đó bắt đầu ngay ở 30%.
   */
  const deLenNhau = useCallback((element: TextElement) => {
    return (dataRef.current?.textElements ?? []).filter(
      (item) =>
        item.id !== element.id &&
        bandsOverlap(element.position, item.position) &&
        item.start < element.end - 0.02 &&
        item.end > element.start + 0.02,
    );
  }, []);

  const boQuaIssue = useCallback(
    async (issueId: string, boQua = true) => {
      if (!projectId) return;
      setData((current) =>
        current
          ? {
              ...current,
              dismissed: boQua
                ? [...current.dismissed, issueId]
                : current.dismissed.filter((item) => item !== issueId),
            }
          : current,
      );
      await (
        boQua
          ? api.dismissIssue(projectId, issueId)
          : api.undismissIssue(projectId, issueId)
      ).catch(boQuaLoi());
    },
    [projectId],
  );

  /**
   * Những TỪ mà một chữ đang phủ — chỉ trả về khi chữ CÒN đúng bằng lời.
   *
   * Đây là phép thử "chữ này do máy sinh từ lời và chưa ai viết lại". Còn khớp
   * thì mới ứng được tiếng nào với từ nào: để gạch chấm chỗ máy nghe không
   * chắc, và để lấy mốc nói thật cho hiệu ứng hiện từng tiếng. Viết lại rồi thì
   * số tiếng không còn khớp, mọi phép ứng đều là bịa.
   *
   * Máy chủ dùng ĐÚNG luật này (xem `nhipNoi` ở `server/pipeline.ts`) — hai bên
   * lệch nhau thì khung xem đang nói dối.
   */
  const captionWords = useCallback((element: TextElement) => {
    const all = dataRef.current?.words ?? [];
    const from = all.findIndex((word) => word.id === element.fromWordId);
    const to = all.findIndex((word) => word.id === element.toWordId);
    if (from === -1 || to === -1 || to < from) return undefined;
    const inside = all.slice(from, to + 1);
    if (inside.map((word) => word.text).join(" ") !== element.content) {
      return undefined;
    }
    return inside;
  }, []);

  /** Mốc nói ra của từng tiếng — chỉ có khi chữ còn khớp lời. */
  const wordStarts = useCallback(
    (element: TextElement) => captionWords(element)?.map((word) => word.start),
    [captionWords],
  );

  /**
   * Lấp chữ cho một câu đang trống.
   *
   * Không có nút "tạo chữ" toàn dự án nữa: chép lời xong là đã có chữ. Cửa này
   * chỉ dùng khi người dùng xoá hết chữ của một câu rồi muốn lấy lại — hỏi ngay
   * tại chính câu đó.
   */
  const createCaptionsForSentence = useCallback(
    async (sentenceId: string) => {
      if (!projectId) return;
      const { created } = await api
        .createCaptions(projectId, sentenceId)
        .catch(() => ({ created: [] as string[] }));
      if (created.length === 0) return;
      const fresh = await api.getProject(projectId).catch(() => null);
      if (fresh) {
        const shaped = shape(fresh);
        durationRef.current = shaped.duration;
        setData(shaped);
      }
      pushUndoRef.current({
        type: "captions",
        label: `Tạo ${created.length} chữ`,
        elementIds: created,
      });
    },
    [projectId],
  );

  const startExport = useCallback(async () => {
    if (!projectId) return;
    await api.startExport(projectId);
    setExportJob({ status: "running", message: "Đang xếp hàng" });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !isJobActive(exportJob?.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const job = await api.getJob(projectId, "export");
        setExportJob({
          status: job.status,
          message:
            job.status === "queued" ? queueLabel(job) : (job.message ?? ""),
        });
        // Xuất HỎNG cũng phải nói ra — cùng lý do với chép lời. Người dùng đợi
        // vài phút rồi thấy nút quay về chữ "Xuất video" mà không biết vì sao.
        if (job.status === "error") {
          toast.add({
            title: "Xuất video không xong",
            description: job.message ?? "Máy chủ không nói lý do",
            type: "error",
          });
        }
      } catch {
        /* việc chưa kịp tạo — hỏi lại nhịp sau */
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [projectId, exportJob?.status]);

  const empty = useMemo(
    () => ({
      sentences: [] as Sentence[],
      words: [] as Word[],
      wordsById: new Map<string, Word>(),
      textElements: [] as TextElement[],
      inserts: [] as Insert[],
      music: [] as MusicTrack[],
      insertLibrary: [] as ApiProject["files"],
      posterUrl: null as string | null,
      segments: [] as Clip[],
      clips: [] as Clip[],
      duration: 0,
      title: "",
      dismissed: [] as string[],
      pipeline: null as ApiPipeline | null,
      manualEffects: [] as Array<{
        id: string;
        start: number;
        end: number;
        kind: JunctionId;
      }>,
    }),
    [],
  );

  const current = data ?? empty;

  /**
   * Danh sách chỗ nối: mỗi chỗ hai đoạn kề nhau dán vào nhau vì có cắt ở giữa.
   *
   * Mốc lấy theo giây BẢN GỐC (chỗ quãng giữ lại phía trước kết thúc) — mốc trên
   * dải đã cắt thì xê dịch mỗi lần bỏ thêm một quãng ở phía trước, mà bản sửa
   * tay phải bám được vào đúng chỗ nối cũ.
   */
  /**
   * Mỗi vết cắt: chỗ quãng giữ lại trước nó KẾT THÚC, và chỗ quãng sau nó BẮT
   * ĐẦU. Cần cả hai vì phần ở giữa không vào video — một hiệu ứng vắt qua vết
   * cắt phải nhảy qua phần đó, không thì nửa sau của nó rơi hết vào chỗ trống.
   */
  const cutMark = useMemo(() => {
    const giu: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    for (const span of skipRanges) {
      if (span.start > cursor) giu.push({ start: cursor, end: span.start });
      cursor = span.end;
    }
    if (current.duration > cursor)
      giu.push({ start: cursor, end: current.duration });
    return giu
      .slice(0, -1)
      .map((range, index) => ({ at: range.end, resume: giu[index + 1].start }));
  }, [skipRanges, current.duration]);

  /**
   * Danh sách HIỆU ỨNG — mỗi cái một quãng, không phải một mốc.
   *
   * Hai nguồn gộp lại:
   * · TỰ SUY ở mỗi vết cắt, theo kiểu mặc định của dự án. Không ghi xuống kho —
   *   ghi thì cắt thêm một chỗ là phải nhớ gieo tiếp, quên một đường là chỗ đó
   *   câm mà chẳng ai biết.
   * · ĐẶT TAY, có hàng thật trong kho, quãng do người dùng định.
   *
   * Cái tự suy ở vết cắt mang mã suy ra từ chính mốc cắt (`eff_cut_3.500`). Nhờ
   * thế lúc người dùng động vào nó, hàng ghi xuống kho mang ĐÚNG mã đó: chỗ đang
   * chọn không nhảy đi đâu, và cái tự suy tự biến mất vì quãng của hàng mới phủ
   * lên vết cắt.
   */
  const effects = useMemo(() => {
    // ĐỈNH luôn tính trên thời gian ĐÃ CẮT, không trên thời gian gốc. Trên thời
    // gian gốc, một quãng vắt qua vết cắt còn ôm cả phần bị bỏ — dài bao nhiêu
    // tuỳ vào chỗ đó bỏ nhiều hay ít, nên đỉnh sẽ trôi lung tung. Máy chủ cũng
    // tính đúng như vậy (xem `effectPeak` trong `server/render.ts`).
    const doi = (item: {
      id: string;
      start: number;
      end: number;
      kind: JunctionId;
      custom: boolean;
    }) => {
      const outStart = toOutput(item.start);
      const outEnd = toOutput(item.end);
      const outPeak = effectPeak(outStart, outEnd, item.kind);
      return {
        ...item,
        outStart,
        outEnd,
        outPeak,
        atCut: cutMark.some((cut) => {
          const at = toOutput(cut.at);
          return outStart <= at && at <= outEnd;
        }),
      };
    };

    const tay = current.manualEffects.map((item) =>
      doi({ ...item, custom: true }),
    );
    const derived = cutMark
      .filter(({ at }) => {
        const out = toOutput(at);
        return !tay.some((item) => item.outStart <= out && out <= item.outEnd);
      })
      .map(({ at, resume }) => {
        const [truoc, sau] = junctionHalves(zoomPunch);
        // Nửa sau đo từ chỗ quãng kế TIẾP bắt đầu: phần giữa hai mốc bị bỏ, nên
        // trên video nó dán liền, còn trên giây gốc thì nó là một cái hố.
        return doi({
          id: `eff_cut_${at.toFixed(3)}`,
          start: at - truoc,
          end: resume + sau,
          kind: zoomPunch,
          custom: false,
        });
      });
    return [...derived, ...tay].sort((a, b) => a.outPeak - b.outPeak);
  }, [cutMark, current.manualEffects, zoomPunch, toOutput]);

  // Đọc danh sách mới nhất từ trong các hàm gọi lại mà không phải cho nó vào
  // danh sách phụ thuộc — cho vào thì mọi hàm dựng lại mỗi lần kéo một mép.
  const effectsRef = useRef(effects);
  effectsRef.current = effects;

  /** Ghi một hiệu ứng xuống kho, có ghi vết hoàn tác. */
  const saveEffect = useCallback(
    async (
      id: string,
      next: { start: number; end: number; kind: JunctionId },
      label: string,
      ghiVet = true,
    ) => {
      if (!projectId) return;
      const cu = current.manualEffects.find((item) => item.id === id) ?? null;
      if (ghiVet) {
        pushUndoRef.current({
          type: "effect",
          label,
          effectId: id,
          was: cu && { start: cu.start, end: cu.end, kind: cu.kind },
        });
      }
      setData((cur) =>
        cur
          ? {
              ...cur,
              manualEffects: cur.manualEffects.some((item) => item.id === id)
                ? cur.manualEffects.map((item) =>
                    item.id === id ? { ...item, ...next } : item,
                  )
                : [...cur.manualEffects, { id, ...next }],
            }
          : cur,
      );
      await api.setEffect(projectId, id, next).catch(boQuaLoi());
    },
    [projectId, current.manualEffects],
  );

  /**
   * Đổi kiểu cho một hiệu ứng.
   *
   * Cái CHƯA ai động vào thì lấy luôn quãng mặc định của kiểu mới — "nháy sáng"
   * dài 0,65 giây là nhức mắt, mà đó là quãng mặc định của "zoom vào".
   * Cái người dùng ĐÃ tự kéo thì giữ nguyên độ dài họ chọn, chỉ dời đỉnh theo
   * nhịp của kiểu mới.
   */
  const setEffectKind = useCallback(
    async (id: string, kind: JunctionId) => {
      const item = effectsRef.current.find((row) => row.id === id);
      if (!item) return;
      // Cái tự suy thì lấy quãng mặc định của kiểu MỚI, đo từ chính vết cắt —
      // giữ quãng cũ thì "nháy sáng" dài 0,65 giây, nhức mắt.
      const next = item.custom
        ? { start: item.start, end: item.end, kind }
        : (() => {
            const [truoc, sau] = junctionHalves(kind);
            const cu = junctionHalves(item.kind);
            return {
              start: item.start + cu[0] - truoc,
              end: item.end - cu[1] + sau,
              kind,
            };
          })();
      await saveEffect(id, next, "Đổi kiểu hiệu ứng");
    },
    [saveEffect],
  );

  /**
   * Thêm một hiệu ứng — vào LÁT đang chọn, hoặc tại CHỖ con trỏ đang đứng.
   *
   * Chọn một đoạn rồi thêm thì hiệu ứng phủ đúng đoạn ấy: đó là cách nói "cả
   * khúc này nhấn lên" mà không phải kéo hai mép bằng tay.
   */
  const addEffectAtPlayhead = useCallback(async () => {
    if (!projectId) return;
    // Mặc định "cắt thẳng" nghĩa là không hiệu ứng — thêm một cái không làm gì
    // thì người dùng bấm xong không thấy gì và tưởng nút hỏng.
    const kind: JunctionId = zoomPunch === "none" ? "zoom-in" : zoomPunch;
    const slice =
      selection?.kind === "clip"
        ? current.segments.find((item) => item.id === selection.id)
        : undefined;
    const span = slice
      ? { start: slice.start, end: slice.end }
      : effectSpan(time, kind);
    // Sát đầu video thì DỜI cả quãng vào trong, không cắt cụt nửa đầu. Cắt cụt
    // thì con trỏ đứng ở giây 0 sẽ đẻ ra một hiệu ứng dài 0,15 giây — đúng bằng
    // mức tối thiểu — mà người dùng không xin cái đó, họ chỉ đứng ở đầu video.
    const shift = Math.max(0, -span.start);
    const start = span.start + shift;
    const end = Math.max(start + MIN_EFFECT_LENGTH, span.end + shift);
    const id = `eff_${Math.random().toString(36).slice(2, 10)}`;
    await saveEffect(id, { start, end, kind }, "Thêm hiệu ứng");
    setSelection({ kind: "junction", id });
  }, [projectId, zoomPunch, selection, current.segments, time, saveEffect]);

  /**
   * Bỏ một hiệu ứng.
   *
   * Ở vết cắt thì không xoá được — vết cắt vẫn còn đó, chỉ là nó thôi được đánh
   * dấu. Nên ghi một hàng "cắt thẳng" đè lên, để cái tự suy không mọc lại.
   */
  const deleteEffect = useCallback(
    async (id: string) => {
      if (!projectId) return;
      const item = effectsRef.current.find((row) => row.id === id);
      if (!item) return;
      if (item.atCut) {
        await saveEffect(
          id,
          { start: item.start, end: item.end, kind: "none" },
          "Bỏ đánh dấu chỗ nối",
        );
        return;
      }
      pushUndoRef.current({
        type: "effect",
        label: "Xoá hiệu ứng",
        effectId: id,
        was: { start: item.start, end: item.end, kind: item.kind },
      });
      setData((cur) =>
        cur
          ? {
              ...cur,
              manualEffects: cur.manualEffects.filter((row) => row.id !== id),
            }
          : cur,
      );
      setSelection(null);
      await api.deleteEffect(projectId, id).catch(boQuaLoi());
    },
    [projectId, saveEffect],
  );

  return {
    ...current,
    loading: !data && !error,
    error,
    time,
    pxPerSecond,
    selection,
    exportJob,
    canZoomIn: pxPerSecond < MAX_PX_PER_SECOND - 1,
    canZoomOut: pxPerSecond > MIN_PX_PER_SECOND + 1,
    projectId,
    seek,
    scrubByPixels,
    zoomBy,
    resetZoom,
    /** Thang dải ảnh; thiếu thì suy từ thời lượng — ảnh cũ dài đúng `ceil+1` giây */
    stripSeconds: strip?.seconds ?? Math.ceil(current.duration) + 1,
    /** Thang gốc của dải ảnh — mức phóng mà khung hình không bị bóp méo */
    stripNativeSecondWidth: strip?.native ?? DEFAULT_PX_PER_SECOND,
    /** Đã biết thang thật hay chưa — dùng để xả bộ nhớ đệm ảnh khi dựng lại */
    stripVersion: strip?.seconds ?? null,
    /** Đường bao âm lượng cho dải sóng; `null` là chưa có, dải tự ẩn đi */
    envelope,
    setSelection,
    toggleSentence,
    updateSentenceText,
    updateTextElement,
    addTextAtPlayhead,
    addOpeningText,
    addInsertAtPlayhead,
    deleteElement,
    moveElement,
    cuts,
    trimmedEdgeAt,
    /** Quãng đã bỏ đang được nghe thử; `null` là không có lượt nào */
    auditSpan,
    startAudit: setAuditSpan,
    skipRanges,
    keptSpan,
    toOutput,
    toSource,
    /** Độ dài video SẼ XUẤT RA — bản gốc trừ đi mọi quãng đã bỏ */
    outputDuration: keptSpan(0, current.duration),
    nextKeptTime,
    cutRange,
    restoreRange,
    zoomPunch,
    setZoomPunch,
    stylePack,
    setStylePack,
    effectsStylePack,
    redoEffects,
    setInsertStyle,
    removeCut,
    undo,
    undoLabel,
    attachMusic,
    addMusicFromLibrary,
    setMusicVolume,
    removeMusic,
    startExport,
    transcribeJob,
    startTranscribe,
    trim,
    commitTrim,
    splitAtPlayhead,
    toggleSegment,
    updateWord,
    confirmWord,
    createCaptionsForSentence,
    draftTextContent,
    commitTextContent,
    mergeTextWithNext,
    splitTextElement,
    applyTextStyleToAll,
    renameProject,
    captionWords,
    effects,
    setEffectKind,
    addEffectAtPlayhead,
    deleteEffect,
    deLenNhau,
    boQuaIssue,
    wordStarts,
    addMedia,
    addAssetsFromLibrary,
    uploadingMedia: uploading,
  };
}

export type EditorState = ReturnType<typeof useEditor>;
