import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  Video,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { OverlayTextBlock } from "@/dev/overlays/overlay-render";
import type { BandId } from "@/dev/overlays/overlay-model";
import { BehindTextPreview } from "@/routes/editor/behind-text-preview";
import { findLayout, slotPixels } from "../../server/layout-kinds";
import { findJunction } from "../../server/junction-kinds";
import { packForElement } from "../../server/style-pack";
import type {
  RemotionCaption,
  RemotionPayload,
  RemotionScene,
} from "../../server/remotion-payload";

/**
 * MÁY VẼ DUY NHẤT — dựng video từ CHÍNH lịch màn của export (`buildRemotionPayload`).
 * Hình học lấy từ `layout-kinds` (cùng `slotPixels` với export/preview), nên ô nằm
 * đúng chỗ export. Milestone P2a: nền + ô người + ô b-roll (viền xé) + nghiêng+rung.
 * Phụ đề/hiệu ứng thêm ở milestone sau.
 */

const TILT = [-4, 3.5, -2.5, 3];
function boil(frame: number, seed: number) {
  const s = Math.floor(frame / 6);
  // Biên độ nhỏ (2px) — chỉ "thở" nhẹ, không giật.
  return { x: Math.sin(s * 1.7 + seed) * 2, y: Math.sin(s * 2.3 + seed * 1.9) * 2 };
}

/**
 * CHỖ NỐI: cộng dồn XUNG tam giác của từng hiệu ứng quanh vết cắt (khớp preview
 * `junctionStyle` + chuỗi lọc ffmpeg) → `transform`/`filter` áp lên cảnh. Cường độ
 * lấy từ `intensity` của bộ dáng (`punchScale`/`flashAmount`).
 */
function junctionCss(
  t: number,
  junctions: RemotionPayload["junctions"],
  pack: RemotionPayload["pack"],
): { transform: string; filter: string } | null {
  const acc: Record<string, number> = {
    zoom: 0,
    sang: 0,
    xoay: 0,
    dichX: 0,
    dichY: 0,
    nhoe: 0,
    sac: 0,
    tuongPhan: 0,
  };
  for (const j of junctions) {
    const da = t - j.peak;
    const before = Math.max(0.04, j.peak - j.start);
    const after = Math.max(0.04, j.end - j.peak);
    const value =
      da < 0
        ? da >= -before
          ? 1 - -da / before
          : 0
        : da <= after
          ? 1 - da / after
          : 0;
    if (value <= 0) continue;
    const drive = findJunction(j.kind).drive as Record<string, number>;
    for (const k of Object.keys(acc)) acc[k] += (drive[k] ?? 0) * value;
  }
  // KHÔNG junction nào active tại t → trả null: nơi gọi KHÔNG bọc lớp filter/
  // transform. CSS filter (kể cả identity) ép lớp GPU trên video → giật khi tua.
  if (Object.values(acc).every((v) => Math.abs(v) < 1e-4)) return null;
  const punch = pack.intensity.punchScale;
  const flash = pack.intensity.flashAmount;
  return {
    transform:
      `scale(${(1 + punch * acc.zoom).toFixed(4)}) ` +
      `translate(${acc.dichX.toFixed(2)}%, ${acc.dichY.toFixed(2)}%) ` +
      `rotate(${acc.xoay.toFixed(2)}deg)`,
    filter:
      `brightness(${(1 + flash * acc.sang).toFixed(3)}) ` +
      `contrast(${(1 + acc.tuongPhan * 0.6).toFixed(3)}) ` +
      `blur(${Math.max(0, acc.nhoe).toFixed(2)}px) ` +
      `hue-rotate(${acc.sac.toFixed(1)}deg)`,
  };
}

/**
 * VIỀN VẼ TAY quanh ô b-roll — nét kẻ chữ nhật bị NHIỄU displacement thành nguệch
 * ngoạc như vẽ bút (chất Chalk/scrapbook), KHÔNG loạn như mép giấy xé cũ. Wobble
 * gọn (`scale` ~ độ dày viền), tần số vừa. Nét đóng góc tròn cho mềm tay.
 *
 * !! KHOÁ THIẾT KẾ — đây là BẢN SẮC ô b-roll Phấn, đã bị làm mất 3+ lần. Chê "quá"
 * thì GIẢM LIỀU (`scale`/`w`), TUYỆT ĐỐI không đổi về viền phẳng/bo-tròn/không-viền.
 * Ảnh mốc: plans/260811-remotion-single-engine/phan-broll-reference.png
 */
