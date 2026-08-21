import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { CutLane } from "@/routes/flow/cut-lane";
import { cutToSrc, srcToCut } from "@/routes/flow/cut-time-map";
import type { AudioEnvelope } from "@/routes/editor/timeline-audio-lane";
import { useCutPlayback } from "@/routes/flow/use-cut-playback";
import "@/index.css";

/**
 * ĐO vòng phát của màn Cắt — không cần đăng nhập.
 *
 * Màn Cắt thật nằm sau cổng Google, mà cái sai của vòng phát là cái sai THEO THỜI
 * GIAN (vấp ở mối nối, chờ ở cú nhảy) nên ảnh chụp không bắt được. Trang này dựng
 * CHÍNH `useCutPlayback` với video thật + quãng bỏ giả, rồi đo hai con số:
 *
 * · CHỜ Ở MỐI NỐI — từ lúc vòng phát ra lệnh nhảy tới khung hình đầu tiên chạy lại.
 * · TÁC VỤ DÀI — long task trên main thread quanh cú nhảy (thứ làm "giật sau lát cắt").
 *
 * Cần ba tệp mẫu (KHÔNG commit — nặng, và là dữ liệu dự án thật):
 *
 *   P=server/data/projects/<projectId>
 *   cp $P/work/preview.mp4    scripts/cut-preview/mau.mp4
 *   cp $P/thumbs/strip.jpg    scripts/cut-preview/strip.jpg
 *   cp $P/work/envelope.json  scripts/cut-preview/envelope.json
 *
 *   npm run dev
 *   mở http://localhost:5173/scripts/cut-preview/cut-preview.html
 *   thêm `?fresh=1` để mô phỏng lỗi "mảng mới mỗi tick" (xem `use-cut-edit.ts`)
 */
/*
 * QUY MÔ THẬT, không phải quy mô cho dễ đọc.
 *
 * Dự án thật có 79 đoạn và tới 39 khoảng bỏ; harness ban đầu chỉ có 1 đoạn + 3
 * khoảng nên nó mượt trong khi màn thật giật. Đo ở quy mô sai là đo một màn khác.
 */
const CLIPS = Array.from({ length: 79 }, (_, i) => ({
  id: `c${i}`,
  start: (i * 82) / 79,
  end: ((i + 1) * 82) / 79,
  srcStart: (i * 82) / 79,
  label: `Đoạn ${i + 1}`,
}));
const SPANS = Array.from({ length: 20 }, (_, i) => ({
  id: `s${i}`,
  start: 4 + i * 3.8,
  end: 4 + i * 3.8 + 1.2,
}));

