import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";

/**
 * TÁCH NGƯỜI trong khung xem trước — cắt người khỏi nền theo mặt nạ, ra người có
 * NỀN TRONG SUỐT để đè lên lớp phía dưới (chữ-sau-người, viền người, và các hiệu
 * ứng dựa-tách-nền sau này).
 *
 * Vì sao cần: các thiết bị dựa tách nền trước đây đành gắn nhãn "hiện ở bản xuất"
 * — trình duyệt không có mặt nạ người. Nay endpoint `/subject` phục vụ mặt nạ
 * (trắng = người, đen = nền), CÙNG TRỤC thời gian với video preview (đều dựng từ
 * `preview.mp4`), nên canvas ghép được đúng như bản xuất.
 *
 * Kỹ thuật: mặt nạ là video XÁM ĐỤC (alpha = 1 khắp khung) nên KHÔNG dùng thẳng
 * làm alpha được. Phải đổi ĐỘ SÁNG mặt nạ thành ALPHA: vẽ mặt nạ ra một canvas
 * nhỏ, đặt `alpha = kênh đỏ` (ảnh xám nên R≈G≈B≈độ sáng), rồi lấy nó làm mặt nạ
 * `destination-in` cho khung người. Xử ở cỡ NHỎ cho nhẹ (mép mềm khi phóng lên —
 * ổn cho khung xem). Chỉ gắn ở cảnh CÓ hiệu ứng tách nền nên giá `getImageData`
 * mỗi khung là chấp nhận được.
 */
export function SubjectCutout({
  projectId,
  time,
  playing,
  className,
}: {
  projectId: string;
  /** Giây trên trục video preview — khớp `editor.time`. */
  time: number;
  playing: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const personRef = useRef<HTMLVideoElement>(null);
  const maskRef = useRef<HTMLVideoElement>(null);
  // Canvas phụ giữ mặt nạ ĐÃ đổi-sáng-thành-alpha, cỡ nhỏ, tái dùng qua các khung.
  const alphaRef = useRef<HTMLCanvasElement | null>(null);
  // Mặt nạ chưa dựng (dự án cũ) → tắt hẳn, để nơi gọi tự lùi về hiện người thường.
  const [available, setAvailable] = useState(true);

  // Tua hai video theo `time` khi NGƯỜI DÙNG nhảy chỗ (không bám đồng hồ tường);
  // phát/dừng theo `playing`. Cùng luật với các thẻ video ô khác của preview.
  useEffect(() => {
    for (const video of [personRef.current, maskRef.current]) {
      if (!video) continue;
      if (Math.abs(video.currentTime - time) > 0.2) video.currentTime = time;
      if (playing) void video.play().catch(() => {});
      else video.pause();
    }
  }, [time, playing]);

  useEffect(() => {
    let raf = 0;
    // Cỡ xử mặt nạ: nhỏ cho nhẹ `getImageData`; mép mềm khi phóng lên — ổn.
    const MASK_W = 270;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const person = personRef.current;
      const mask = maskRef.current;
      if (!canvas || !person || !mask) return;
      // Chưa đủ khung để vẽ (đang tua/nạp) thì bỏ qua khung này.
      if (person.readyState < 2 || mask.readyState < 2) return;
      const w = person.videoWidth;
      const h = person.videoHeight;
      if (!w || !h) return;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 1) Mặt nạ → alpha ở cỡ nhỏ.
      let alpha = alphaRef.current;
      if (!alpha) {
        alpha = document.createElement("canvas");
        alphaRef.current = alpha;
      }
      const mh = Math.max(1, Math.round((MASK_W * h) / w));
      if (alpha.width !== MASK_W || alpha.height !== mh) {
        alpha.width = MASK_W;
        alpha.height = mh;
      }
      const actx = alpha.getContext("2d", { willReadFrequently: true });
      if (!actx) return;
      actx.drawImage(mask, 0, 0, MASK_W, mh);
      const img = actx.getImageData(0, 0, MASK_W, mh);
      const data = img.data;
      for (let i = 0; i < data.length; i += 4) data[i + 3] = data[i];
      actx.putImageData(img, 0, 0);

      // 2) Người, rồi GIỮ LẠI theo alpha mặt nạ (phóng cỡ nhỏ lên full) → nền trong.
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(person, 0, 0, w, h);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(alpha, 0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!available) return null;

  return (
    <>
      {/* Hai video NGUỒN ẩn (vẫn giải mã để `drawImage` lấy khung): để trong luồng
          layout cỡ 1px + trong suốt thay vì `display:none` — vài trình duyệt ngừng
          giải mã thẻ `display:none`, làm canvas đứng hình. */}
      <video
        ref={personRef}
        src={api.baseVideoUrl(projectId)}
        muted
        playsInline
        preload="auto"
        className="pointer-events-none absolute size-px opacity-0"
      />
      <video
        ref={maskRef}
        src={api.subjectMaskUrl(projectId)}
        muted
        playsInline
        preload="auto"
        className="pointer-events-none absolute size-px opacity-0"
        onError={() => setAvailable(false)}
      />
      <canvas ref={canvasRef} className={className} />
    </>
  );
}
