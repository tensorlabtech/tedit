import { memo, useEffect, useRef, useState, type RefObject } from "react";

import { Player, type PlayerRef } from "@remotion/player";

import { api } from "@/lib/api";
import { VideoComposition } from "@/remotion/video-composition";
import type { EditorState } from "./use-editor";
import type { RemotionPayload } from "../../../server/remotion-payload";

const PLAYER_STYLE = { width: "100%", height: "100%" } as const;

/**
 * Bề mặt Player TÁCH RIÊNG + `memo`: chỉ vẽ lại khi `payload` đổi (props ổn định),
 * KHÔNG vẽ lại theo `editor.time` khi bàn dựng dựng lại lúc kéo dải → hết giật do
 * Player bị dựng lại liên tục. Tua vào Player đi qua `playerRef` (ngoài render).
 */
const PlayerSurface = memo(function PlayerSurface({
  payload,
  playerRef,
  initialFrame,
}: {
  payload: RemotionPayload;
  playerRef: RefObject<PlayerRef | null>;
  /** Mốc khởi động Player — giữ vạch khi payload dựng lại (đổi khung/tư liệu),
      kẻo Player remount ở frame 0 = video nhảy về đầu. */
  initialFrame: number;
}) {
  // Bọc để tắt viền focus (tím) mà nút play/tua của Player nhận từ luật `*` toàn
  // cục — bấm play xong nút giữ focus, viền tím dính lại trông như lỗi. Play/tạm
  // dừng vẫn chạy bằng phím Cách + bấm chuột.
  return (
    <div className="remotion-preview-surface size-full">
      <Player
        ref={playerRef}
        component={VideoComposition}
        inputProps={payload}
        durationInFrames={Math.max(1, Math.round(payload.seconds * payload.fps))}
        fps={payload.fps}
        compositionWidth={payload.width}
        compositionHeight={payload.height}
        initialFrame={initialFrame}
        style={PLAYER_STYLE}
        controls
        loop
      />
    </div>
  );
});

/**
 * KHUNG XEM = MÁY VẼ REMOTION. Chạy CHÍNH `VideoComposition` (thứ export dùng) qua
 * `@remotion/player`, ăn payload thật từ server → preview = export TỪNG PIXEL, do
 * bản chất. Đổi composition (bỏ doodle / bo tròn viền…) → preview tự đổi theo.
 *
 * ĐỒNG BỘ với dải thời gian: Player là ĐỒNG HỒ (thay thẻ <video> cũ). Hai chiều:
 *  - Player chạy → `frameupdate` đẩy `editor.time` (vạch trên dải chạy theo).
 *  - Bấm dải / chọn cụm đổi `editor.time` → tua Player tới đó.
 * Ngưỡng nhỏ (0.05s / 2 frame) chặn dội qua lại. Player ở giờ ĐÃ CẮT (output),
 * `editor.time` ở giờ GỐC (source) — quy đổi bằng `toSource`/`toOutput`.
 */
