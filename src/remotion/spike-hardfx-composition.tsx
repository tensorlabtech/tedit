import { AbsoluteFill, Video, staticFile } from "remotion";

/**
 * P1 — de-risk 3 HỆ KHÓ bằng CSS/PNG trong Remotion, thay cho ffmpeg:
 *
 *  ① GRAIN-VÀO-ALPHA (chữ phấn): ffmpeg nhân grain(gray) vào kênh alpha chữ.
 *     → CSS `mask-image` chế độ LUMINANCE với chính `caption-grain.png`: vùng grain
 *       sáng = chữ hiện, đốm tối = ăn mòn → nét "bụi phấn". Cùng nguyên lý (nhân
 *       độ sáng vào alpha), cùng tệp grain.
 *
 *  ② VIỀN GIẤY XÉ (ô b-roll): ffmpeg erode/dilate mặt nạ ô.
 *     → PNG `o-rach.png` pre-baked làm `mask-image` cho ô (mép xé), lớp vàng cùng
 *       mặt nạ phóng to 3% nằm sau = viền xé. Không cần morphology runtime.
 *
 *  ③ GLOW (quầng chữ): ffmpeg copy đen giữ alpha + boxblur + phủ sau.
 *     → CSS `drop-shadow` = quầng mờ theo đúng hình alpha chữ. radiusPx=10 khớp
 *       tham số glow của bộ dáng.
 *
 * Static (hiệu ứng là texture, không cần động) để soi rõ chất liệu.
 */

const CREAM = "#F2ECDC";
const YELLOW = "#E7C24A";
const CHALK = "#F7F1E3";
const BOXDARK = "rgba(32,20,10,0.72)"; // highlight box của Phấn

export function SpikeHardFxComposition() {
  const grain = `url(${staticFile("spike/caption-grain.png")})`;
  const torn = `url(${staticFile("spike/o-rach.png")})`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: CREAM,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-around",
        padding: "8% 6%",
      }}
    >
      {/* ① CHỮ PHẤN: grain-vào-alpha + ③ glow, trên hộp nhấn tối. */}
      <div
        style={{
          background: BOXDARK,
          padding: "2% 5%",
          borderRadius: 12,
          transform: "rotate(-2deg)",
        }}
      >
        <span
          style={{
            fontFamily: "Anton, sans-serif",
            fontSize: 150,
            lineHeight: 1,
            color: CHALK,
            // ① grain vào alpha (luminance mask = nhân độ sáng grain vào chữ)
            WebkitMaskImage: grain,
            maskImage: grain,
            WebkitMaskSize: "cover",
            maskSize: "cover",
            maskMode: "luminance",
            // mép lem nhẹ (gblur 0.6 của ffmpeg) + ③ glow (drop-shadow, radius 10)
            filter:
              "blur(0.4px) drop-shadow(0 0 10px rgba(20,20,20,0.9))",
            display: "inline-block",
          }}
        >
          BỤI PHẤN
        </span>
      </div>

      {/* ② Ô B-ROLL mép xé + viền vàng xé. */}
      <div
        style={{
          position: "relative",
          width: "78%",
          aspectRatio: "16/10",
          transform: "rotate(-3deg)",
        }}
      >
        {/* Lớp viền vàng: cùng mặt nạ xé, phóng 3% → ló ra thành viền. */}
        <div
          style={{
            position: "absolute",
            inset: "-2.5%",
            background: YELLOW,
            WebkitMaskImage: torn,
            maskImage: torn,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
          }}
        />
        {/* Ảnh b-roll mép xé. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            WebkitMaskImage: torn,
            maskImage: torn,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
            overflow: "hidden",
          }}
        >
          <Video
            src={staticFile("spike/broll.mp4")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            muted
          />
        </div>
      </div>

      {/* Nhãn so sánh. */}
      <div style={{ fontFamily: "Anton, sans-serif", fontSize: 44, color: "#1A1712" }}>
        ① grain · ② viền xé · ③ glow — CSS thuần
      </div>
    </AbsoluteFill>
  );
}
