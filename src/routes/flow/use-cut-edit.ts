import { useCallback, useEffect, useRef, useState } from "react";

import { api, type ApiSegment } from "@/lib/api";

import type { AudioEnvelope } from "../editor/timeline-audio-lane";
import { DEFAULT_PX_PER_SECOND } from "../editor/timeline-zoom";
import type { Span } from "./cut-lane";

/**
 * DỮ LIỆU VÀ THAO TÁC CỦA BƯỚC CẮT.
 *
 * ══ MỘT KHOẢNG CẮT LÀ MỘT ĐOẠN CÓ `removed` ══
 *
 * Không thêm bảng nào. `ai-cuts.ts` đã đánh dấu sẵn bằng `removeRange`, bàn dựng
 * đọc cùng chỗ ấy, và `commit-cut` nướng từ cùng chỗ ấy. Dựng một cơ chế "khoảng
 * cắt" riêng cho màn này là hai nguồn cho cùng một ý, tức hai chỗ để lệch nhau.
 *
 * ══ SỬA MỘT KHOẢNG = HOÀ TAN RỒI BỎ LẠI ══
 *
 * `trimSegment` CHẶN không cho một đoạn lấn sang đoạn bên cạnh
 * (`server/segments.ts:195`), nên nới rộng một khoảng cắt bằng cách gọt mép
 * chính nó thì không nhúc nhích. Còn gọt mép đoạn bên cạnh thì để lại chỗ HỞ —
 * hở cũng không vào video, nên trông như không có gì đổi.
 *
 * Nên sửa một khoảng đi đường khác: trả nó về, XOÁ hai lằn chia hai đầu, rồi
 * `removeRange` bỏ lại theo mốc mới. Một phép nguyên thuỷ, không luật thứ tự nào
 * phải nhớ, đúng ở cả khoảng nằm sát đầu lẫn sát cuối bản.
 *
 * Phải xoá lằn chia cũ chứ không để đó: `splitAt` từ chối chẻ khi mẩu sinh ra
 * ngắn hơn 0,3 giây, nên còn lằn cũ thì mọi cú kéo dưới 0,3 giây quanh nó đều
 * không ăn — người dùng kéo, thả, và khoảng nhảy về chỗ cũ mà không lời nào báo.
 */

/** Khoảng thêm mới dài bằng ngần này rồi người dùng kéo lại. */
const NEW_SPAN = 1;
/** Hẹp hơn thế thì thêm vào cũng không kéo nổi — thà báo là không còn chỗ. */
const MIN_NEW_SPAN = 0.15;

/** Một clip trên dải: đúng một tệp cảnh chính đã nạp. */
export type CutClip = {
  id: string;
  start: number;
  end: number;
  label: string;
  srcStart: number;
};

/** Các đoạn đã đánh dấu BỎ, rút ra từ một tập `segment` bất kỳ. */
const removedSpans = (rows: ApiSegment[]): Span[] =>
  rows
    .filter((row) => row.removed === 1)
    .map((row) => ({ id: row.id, start: row.start_sec, end: row.end_sec }));

