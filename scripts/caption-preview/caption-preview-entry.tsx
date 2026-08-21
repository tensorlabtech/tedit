import { createRoot } from "react-dom/client";

import { OverlayTextBlock } from "@/dev/overlays/overlay-render";
import "@/index.css";

import { withFontRole } from "../../server/style-pack";
import { STYLE_PACKS } from "../../server/style-pack-catalog";

/**
 * Xem thử KHỐI CHỮ của từng bộ dáng ở mốc đã hiện xong — KHÔNG cần đăng nhập.
 *
 * Cùng lý do với `scripts/ui-preview/`: mọi đường dẫn thật nằm sau cổng Google mà
 * Google chối trình duyệt bị điều khiển, nên không có cửa này thì mọi lượt so
 * dáng chữ bằng máy đều phải nhờ người ngồi bấm.
 *
 * Dựng thẳng `OverlayTextBlock` — đúng bộ máy mà bản xuất Remotion dùng, nên thứ
 * thấy ở đây là thứ in ra.
 *
 *   npm run dev
 *   mở http://localhost:5173/scripts/caption-preview/caption-preview.html
 */
const TEXT = "Các bạn có tin được không ạ?";
const KEYWORDS = ["tin"];

function Tile({ packId }: { packId: string }) {
  const pack = STYLE_PACKS.find((item) => item.id === packId)!;
  const words = TEXT.split(/\s+/);
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div
        className="@container"
        style={{
          position: "relative",
          width: 360,
          aspectRatio: "9 / 16",
          background: "#1c1c1c",
          overflow: "hidden",
        }}
      >
        <OverlayTextBlock
          config={{
            text: TEXT,
            align: pack.defaults.align,
            emphasis: pack.defaults.emphasis,
            band: "middle",
            keywords: KEYWORDS,
            insert: { kind: "none", shape: "wide" },
          }}
          pack={withFontRole(pack, "voice")}
          // Mốc ĐÃ hiện xong mọi tiếng: so dáng cuối, không so hiệu ứng vào.
          wordStarts={words.map((_, index) => index * 0.25)}
          span={words.length * 0.25}
          seconds={99}
        />
      </div>
      <div style={{ color: "#eee", font: "12px sans-serif" }}>{pack.label}</div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      padding: 12,
      background: "#111",
    }}
  >
    {STYLE_PACKS.map((pack) => (
      <Tile key={pack.id} packId={pack.id} />
    ))}
  </div>,
);
