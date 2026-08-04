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

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    void (async () => {
      const [rows, project] = await Promise.all([
        api.listSegments(projectId),
        api.getProject(projectId),
      ]);
      if (!alive) return;
      setSegments(rows);

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
  }, [projectId]);

  const total = clips.at(-1)?.end ?? segments.at(-1)?.end_sec ?? 0;
  const spans: Span[] = segments
    .filter((row) => row.removed === 1)
    .map((row) => ({ id: row.id, start: row.start_sec, end: row.end_sec }));

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
      setSegments(rows);
    },
    [projectId, dissolve],
  );

  const remember = useCallback(() => {
    history.current.push(spans.map(({ start, end }) => ({ start, end })));
    setDepth(history.current.length);
  }, [spans]);

  const undo = useCallback(async () => {
    const previous = history.current.pop();
    setDepth(history.current.length);
    if (previous) await applySpans(previous);
  }, [applySpans]);

  const resizeSpan = useCallback(
    async (id: string, start: number, end: number) => {
      if (!projectId) return;
      remember();
      await dissolve(id);
      setSegments(await api.removeRange(projectId, start, end, true));
    },
    [projectId, dissolve, remember],
  );

  const deleteSpan = useCallback(
    async (id: string) => {
      remember();
      setSegments(await dissolve(id));
    },
    [dissolve, remember],
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
    async (at: number): Promise<string | null> => {
      if (!projectId || total <= 0) return null;
      const before = spans.filter((span) => span.end <= at).at(-1);
      const after = spans.find((span) => span.start > at);
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
        start = Math.max(floor, Math.min(at - NEW_SPAN / 2, ceiling - MIN_NEW_SPAN));
        end = Math.min(start + NEW_SPAN, ceiling);
      }
      if (end - start < MIN_NEW_SPAN) return null;

      remember();
      const rows = await api.removeRange(projectId, start, end, true);
      setSegments(rows);
      // Trả về đoạn VỪA TẠO để nơi gọi active luôn — đoạn phủ giữa khoảng vừa bỏ.
      const mid = (start + end) / 2;
      const created = rows.find(
        (row) => row.removed === 1 && row.start_sec <= mid && row.end_sec >= mid,
      );
      return created?.id ?? null;
    },
    [projectId, total, spans, remember, silenceAround],
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
