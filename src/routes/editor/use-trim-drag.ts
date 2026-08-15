import { useCallback, useRef, useState } from "react";

import { api, type ApiSegment } from "@/lib/api";
import type { JunctionId } from "@/dev/overlays/overlay-model";
import type { ScheduledScene } from "../../../server/timing";
import { shape, toMusicTrack } from "./shape-project";
import type { UndoEntry, Word } from "./editor-data";
import { boQuaLoi } from "./ignore-error";
import { MIN_EFFECT_LENGTH, MIN_MUSIC_LENGTH, MIN_SEGMENT, MIN_TEXT_LENGTH } from "./editor-limits";
import type { TrimKind } from "./use-timeline-drag";

type Shaped = ReturnType<typeof shape>;
type EffectRow = { id: string; start: number; end: number; kind: JunctionId };

/** Tìm chỉ số TỪ gần `target` nhất trong đoạn [from, to], đo theo `metric`. */
function nearestWordIndex(
  words: readonly Word[],
  from: number,
  to: number,
  target: number,
  metric: (word: Word) => number,
): number {
  let best = from;
  for (let i = from; i <= to; i += 1) {
    if (
      Math.abs(metric(words[i]) - target) <
      Math.abs(metric(words[best]) - target)
    ) {
      best = i;
    }
  }
  return best;
}

/**
 * Thu hẹp biên tìm từ theo mốc XUẤT RA của khối LIỀN KỀ — không cho mép ô
 * người vượt qua khối đó (không đè lên b-roll hay ô người khác).
 */
