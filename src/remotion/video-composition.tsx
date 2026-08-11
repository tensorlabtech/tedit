import {
  AbsoluteFill,
  Video,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { findLayout, slotPixels } from "../../server/layout-kinds";
import type { RemotionPayload, RemotionScene } from "../../server/remotion-payload";

/**
 * MÁY VẼ DUY NHẤT — dựng video từ CHÍNH lịch màn của export (`buildRemotionPayload`).
 * Hình học lấy từ `layout-kinds` (cùng `slotPixels` với export/preview), nên ô nằm
 * đúng chỗ export. Milestone P2a: nền + ô người + ô b-roll (viền xé) + nghiêng+rung.
 * Phụ đề/hiệu ứng thêm ở milestone sau.
 */

const TILT = [-4, 3.5, -2.5, 3];
const torn = () => `url(${staticFile("spike/o-rach.png")})`;

function boil(frame: number, seed: number) {
  const s = Math.floor(frame / 5);
  return { x: Math.sin(s * 1.7 + seed) * 4, y: Math.sin(s * 2.3 + seed * 1.9) * 4 };
}

function Cells({
  scene,
  payload,
  frame,
}: {
  scene: RemotionScene;
  payload: RemotionPayload;
  frame: number;
}) {
  const { width, height } = useVideoConfig();
  const spec = findLayout(scene.layout);
  const edge = scene.frameBlock?.subjectEdge ?? null;

  return (
    <>
      {[...spec.slots]
        .sort((a, b) => a.z - b.z)
        .map((slot, i) => {
          const isBroll = slot.role === "phu";
          const aspect =
            isBroll && scene.insert != null
              ? payload.inserts[scene.insert]?.aspect ?? 1
              : (payload.sourceAspect ?? width / height);
          const rect = slotPixels(slot, width, height, aspect);
          const jit = boil(frame, i);
          const src =
            isBroll && scene.insert != null
              ? payload.inserts[scene.insert]?.url
              : payload.personUrl;
          if (!src) return null;
          const showTorn = isBroll && !!edge;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                transform: `rotate(${TILT[i % 4]}deg) translate(${jit.x}px, ${jit.y}px)`,
              }}
            >
              {showTorn && (
                <div
                  style={{
                    position: "absolute",
                    inset: "-3%",
                    background: edge!.tone.color,
                    opacity: edge!.tone.alpha,
                    WebkitMaskImage: torn(),
                    maskImage: torn(),
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
                  ...(showTorn
                    ? {
                        WebkitMaskImage: torn(),
                        maskImage: torn(),
                        WebkitMaskSize: "100% 100%",
                        maskSize: "100% 100%",
                      }
                    : { borderRadius: width * 0.03 }),
                }}
              >
                <Video
                  src={staticFile(src)}
                  muted
                  loop
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            </div>
          );
        })}
    </>
  );
}

export function VideoComposition(payload: RemotionPayload) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const scene = payload.scenes.find((s) => t >= s.start && t < s.end) ?? null;
  const page = scene?.frameBlock?.page ?? payload.basePage;

  return (
    <AbsoluteFill style={{ backgroundColor: page?.tone.color ?? "#08090C" }}>
      {scene ? (
        <Cells scene={scene} payload={payload} frame={frame} />
      ) : (
        // Khoảng trống = toàn-khung phủ kín người.
        <Video
          src={staticFile(payload.personUrl)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
    </AbsoluteFill>
  );
}
