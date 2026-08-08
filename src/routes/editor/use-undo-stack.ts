import { useCallback, useEffect, useState } from "react";

import { api, type ApiSegment } from "@/lib/api";
import type { UndoEntry } from "./editor-data";
import { boQuaLoi } from "./ignore-error";
import { shape, toMusicTrack } from "./shape-project";

type Shaped = ReturnType<typeof shape>;

/**
 * NGĂN HOÀN TÁC — và cách đảo ngược từng loại thao tác.
 *
 * Tách khỏi `use-editor.ts` vì đây là chỗ ĐAN NHIỀU NHẤT bàn dựng: hơn hai trăm
 * dòng biết cách đảo ngược đủ mười hai loại, với tay vào nhạc, chữ, đoạn, hiệu
 * ứng và từ. Để chung thì đọc bất cứ miền nào cũng phải cuộn qua nó.
 *
 * Tách ra KHÔNG làm hết đan xen: nó vẫn ghi lên cùng một khối `data` như mọi
 * miền khác, và vẫn cần `applySegmentsRef` để gọi ngược vào phần đoạn — cái ref
 * ấy tồn tại chính vì vòng phụ thuộc này. Muốn hết thì phải đổi cách sở hữu
 * trạng thái, không phải đổi chỗ đặt mã.
 */
export function useUndoStack({
  projectId,
  setData,
  setSelection,
  applySegmentsRef,
  durationRef,
  onInsertTrimmed,
  onSceneTrimmed,
}: {
  projectId: string | undefined;
  setData: React.Dispatch<React.SetStateAction<Shaped | null>>;
  setSelection: (value: null) => void;
  applySegmentsRef: React.RefObject<(rows: ApiSegment[]) => void>;
  durationRef: React.RefObject<number>;
  /** Hoàn tác gọt-mép b-roll: mốc từ tư liệu đổi lại → xếp lại lịch màn. */
  onInsertTrimmed?: () => void;
  /** Hoàn tác gọt-mép ô người: mốc từ đổi lại → xếp lại lịch màn. */
  onSceneTrimmed?: () => void;
}) {
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
      // Mép b-roll trả về chỗ cũ → xếp lại lịch màn cho khung người theo kịp.
      onInsertTrimmed?.();
      return;
    }
    if (last.type === "scene-trim") {
      // Ô người không nằm trong `data` — không cần nạp lại `shape(fresh)` như
      // b-roll, chỉ cần ghi mã từ cũ rồi xếp lại lịch màn để đọc ra mốc mới.
      await api
        .updateElement(
          last.elementId,
          last.edge === "start"
            ? { fromWordId: last.wordId }
            : { toWordId: last.wordId },
        )
        .catch(boQuaLoi());
      onSceneTrimmed?.();
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
  }, [undoStack, persist, onInsertTrimmed, onSceneTrimmed]);

  return { undoStack, undoLabel, persist, pushUndo, undo };
}
