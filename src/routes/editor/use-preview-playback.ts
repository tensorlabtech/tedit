import { useEffect, useRef, useState } from "react";

import type { EditorState } from "./use-editor";

/**
 * VÒNG LẶP PHÁT của bàn dựng — tách khỏi màn để bàn dựng cũ (`/editor`) và bước
 * "Bàn dựng" trong /flow dùng CHUNG một cơ chế.
 *
 * Cờ phát nằm ở màn chứ không trong `useEditor`: nó gắn với đồng hồ thật và thẻ
 * `<video>`, không gắn với dữ liệu. Đồng hồ LÀ VIDEO — mạng khựng thì vạch chạy
 * chậm theo, không ai tua ai. Đẩy mốc vào state 20 lần/giây (đủ cho mắt), vẫn
 * tính ở 60fps để không tích luỹ sai số. Xem chú thích chi tiết ngay trong vòng.
 */
export function usePreviewPlayback(editor: EditorState) {
  const { seek, duration } = editor;
  const [playing, setPlaying] = useState(false);

  const timeRef = useRef(editor.time);
  timeRef.current = editor.time;
  const skipRef = useRef(editor.nextKeptTime);
  skipRef.current = editor.nextKeptTime;

  /** Mốc DỪNG của lần phát hiện tại (giây gốc); `null` là chạy tới hết. */
  const stopAtRef = useRef<number | null>(null);
  /** Quãng đang nghe thử, đọc được NGAY trong lượt vẽ đặt nó. */
  const auditRef = useRef<{ start: number; end: number } | null>(null);
  /** Kết thúc lượt nghe thử — qua ref để không dựng lại vòng mỗi lần nghe. */
  const endAudit = useRef(() => editor.startAudit(null));
  endAudit.current = () => editor.startAudit(null);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    // Đồng hồ chạy 60 lần/giây nhưng chỉ ĐẨY VÀO STATE 20 lần — mỗi lần đẩy là
    // dựng lại cả bàn dựng, sáu mươi lần/giây thì máy không theo kịp và kéo dải
    // thấy giật. Hai mươi lần/giây đủ cho mắt nhìn vạch chạy.
    const PUSH_EVERY_MS = 50;
    let carried: number | null = null;
    let pushed: number | null = null;
    let lastPush = 0;
    const tick = (now: number) => {
      const audit = auditRef.current;
      const video = editor.videoRef.current;
      // ĐỒNG HỒ LÀ VIDEO — rơi về đồng hồ tường khi chưa có video, đang dừng,
      // đang tua dở, hoặc đang nghe thử một quãng (lúc đó quãng chỉ huy mốc).
      const videoLeads =
        !!video && !video.paused && !video.seeking && !audit && !video.ended;
      // `timeRef` lệch khỏi mốc vừa đẩy nghĩa là CÓ NGƯỜI TUA chen ngang.
      const seeked =
        pushed === null || Math.abs(timeRef.current - pushed) > 0.001;
      const current = seeked ? timeRef.current : (carried ?? timeRef.current);
      const base =
        audit && (current < audit.start || current >= audit.end)
          ? audit.start
          : current;
      const raw = videoLeads ? video.currentTime : base + (now - last) / 1000;
      last = now;
      // Nhảy qua chỗ đã bỏ: xem trước phải giống hệt video sẽ xuất ra.
      const next = auditRef.current ? raw : skipRef.current(raw);
      // Vào một quãng ĐÃ BỎ thì tua video tới chỗ tiếp — tua CÓ CHỦ Ý.
      if (videoLeads && next - raw > 0.05) video.currentTime = next;
      if (stopAtRef.current != null && next >= stopAtRef.current) {
        setPlaying(false);
        auditRef.current = null;
        endAudit.current();
        seek(stopAtRef.current);
        stopAtRef.current = null;
        return;
      }
      if (next >= duration) {
        setPlaying(false);
        seek(duration);
        return;
      }
      if (now - lastPush >= PUSH_EVERY_MS) {
        lastPush = now;
        pushed = next;
        carried = null;
        seek(next);
      } else {
        carried = next;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, seek, duration, editor.videoRef]);

  /** Phát/dừng bằng tay — bỏ mốc dừng và hạ cờ nghe thử để ra ĐÚNG video xuất. */
  const togglePlay = () => {
    stopAtRef.current = null;
    endAudit.current();
    setPlaying((current) => !current);
  };

  /** Xem thử một khoảng: đưa vạch tới `at` rồi chạy, dừng ở `until` nếu có. */
  const onPreview = (at: number, until?: number) => {
    stopAtRef.current = until ?? null;
    const from = Math.max(0, at);
    seek(from);
    // Vòng lặp đọc `timeRef` NGAY lượt này, mà `seek` phải đợi lượt sau.
    timeRef.current = from;
    setPlaying(true);
  };

  /** Nghe thử một quãng ĐÃ BỎ: treo phép nhảy qua nó, chạy hết quãng rồi dừng. */
  const onAudit = (span: { start: number; end: number }) => {
    editor.startAudit(span);
    stopAtRef.current = span.end;
    seek(span.start);
    timeRef.current = span.start;
    auditRef.current = span;
    setPlaying(true);
  };

  return { playing, setPlaying, togglePlay, onPreview, onAudit };
}
