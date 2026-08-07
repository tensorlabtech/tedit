import { cssColor, type StylePack } from "../../../server/style-pack";

/**
 * VỆT QUÉT ở trang xem — bản sinh đôi của `sweepSteps` (`server/style-pack.ts`).
 *
 * Server dựng mỗi vệt là một dải màu đặc rộng `widthShare × khung`, chạy từ ngoài
 * mép trái sang ngoài mép phải trong `sweep.seconds`, TÂM đặt tại một mốc cắt. Twin
 * này tái dựng đúng hình học ấy bằng CSS — cùng số liệu, khác đầu ra.
 *
 * Vì sao dải ĐẶC chứ không gradient: server dùng `color=c=...` (một mảng màu phẳng),
 * nên để khớp bản xuất thì twin cũng phải đặc. Độ mờ nằm trong `tone.alpha`.
 *
 * Mốc cắt lấy từ CÙNG nguồn với bản xuất: `effects` (bỏ `kind==="none"`), mốc `outPeak`
 * trên dải đã cắt — đúng `cutMarks` mà `render.ts` truyền vào `sweepSteps`.
 */
export function StyleSweep({
  pack,
  cutMarks,
  seconds,
}: {
  pack: Pick<StylePack, "sweep">;
  /** Mốc cắt trên dải ĐÃ CẮT (giây), cùng thang với `seconds`. */
  cutMarks: readonly number[];
  /** Vạch hiện tại trên dải đã cắt (giây). */
  seconds: number;
}) {
  const sweep = pack.sweep;
  if (!sweep) return null;

  const half = sweep.seconds / 2;
  // Dải rộng theo bề rộng khung; quãng đi = một bề rộng khung cộng một bề rộng dải,
  // để mép dải ra hẳn ngoài hai đầu — đúng `travel = frameWidth + band` của server.
  const bandPct = sweep.widthShare * 100;
  const travelPct = 100 + bandPct;

  // Mỗi mốc cắt một lượt quét. Hai mốc gần nhau có thể chồng khoảng — vẽ HẾT các
  // lượt đang chạy, đúng như server phủ mỗi vệt một lớp riêng.
  const actives = cutMarks.filter(
    (cut) => seconds >= cut - half && seconds <= cut + half,
  );
  if (actives.length === 0) return null;

  return (
    <>
      {actives.map((cut, index) => {
        const from = cut - half;
        const progress = Math.max(0, Math.min(1, (seconds - from) / sweep.seconds));
        const leftPct = -bandPct + travelPct * progress;
        return (
          <div
            key={index}
            aria-hidden
            className="pointer-events-none absolute inset-y-0"
            style={{
              left: `${leftPct}%`,
              width: `${bandPct}%`,
              background: cssColor(sweep.tone),
            }}
          />
        );
      })}
    </>
  );
}