function clampSearchBound(
  words: readonly Word[],
  toOutput: (at: number) => number,
  fixedIndex: number,
  toward: "start" | "end",
  limitOutput: number,
  metric: (word: Word) => number,
): number {
  let bound = fixedIndex;
  if (toward === "start") {
    for (let i = fixedIndex; i >= 0; i -= 1) {
      if (toOutput(metric(words[i])) < limitOutput - 0.001) break;
      bound = i;
    }
  } else {
    for (let i = fixedIndex; i < words.length; i += 1) {
      if (toOutput(metric(words[i])) > limitOutput + 0.001) break;
      bound = i;
    }
  }
  return bound;
}

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
  dataRef,
  sceneScheduleRef,
  timeMapRef,
  onInsertTrimmed,
  onSceneTrimmed,
}: {
  projectId: string | undefined;
  setData: React.Dispatch<React.SetStateAction<Shaped | null>>;
  pushUndo: (entry: UndoEntry) => void;
  applySegmentsRef: React.RefObject<(rows: ApiSegment[]) => void>;
  effectsRef: React.RefObject<EffectRow[]>;
  /** Bản `data` mới nhất — nhánh "scene" cần `words` mà không đụng `current` của `setData`. */
  dataRef: React.RefObject<Shaped | null>;
  /** LỊCH MÀN mới nhất — ô người không nằm trong `data`, tra ở đây mốc hiện tại + khối liền kề. */
  sceneScheduleRef: React.RefObject<readonly ScheduledScene[]>;
  /** Quy đổi nguồn ⇄ xuất ra — ô người neo theo từ (mốc nguồn) nhưng schedule vẽ theo mốc XUẤT RA. */
  timeMapRef: React.RefObject<{
    toOutput: (at: number) => number;
    toSource: (at: number) => number;
  }>;
  /**
   * Gọt mép b-roll xong: mốc từ của tư liệu đã đổi, nên LỊCH MÀN phải xếp lại —
   * khung người hai bên nới ra lấp đúng chỗ b-roll vừa co. Không gọi thì dải bố
   * cục còn một cái hở tới lần nạp sau.
   */
  onInsertTrimmed?: () => void;
  /** Gọt mép Ô NGƯỜI xong: mốc từ đã đổi, xếp lại lịch màn — cùng lý do trên. */
  onSceneTrimmed?: () => void;
}) {
  /**
   * Khối Ô NGƯỜI đang được kéo — bản xem trước CỤC BỘ. `schedule` là state
   * RIÊNG (`useSceneLayout`), không đi qua `setData` như b-roll, nên không thể
   * "cứ đổi `current` là dải tự vẽ lại" như mọi nhánh khác trong `trim`. Chỉ
   * khối đang kéo cần override mốc của chính nó lúc vẽ.
   */
  const [scenePreview, setScenePreview] = useState<{
    elementId: string;
    start: number;
    end: number;
  } | null>(null);

  const dragTrim = useRef<{
    /** Mỗi loại một đường ghi khác nhau */
    kind: TrimKind;
    id: string;
    edge: "start" | "end";
    /** Mốc mới của mép, chốt lúc thả tay */
    at: number;
    /** Mốc cũ, để hoàn tác */
    was: number;
    /** Tư liệu chèn / ô người neo vào TỪ, nên mép của nó là một mã từ chứ không phải giây */
    wordId?: string;
    wasWordId?: string;
    /**
     * Có mặt khi lần kéo này BIẾN một hiệu ứng tự suy thành hàng thật. Hoàn tác
     * lúc ấy phải XOÁ hàng đi chứ không phải trả mép về chỗ cũ — trả mép thì còn
     * lại một hàng thật trùng khít cái tự suy, nhìn không ra khác biệt mà lần
     * sau đổi mặc định dự án thì chỗ này trơ ra.
     */
    wasKind?: JunctionId;
    /**
     * Ô NGƯỜI: chỉ số từ ở mép ĐỐI DIỆN (không kéo) và mốc XUẤT RA của khối
     * liền kề — tính MỘT LẦN lúc bắt đầu kéo, giữ nguyên suốt lượt để khỏi trôi
     * vì sai số làm tròn cộng dồn qua từng khung chuột.
     */
    fixedIndex?: number;
    neighborLimit?: number;
    /**
     * B-ROLL kiểu CapCut: kéo mép khối = chọn CỬA SỔ nguồn. Đổi đồng thời vị trí
     * (start/end) và cửa sổ (mediaIn/mediaOut), giữ bất biến out−in == end−start.
     * Chốt lúc thả ghi cả bốn; `wasStart/End/In/Out` là bộ CŨ để hoàn tác.
     */
    insertStart?: number;
    insertEnd?: number;
    mediaIn?: number;
    mediaOut?: number;
    wasStart?: number;
    wasEnd?: number;
    wasIn?: number | null;
    wasOut?: number | null;
  } | null>(null);

  /**
   * KÉO DỜI cả khối (body drag) — khác `trim` (kéo mép). Giữ NGUYÊN độ dài, chỉ
   * dời chỗ. Khối neo-TỪ (b-roll) snap theo từ, giữ nguyên SỐ TIẾNG; khối neo-GIÂY
   * (nhạc/chữ tự do/hiệu ứng) dời theo giây. Chốt lúc thả ở `commitMove`.
   */
  const dragMove = useRef<{
    kind: TrimKind;
    id: string;
    /** neo-từ (b-roll): mã từ mới hai mép + mã cũ để hoàn tác. */
    fromWordId?: string;
    toWordId?: string;
    wasFromWordId?: string;
    wasToWordId?: string;
    /** neo-giây: mốc mới + mốc cũ (để hoàn tác). */
    start?: number;
    end?: number;
    wasStart?: number;
    wasEnd?: number;
  } | null>(null);

  const move = useCallback((kind: TrimKind, id: string, targetStart: number) => {
    // KHUNG NGƯỜI: không sống trong `data` — lịch màn là state riêng. Dời cả khối
    // = snap mép ĐẦU vào từ gần `targetStart`, giữ nguyên SỐ TIẾNG. Vẽ tạm qua
    // `scenePreview` (mốc XUẤT RA) như nhánh scene của `trim`.
    if (kind === "scene") {
      const schedule = sceneScheduleRef.current;
      const scene = schedule.find(
        (item) => item.elementId === id && item.insert === undefined,
      );
      const words = dataRef.current?.words ?? [];
      if (!scene || words.length === 0) return;
      const { toOutput, toSource } = timeMapRef.current;
      const fromIdx = nearestWordIndex(
        words, 0, words.length - 1, toSource(scene.start), (w) => w.start,
      );
      const toIdx = nearestWordIndex(
        words, 0, words.length - 1, toSource(scene.end), (w) => w.end,
      );
      const span = toIdx - fromIdx;
      let newFrom = nearestWordIndex(
        words, 0, Math.max(0, words.length - 1 - span), targetStart, (w) => w.start,
      );
      newFrom = Math.max(0, Math.min(newFrom, words.length - 1 - span));
      const newTo = newFrom + span;
      dragMove.current = {
        kind: "scene",
        id,
        fromWordId: words[newFrom].id,
        toWordId: words[newTo].id,
        wasFromWordId: dragMove.current?.wasFromWordId ?? words[fromIdx].id,
        wasToWordId: dragMove.current?.wasToWordId ?? words[toIdx].id,
      };
      setScenePreview({
        elementId: id,
        start: toOutput(words[newFrom].start),
        end: toOutput(words[newTo].end),
      });
      return;
    }
    setData((current) => {
      if (!current) return current;
      // B-ROLL / NHẠC / CHỮ TỰ DO: neo theo GIÂY → dời cả khối theo delta, giữ
      // nguyên độ dài, kẹp start ≥ 0.
      const shiftSeconds = (
        cur: { start: number; end: number },
      ): { start: number; end: number } => {
        const len = cur.end - cur.start;
        const start = Math.max(0, targetStart);
        return { start, end: start + len };
      };
      if (kind === "insert") {
        const insert = current.inserts.find((item) => item.id === id);
        if (!insert) return current;
        const next = shiftSeconds(insert);
        dragMove.current = {
          kind, id, ...next,
          wasStart: dragMove.current?.wasStart ?? insert.start,
          wasEnd: dragMove.current?.wasEnd ?? insert.end,
        };
        return {
          ...current,
          inserts: current.inserts.map((item) =>
            item.id === id ? { ...item, ...next } : item,
          ),
        };
      }
      if (kind === "music") {
        const track = current.music.find((item) => item.id === id);
        if (!track) return current;
        const next = shiftSeconds(track);
        dragMove.current = {
          kind, id, ...next,
          wasStart: dragMove.current?.wasStart ?? track.start,
          wasEnd: dragMove.current?.wasEnd ?? track.end,
        };
        return {
          ...current,
          music: current.music.map((item) =>
            item.id === id ? { ...item, ...next } : item,
          ),
        };
      }
      if (kind === "text") {
        const element = current.textElements.find((item) => item.id === id);
        if (!element) return current;
        const next = shiftSeconds(element);
        dragMove.current = {
          kind, id, ...next,
          wasStart: dragMove.current?.wasStart ?? element.start,
          wasEnd: dragMove.current?.wasEnd ?? element.end,
        };
        return {
          ...current,
          textElements: current.textElements.map((item) =>
            item.id === id ? { ...item, ...next } : item,
          ),
        };
      }
      if (kind === "effect") {
        const manual = current.manualEffects.find((item) => item.id === id);
        const original =
          manual ?? effectsRef.current.find((item) => item.id === id) ?? null;
        if (!original) return current;
        const next = shiftSeconds(original);
        dragMove.current = {
          kind, id, ...next,
          wasStart: dragMove.current?.wasStart ?? original.start,
          wasEnd: dragMove.current?.wasEnd ?? original.end,
        };
        return {
          ...current,
          manualEffects: manual
            ? current.manualEffects.map((item) =>
                item.id === id ? { ...item, ...next } : item,
              )
            : [...current.manualEffects, { id, ...next, kind: original.kind }],
        };
      }
      return current;
    });
  }, []);

  const commitMove = useCallback(async () => {
    const pending = dragMove.current;
    dragMove.current = null;
    setScenePreview(null); // hết nhiệm vụ dù dời loại nào
    if (!projectId || !pending) return;
    if (pending.kind === "scene") {
      if (pending.fromWordId && pending.toWordId) {
        await api
          .updateElement(pending.id, {
            fromWordId: pending.fromWordId,
            toWordId: pending.toWordId,
          })
          .catch(boQuaLoi());
      }
      onSceneTrimmed?.(); // xếp lại lịch màn (khung dời → chỗ trống về toàn-khung)
      return;
    }
    if (pending.kind === "insert") {
      // B-roll neo-GIÂY: dời = ghi start/end mới.
      await api
        .updateElement(pending.id, {
          start: pending.start,
          end: pending.end,
        })
        .catch(boQuaLoi());
      onInsertTrimmed?.(); // xếp lại lịch màn (b-roll dời → khung người lấp lại)
      return;
    }
    if (pending.kind === "effect") {
      const item = effectsRef.current.find((row) => row.id === pending.id);
      await api
        .setEffect(projectId, pending.id, {
          start: pending.start ?? 0,
          end: pending.end ?? 0,
          kind: item?.kind ?? "zoom-in",
        })
        .catch(boQuaLoi());
      return;
    }
    if (pending.kind === "text") {
      await api
        .updateElement(pending.id, { start: pending.start, end: pending.end })
        .catch(boQuaLoi());
      return;
    }
    if (pending.kind === "music") {
      await api
        .updateMusic(pending.id, { start: pending.start, end: pending.end })
        .catch(boQuaLoi());
    }
  }, [projectId, onInsertTrimmed, onSceneTrimmed]);

  const trim = useCallback(
    (kind: TrimKind, id: string, edge: "start" | "end", nextTime: number) => {
      // Ô NGƯỜI không sống trong `data`/`current` — lịch màn là state riêng
      // (`use-scene-layout.ts`). Nhánh này đứng NGOÀI `setData`: chỉ đọc
      // `dataRef`/`sceneScheduleRef` (đã fresh qua ref) rồi ghi vào
      // `scenePreview` cục bộ, không đụng gì tới `current`.
      if (kind === "scene") {
        const schedule = sceneScheduleRef.current;
        const scene = schedule.find(
          (item) => item.elementId === id && item.insert === undefined,
        );
        const words = dataRef.current?.words ?? [];
        if (!scene || words.length === 0) return;
        const { toOutput, toSource } = timeMapRef.current;

        const cache =
          dragTrim.current?.kind === "scene" && dragTrim.current.id === id
            ? dragTrim.current
            : null;

        // Mép ĐỐI DIỆN đứng yên suốt lượt kéo.
        const fixedIndex =
          cache?.fixedIndex ??
          nearestWordIndex(
            words,
            0,
            words.length - 1,
            toSource(edge === "start" ? scene.end : scene.start),
            edge === "start" ? (w) => w.end : (w) => w.start,
          );

        // Mốc XUẤT RA của khối liền kề ở phía đang kéo — không cho mép vượt
        // qua, đúng luật "không đè lên b-roll/ô người khác".
        const neighborLimit =
          cache?.neighborLimit ??
          (edge === "end"
            ? schedule
                .filter(
                  (item) =>
                    item.elementId !== id && item.start >= scene.end - 0.001,
                )
                .reduce(
                  (min, item) => Math.min(min, item.start),
                  Number.POSITIVE_INFINITY,
                )
            : schedule
                .filter(
                  (item) =>
                    item.elementId !== id && item.end <= scene.start + 0.001,
                )
                .reduce((max, item) => Math.max(max, item.end), 0));

        const wasWordId =
          cache?.wasWordId ??
          words[
            nearestWordIndex(
              words,
              0,
              words.length - 1,
              toSource(edge === "start" ? scene.start : scene.end),
              edge === "start" ? (w) => w.start : (w) => w.end,
            )
          ].id;

        let pick: number;
        if (edge === "start") {
          const bound = clampSearchBound(
            words,
            toOutput,
            fixedIndex,
            "start",
            neighborLimit,
            (w) => w.start,
          );
          pick = nearestWordIndex(
            words,
            bound,
            fixedIndex,
            nextTime,
            (w) => w.start,
          );
          // Giữ ít nhất một tiếng — hai mép trùng nhau là khối rộng 0.
          if (pick >= fixedIndex) pick = Math.max(bound, fixedIndex - 1);
        } else {
          const bound = clampSearchBound(
            words,
            toOutput,
            fixedIndex,
            "end",
            neighborLimit,
            (w) => w.end,
          );
          pick = nearestWordIndex(
            words,
            fixedIndex,
            bound,
            nextTime,
            (w) => w.end,
          );
          if (pick <= fixedIndex) pick = Math.min(bound, fixedIndex + 1);
        }
        const word = words[pick];

        dragTrim.current = {
          kind: "scene",
          id,
          edge,
          at: edge === "start" ? toOutput(word.start) : toOutput(word.end),
          was: cache?.was ?? (edge === "start" ? scene.start : scene.end),
          wordId: word.id,
          wasWordId,
          fixedIndex,
          neighborLimit,
        };

        setScenePreview({
          elementId: id,
          start: edge === "start" ? toOutput(word.start) : scene.start,
          end: edge === "end" ? toOutput(word.end) : scene.end,
        });
        return;
      }

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

          // ẢNH: đứng hình, KHÔNG có cửa sổ clip → cho kéo DÀI/NGẮN tuỳ ý (chỉ giới
          // hạn MIN_SEGMENT, không âm). Cắt theo `clipDuration` (0,04s của tệp ảnh)
          // là sai — kéo phát co cụt. Xoá luôn mediaIn/mediaOut (vô nghĩa với ảnh).
          if (insert.isVideo === false) {
            let nextStart = insert.start;
            let nextEnd = insert.end;
            if (edge === "start") {
              nextStart = Math.min(
                Math.max(nextTime, 0),
                insert.end - MIN_SEGMENT,
              );
            } else {
              nextEnd = Math.max(nextTime, insert.start + MIN_SEGMENT);
            }
            dragTrim.current = {
              kind: "insert",
              id,
              edge,
              at: edge === "start" ? nextStart : nextEnd,
              was:
                dragTrim.current?.was ??
                (edge === "start" ? insert.start : insert.end),
              insertStart: nextStart,
              insertEnd: nextEnd,
              mediaIn: undefined,
              mediaOut: undefined,
              wasStart: dragTrim.current?.wasStart ?? insert.start,
              wasEnd: dragTrim.current?.wasEnd ?? insert.end,
              wasIn: dragTrim.current?.wasIn ?? insert.mediaIn,
              wasOut: dragTrim.current?.wasOut ?? insert.mediaOut,
            };
            return {
              ...current,
              inserts: current.inserts.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      start: nextStart,
                      end: nextEnd,
                      mediaIn: null,
                      mediaOut: null,
                    }
                  : item,
              ),
            };
          }

          // VIDEO kiểu CapCut: kéo mép khối = chọn CỬA SỔ nguồn [in,out] của clip.
          // Bất biến: out − in == end − start (bề rộng khối = bề rộng cửa sổ, HẾT
          // loop). Mép trái giữ end/out, đổi start→in; mép phải giữ start/in, đổi
          // end→out. TRẦN là độ dài clip (in≥0, out≤clipDuration) → "kéo tới max
          // thì dừng". Cửa sổ chưa cắt (null) coi như [0, độ dài khối].
          const clipDur =
            insert.clipDuration ??
            insert.mediaOut ??
            insert.end - insert.start;
          const inS = insert.mediaIn ?? 0;
          const outS =
            insert.mediaOut ?? Math.min(clipDur, inS + (insert.end - insert.start));

          let nextStart = insert.start;
          let nextEnd = insert.end;
          let nextIn = inS;
          let nextOut = outS;
          if (edge === "start") {
            // Giới hạn dưới `end − outS`: giữ in ≥ 0 (không lấy trước đầu clip).
            nextStart = Math.min(
              Math.max(nextTime, insert.end - outS),
              insert.end - MIN_SEGMENT,
            );
            nextIn = outS - (insert.end - nextStart);
          } else {
            // Giới hạn trên `start + (clipDur − inS)`: giữ out ≤ độ dài clip.
            nextEnd = Math.min(
              Math.max(nextTime, insert.start + MIN_SEGMENT),
              insert.start + (clipDur - inS),
            );
            nextOut = inS + (nextEnd - insert.start);
          }
          dragTrim.current = {
            kind: "insert",
            id,
            edge,
            at: edge === "start" ? nextStart : nextEnd,
            was:
              dragTrim.current?.was ??
              (edge === "start" ? insert.start : insert.end),
            insertStart: nextStart,
            insertEnd: nextEnd,
            mediaIn: nextIn,
            mediaOut: nextOut,
            // Bộ CŨ (chốt ở lần kéo ĐẦU) để hoàn tác trả lại cả bốn.
            wasStart: dragTrim.current?.wasStart ?? insert.start,
            wasEnd: dragTrim.current?.wasEnd ?? insert.end,
            wasIn: dragTrim.current?.wasIn ?? insert.mediaIn,
            wasOut: dragTrim.current?.wasOut ?? insert.mediaOut,
          };
          return {
            ...current,
            inserts: current.inserts.map((item) =>
              item.id === id
                ? {
                    ...item,
                    start: nextStart,
                    end: nextEnd,
                    mediaIn: nextIn,
                    mediaOut: nextOut,
                  }
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
    // Bản xem trước cục bộ hết nhiệm vụ ngay khi thả tay — dù kéo loại nào,
    // vì `scenePreview` chỉ có ý nghĩa TRONG lúc kéo một ô người.
    setScenePreview(null);
    if (!projectId || !pending) return;

    if (pending.kind === "scene") {
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
          type: "scene-trim",
          label: "Đổi khoảng ô người",
          elementId: pending.id,
          edge: pending.edge,
          wordId: pending.wasWordId,
        });
      }
      // Mép ô người đổi → xếp lại lịch màn để khối liền kề lấp đúng chỗ vừa co.
      onSceneTrimmed?.();
      return;
    }

    if (pending.kind === "insert") {
      // B-roll kiểu CapCut: ghi ĐỒNG THỜI vị trí (start/end) và cửa sổ nguồn
      // (mediaIn/mediaOut) — đổi mép là đổi cả hai.
      await api
        .updateElement(pending.id, {
          start: pending.insertStart,
          end: pending.insertEnd,
          mediaIn: pending.mediaIn ?? null,
          mediaOut: pending.mediaOut ?? null,
        })
        .catch(boQuaLoi());
      pushUndo({
        type: "insert-trim",
        label: "Đổi đoạn tư liệu",
        elementId: pending.id,
        start: pending.wasStart ?? pending.insertStart ?? 0,
        end: pending.wasEnd ?? pending.insertEnd ?? 0,
        mediaIn: pending.wasIn ?? null,
        mediaOut: pending.wasOut ?? null,
      });
      // Mép b-roll đổi → xếp lại lịch màn để khung người lấp đúng chỗ vừa co.
      onInsertTrimmed?.();
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
  }, [projectId, pushUndo, onInsertTrimmed, onSceneTrimmed]);

  /**
   * Những chỗ KHÔNG vào video, suy ra từ ĐOẠN — không có danh sách riêng nào nữa.
   *
   * Ba nguồn, cùng một ý: đoạn bị bỏ, hở giữa hai đoạn (do gọt mép), câu bị gạch.
   * Trước đây "cắt tay" là bảng thứ tư song song với đoạn, nên cùng một chuyện có
   * hai chỗ lưu và hai cách hiện trên dải.
   */

  return { dragTrim, trim, commitTrim, move, commitMove, scenePreview };
}
