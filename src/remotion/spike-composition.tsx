import {
  AbsoluteFill,
  Video,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

/**
 * P0 SPIKE — chứng minh vòng lặp Remotion render mp4 trên máy này, và một khung
 * hình dựng HOÀN TOÀN bằng React (nền + ô b-roll nghiêng+rung+viền + tiêu đề +
 * phụ đề pop-in). Tự chứa (inline style, không import overlay/Tailwind) để tách
 * rủi ro MÔI TRƯỜNG khỏi rủi ro TÁI DÙNG. P0b sẽ thay bằng component overlay thật.
 *
 * Look nhại Phấn để so cạnh bản xuất ffmpeg cho có nghĩa.
 */

const CREAM = "#F2ECDC";
const YELLOW = "#E7C24A";
const INK = "#1A1712";

// Rung stop-motion: nhảy theo BẬC frame (giống export `floor(t*6)`), không mượt.
function boil(frame: number, seed: number) {
  const step = Math.floor(frame / 5); // ~6 bậc/giây ở 30fps
  return {
    x: Math.sin(step * 1.7 + seed) * 5,
    y: Math.sin(step * 2.3 + seed * 1.9) * 5,
  };
}

export function SpikeComposition() {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // Ô b-roll pop-in (easeOutBack) rồi rung nhẹ.
  const pop = spring({ frame, fps, config: { damping: 12, mass: 0.6 } });
  const cellScale = interpolate(pop, [0, 1], [0.7, 1]);
  const jit = boil(frame, 0);

  // Phụ đề nảy vào sau 8 frame.
  const capPop = spring({
    frame: frame - 8,
    fps,
    config: { damping: 14, mass: 0.5 },
  });
  const capScale = interpolate(capPop, [0, 1], [0.6, 1], {
    easing: Easing.out(Easing.back(2)),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: CREAM }}>
      {/* Ô B-ROLL nổi: nghiêng như ảnh dán tay + rung + viền vàng, bo góc. */}
      <div
        style={{
          position: "absolute",
          left: "10%",
          top: "16%",
          width: "80%",
          height: "42%",
          transform: `rotate(-4deg) translate(${jit.x}px, ${jit.y}px) scale(${cellScale})`,
          borderRadius: width * 0.03,
          border: `${width * 0.008}px solid ${YELLOW}`,
          overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        }}
      >
        <Video
          src={staticFile("spike/broll.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          muted
        />
      </div>

      {/* TIÊU ĐỀ trên đầu. */}
      <div
        style={{
          position: "absolute",
          top: "6%",
          width: "100%",
          textAlign: "center",
          fontFamily: "Arial Black, sans-serif",
          fontWeight: 900,
          fontSize: width * 0.06,
          color: INK,
          letterSpacing: -1,
        }}
      >
        SPIKE · MỘT MÁY VẼ
      </div>

      {/* PHỤ ĐỀ pop-in giữa dưới. */}
      <div
        style={{
          position: "absolute",
          bottom: "22%",
          width: "100%",
          textAlign: "center",
          transform: `scale(${capScale})`,
        }}
      >
        <span
          style={{
            fontFamily: "Arial Black, sans-serif",
            fontWeight: 900,
            fontSize: width * 0.11,
            lineHeight: 1.05,
            color: INK,
            background: YELLOW,
            padding: `${width * 0.01}px ${width * 0.03}px`,
            boxDecorationBreak: "clone",
            WebkitBoxDecorationBreak: "clone",
            borderRadius: width * 0.015,
          }}
        >
          CÁI BẠN THẤY
        </span>
      </div>
    </AbsoluteFill>
  );
}
