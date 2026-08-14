import {
  AbsoluteFill,
  Audio,
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
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const spec = findLayout(scene.layout);
  const edge = scene.frameBlock?.subjectEdge ?? null;
  // THẺ SẠCH đọc theo BLOCK của cảnh (block-pool): khung Prism mang thẻ sạch, khung
  // Phấn/Nhịp-đen mang `null` → lối "dán tay" (nghiêng+rung). Nhờ vậy trộn preset
  // trong một video vẫn đúng look từng khung.
  const card = scene.frameBlock?.insetCard ?? null;

  return (
    <>
      {[...spec.slots]
        .sort((a, b) => a.z - b.z)
        .map((slot, i) => {
          const isBroll = slot.role === "phu";
          // Ô b-roll KHÔNG có tư liệu:
          // · XUẤT (`preview=false`) → KHÔNG vẽ. Lấp bằng video người thì ra "hai ô
          //   người", sai (bug user bắt được).
          // · EDITOR (`preview=true`) → vẽ PLACEHOLDER (ô gạch + icon phim) để người
          //   dùng thấy "b-roll đặt đây" mà bấm "Chọn tư liệu". Không phải mock giả:
          //   là ô trống có viền, đúng lối placeholder aspect-ratio.
          if (isBroll && scene.insert == null) {
            if (!payload.preview) return null;
            const rect = slotPixels(
              slot,
              width,
              height,
              payload.sourceAspect ?? width / height,
            );
            const pad = Math.round(Math.min(rect.w, rect.h) * 0.12);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: rect.x,
                  top: rect.y,
                  width: rect.w,
                  height: rect.h,
                  borderRadius: card ? width * (card.cornerShare ?? 0) : width * 0.03,
                  border: `${Math.max(2, Math.round(width * 0.004))}px dashed rgba(255,255,255,0.28)`,
                  background: "rgba(255,255,255,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: pad * 0.5,
                }}
              >
                <svg
                  width={Math.round(rect.w * 0.16)}
                  height={Math.round(rect.w * 0.16)}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="1.6"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M7 4v16M17 4v16M2 9h5M2 15h5M17 9h5M17 15h5" />
                </svg>
                <span
                  style={{
                    color: "rgba(255,255,255,0.62)",
                    fontSize: Math.round(width * 0.038),
                    fontWeight: 500,
                  }}
                >
                  Chỗ b-roll
                </span>
              </div>
            );
          }
          const aspect =
            isBroll && scene.insert != null
              ? payload.inserts[scene.insert]?.aspect ?? 1
              : (payload.sourceAspect ?? width / height);
          const rect = slotPixels(slot, width, height, aspect);
          // Rung CHỈ cho ảnh b-roll (như ảnh dán tay); ô NGƯỜI đứng yên — người
          // wobble đọc ra giật, mất tự nhiên. Thẻ sạch (Prism): đứng im hẳn.
          const jit = card ? { x: 0, y: 0 } : isBroll ? boil(frame, i) : { x: 0, y: 0 };
          // Nghiêng "dán tay" CHỈ cho ảnh b-roll (như `jit` rung — người không dính).
          // Ô NGƯỜI (kể cả toàn-khung / khung mờ) đứng thẳng: người nghiêng đọc ra
          // "video bị nghiêng", không phải ảnh dán. Thẻ sạch (Prism) cũng không nghiêng.
          const tilt = !card && isBroll ? TILT[i % 4] : 0;
          // Bóng đổ mềm dưới thẻ sạch (bán kính theo cạnh ngắn của ô).
          const shadow = card
            ? Math.round(Math.min(rect.w, rect.h) * card.shadowShare)
            : 0;
          const ins =
            isBroll && scene.insert != null
              ? payload.inserts[scene.insert]
              : null;
          const src = ins ? ins.url : payload.personUrl;
          if (!src) return null;
          // B-roll kiểu CapCut: cắt CỬA SỔ nguồn [in, out]. Điểm VÀO đặt bằng
          // `trimBefore`; điểm RA KHÔNG cần `trimAfter` — bề rộng khối = out−in nên
          // phát từ `in` đúng đủ độ dài khối là dừng ở `out`. (Và `<Video trimAfter>`
          // vỡ ở Remotion hiện tại — render ra khung rỗng, nên tránh hẳn.)
          const trimBefore =
            ins?.in != null ? Math.max(0, Math.round(ins.in * fps)) : undefined;
          // Chỉ LẶP khi CHƯA cắt (out ngầm): clip ngắn hơn khung thì lặp cho đủ.
          // Đã cắt thì khung = cửa sổ nên phát một lần là vừa khít, khỏi lặp.
          const brollLoop = ins?.out == null;
          const borderW = Math.max(4, Math.round(Math.min(rect.w, rect.h) * 0.018));
          // MỌC LÊN / THU VỀ — thẻ sạch (KHÔNG toàn-khung) scale + trượt + mờ ở
          // đầu/cuối cảnh, chất "card grows in / shrinks out" của template. Toàn-
          // khung (areaShare 1, phủ kín) KHÔNG animate — zoom cả người mỗi cảnh giật.
          let animScale = 1;
          let animOpacity = 1;
          let animY = 0;
          if (card && slot.areaShare < 1) {
            const since = t - scene.start;
            const until = scene.end - t;
            if (since < CARD_ENTER) {
              const p = smooth(since / CARD_ENTER);
              animScale = 0.86 + 0.14 * p;
              animOpacity = p;
              animY = 22 * (1 - p); // mọc lên từ dưới
            } else if (until < CARD_EXIT) {
              const p = smooth(until / CARD_EXIT);
              animScale = 0.92 + 0.08 * p;
              animOpacity = p;
              animY = -14 * (1 - p); // thu về + trượt lên
            }
          }
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                opacity: animOpacity,
                transform: `rotate(${tilt}deg) translate(${jit.x}px, ${jit.y + animY}px) scale(${animScale})`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  // Bo góc theo THẺ của khung: Prism `cornerShare=0` → VUÔNG. Lối
                  // dán tay (không có card) giữ bo tròn nhẹ như cũ. `?? 0` để
                  // block cũ (stamp trước khi có cornerShare) không ra NaN.
                  borderRadius: card ? width * (card.cornerShare ?? 0) : width * 0.03,
                  // Bóng đổ mềm dưới thẻ sạch — chất "thẻ nổi" editorial.
                  boxShadow: shadow
                    ? `0 ${Math.round(shadow * 0.5)}px ${shadow}px rgba(0,0,0,0.5)`
                    : undefined,
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
                    // B-roll VIDEO: phát từ điểm vào (`trimBefore`); lặp chỉ khi
                    // chưa cắt (xem `brollLoop`). Bề rộng khối = cửa sổ nên tự dừng
                    // đúng điểm ra, khỏi `trimAfter` (vốn vỡ ở Remotion hiện tại).
                    <Video
                      src={staticFile(src)}
                      muted
                      loop={brollLoop}
                      trimBefore={trimBefore}
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
                  lớp cắt (overflow-hidden) để nét tay ló ra được. Thẻ sạch (Prism)
                  KHÔNG có viền này. */}
              {isBroll && edge && !card && (
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
  bandOverride,
}: {
  c: RemotionCaption;
  pack: RemotionPayload["pack"];
  fps: number;
  /** Punchline (defocus): dời cụm ra dải GIỮA để nổi trên hình đã mờ. */
  bandOverride?: BandId;
}) {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", inset: 0, containerType: "size" }}>
      <OverlayTextBlock
        config={{
          text: c.content,
          align: c.align ?? "left",
          emphasis: c.emphasis ?? "even",
          band: (bandOverride ?? c.band ?? "bottom") as BandId,
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

/** Ease smoothstep, kẹp [0,1] — bỏ góc gãy cho mọi ramp animation. */
const smooth = (x: number): number => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};

/** Thời lượng thẻ b-roll MỌC LÊN (vào) và THU VỀ (ra), giây — chất scale template. */
const CARD_ENTER = 0.42;
const CARD_EXIT = 0.3;

/** KHUNG MỜ: độ mờ người (px) + thời gian ramp mờ vào/ra hai đầu cảnh (giây). */
const DEFOCUS_BLUR_PX = 16;
const DEFOCUS_RAMP = 0.4;

export function VideoComposition(payload: RemotionPayload) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const scene = payload.scenes.find((s) => t >= s.start && t < s.end) ?? null;
  // Nền trang đọc theo BLOCK của cảnh (kiến trúc block-pool): mỗi khung mang look
  // của PRESET nó — cảnh dùng khung Nhịp-đen ra nền caro, khung Phấn ra nền vàng,
  // TRONG CÙNG một video. Rơi về `basePage` khi cảnh chưa có block.
  const page = scene?.frameBlock?.page ?? payload.basePage;
  // Mở màn CHỮ-SAU-NGƯỜI đã TẮT theo yêu cầu: đoạn đầu giữ NGUYÊN footage gốc,
  // không đổi nền + không tách người (mép tách chưa sạch, đọc ra lỗi).
  const SHOW_BEHIND = false;
  const opening =
    SHOW_BEHIND && payload.behind && t < payload.behind.seconds
      ? payload.behind
      : null;
  // NỀN VIDEO MỜ cho MỌI cảnh có thẻ (khung `insetCard.blurBackdrop`): b-roll đơn,
  // ô người, hai ô... đều nổi trên nền NGƯỜI MỜ tối — cả video thành một hệ "thẻ
  // nổi trên nền mờ" (chất Prism Pro). Ô người thì là người-sắc-trong-thẻ trên
  // chính-người-mờ (xoá phông chân dung). Cảnh toàn-khung là `scene==null` nên
  // không dính. Đọc từ frame block → đúng nguyên tắc frame-level.
  const backdrop = !!scene && !!scene.frameBlock?.insetCard?.blurBackdrop;
  // Nền NGƯỜI MỜ: LUÔN mờ sẵn (KHÔNG ramp vào). Trước đây ramp sắc→mờ lúc thẻ vào,
  // nhưng nếu ngay trước đó có DEFOCUS (người đã mờ) thì nền reset về sắc = blur
  // người NHẢY mờ→sắc→mờ = giật cục. Giữ mờ cố định thì defocus→b-roll liền mạch;
  // chuyển động "vào" đã do THẺ MỌC LÊN lo. Chỉ nét lại NHẸ ở cuối (thẻ thu về).
  const bdK = backdrop && scene ? smooth((scene.end - t) / CARD_EXIT) : 1;

  // Cảnh NGƯỜI TOÀN-KHUNG (chủ thể phủ kín) — dùng để chỗ nối né khung (dưới).
  const fullPerson =
    !scene ||
    findLayout(scene.layout).slots.some(
      (s) => s.role === "chinh" && s.areaShare >= 1,
    );
  // KHUNG MỜ (defocus): cảnh đóng dấu `frameBlock.blur` → mờ người, ramp mềm hai
  // đầu cảnh cho vào/ra không giật. Chữ bên trên GIỮ NGUYÊN (không dời ra giữa):
  // mờ giờ là KHUNG chọn được, không dính caption. Thay cơ chế punchline-tự-động
  // cũ (đọc `payload.punchDefocus` + `punchlineSet` lúc render).
  const blurFrame = !!scene?.frameBlock?.blur;
  const blurRamp =
    blurFrame && scene
      ? smooth(
          Math.max(
            0,
            Math.min(
              1,
              (t - scene.start) / DEFOCUS_RAMP,
              (scene.end - t) / DEFOCUS_RAMP,
            ),
          ),
        )
      : 0;
  const defocusBlur = blurFrame ? DEFOCUS_BLUR_PX * blurRamp : 0;

  // Chỗ nối áp lên HÌNH cảnh (zoom/nháy/nghiêng quanh vết cắt) — CHỈ khi cảnh là
  // NGƯỜI TOÀN-KHUNG. Cảnh có khung (b-roll/2-ô/thẻ) thì NÉ: thẻ b-roll + nền mờ
  // đã che gần hết nên fade/nhoè ở đó không ai thấy, chỉ tổ giật. Chỗ nối để dành
  // cho đoạn người-toàn-khung nơi nó thật sự đọc ra được.
  const jStyle = fullPerson
    ? junctionCss(t, payload.junctions, payload.pack)
    : null;

  return (
    <AbsoluteFill style={{ backgroundColor: page?.tone.color ?? "#08090C" }}>
      {/* TIẾNG chỉ ở KHUNG XEM (`payload.preview`). Bản XUẤT vẽ hình CÂM rồi ffmpeg
          ghép giọng + trộn nhạc SAU — nên ở export hai trường này rỗng, khỏi nhân
          đôi. Giọng khớp 1:1 dải output (video người đã cắt); nhạc đặt theo mốc +
          âm lượng của từng bài. */}
      {payload.preview && payload.voiceUrl && (
        <Audio src={staticFile(payload.voiceUrl)} />
      )}
      {payload.preview &&
        payload.music.map((track, i) => (
          <Sequence
            key={i}
            from={Math.round(track.start * fps)}
            durationInFrames={Math.max(
              1,
              Math.round((track.end - track.start) * fps),
            )}
          >
            <Audio src={staticFile(track.url)} volume={track.volume} />
          </Sequence>
        ))}
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
            // Blur DEFOCUS GIỮ ở cụm-nhấn — gộp vào filter cảnh (cả người lẫn thẻ
            // b-roll chìm), chữ punchline nổi lên trên (dải giữa).
            ...(defocusBlur
              ? {
                  filter: `${jStyle?.filter ?? ""} blur(${defocusBlur.toFixed(2)}px)`.trim(),
                }
              : {}),
          }}
        >
          {scene ? (
            <>
              {backdrop && (
                <OffthreadVideo
                  src={staticFile(payload.personUrl)}
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    // Mờ + tối NHẸ theo `bdK`. Dim VỪA PHẢI (0,22 thay vì 0,4):
                    // nền áp cho MỌI khung, dim mạnh thì cả video u ám tối nhiều chỗ
                    // chứ không chỉ khung đó. Đủ tối để thẻ nổi, không gloomy.
                    filter: `blur(${(24 * bdK).toFixed(1)}px) brightness(${(1 - 0.22 * bdK).toFixed(2)})`,
                    // Phóng theo `bdK`: 1,1 khi MỜ (giấu mép blur) → 1,0 khi NÉT
                    // (cuối khung). Nhờ vậy lúc thu về, nền = HỆT cảnh người toàn-
                    // khung (blur 0, sáng 1, scale 1) → cắt LIỀN MẠCH, hết giật cuối.
                    transform: `scale(${(1 + 0.1 * bdK).toFixed(3)})`,
                  }}
                />
              )}
              <Cells scene={scene} payload={payload} frame={frame} />
            </>
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
          {/* "Chữ vào giữa" ở punchline TẠM TẮT: phụ đề chồng thời gian nên cụm
              punchline bị cụm kế đè, canh giữa ra sai/nhấp nháy. Blur GIỮ vẫn chạy
              (defocusBlur ở trên) — đó là chất chính; canh giữa để lượt sau khi
              gỡ được chồng lấn phụ đề. */}
          <CaptionSeq c={c} pack={payload.pack} fps={fps} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
