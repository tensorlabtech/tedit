import {
  AbsoluteFill,
  Video,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

import { findLayout, slotPixels } from "../../server/layout-kinds";

/**
 * A/B THẬT — dựng lại cảnh collage Phấn bằng FOOTAGE THẬT + HÌNH HỌC THẬT (gọi
 * `layout-kinds` y hệt export/preview, KHÔNG eyeball) + font Patrick Hand + caption
 * grain + viền xé `o-rach` thật. Đặt cạnh `out/real-22.png` (export ffmpeg) để soi
 * Remotion có ra ĐÚNG chất Phấn trên nội dung thật không.
 *
 * Layout `vuong-ngang` = ô người + ô b-roll (2 ô Phấn). Rect lấy từ `slotPixels`.
 */

const CREAM = "#F2ECDC";
const YELLOW = "#E7C24A";
const TILT = [-4, 3.5, -2.5, 3];

function boil(frame: number, seed: number) {
  const s = Math.floor(frame / 5);
  return { x: Math.sin(s * 1.7 + seed) * 4, y: Math.sin(s * 2.3 + seed * 1.9) * 4 };
}

export function SpikeRealSceneComposition() {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const spec = findLayout("vuong-ngang");
  // Rect thật từ layout-kinds (person = chinh, b-roll = phu).
  const cells = [...spec.slots]
    .sort((a, b) => a.z - b.z)
    .map((slot, i) => ({
      slot,
      i,
      rect: slotPixels(slot, width, height),
      tilt: TILT[i % 4],
    }));

  const pop = spring({ frame, fps, config: { damping: 13, mass: 0.6 } });
  const popScale = interpolate(pop, [0, 1], [0.7, 1]);

  const grain = `url(${staticFile("spike/caption-grain.png")})`;
  const torn = `url(${staticFile("spike/o-rach.png")})`;

  return (
    <AbsoluteFill style={{ backgroundColor: CREAM }}>
      {/* Nền giấy có noise (paper-grain), phủ nhẹ như export. */}
      <Img
        src={staticFile("spike/paper-grain.png")}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5, mixBlendMode: "multiply" }}
      />

      {/* Ô người + ô b-roll — rect thật, nghiêng + rung + pop-in. */}
      {cells.map(({ slot, i, rect, tilt }) => {
        const jit = boil(frame, i);
        const isBroll = slot.role === "phu";
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              transform: `rotate(${tilt}deg) translate(${jit.x}px, ${jit.y}px) scale(${popScale})`,
            }}
          >
            {isBroll && (
              // Viền vàng xé: cùng mặt nạ, lớp dưới phóng ra.
              <div
                style={{
                  position: "absolute",
                  inset: "-3%",
                  background: YELLOW,
                  WebkitMaskImage: torn,
                  maskImage: torn,
                  WebkitMaskSize: "100% 100%",
                  maskSize: "100% 100%",
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                ...(isBroll
                  ? {
                      WebkitMaskImage: torn,
                      maskImage: torn,
                      WebkitMaskSize: "100% 100%",
                      maskSize: "100% 100%",
                    }
                  : { borderRadius: width * 0.03 }),
              }}
            >
              <Video
                src={staticFile(isBroll ? "spike/broll2.mp4" : "spike/person.mp4")}
                startFrom={isBroll ? 30 : 300}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                muted
              />
            </div>
          </div>
        );
      })}

      {/* CAPTION phấn: Patrick Hand + grain-vào-alpha + hộp nhấn "một" + glow. */}
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          width: "100%",
          textAlign: "center",
          transform: "rotate(-2deg)",
        }}
      >
        <span
          style={{
            fontFamily: "'Patrick Hand', cursive",
            fontSize: width * 0.1,
            color: "#F7F1E3",
            WebkitMaskImage: grain,
            maskImage: grain,
            WebkitMaskSize: "cover",
            maskSize: "cover",
            maskMode: "luminance",
            filter: "blur(0.4px) drop-shadow(0 0 8px rgba(20,20,20,0.85))",
          }}
        >
          nhỏ hoặc{" "}
          <span style={{ background: "rgba(32,20,10,0.72)", padding: "0 0.2em", borderRadius: 6 }}>
            một
          </span>{" "}
          story
        </span>
      </div>
    </AbsoluteFill>
  );
}
