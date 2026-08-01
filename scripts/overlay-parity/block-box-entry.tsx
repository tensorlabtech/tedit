import { createRoot } from "react-dom/client";

import { OverlayTextBlock } from "@/dev/overlays/overlay-render";
import "@/index.css";

import { STYLE_PACKS } from "../../server/style-pack-catalog";
import { CASES } from "./parity-cases";

/**
 * Nửa TRANG XEM của phép so CHỖ ĐỨNG khối chữ.
 *
 * Vì sao cần thêm một phép so nữa bên cạnh `parity-page.html`: trang kia so số
 * dòng và cỡ chữ, hai thứ tính được bằng hàm thuần — nên nó không bao giờ chạm
 * tới CSS. Mà chỗ hai đường vẽ vừa trôi khỏi nhau lại nằm đúng ở CSS: đệm dọc
 * của nền khối nở hộp dòng bên trang xem mà bên máy chủ không tính, và cả khối
 * chữ xuất ra thấp hơn trang xem 86 điểm ảnh. Phép so cũ báo "khớp 100%" suốt.
 *
 * Nên trang này DỰNG THẬT component, rồi đo hộp bao bằng `getBoundingClientRect`
 * — thứ chỉ trình duyệt mới trả lời được.
 */

const FRAME_WIDTH = 360;
const FRAME_HEIGHT = 640;

function Frame({
  packIndex,
  caseIndex,
}: {
  packIndex: number;
  caseIndex: number;
}) {
  const pack = STYLE_PACKS[packIndex];
  const item = CASES[caseIndex];
  return (
    <div
      data-frame={`${pack.id}|${caseIndex}`}
      // `@container` là mốc của `cqw`, đúng như khung xem thật dùng.
      className="@container relative overflow-hidden bg-neutral-900"
      style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }}
    >
      <OverlayTextBlock
        config={{
          text: item.text,
          align: pack.defaults.align,
          emphasis: pack.defaults.emphasis,
          band: item.band,
          keywords: [],
          insert: { kind: "none", shape: "wide" },
        }}
        pack={pack}
        // Số lớn: mọi tiếng đã hiện xong nên khối đứng ở chỗ CUỐI CÙNG của nó.
        // Đo giữa lúc chữ đang chạy vào là đo một vị trí tạm.
        seconds={99}
      />
    </div>
  );
}

function App() {
  return (
    <div className="flex flex-wrap">
      {STYLE_PACKS.map((_, packIndex) =>
        CASES.map((_, caseIndex) => (
          <Frame
            key={`${packIndex}-${caseIndex}`}
            packIndex={packIndex}
            caseIndex={caseIndex}
          />
        )),
      )}
    </div>
  );
}


/**
 * Đo hộp bao của khối chữ trong TỪNG khung, quy về tỉ lệ khung.
 *
 * Đo thẻ bọc (`> div`) chứ không đo từng hàng: đó là thứ `placeWords` trả về ở
 * `box`, nên hai bên mới so được với nhau.
 */
declare global {
  interface Window {
    __blockBoxes?: () => Array<{
      pack: string;
      caseIndex: number;
      top: number;
      bottom: number;
    }>;
    __blockReady?: boolean;
  }
}

window.__blockBoxes = () =>
  [...document.querySelectorAll("[data-frame]")].map((frame) => {
    const [pack, caseIndex] = (
      frame.getAttribute("data-frame") ?? "|"
    ).split("|");
    const outer = frame.getBoundingClientRect();
    const block = frame.querySelector(":scope > div > div")!.getBoundingClientRect();
    return {
      pack,
      caseIndex: Number(caseIndex),
      top: (block.top - outer.top) / outer.height,
      bottom: (block.bottom - outer.top) / outer.height,
    };
  });

/*
 * Nạp ĐÚNG tệp `.ttf` mà ffmpeg in ra, y như `parity-page.html` làm.
 *
 * Bốn trong mười bộ dùng font không có trong CSS của ứng dụng (Anton, Archivo,
 * Barlow Condensed, Lexend). Thiếu bước này thì trình duyệt lặng lẽ đo bằng font
 * thay thế — và phép so báo lệch tới 0,118 chiều cao khung ở những bộ đó trong
 * khi sản phẩm không sai gì. Một phép đo dùng sai font thì mọi con số nó ra đều
 * vô nghĩa, mà chúng vẫn trông hợp lý.
 */
async function loadPackFonts() {
  for (const pack of STYLE_PACKS) {
    const family = pack.font.cssStack
      .split(",")[0]
      .replace(/['"]/g, "")
      .trim();
    const face = new FontFace(family, `url(/${pack.font.file})`, {
      weight: String(pack.font.cssWeight),
      style: pack.font.italic ? "italic" : "normal",
    });
    await face.load();
    document.fonts.add(face);
  }
  await document.fonts.ready;
}

/*
 * Nạp font XONG RỒI MỚI dựng — thứ tự này là cả phép kiểm.
 *
 * `fitGroup` đo bề rộng bằng canvas NGAY LÚC dựng, và kết quả nằm luôn trong cây
 * React. Font về sau đó thì không có gì bắt React tính lại: phép bẻ dòng đứng
 * nguyên với số đo của font thay thế. Bản đầu của tệp này dựng trước, nạp sau —
 * và nó báo 61/100 khung lệch, trong đó có những khung sản phẩm không sai gì.
 */
void loadPackFonts().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
  // Chờ một nhịp cho React vẽ xong rồi mới báo sẵn sàng.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      window.__blockReady = true;
    }),
  );
});
