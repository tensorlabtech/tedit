import { useCallback, useRef } from "react";

import { api, type ApiSegment } from "@/lib/api";
import type { JunctionId } from "@/dev/overlays/overlay-model";
import { shape, toMusicTrack } from "./shape-project";
import type { UndoEntry, Word } from "./editor-data";
import { boQuaLoi } from "./ignore-error";
import { MIN_EFFECT_LENGTH, MIN_MUSIC_LENGTH, MIN_SEGMENT, MIN_TEXT_LENGTH } from "./editor-limits";

type Shaped = ReturnType<typeof shape>;
type EffectRow = { id: string; start: number; end: number; kind: JunctionId };

/**
 * KÉO MÉP một khối trên dải thời gian.
 *
 * Kéo thì chỉ đổi hình cho thấy ngay; ghi xuống máy chủ ở `commitTrim` lúc thả
 * tay — mỗi lần kéo bắn hàng chục sự kiện, ghi từng cái là đẻ ra hàng chục đoạn
 * cắt vụn.
 *
 * Tách khỏi `use-editor.ts` vì đây là nhóm dài nhất trong cả bàn dựng mà chỉ cần
 * bốn thứ bên ngoài, và cả bốn đều là chỗ GHI chứ không phải chỗ đọc trạng thái —
 * nên nó không kéo theo nửa còn lại của bàn dựng.
 *
 * `effectsRef` nhận từ ngoài chứ không tự dựng: danh sách hiệu ứng tính ở cuối
 * `useEditor`, sau nhóm này rất xa, mà ref thì phải tồn tại trước lượt đọc đầu.
 */
export function useTrimDrag({
  projectId,
  setData,
  pushUndo,
  applySegmentsRef,
  effectsRef,
}: {
  projectId: string | undefined;
  setData: React.Dispatch<React.SetStateAction<Shaped | null>>;
  pushUndo: (entry: UndoEntry) => void;
  applySegmentsRef: React.RefObject<(rows: ApiSegment[]) => void>;
  effectsRef: React.RefObject<EffectRow[]>;
}) {
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

  return { dragTrim, trim, commitTrim };
}
