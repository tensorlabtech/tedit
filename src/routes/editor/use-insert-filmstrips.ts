import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import type { Insert } from "./editor-data";

/** Thang sprite của một clip b-roll — đủ để vẽ dải ảnh trên khối timeline. */
export type InsertStrip = {
  url: string;
  /** Số giây ảnh phủ (`totalSeconds`) — dùng cho `backgroundSize`. */
  seconds: number;
  /** Px/giây khi vẽ ĐÚNG tỉ lệ ở chiều cao dải chuẩn (56px). */
  nativeSecondWidth: number;
};

/**
 * Dựng (hoặc lấy cache) dải ảnh cho MỌI b-roll VIDEO đang có, trả map theo
 * `mediaFileId`. Mỗi tệp dựng MỘT LẦN (ffmpeg, cache máy chủ) — nhiều khối cùng
 * một tệp share chung một dải. Ảnh chưa xong thì khối tạm không có nền, không sập.
 */
export function useInsertFilmstrips(
  inserts: readonly Insert[],
): Record<string, InsertStrip> {
  const [strips, setStrips] = useState<Record<string, InsertStrip>>({});
  // Tệp đã yêu cầu dựng — khỏi gọi lại mỗi lần `inserts` đổi tham chiếu.
  const requested = useRef<Set<string>>(new Set());

  // Chuỗi id tệp video (ổn định theo NỘI DUNG) để effect khỏi chạy lại vô cớ.
  const fileIds = Array.from(
    new Set(
      inserts
        .filter((item) => item.isVideo && item.mediaFileId)
        .map((item) => item.mediaFileId as string),
    ),
  ).join(",");

  useEffect(() => {
    let alive = true;
    for (const fileId of fileIds ? fileIds.split(",") : []) {
      if (requested.current.has(fileId)) continue;
      requested.current.add(fileId);
      void api
        .makeFileFilmstrip(fileId)
        .then((strip) => {
          if (!alive) return;
          setStrips((cur) => ({
            ...cur,
            [fileId]: {
              url: api.fileFilmstripUrl(fileId, strip.seconds),
              seconds: strip.seconds,
              nativeSecondWidth: strip.nativeSecondWidth,
            },
          }));
        })
        .catch(() => {
          requested.current.delete(fileId); // hỏng thì cho thử lại lượt sau
        });
    }
    return () => {
      alive = false;
    };
  }, [fileIds]);

  return strips;
}