function HandDrawnBorder({
  color,
  w,
  seed,
  cw,
  ch,
}: {
  color: string;
  w: number;
  seed: number;
  cw: number;
  ch: number;
}) {
  const id = `hd-${seed}`;
  const pad = w * 1.2;
  return (
    <svg
      width={cw}
      height={ch}
      style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
    >
      <defs>
        <filter id={id} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.018"
            numOctaves={2}
            seed={seed * 11 + 5}
            result="n"
          />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={w * 2.4} />
        </filter>
      </defs>
      <rect
        x={pad}
        y={pad}
        width={cw - 2 * pad}
        height={ch - 2 * pad}
        rx={w * 2}
        fill="none"
        stroke={color}
        strokeWidth={w}
        strokeLinejoin="round"
        strokeLinecap="round"
        filter={`url(#${id})`}
      />
    </svg>
  );
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
          // Ô b-roll KHÔNG có tư liệu → KHÔNG vẽ (khớp export). Không lấp bằng
          // video người — lấp thế thì ra "hai ô người", sai (bug user bắt được).
          if (isBroll && scene.insert == null) return null;
          const aspect =
            isBroll && scene.insert != null
              ? payload.inserts[scene.insert]?.aspect ?? 1
              : (payload.sourceAspect ?? width / height);
          const rect = slotPixels(slot, width, height, aspect);
          // Rung CHỈ cho ảnh b-roll (như ảnh dán tay); ô NGƯỜI đứng yên — người
          // wobble đọc ra giật, mất tự nhiên.
          const jit = isBroll ? boil(frame, i) : { x: 0, y: 0 };
          const src =
            isBroll && scene.insert != null
              ? payload.inserts[scene.insert]?.url
              : payload.personUrl;
          if (!src) return null;
          const borderW = Math.max(4, Math.round(Math.min(rect.w, rect.h) * 0.018));
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
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  borderRadius: width * 0.03,
                }}
              >
                {isBroll ? (
                  scene.insert != null &&
                  payload.inserts[scene.insert]?.isVideo === false ? (
                    // B-roll là ẢNH tĩnh → Img (Video sẽ vỡ).
                    <Img
                      src={staticFile(src)}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    // B-roll VIDEO = clip NGẮN → cần lặp; Video hỗ trợ loop.
                    <Video
                      src={staticFile(src)}
                      muted
                      loop
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  )
                ) : (
                  // NGƯỜI = OffthreadVideo: trích frame chính xác → HẾT giật.
                  <OffthreadVideo
                    src={staticFile(src)}
                    muted
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
              </div>
              {/* Viền VẼ TAY (nguệch ngoạc) quanh ô b-roll — chất Chalk. Nằm NGOÀI
                  lớp cắt (overflow-hidden) để nét tay ló ra được. */}
              {isBroll && edge && (
                <HandDrawnBorder
                  color={edge.tone.color}
                  w={borderW}
                  seed={i}
                  cw={rect.w}
                  ch={rect.h}
                />
              )}
            </div>
          );
        })}
    </>
  );
}

/**
 * Một cụm phụ đề trong cửa sổ thời gian của nó — `<Sequence>` cấp lại frame=0 ở
 * đầu cụm, nên `seconds = frame/fps` chính là "giây tính từ đầu cụm" mà
 * `OverlayTextBlock` cần (khớp cách preview truyền). `container-type: size` để đơn
 * vị `cqw` của chữ đo theo bề rộng khung (bắt buộc, như `@container` ở preview).
 */
