import type { StylePack } from "../../../server/style-pack";

/**
 * CHỮ-NỀN (sau người) trong khung xem trước — mirror khối `behindText` của
 * `render.ts`: chữ VIẾT HOA, font đậm đặc hẹp (Anton), xếp nhiều TẦNG chồng dọc
 * nhạt dần, cả chồng TRÔI LÊN chậm + MỜ vào/ra. Người được tách nền (`SubjectCutout`)
 * đè lên lớp này, nên chữ chỉ hở ra ở phần KHÔNG có người — đúng "chữ sau người".
 *
 * Đây là lớp NỀN (dưới người-cắt), parity XẤP XỈ: bỏ texture phấn, đo bằng % khung
 * thay vì điểm ảnh. Chỉ vẽ khi bộ dáng có `behindText` (Phấn) và có câu chữ-nền.
 */

// Cùng con số với `render.ts`.
const TIER_STEP = 0.22; // mỗi tầng vào muộn dần (giây)
const FADE = 0.35; // mờ vào/ra (giây) — HEADLINE_FADE
const DRIFT_PCT = (90 / 1920) * 100; // BEHIND_DRIFT trên chiều cao khung → %
const BANDS = 5; // BEHIND_BANDS
// 1cqw = 1% BỀ RỘNG; quy sang % CHIỀU CAO (khung khoá 9:16): ×9/16.
const CQW_TO_PCT_H = 9 / 16;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function BehindTextPreview({
  pack,
  line,
  band,
  seconds,
}: {
  pack: StylePack;
  /** Câu chữ-nền (chưa hoa) — từ `editor.sceneLayout.behindLine`. */
  line: string;
  /** Dải đặt (0..BANDS-1) — `editor.sceneLayout.behindBand`. */
  band: number;
  /** Giây trên trục preview (= `editor.time`). */
  seconds: number;
}) {
  const behind = pack.behindText;
  if (!behind || !line) return null;
  // Ngoài cửa sổ chữ-nền thì không vẽ gì.
  if (seconds >= behind.seconds + FADE) return null;

  const text = line.toLocaleUpperCase("vi-VN");
  const font = behind.font;
  const fontCqw = behind.sizeShare * 100;
  const fontPctH = fontCqw * CQW_TO_PCT_H;
  const bandTopPct = (band / BANDS) * 100;
  const driftPct = DRIFT_PCT * clamp01(seconds / behind.seconds);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: behind.repeats }, (_unused, tier) => {
        const tierAlpha = behind.tone.alpha * (1 - tier / (behind.repeats + 0.6));
        const fadeIn = clamp01((seconds - tier * TIER_STEP) / FADE);
        const fadeOut = clamp01(1 - (seconds - behind.seconds) / FADE);
        const opacity = tierAlpha * Math.min(fadeIn, fadeOut);
        if (opacity <= 0) return null;
        const top = bandTopPct + 1.02 * tier * fontPctH - driftPct;
        return (
          <div
            key={tier}
            className="absolute inset-x-0 text-center whitespace-nowrap"
            style={{
              top: `${top}%`,
              opacity,
              color: behind.tone.color,
              fontFamily: font.cssStack,
              fontWeight: font.cssWeight,
              fontStyle: font.italic ? "italic" : "normal",
              fontSize: `${fontCqw}cqw`,
              lineHeight: 1,
            }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}
