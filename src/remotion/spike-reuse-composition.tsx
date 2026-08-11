import { AbsoluteFill } from "remotion";

import { Headline } from "@/dev/overlays/overlay-render";
import { PHAN } from "../../server/style-pack-catalog";
import type { StylePack } from "../../server/style-pack";

/**
 * P0b — TÁI DÙNG component overlay THẬT (`Headline`) của preview qua bundler
 * Remotion. Chứng minh: alias `@`, import `server/style-pack*`, Tailwind, và FONT
 * thật (Anton/Be Vietnam Pro) đều chạy trong Remotion — không phải viết lại.
 *
 * `Headline` trả null nếu `pack.title` null (Phấn mặc định tắt tiêu đề), nên spike
 * cấp một `title` để có gì mà vẽ. Đây là cách preview và export SẼ dùng chung một
 * component: cùng props, cùng kết quả.
 */
const PACK_WITH_TITLE: StylePack = {
  ...PHAN,
  title: {
    font: "voice",
    sizeShare: 0.09,
    band: "top",
    tone: { color: "#1A1712", alpha: 1 },
    bleed: false,
  },
};

export function SpikeReuseComposition() {
  return (
    <AbsoluteFill style={{ backgroundColor: "#F2ECDC" }}>
      <Headline
        text="Mình từng nghĩ chuyện này rất khó"
        pack={PACK_WITH_TITLE}
      />
    </AbsoluteFill>
  );
}
