import { useEffect, type RefObject } from "react";

import type { Span } from "./cut-lane";
import { cutToSrc, type Kept } from "./cut-time-map";

/**
 * VÒNG PHÁT của màn cắt — phát bản ĐÃ CẮT trên tệp gốc chưa cắt.
 *
 * ## Cú nối tốn bao lâu, và vì sao KHÔNG nuôi thẻ video thứ hai
 *
 * Đo trên trang thử (`scripts/cut-preview/`) với video thật: từ lệnh nối tới khung
 * hình đầu tiên được trình bày mất **33ms — đúng một khung**. Bản xem trước là
 * all-intra (mỗi khung một keyframe) nên seek gần như không tốn gì: `seeked` bắn
 * sau 7ms.
 *
 * Tôi đã thử lối nuôi sẵn một thẻ thứ hai ở điểm ra rồi đổi thẻ tại mép — kỹ thuật
 * chuẩn để giấu quãng seek. Đo đối chứng: **51/34/34ms, y hệt lối một thẻ**
 * (51/33/33). Không mua được gì, mà phải nuôi thêm một luồng giải mã. Nên bỏ.
 *
 * Ghi lại ở đây vì nó trông rất hợp lý và sẽ có người (kể cả tôi) nghĩ lại lần nữa.
 *
 * ## Vì sao là một hook riêng
 *
 * Cái sai của vòng phát là cái sai THEO THỜI GIAN (vấp ở mối nối, tiếng khục, dải
 * trôi bậc) — ảnh chụp không bắt được. Tách ra thì trang thử dựng được CHÍNH nó
 * với video thật và quãng bỏ giả rồi ĐO; để nguyên trong màn thì phải đăng nhập
 * Google mới chạm tới, tức không ai đo được ngoài người ngồi bấm.
 */
export function useCutPlayback({
  playing,
  spans,
  total,
  videoRef,
  kept,
  liveTimeRef,
  auditing,
  setTime,
}: {
  playing: boolean;
  spans: readonly Span[];
  total: number;
  /**
   * Các khoảng còn GIỮ, khi thẻ video đang phát BẢN ĐÃ CẮT.
   *
   * Có nó thì không còn mối nối nào để nhảy — tệp đang phát vốn đã liền mạch — và
   * việc duy nhất của vòng này là quy mốc về trục GỐC để dải vẽ đúng chỗ.
   *
   * `null` = đang phát tệp gốc, chạy lối nhảy-qua-khoảng-bỏ như cũ. Đó cũng là
   * đường lùi cho lúc bản ghép chưa dựng xong hoặc dựng hỏng.
   */
  kept?: readonly Kept[] | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Mốc phát THẬT, cập nhật mỗi khung cho dải trôi 60fps. */
  liveTimeRef: RefObject<number>;
  /** Khoảng đang cố ý nghe thử — chỉ khoảng ấy KHÔNG bị nhảy qua. */
  auditing: RefObject<string | null>;
  setTime: (at: number) => void;
}) {
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    // Đọc `currentTime` MỖI khung: ghi vào `liveTimeRef` để `CutLane` lái dải trôi
    // 60fps (mượt, khớp tiếng), CÒN đẩy vào state chỉ ~20 lần/giây — state giờ chỉ
    // lo đồng hồ + cửa sổ dựng ảnh, mà mỗi lần đẩy vẫn dựng lại phần đó nên 60fps
    // thì phí. Tách hai nhịp: hình trôi 60fps, dữ liệu 20fps.
    const PUSH_EVERY_MS = 50;
    let lastPush = 0;
    // ĐỒNG HỒ MEDIA NỘI SUY. `video.currentTime` chỉ nhích theo khung hình video
    // (~30fps, lại không đều) nên đọc thẳng thì dải TRÔI BẬC: có khung đứng rồi
    // khung sau bù gấp đôi. Neo một mốc (media, đồng hồ tường) rồi chạy mượt rate 1
    // giữa các nấc; chỉ neo lại khi NHẢY, tua lùi, hay lệch xa (video khựng).
    let anchorAt = 0;
    let anchorPerf = 0;
    let anchored = false;

    const tick = (now: number) => {
      const live = videoRef.current;
      if (live) {
        /*
         * ĐANG PHÁT BẢN ĐÃ CẮT: không nhảy gì cả, chỉ quy mốc về trục gốc.
         *
         * Nhánh này ngắn đúng như bản chất của nó — mọi việc khó (nhảy đúng mép,
         * không lọt khung, không kẹt ở khoảng bỏ cuối) biến mất khi thứ đang phát
         * đã là một video liền mạch.
         */
        if (kept && kept.length > 0) {
          const at = cutToSrc(kept, live.currentTime);
          liveTimeRef.current = at;
          if (now - lastPush >= PUSH_EVERY_MS) {
            lastPush = now;
            setTime(at);
          }
          frame = requestAnimationFrame(tick);
          return;
        }
        let at = live.currentTime;
        const here = spans.find((span) => at >= span.start && at < span.end);
        const active = auditing.current
          ? spans.find((span) => span.id === auditing.current)
          : null;
        if (active && at >= active.end) auditing.current = null;

        let jumped = false;
        if (here && auditing.current !== here.id) {
          // Khoảng bỏ CHẠM cuối bản — không còn khung GIỮ nào phía sau. Nhảy tới
          // `here.end` sẽ đứng ở khung của đoạn ĐÃ BỎ rồi đơ luôn. Dừng ngay đầu
          // khoảng bỏ — khung giữ cuối cùng.
          if (here.end >= total - 0.01) {
            live.currentTime = here.start;
            live.pause();
            liveTimeRef.current = here.start;
            setTime(here.start);
            return;
          }
          live.currentTime = here.end;
          at = here.end;
          jumped = true;
        }

        // Mốc cho dải trôi — NỘI SUY để mượt: chạy tiếp từ neo bằng đồng hồ tường,
        // neo lại khi lần đầu / nhảy / tua lùi / lệch > 0,2s (video khựng).
        const predicted = anchorAt + (now - anchorPerf) / 1000;
        if (
          !anchored ||
          jumped ||
          at < anchorAt - 0.02 ||
          Math.abs(at - predicted) > 0.2
        ) {
          anchorAt = at;
          anchorPerf = now;
          anchored = true;
          liveTimeRef.current = at;
        } else {
          liveTimeRef.current = predicted;
        }
        // Nhảy thì ĐẨY NGAY để đồng hồ bật tới chỗ mới không trễ; phát trơn thì
        // gộp về 20fps cho khỏi dựng lại dữ liệu quá dày.
        if (jumped || now - lastPush >= PUSH_EVERY_MS) {
          lastPush = now;
          setTime(at);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, spans, total, kept, videoRef, liveTimeRef, auditing, setTime]);
}