export function RemotionPreview({
  projectId,
  reloadKey,
  editor,
  playerRef,
}: {
  projectId: string;
  reloadKey?: number | string;
  editor: EditorState;
  playerRef: RefObject<PlayerRef | null>;
}) {
  const [state, setState] = useState<{
    payload: RemotionPayload | null;
    loaded: boolean;
    error: string | null;
  }>({ payload: null, loaded: false, error: null });

  // Vạch hiện tại lúc dựng lại — để Player mount lại đúng chỗ (initialFrame).
  const resumeFrameRef = useRef(0);
  // Dự án đang xem — để phân biệt DỰNG LẠI (đổi khung/tư liệu/chỗ nối, cùng dự án)
  // với ĐỔI DỰ ÁN.
  const prevProjectRef = useRef(projectId);

  useEffect(() => {
    let alive = true;
    resumeFrameRef.current = Math.round(
      toOutputRef.current(timeRef.current) * (state.payload?.fps ?? 30),
    );
    // DỰNG LẠI cùng dự án (reloadKey đổi): GIỮ Player cũ hiển thị trong lúc lấy
    // payload mới rồi TRÁO — hết chớp "Đang dựng khung xem…" và hết NHẢY. Chỉ để
    // trống (loading) khi ĐỔI DỰ ÁN hoặc lần đầu chưa có gì.
    if (prevProjectRef.current !== projectId) {
      setState({ payload: null, loaded: false, error: null });
      prevProjectRef.current = projectId;
    }
    api
      .remotionPayload(projectId)
      .then((p) => alive && setState({ payload: p, loaded: true, error: null }))
      .catch(
        (e) =>
          alive &&
          setState((s) => ({ ...s, loaded: true, error: String(e) })),
      );
    return () => {
      alive = false;
    };
    // state.payload đọc để chốt fps lúc dựng lại — KHÔNG cho vào deps kẻo mỗi lần
    // payload đổi lại chạy = vòng lặp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, reloadKey]);

  // Bản đồ thời gian + mốc hiện tại đọc qua ref để listener không "chốt" bản cũ.
  const timeRef = useRef(editor.time);
  timeRef.current = editor.time;
  const toSourceRef = useRef(editor.toSource);
  toSourceRef.current = editor.toSource;
  const toOutputRef = useRef(editor.toOutput);
  toOutputRef.current = editor.toOutput;
  const seekRef = useRef(editor.seek);
  seekRef.current = editor.seek;
  const lastSeekMsRef = useRef(0);
  const seekTimerRef = useRef<number | null>(null);
  const lastFrameMsRef = useRef(0);

  const fps = state.payload?.fps ?? 30;

  // Payload mới về (trim/dời/đổi khung): ÉP Player vẽ lại KHUNG HIỆN TẠI. Player
  // đang PAUSE không tự vẽ lại chỉ vì `inputProps` đổi tham chiếu — nó kẹt ở
  // arrangement CŨ (timeline một đằng, hình một nẻo). `seekTo` lại đúng chỗ buộc
  // dựng khung với payload mới. Chạy SAU khi payload đã commit (deps `state.payload`).
  useEffect(() => {
    if (!state.payload) return;
    const player = playerRef.current;
    if (!player) return;
    const frame = Math.round(
      toOutputRef.current(timeRef.current) * state.payload.fps,
    );
    player.seekTo(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.payload]);

  // Player → editor: mỗi frame, quy giờ output về source rồi đẩy vạch (nếu lệch đủ).
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => {
      // THROTTLE ~10/s: lúc phát, frameupdate bắn mỗi frame; đẩy editor.time mỗi
      // lần thì cả BÀN DỰNG (Timeline) dựng lại 20-30/s = lag. 10/s đủ cho vạch.
      const now = performance.now();
      if (now - lastFrameMsRef.current < 100) return;
      const src = toSourceRef.current(e.detail.frame / fps);
      if (Math.abs(src - timeRef.current) > 0.05) {
        seekRef.current(src);
        lastFrameMsRef.current = now;
      }
    };
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [playerRef, fps, state.payload]);

  // editor.time → Player: bấm/kéo dải tua Player. THROTTLE ~16 lần/giây (60ms) —
  // kéo nhanh đổi mốc mấy chục lần/giây, seek Player mỗi lần thì giải mã dồn = lag.
  // 16 lần/giây đủ cho mắt lúc kéo nhanh, mà nhẹ decode hẳn. Leading + trailing để
  // mốc CUỐI luôn tới đúng. Đọc `editor` qua ref → deps chỉ `editor.time`.
  useEffect(() => {
    if (!state.payload) return;
    const doSeek = () => {
      seekTimerRef.current = null;
      lastSeekMsRef.current = performance.now();
      const player = playerRef.current;
      if (!player) return;
      const target = Math.round(toOutputRef.current(timeRef.current) * fps);
      if (Math.abs(target - player.getCurrentFrame()) > 2) player.seekTo(target);
    };
    const since = performance.now() - lastSeekMsRef.current;
    if (since >= 60) doSeek();
    else if (seekTimerRef.current == null)
      seekTimerRef.current = window.setTimeout(doSeek, 60 - since);
  }, [editor.time, fps, state.payload, playerRef]);

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
    <PlayerSurface
      payload={payload}
      playerRef={playerRef}
      initialFrame={resumeFrameRef.current}
    />
  );
}