export function useCutEdit(projectId: string | undefined) {
  const [segments, setSegments] = useState<ApiSegment[]>([]);
  const [clips, setClips] = useState<CutClip[]>([]);
  const [strip, setStrip] = useState({
    url: "",
    seconds: 0,
    nativeSecondWidth: DEFAULT_PX_PER_SECOND,
  });
  const [envelope, setEnvelope] = useState<AudioEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * Sổ hoàn tác: mỗi mục là TOÀN BỘ danh sách khoảng cắt TRƯỚC một thao tác.
   *
   * Ghi nghịch đảo từng phép thì phải nhớ ba luật riêng (thêm ngược lại là xoá,
   * xoá ngược lại là thêm ở đâu, kéo ngược lại là kéo về mốc nào) và mã mới sinh
   * ra sau mỗi lần `removeRange` lại khác. Chụp cả danh sách thì chỉ có MỘT phép
   * để đúng — `applySpans` — và nó cũng chính là phép ba thao tác kia gọi.
   * Số khoảng luôn dưới vài chục nên chép cả danh sách chẳng tốn gì.
   */
  const history = useRef<Array<Array<{ start: number; end: number }>>>([]);
  const [depth, setDepth] = useState(0);

  /**
   * Trạng thái đoạn, đọc-ĐỒNG-BỘ.
   *
   * Mọi phép sửa cần trạng thái MỚI NHẤT ngay lúc chạy, không đợi React vẽ lại.
   * `setSegments` chỉ thấy ở lượt vẽ sau, nên trong một chuỗi phép nối đuôi (xem
   * `enqueue`) mà đọc từ state thì phép sau đọc trúng trạng thái CŨ của phép
   * trước. Giữ một bản trong ref, cập nhật cùng nhịp với state.
   */
  const segmentsRef = useRef<ApiSegment[]>([]);
  const applyRows = useCallback((rows: ApiSegment[]) => {
    segmentsRef.current = rows;
    setSegments(rows);
  }, []);

  /**
   * HÀNG ĐỢI MỘT LÀN — mọi phép sửa cắt chạy nối đuôi, không bao giờ chồng nhau.
   *
   * Mỗi phép là một chuỗi nhiều vòng gọi máy chủ (`dissolve`→`removeRange`…) cùng
   * mutate bảng `segment`. Kéo qua lại nhanh khiến hai chuỗi đè lên nhau: kết quả
   * về sai thứ tự, hai lát cắt cạnh nhau bị gộp và đoạn phim ở giữa BIẾN MẤT mà
   * người dùng không bấm gì. Nối đuôi thì phép sau luôn chạy trên trạng thái đã
   * yên của phép trước — hết xung đột. Lỗi một phép không chặn phép kế (`op` chạy
   * ở cả hai nhánh) để một lần hỏng mạng không khoá cứng cả dải.
   */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(op: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(op, op);
    queue.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    void (async () => {
      // `getProject` TRƯỚC — chính lượt ấy kéo đoạn cuối tới ĐỘ DÀI THẬT của
      // `base.mp4` (server `extendToDuration`). Rồi `sealCutGaps` HÀN mọi lỗ hổng
      // giữa các đoạn cho liền mạch (lỗ ở màn Cắt là rác của cú kéo dở dang; nếu
      // để đó thì `keptFromSegments` và Soát lời tính là "đã bỏ" còn màn Cắt vẫn
      // hiện là giữ — ba nơi lệch). Nó trả về luôn danh sách đã hàn.
      const project = await api.getProject(projectId);
      const rows = await api.sealCutGaps(projectId);
      if (!alive) return;
      applyRows(rows);

      /*
       * Clip trên dải là CÁC TỆP CẢNH CHÍNH nối đuôi nhau, không phải các đoạn.
       *
       * Đoạn là đơn vị của việc cắt; clip là đơn vị của việc quay. Vẽ dải theo
       * đoạn thì mỗi lần bỏ một chỗ là dải tự vỡ thêm hai lằn chia, và người dùng
       * thấy phim mình bị băm nhỏ dần theo số lần cắt. Vẽ theo clip thì dải đứng
       * yên — nó là thứ họ nạp lên — còn chỗ cắt chỉ là một lớp CHE đè lên.
       */
      let at = 0;
      const laid: CutClip[] = [];
      for (const file of project.files) {
        if (file.role !== "main") continue;
        const length = file.duration ?? 0;
        if (length <= 0) continue;
        laid.push({
          id: file.id,
          start: at,
          end: at + length,
          label: file.name,
          // Một trục duy nhất ở bước này — bản cắt chưa nướng vào phim, nên mốc
          // trên dải chính là mốc của `base.mp4` mà dải ảnh cắt ra từ đó.
          srcStart: at,
        });
        at += length;
      }
      // Kéo mép clip cuối tới ĐỘ DÀI THẬT (mép đoạn cuối, server đã kéo tới độ dài
      // đo từ `base.mp4`). Tổng `file.duration` các tệp gốc hay HỤT vài phần mười
      // giây (video VFR đo thiếu), nên để clip cuối dừng ở đó thì còn một khúc đuôi
      // footage thật mà trần cắt không với tới. Khớp lại thì dải phim phủ hết và
      // cắt được tới cuối.
      const trueEnd = rows.at(-1)?.end_sec ?? at;
      if (laid.length > 0 && trueEnd > laid[laid.length - 1].end + 0.02) {
        laid[laid.length - 1] = { ...laid[laid.length - 1], end: trueEnd };
      }
      setClips(laid);
      setStrip({
        url: api.filmstripUrl(projectId, project.project.strip_seconds),
        seconds: project.project.strip_seconds ?? Math.ceil(at) + 1,
        nativeSecondWidth:
          project.project.strip_native_second_width ?? DEFAULT_PX_PER_SECOND,
      });
      setLoading(false);

      // Sóng tới sau cũng được — dải vẽ được ngay, sóng chỉ là tầng đáy của khối.
      // Máy chủ có thể phải dựng `envelope.json` lần đầu, mất vài giây.
      try {
        const wave = await api.getEnvelope(projectId);
        if (alive) setEnvelope(wave);
      } catch {
        // Không có sóng thì dải vẫn dùng được, chỉ là nhìn ít hơn. Không chặn.
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId, applyRows]);

  // Trần cắt = mép muộn nhất giữa clip cuối và đoạn cuối. Đoạn cuối do server kéo
  // tới độ dài THẬT (`extendToDuration`), nên `Math.max` bắt được khúc đuôi mà tổng
  // `file.duration` (mép clip) đo hụt — không thì kéo cắt không tới cuối footage.
  const total = Math.max(
    clips.at(-1)?.end ?? 0,
    segments.at(-1)?.end_sec ?? 0,
  );
  const spans: Span[] = removedSpans(segments);

  /**
   * Trả một khoảng về video và xoá hai lằn chia của nó.
   *
   * Chỉ gộp sang đoạn liền kề khi đoạn ấy đang GIỮ. Gộp vào một khoảng cắt khác
   * là âm thầm nuốt mất nó — hai chỗ cắt cạnh nhau thành một, và chỗ phim ở giữa
   * biến mất khỏi bản dựng mà không ai bấm gì.
   */
  const dissolve = useCallback(
    async (id: string): Promise<ApiSegment[]> => {
      if (!projectId) return [];
      await api.updateSegment(id, { removed: false });
      let rows = await api.listSegments(projectId);
      const at = rows.findIndex((row) => row.id === id);
      if (at < 0) return rows;

      let host = at;
      if (at > 0 && rows[at - 1].removed === 0) {
        rows = await api.mergeSegment(id);
        host = at - 1;
      }
      const next = rows[host + 1];
      if (next && next.removed === 0) rows = await api.mergeSegment(next.id);
      return rows;
    },
    [projectId],
  );

  /** Đặt lại TOÀN BỘ tập khoảng cắt — phép duy nhất mọi thao tác đi qua. */
  const applySpans = useCallback(
    async (target: Array<{ start: number; end: number }>) => {
      if (!projectId) return;
      let rows = await api.listSegments(projectId);
      for (const row of rows.filter((item) => item.removed === 1)) {
        rows = await dissolve(row.id);
      }
      // Bỏ từ CUỐI lên ĐẦU: `removeRange` chẻ đoạn, nên đi xuôi thì các mốc phía
      // sau đã xê dịch sau lần bỏ đầu tiên.
      for (const span of [...target].sort((a, b) => b.start - a.start)) {
        rows = await api.removeRange(projectId, span.start, span.end, true);
      }
      applyRows(rows);
    },
    [projectId, dissolve, applyRows],
  );

  // Chụp trạng thái TRƯỚC một phép — đọc từ ref (mới nhất), không từ `spans`
  // trong closure (có thể là bản của lượt vẽ cũ giữa một chuỗi phép nối đuôi).
  const remember = useCallback(() => {
    history.current.push(
      removedSpans(segmentsRef.current).map(({ start, end }) => ({
        start,
        end,
      })),
    );
    setDepth(history.current.length);
  }, []);

  const undo = useCallback(
    () =>
      enqueue(async () => {
        const previous = history.current.pop();
        setDepth(history.current.length);
        if (previous) await applySpans(previous);
      }),
    [applySpans, enqueue],
  );

  const resizeSpan = useCallback(
    (id: string, start: number, end: number) =>
      enqueue(async () => {
        if (!projectId) return;
        remember();
        await dissolve(id);
        applyRows(await api.removeRange(projectId, start, end, true));
      }),
    [projectId, dissolve, remember, enqueue, applyRows],
  );

  const deleteSpan = useCallback(
    (id: string) =>
      enqueue(async () => {
        remember();
        applyRows(await dissolve(id));
      }),
    [dissolve, remember, enqueue, applyRows],
  );

  /**
   * ĐO KHOẢNG LẶNG QUANH MỐC `at` để định bề rộng đoạn cắt mới.
   *
   * Người dùng bấm thêm ở đâu thì thường ở đó có tiếng cần bỏ — một quãng ề à,
   * một chỗ nghỉ dài. Nong ra hai phía CHỪNG NÀO CÒN DƯỚI mức tiếng nói thì bắt
   * trọn đúng khoảng lặng ấy, khỏi phải kéo tay. Không có sóng, hoặc chỗ ấy
   * đang có tiếng, thì trả `null` để nơi gọi dùng bề rộng mặc định.
   */
  const silenceAround = useCallback(
    (at: number): { start: number; end: number } | null => {
      if (!envelope) return null;
      const { hop, values, speechLevel } = envelope;
      const here = Math.floor(at / hop);
      if ((values[here] ?? 1) >= speechLevel) return null; // đang có tiếng
      let lo = here;
      let hi = here;
      while (lo > 0 && (values[lo - 1] ?? 1) < speechLevel) lo -= 1;
      while (hi < values.length - 1 && (values[hi + 1] ?? 1) < speechLevel) hi += 1;
      const start = lo * hop;
      const end = (hi + 1) * hop;
      return end - start >= MIN_NEW_SPAN ? { start, end } : null;
    },
    [envelope],
  );

  /**
   * Thêm một khoảng quanh mốc `at`. Trả `false` nếu chỗ ấy không còn chỗ trống.
   *
   * Bề rộng lấy theo ĐỘ LẶNG đo được quanh mốc; không có khoảng lặng rõ thì một
   * khoảng mặc định để người dùng kéo lại.
   *
   * PHẢI chặn không cho chạm khoảng bên cạnh: dính vào là `coalesceRemoved` gộp
   * làm một, số khoảng không đổi, và nút bấm trông như hỏng. Chạm mép thì co lại
   * cho vừa; hẹp quá mới chịu thua, và lúc ấy phải NÓI, không im.
   */
  const addSpanAt = useCallback(
    (at: number): Promise<string | null> =>
      enqueue(async () => {
        if (!projectId || total <= 0) return null;
        // Mốc kề bên đọc từ trạng thái TƯƠI (ref), không từ `spans` closure — nếu
        // không, thêm ngay sau một cú kéo có thể tính floor/ceiling trên bản cũ.
        const live = removedSpans(segmentsRef.current);
        const before = live.filter((span) => span.end <= at).at(-1);
        const after = live.find((span) => span.start > at);
        const floor = before?.end ?? 0;
        const ceiling = after?.start ?? total;
        if (at < floor || at >= ceiling) return null;

        const quiet = silenceAround(at);
        let start: number;
        let end: number;
        if (quiet) {
          start = Math.max(floor, quiet.start);
          end = Math.min(ceiling, quiet.end);
        } else {
          start = Math.max(
            floor,
            Math.min(at - NEW_SPAN / 2, ceiling - MIN_NEW_SPAN),
          );
          end = Math.min(start + NEW_SPAN, ceiling);
        }
        if (end - start < MIN_NEW_SPAN) return null;

        remember();
        const rows = await api.removeRange(projectId, start, end, true);
        applyRows(rows);
        // Trả đoạn VỪA TẠO để nơi gọi active luôn — đoạn phủ giữa khoảng vừa bỏ.
        const mid = (start + end) / 2;
        const created = rows.find(
          (row) => row.removed === 1 && row.start_sec <= mid && row.end_sec >= mid,
        );
        return created?.id ?? null;
      }),
    [projectId, total, remember, silenceAround, enqueue, applyRows],
  );

  return {
    spans,
    clips,
    strip,
    envelope,
    total,
    loading,
    canUndo: depth > 0,
    undo,
    resizeSpan,
    deleteSpan,
    addSpanAt,
  };
}