function CaptionSeq({
  c,
  pack,
  fps,
}: {
  c: RemotionCaption;
  pack: RemotionPayload["pack"];
  fps: number;
}) {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", inset: 0, containerType: "size" }}>
      <OverlayTextBlock
        config={{
          text: c.content,
          align: c.align ?? "left",
          emphasis: c.emphasis ?? "even",
          band: (c.band ?? "bottom") as BandId,
          keywords: c.keywords ?? [],
          insert: { kind: "none", shape: "wide" },
        }}
        pack={packForElement(
          pack,
          { letterCase: c.letterCase, keyColor: c.keyColor, fontStyle: c.fontStyle },
          c.keywords,
          c.captionBlock,
        )}
        seconds={frame / fps}
        wordStarts={c.wordStarts}
        span={c.span}
      />
    </div>
  );
}

export function VideoComposition(payload: RemotionPayload) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const scene = payload.scenes.find((s) => t >= s.start && t < s.end) ?? null;
  const page = scene?.frameBlock?.page ?? payload.basePage;
  // Mở màn CHỮ-SAU-NGƯỜI đã TẮT theo yêu cầu: đoạn đầu giữ NGUYÊN footage gốc,
  // không đổi nền + không tách người (mép tách chưa sạch, đọc ra lỗi).
  const SHOW_BEHIND = false;
  const opening =
    SHOW_BEHIND && payload.behind && t < payload.behind.seconds
      ? payload.behind
      : null;
  // Chỗ nối áp lên HÌNH cảnh (không lên chữ/nền) — zoom/nháy/nghiêng quanh vết cắt.
  const jStyle = junctionCss(t, payload.junctions, payload.pack);

  return (
    <AbsoluteFill style={{ backgroundColor: page?.tone.color ?? "#08090C" }}>
      {/* HẠT GIẤY: đốm ấm mờ (#8A7A4E, 28%) qua mặt nạ paper-grain — chỉ rõ trên
          nền sáng (trang Phấn), gần vô hình trên nền tối. Khớp export. */}
      {page && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#8A7A4E",
            opacity: 0.28,
            WebkitMaskImage: `url(${staticFile("masks/paper-grain.png")})`,
            maskImage: `url(${staticFile("masks/paper-grain.png")})`,
            WebkitMaskSize: "cover",
            maskSize: "cover",
          }}
        />
      )}
      {/* LƯỚI NỀN (Nhịp-đen `luoi-ba`): mask PNG + màu lưới. Rõ trên nền tối. */}
      {page?.grid && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: page.grid.tone.color,
            opacity: page.grid.tone.alpha,
            WebkitMaskImage: `url(${staticFile(`graphics/${page.grid.id}.png`)})`,
            maskImage: `url(${staticFile(`graphics/${page.grid.id}.png`)})`,
            WebkitMaskSize: "cover",
            maskSize: "cover",
          }}
        />
      )}
      {opening ? (
        // Chữ chìm SAU, người-cắt (webm alpha) đè LÊN → chữ hở quanh người.
        <div style={{ position: "absolute", inset: 0, containerType: "size" }}>
          <BehindTextPreview
            pack={payload.pack}
            line={opening.line}
            band={opening.band}
            seconds={t}
          />
          {opening.personCutUrl && (
            // `transparent` để alpha webm sống qua render (OffthreadVideo dùng
            // ffmpeg trích khung — mặc định bỏ alpha).
            <OffthreadVideo
              src={staticFile(opening.personCutUrl)}
              transparent
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            // Chỉ áp transform/filter khi CÓ junction (jStyle non-null). Không thì
            // div trơn → không ép lớp GPU → tua/phát nhẹ.
            ...(jStyle ?? {}),
          }}
        >
          {scene ? (
            <Cells scene={scene} payload={payload} frame={frame} />
          ) : (
            // Khoảng trống = toàn-khung phủ kín người (OffthreadVideo — hết giật).
            <OffthreadVideo
              src={staticFile(payload.personUrl)}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
        </div>
      )}

      {/* Doodle vàng đã BỎ theo yêu cầu (hoạ tiết random không cần). */}

      {/* PHỤ ĐỀ — mỗi cụm một Sequence đúng cửa sổ, reuse OverlayTextBlock preview. */}
      {payload.captions.map((c, i) => (
        <Sequence
          key={i}
          from={Math.round(c.start * fps)}
          durationInFrames={Math.max(1, Math.round(c.span * fps))}
          layout="none"
        >
          <CaptionSeq c={c} pack={payload.pack} fps={fps} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