function Harness() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const liveTimeRef = useRef(0);
  const auditing = useRef<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  // Dải sóng THẬT — phần vẽ nặng nhất của dải, và là thứ duy nhất harness còn thiếu
  // so với màn thật.
  const [envelope, setEnvelope] = useState<AudioEnvelope | null>(null);
  useEffect(() => {
    void fetch("/scripts/cut-preview/envelope.json")
      .then((r) => r.json())
      .then(setEnvelope)
      .catch(() => {});
  }, []);

  // `?fresh=1` mô phỏng ĐÚNG lỗi của màn thật: `spans` là mảng MỚI mỗi lần dựng
  // lại (xem `use-cut-edit.ts` — `removedSpans(segments)` gọi thẳng trong thân).
  const moiMoiLan = new URLSearchParams(location.search).has("fresh");
  const spans = moiMoiLan ? SPANS.map((x) => ({ ...x })) : SPANS;
  // `?ghep=1` phát BẢN ĐÃ GHÉP (không mối nối nào) để so với lối nhảy-qua-khoảng.
  const banGhep = new URLSearchParams(location.search).has("ghep");
  const KEPT = [
    { start: 0, end: 6 },
    { start: 9, end: 14 },
    { start: 18.5, end: 24 },
    { start: 26, end: 82 },
  ];

  /*
   * `?doi=1` — diễn lại ĐÚNG vòng đời của màn Cắt để bắt lỗi "nhảy về đầu":
   *   phát tệp gốc → (giây 6) bản ghép sẵn sàng, đổi nguồn → (giây 12) người dùng
   *   sửa khoảng cắt, bản ghép hết hạn, về lại tệp gốc.
   * Mỗi lần đổi phải GIỮ NGUYÊN chỗ đang đứng trên trục gốc.
   */
  const dienDoiNguon = new URLSearchParams(location.search).has("doi");
  const [dungGhep, setDungGhep] = useState(banGhep);
  const sauKhiNap = useRef<{ at: number; play: boolean } | null>(null);
  useEffect(() => {
    if (!dienDoiNguon) return;
    const t1 = window.setTimeout(() => {
      const v = videoRef.current;
      if (v) sauKhiNap.current = { at: v.currentTime, play: !v.paused };
      setLog((l) => [...l, `→ đổi SANG bản ghép ở gốc ${videoRef.current?.currentTime.toFixed(1)}s`]);
      setDungGhep(true);
    }, 6000);
    const t2 = window.setTimeout(() => {
      const v = videoRef.current;
      if (v) sauKhiNap.current = { at: cutToSrc(KEPT, v.currentTime), play: !v.paused };
      setLog((l) => [...l, `→ bỏ bản ghép, về tệp gốc`]);
      setDungGhep(false);
    }, 12000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [dienDoiNguon]);

  useCutPlayback({
    playing,
    spans: dungGhep ? [] : spans,
    kept: dungGhep ? KEPT : null,
    total: 82,
    videoRef,
    liveTimeRef,
    auditing,
    setTime,
  });

  /*
   * ĐO ĐÚNG THỨ MẮT THẤY: từ lệnh nối tới KHUNG HÌNH ĐẦU TIÊN được trình bày.
   *
   * Bản đo trước chờ `currentTime` chạy thêm 20ms rồi mới tính — tức nó cộng luôn
   * 20ms video vào kết quả và không bao giờ xuống dưới ngần ấy, che mất chính cái
   * đang cần đo. `requestVideoFrameCallback` bắn đúng lúc trình duyệt trình bày
   * một khung, nên nó là thước thật.
   */
  useEffect(() => {
    if (!playing) return;
    const cur = () => videoRef.current;
    let prev = cur()?.currentTime ?? 0;
    let frame = 0;
    const tick = () => {
      const v = cur();
      if (v) {
        const now = v.currentTime;
        if (now - prev > 0.5) {
          const t0 = performance.now();
          const target = v;
          target.requestVideoFrameCallback(() => {
            setLog((l) => [...l, `khung chạy lại sau: ${(performance.now() - t0).toFixed(0)}ms`]);
          });
        }
        prev = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // KHUNG RỚT — thước trực tiếp cho cảm giác "giật": trình duyệt tự đếm khung
    // nó phải bỏ vì không kịp trình bày.
    // Ghi mức tiếng mỗi 20ms — in RA khi thấy nó rời khỏi 1 (đang vuốt), kèm vài
    // mẫu trước và sau để đọc được hình dạng cú vuốt.
    const mau: number[] = [];
    const demTieng = window.setInterval(() => {
      const v = cur();
      if (!v) return;
      mau.push(v.volume);
      if (mau.length > 16) mau.shift();
      const daVuot = mau.some((x) => x < 0.98);
      const xongVuot = daVuot && mau.slice(-4).every((x) => x > 0.98);
      if (xongVuot) {
        // Tính chuỗi RA BIẾN trước: hàm cập nhật của `setLog` chạy sau, lúc ấy
        // `mau` đã bị xoá.
        const dong = mau.map((x) => x.toFixed(2)).join(" ");
        mau.length = 0;
        setLog((l) => [...l, `vuốt tiếng: ${dong}`]);
      }
    }, 20);
    const dem = window.setInterval(() => {
      const v = cur();
      const q = v?.getVideoPlaybackQuality?.();
      if (q) setLog((l) => [...l, `khung rớt: ${q.droppedVideoFrames}/${q.totalVideoFrames}`]);
    }, 4000);
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (e.duration > 30) setLog((l) => [...l, `TÁC VỤ DÀI ${e.duration.toFixed(0)}ms`]);
    });
    try { obs.observe({ entryTypes: ["longtask"] }); } catch { /* Safari */ }
    return () => { cancelAnimationFrame(frame); obs.disconnect(); window.clearInterval(dem); window.clearInterval(demTieng); };
  }, [playing]);

  return (
    <div className="grid gap-3 bg-background p-4 text-foreground">
      <video
        ref={videoRef}
        src={dungGhep ? "/scripts/cut-preview/daghep.mp4" : "/scripts/cut-preview/mau.mp4"}
        onLoadedData={(event) => {
          const viec = sauKhiNap.current;
          sauKhiNap.current = null;
          if (!viec) return;
          const v = event.currentTarget;
          v.currentTime = dungGhep ? srcToCut(KEPT, viec.at) : viec.at;
          if (viec.play) void v.play();
          setLog((l) => [...l, `nạp xong → đặt lại ${v.currentTime.toFixed(1)}s (gốc ${viec.at.toFixed(1)}s)`]);
        }}
        preload="auto"
        playsInline
        // CÂM + tự chạy: trình duyệt tự động hoá chỉ cho phát khi câm, mà phép đo ở
        // đây là đo HÌNH và MAIN THREAD nên không cần tiếng.
        // Câm để trình duyệt tự động hoá cho phép tự phát. `muted` KHÔNG đụng tới
        // `volume`, nên phép đo mức tiếng dưới đây vẫn đọc đúng thứ vòng phát lái.
        muted
        className="h-[560px]"
        onCanPlay={(event) => {
          if (playing) return;
          const v = event.currentTarget;
          v.currentTime = 4;
          void v.play();
          setPlaying(true);
        }}
      />
      {/* DẢI THẬT — đây mới là phần nghi ngờ chiếm main thread lúc nhảy: mỗi lần
          cửa sổ dựng ảnh đổi là cả dải ô ảnh + thước dựng lại. */}
      <CutLane
        clips={CLIPS}
        strip={{ url: "/scripts/cut-preview/strip.jpg", seconds: 82, nativeSecondWidth: 196 }}
        envelope={envelope}
        spans={spans}
        total={82}
        time={time}
        playing={playing}
        liveTimeRef={liveTimeRef}
        pxPerSecond={40}
        selectedId={null}
        onSelect={() => {}}
        onSeek={() => {}}
        onPause={() => {}}
        onZoom={() => {}}
        onResize={() => {}}
        onAddAt={() => {}}
        onDelete={() => {}}
        onAudit={() => {}}
        onAuditSeam={() => {}}
      />
      <pre className="text-xs leading-5">{log.join("\n") || "…"}</pre>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
