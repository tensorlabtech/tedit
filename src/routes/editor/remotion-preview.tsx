import { useEffect, useState } from "react";

import { Player } from "@remotion/player";

import { api } from "@/lib/api";
import { VideoComposition } from "@/remotion/video-composition";
import type { RemotionPayload } from "../../../server/remotion-payload";

/**
 * KHUNG XEM = MÁY VẼ REMOTION. Chạy CHÍNH `VideoComposition` (thứ export dùng) qua
 * `@remotion/player`, ăn payload thật từ server → preview = export TỪNG PIXEL, do
 * bản chất. Hết cảnh "xem một đằng xuất một nẻo": bỏ doodle / bo tròn viền / đổi
 * bất cứ gì trong composition → preview tự đổi theo, không phải sửa hai nơi.
 *
 * `reloadKey` đổi → dựng lại payload (khi lịch màn / phần tử đổi).
 */
export function RemotionPreview({
  projectId,
  reloadKey,
}: {
  projectId: string;
  reloadKey?: number | string;
}) {
  const [state, setState] = useState<{
    payload: RemotionPayload | null;
    loaded: boolean;
    error: string | null;
  }>({ payload: null, loaded: false, error: null });

  useEffect(() => {
    let alive = true;
    setState({ payload: null, loaded: false, error: null });
    api
      .remotionPayload(projectId)
      .then((p) => alive && setState({ payload: p, loaded: true, error: null }))
      .catch(
        (e) =>
          alive &&
          setState({ payload: null, loaded: true, error: String(e) }),
      );
    return () => {
      alive = false;
    };
  }, [projectId, reloadKey]);

  if (state.error)
    return (
      <div className="grid size-full place-items-center p-4 text-center text-xs text-muted-foreground">
        Chưa dựng được khung xem: {state.error}
      </div>
    );
  if (!state.loaded)
    return (
      <div className="grid size-full place-items-center text-xs text-muted-foreground">
        Đang dựng khung xem…
      </div>
    );
  const payload = state.payload;
  if (!payload)
    return (
      <div className="grid size-full place-items-center p-4 text-center text-xs text-muted-foreground">
        Chưa có bản dựng (thiếu video gốc hoặc bộ dáng không có bố cục).
      </div>
    );

  return (
    <Player
      component={VideoComposition}
      inputProps={payload}
      durationInFrames={Math.max(1, Math.round(payload.seconds * payload.fps))}
      fps={payload.fps}
      compositionWidth={payload.width}
      compositionHeight={payload.height}
      style={{ width: "100%", height: "100%" }}
      controls
      loop
    />
  );
}
