import type { FontSpec, StylePack, StylePackId } from "./style-pack";

/**
 * KHO HỌ CHỮ — khai một lần, các bộ dáng cùng trỏ vào.
 *
 * Chỉ `beVietnamProBlack` (Nhịp đen) và `patrickHand` (Phấn) còn được một bộ
 * dáng dùng tới sau khi mười bộ tham số cũ đã bỏ; mấy họ còn lại giữ NGỦ ĐÔNG —
 * chép sang bản thứ hai là có bản thứ hai để lệch, mà lệch `cssStack` với `file`
 * chính là lỗi "trang xem vẽ một font, ffmpeg in font kia" — im lặng tuyệt đối,
 * nên xoá hẳn thì rủi ro hơn giữ.
 *
 * `cssStack` phải khớp `@font-face` trong `src/style-pack-fonts.css`;
 * `npm run check:style-pack` đọc thẳng tệp CSS đó mà đối chiếu.
 */
const FONT = {
  beVietnamProItalic: {
    file: "assets/fonts/BeVietnamPro-ExtraBoldItalic.ttf",
    cssStack: "'Be Vietnam Pro', sans-serif",
    cssWeight: 800,
    italic: true,
  },
  beVietnamProBlack: {
    file: "assets/fonts/BeVietnamPro-Black.ttf",
    cssStack: "'Be Vietnam Pro Black', sans-serif",
    cssWeight: 900,
    italic: false,
  },
  anton: {
    file: "assets/fonts/Anton-Regular.ttf",
    cssStack: "Anton, sans-serif",
    cssWeight: 400,
    italic: false,
  },
  archivoExpanded: {
    file: "assets/fonts/Archivo-ExpandedBlack.ttf",
    cssStack: "'Archivo Expanded', sans-serif",
    cssWeight: 900,
    italic: false,
  },
  barlowCondensed: {
    file: "assets/fonts/BarlowCondensed-BoldItalic.ttf",
    cssStack: "'Barlow Condensed', sans-serif",
    cssWeight: 700,
    italic: true,
  },
  montserratItalic: {
    file: "assets/fonts/Montserrat-BoldItalic.ttf",
    cssStack: "Montserrat, sans-serif",
    cssWeight: 700,
    italic: true,
  },
  oswald: {
    file: "assets/fonts/Oswald-Bold.ttf",
    cssStack: "Oswald, sans-serif",
    cssWeight: 700,
    italic: false,
  },
  lexend: {
    file: "assets/fonts/Lexend-Bold.ttf",
    cssStack: "Lexend, sans-serif",
    cssWeight: 700,
    italic: false,
  },
  // Ba họ dưới đây KHÔNG phải sans — chúng chỉ tồn tại cho vai `accent`. Tám họ
  // trên đều là sans đậm, nên hai vai chọn trong đó thì chúng khác nhau về độ
  // đậm chứ không khác về nhóm chữ, và ở khổ điện thoại đó là không khác gì.
  playfairDisplay: {
    file: "assets/fonts/PlayfairDisplay-Bold.ttf",
    cssStack: "'Playfair Display', serif",
    cssWeight: 700,
    italic: false,
  },
  loraItalic: {
    file: "assets/fonts/Lora-BoldItalic.ttf",
    cssStack: "Lora, serif",
    cssWeight: 700,
    italic: true,
  },
  // Nét mảnh hơn hẳn mọi họ khác ở cùng cỡ chữ — 700 đã là thể đậm nhất của họ.
  // Chỉ dùng được cho cụm NGẮN cỡ lớn; đặt làm `voice` là phụ đề không đọc nổi.
  dancingScript: {
    file: "assets/fonts/DancingScript-Bold.ttf",
    cssStack: "'Dancing Script', cursive",
    cssWeight: 700,
    italic: false,
  },
  /*
   * NÉT BÚT THẬT — không phải thư pháp.
   *
   * `dancingScript` cũng là chữ viết, nhưng là thư pháp: nét đều, nghiêng đều,
   * nối liền. Nó đọc ra là "trang trọng", không đọc ra là "ai đó vừa ghi vội".
   * Patrick Hand thì rời từng chữ, chiều cao không đều, trục chữ hơi ngả —
   * đúng thứ một cụm chữ trên nền giấy hay bảng đen cần.
   *
   * Chọn nó trong bốn ứng viên vì cả bốn đều ĐỦ dấu tiếng Việt (74/74) nhưng ba
   * cái kia không phải nét bút: `grandstander` và `baloo2` là chữ hình học bo
   * tròn, `itim` là bút dạ. Phần lớn font viết tay Latin thiếu dấu Việt, nên
   * đây là chỗ phải đo trước khi chọn chứ không chọn theo mắt.
   */
  patrickHand: {
    file: "assets/fonts/PatrickHand-Regular.ttf",
    cssStack: "'Patrick Hand', cursive",
    cssWeight: 400,
    italic: false,
  },
} satisfies Record<string, FontSpec>;

/**
 * BỘ DÁNG — dữ liệu, không phải logic.
 *
 * Tách khỏi `style-pack.ts` (nơi khai kiểu và các hàm dùng chung) vì hai tệp trả
 * lời hai câu khác nhau: bên kia là *"một bộ dáng gồm những gì"*, bên này là
 * *"có những bộ dáng nào và chúng khác nhau ở đâu"*. Câu thứ hai là câu người ta
 * mở ra đọc nhiều nhất, nên nó không nên nằm sau hai trăm dòng khai kiểu.
 *
 * Luật của cả tệp: **mỗi cặp bộ dáng phải khác nhau ở ít nhất HAI trục nhìn thấy
 * được.** Chỉ đổi màu thì hai bộ đọc ra như một bộ có hai lựa chọn màu — không
 * đáng một ô riêng trong màn chọn.
 */
/*
 * ## Vì sao `defaults` được phép KHÁC NHAU giữa các bộ
 *
 * Vòng đầu để cả năm bộ khai `defaults` giống hệt nhau, để đổi bộ dáng an toàn
 * tuyệt đối. Giá phải trả lộ ra ngay khi dùng thật: khung "Đang sửa" chỉ bày ba
 * trục BỐ CỤC (dáng · chỗ đặt · căn ngang), nên đổi bộ dáng xong nhìn vào đó
 * **không thấy gì đổi** — năm bộ dáng đọc ra như một bộ có năm bảng màu.
 *
 * Nới ra được mà KHÔNG mất gì, vì `defaults` chỉ áp ở đúng MỘT thời điểm: lúc
 * SINH chữ (`caption-elements.ts`). Mà màn chờ cho chọn bộ dáng TRƯỚC khi chặng
 * `captions` chạy — lúc đó chưa có cụm nào để mà giữ hay đè. Nên:
 *
 * - **Dự án mới**: sinh chữ theo bố cục của bộ đã chọn → năm bộ khác nhau cả bố
 *   cục, và không có gì để mất vì chữ chưa tồn tại.
 * - **Đổi bộ dáng ở bàn dựng**: `defaults` KHÔNG áp lại, chỉ phần vẽ đổi. Bố
 *   cục từng cụm giữ nguyên — kể cả cụm người dùng đã chỉnh tay.
 *
 * Bất biến giữ nguyên: **`pack.defaults` chỉ được đọc ở `caption-elements.ts`**.
 * `npm run check:style-pack` quét mã nguồn để canh đúng điều đó — nó thay chỗ
 * cho phép kiểm "defaults giống hệt nhau" của vòng trước.
 *
 * `reveal` (cách tư liệu chèn hiện ra) vẫn để `none` ở mọi bộ: nó là mặc định
 * của phần tử CHỮ, mà chữ thì không có tư liệu để mà hiện.
 */

/**
 * Nền chung của mọi bộ dáng — chép đúng từng con số đang chạy trước khi có tệp này.
 *
 * Mỗi bộ dáng chỉ khai ĐIỀU NÓ KHÁC. Viết đủ mười lăm trường cho từng bộ thì
 * khác biệt chìm trong chỗ giống nhau, mà luật của phase này là *"mỗi cặp phải
 * khác nhau ở ít nhất HAI trục nhìn thấy được"* — luật đó chỉ kiểm được bằng mắt
 * khi chỗ khác nhau đứng riêng ra.
 */
const BASE = {
  theme: "ke-chuyen",
  letterCase: "as-typed",
  color: {
    main: { color: "#FFFFFF", alpha: 0.925 },
    dim: { color: "#D6DBE0", alpha: 0.72 },
    key: { color: "#FFFFFF", alpha: 1 },
  },
  // Ánh kim chữ nhấn: hai bộ hiện có đều chưa dùng — chữ nhấn tô màu đặc.
  sheen: null,
  edge: { share: 0.022, tone: { color: "#000000", alpha: 0.7 } },
  glow: { opacity: 0.9, radiusPx: 10, cssBlurShare: 12 },
  box: null,
  // Mảng màu: hai bộ hiện có đều chưa dùng — trục này để hạ tầng chờ bộ dáng
  // THIẾT BỊ tiếp theo, cùng lối `Phấn`/`Nhịp đen`.
  plate: null,
  page: null,
  layouts: [],
  scenePush: null,
  subjectEdge: null,
  behindText: null,
  doodles: null,
  sweep: null,
  // Hình dán: hai bộ hiện có đều chưa dùng.
  graphics: null,
  // Hình bám chữ: hai bộ hiện có đều chưa dùng.
  wrap: null,
  // Khung bao quanh hình: hai bộ hiện có đều chưa dùng — hình vẫn phủ kín như trước.
  frame: null,
  // Thẻ b-roll sạch: hai bộ hiện có đều dùng lối "dán tay" (nghiêng + rung + viền).
  insetCard: null,
  // Defocus giữ ở cụm-nhấn: chỉ Prism dùng (bản gốc "blur chính, chữ vào giữa").
  punchDefocus: null,
  // Dòng tiêu đề: hai bộ hiện có đều chưa dùng, cùng lý do với mảng màu.
  title: null,
  // Bộ gốc KHÔNG nắn màu: nó là mốc so, và mốc so phải là khung hình y như người
  // dùng quay ra.
  grade: null,
  highlight: null,
  // Đúng năm con số từng rải khắp `render.ts`, `ai-keywords.ts` và cột
  // `projects.min_silence`.
  intensity: {
    punchScale: 0.08,
    flashAmount: 0.7,
    keywordShare: 0.4,
    keywordsPerGroup: 2,
    minSilence: 0.8,
  },
  // Đúng năm con số từng chôn trong `caption-groups.ts`. Xem lý do của từng số
  // ở ghi chú trong tệp đó — chúng không phải chọn cho dễ đọc.
  grouping: { maxWords: 7, maxChars: 36, maxSpan: 2.2, minHold: 0 },
  density: {
    maxScale: 0.15,
    lineHeight: 1,
    wordGap: 0.12,
    leadRatio: 0.45,
    mixedSmallRatio: 0.55,
  },
  motion: {
    reveal: "per-word",
    enterSeconds: 0.3,
    baseDelay: 0.06,
    rowDelay: 0.16,
    colDelay: 0.07,
    largeScale: 0.14,
    smallShift: 0.035,
    largeShift: 0.24,
    lineBox: 1.15,
  },
  // Thiên lệch nhạc mặc định: không lọc gì ở hai trục đầu, và tránh nhạc CÓ LỜI.
  // Lời hát đè lên tiếng người nói là hỏng thẳng vào thứ video này đang bán —
  // đó là ràng buộc của sản phẩm chứ không phải sở thích của một bộ dáng, nên
  // mọi bộ đều mang nó.
  // Nhịp của bộ gốc = nhịp đang chạy trước khi có trục này: không thiên về kiểu
  // nào, và ba con số nhịp lấy đúng mức trung dung.
  effectBias: { junction: [], insertReveal: [] },
  rhythm: { junctionShare: 0.75, brollEverySec: 12 },
  musicBias: { energy: [], density: [], vocal: ["khong-loi"] },
  // `taper` (Dẫn nhỏ · ý to) chứ không phải `even`: đo video tham khảo
  // (`examples/`) thấy dòng dẫn cao 4,0% khung còn dòng ý cao 6,5% — chênh 1,6
  // lần, và chính cái chênh đó ép hai dòng cài răng lược vào nhau.
  // Cỡ chữ ĐỀU (không dẫn-nhỏ-ý-to): mỗi bộ dáng chữ đồng đều, người dùng chỉ
  // chọn CHỖ ĐẶT và MÀU TỪ NHẤN — không chỉnh cỡ từng cụm. Đơn giản, đọc ra là
  // phụ đề gọn chứ không phải một bảng điều khiển.
  defaults: { align: "center", emphasis: "even", reveal: "none" },
} satisfies Omit<StylePack, "id" | "label" | "fonts">;

/**
 * PHẤN — bộ đầu tiên dựng theo lối THIẾT BỊ, không theo lối tham số.
 *
 * Các bộ tham số trước đây (đã bỏ, xem ghi chú `findStylePack`) chỉ khác nhau ở
 * màu, font, nhanh chậm. Bộ này khác ở chỗ nó LÀM ĐƯỢC những việc các bộ đó
 * không làm được:
 *
 * · **Chữ chạy sau người** — khối chữ nằm giữa nền và người nói, bị đầu và vai
 *   che một phần. Đòi mặt nạ người (`work/subject.mp4`).
 * · **Viền quanh tư liệu chèn** — nét vàng bám mép ảnh/video chèn (b-roll), đúng
 *   bảng "Chalk" viền TƯ LIỆU chứ không viền người. Chỉ cần CÓ b-roll.
 * · **Nét vẽ tay** — ngoằn ngoèo, mặt cười, mây rải vào chỗ trống (chưa dựng).
 *
 * Chữ-sau-người đòi `work/subject.mp4`; dự án chưa tách nền thì nó im, còn bộ vẫn
 * ra chất nhờ nền bảng phấn + dấu góc + chữ viết tay + keyword vàng + viền b-roll.
 *
 * Chữ dùng Patrick Hand: nét bút rời từng chữ, chiều cao không đều. `voice` và
 * `accent` CÙNG một họ vì bộ này không nhấn bằng font mà nhấn bằng MÀU — vàng
 * trên nền chữ trắng, đúng lối bút dạ quang trên vở.
 */
export const PHAN: StylePack = {
  ...BASE,
  id: "phan",
  label: "Phấn",
  theme: "ke-chuyen",
  fonts: { voice: FONT.patrickHand, accent: FONT.patrickHand },
  color: {
    ...BASE.color,
    key: { color: "#F5E663", alpha: 1 },
  },
  // Ô SÁNG CHẠY THEO LỜI — caption "phong phú": mỗi tiếng đang nói được đè một ô
  // bo tối, chữ hoá kem sáng. Đúng dáng Chalk (hộp tối sau tiếng nhấn), và cho
  // phụ đề một nhịp sống thay vì đứng im. Hộp tối nổi trên video/ảnh chèn; trên
  // nền bảng phấn nó chỉ khẽ đậm hơn nên không chọi với chữ vàng.
  highlight: {
    tone: { color: "#FFF4CE", alpha: 1 },
    box: { color: "#20140A", alpha: 0.72 },
  },
  // Nét viền chữ dày hơn mặc định: chữ viết tay mảnh hơn hẳn chữ in ở cùng cỡ,
  // nên nó cần nhiều đường bao hơn để nổi khỏi nền video.
  /*
   * Trang BẢNG PHẤN tối — khác "Nhịp đen" ở nền ẤM có DẤU GÓC (kiểu khung ngắm)
   * thay vì lưới một phần ba, và ở chữ viết tay + keyword vàng.
   *
   * TỐI chứ không giấy trắng: chữ lời (BASE #FFFFFF) và CHỮ-SAU-NGƯỜI đều trắng
   * như phấn, nên nền phải tối thì chúng mới hiện — để giấy trắng là chữ-sau-
   * người trắng-trên-trắng vô hình. Đây đúng bảng phấn thật của Captions "Chalk":
   * charcoal ấm, dấu góc kẻ bằng phấn sáng để nổi trên nền tối.
   */
  // KHÔNG dấu góc / khung ngắm: đó là ngôn ngữ "Pulse" (Nhịp đen), không phải
  // Chalk. Chalk là bảng phấn TRƠN — chữ, ảnh dán, doodle nổi trực tiếp trên nền,
  // không có viền khung nào bao quanh khung hình.
  // Nền TRANG GIẤY SÁNG (kem) — chỉ hiện ở cảnh CÓ khung (b-roll): lúc đó ra một
  // TRANG SCRAPBOOK sáng với ảnh polaroid dán lên, đúng Chalk. Cảnh nói toàn-khung
  // video phủ kín nên không thấy nền này. Caption có viền tối nên vẫn đọc được
  // trên nền sáng; chữ-sau-người nằm trên video tối nên không đụng nền trang.
  page: {
    tone: { color: "#ECE4D0", alpha: 1 },
    grid: null,
  },
  /*
   * Ba bố cục, KHÔNG có `toan-khung`.
   *
   * Bộ này kể chuyện chậm, và ô luôn có mép là dấu "đang xem một trang" chứ
   * không phải "đang xem một video". Bỏ toàn khung là bỏ đúng cái phá cảm giác
   * ấy — nhưng cũng nghĩa là chữ luôn có dải riêng, nên chữ phải nhỏ hơn.
   */
  // TOÀN-KHUNG làm CHỦ ĐẠO — người nói phủ kín như Chalk, KHÔNG nhốt vào thẻ nhỏ.
  // Bỏ ô-đơn/ô-lệch (thẻ người kiểu Nhịp đen): `placePersonLayouts` lọc ra layout
  // ô-người (không cần tư liệu, khác toàn-khung) — rỗng thì không gieo thẻ người
  // nào. Chỉ giữ layout CÓ tư liệu để b-roll vẫn lên.
  // `broll-don` ĐỨNG ĐẦU họ b-roll → b-roll mặc định thành CẢNH RIÊNG (ảnh trên
  // nền phủ kín, như Chalk), collage 2 ô là biến thể.
  layouts: ["toan-khung", "broll-don", "vuong-ngang", "ngang-vuong"],
  // Dồn 4%/giây trên một phần tư số màn — mức của `ember`, bộ chậm nhất trong
  // kho mẫu mà vẫn có chuyển động.
  scenePush: { ratePerSecond: 0.04, share: 0.25 },
  edge: { share: 0.03, tone: { color: "#1A1A1A", alpha: 0.925 } },
  subjectEdge: {
    // Vàng BÚT DẠ ẤM, không neon chói: viền neon #F2FF3D đọc ra "đèn LED" chứ
    // không ra "bút dạ quang trên ảnh". Dịu lại cho hợp trang giấy + ảnh cắt dán.
    tone: { color: "#E7C24A", alpha: 0.92 },
    // MẢNH (3 thay vì 6): Chalk viền người bằng một nét bút gọn, không phải dải
    // dày ôm cả tóc/tay thành mảng rối. Số này chỉ chi phối viền QUANH NGƯỜI;
    // viền quanh b-roll tự tính bề dày theo cỡ ô.
    steps: 3,
    share: 0.3,
  },
  behindText: {
    // ANTON — grotesque ĐẬM ĐẶC HẸP kiểu Impact, viết HOA + phủ hạt phấn = đúng
    // chữ "YOUTH" khổng lồ sau người của Chalk. Nét tay PatrickHand cũ đọc ra
    // yếu, không phải "biển chữ nền".
    font: FONT.anton,
    // Chữ chìm SAU người (người được che đè lên) nên to được mà không át chủ thể.
    // 0.28: đủ lớn để thành mảng chữ nền có sức nặng như Chalk, chưa tràn khung.
    sizeShare: 0.28,
    tone: { color: "#FFFFFF", alpha: 0.5 },
    repeats: 3,
    // 2,4 giây — con số chụm nhất trong cả bộ số đo: sáu bộ mẫu ra 2,1 · 2,5 ·
    // 2,65 · 2,4 · 2,4 · 2,1–3,5. Bản đầu tôi đặt 4,5 theo cảm giác, gần gấp đôi.
    seconds: 2.4,
  },
  // Doodle CHỈ ở cảnh b-roll solo (xem `doodleSteps` + `brollWindows`): nét vẽ
  // tay vàng vào LỀ quanh ảnh như Chalk, KHÔNG rải khắp phim (lối rải cũ mới là
  // "đồ hoạ lạ" đã bị chê). Xoay vòng ngoằn ngoèo/mặt cười/mây/dấu tích.
  doodles: {
    ids: ["net-ngoan-ngoeo", "net-mat-cuoi", "net-may", "net-dau-tich"],
    tone: { color: "#E7C24A", alpha: 0.9 },
    sizeShare: 0.14,
  },
  density: { ...BASE.density, maxScale: 0.1, lineHeight: 1.3, wordGap: 0.16 },
  effectBias: {
    junction: ["cross-smooth", "zoom-out"],
    insertReveal: ["fade"],
  },
  rhythm: { junctionShare: 0.6, brollEverySec: 14 },
  musicBias: { energy: ["em", "vua"], density: [], vocal: ["khong-loi"] },
  intensity: { ...BASE.intensity, keywordShare: 0.5, minSilence: 0.8 },
  grouping: { ...BASE.grouping, maxWords: 7, maxChars: 34 },
  defaults: { ...BASE.defaults, align: "left", emphasis: "even" },
};

/**
 * NHỊP ĐEN — bộ đầu tiên dựng theo lối BỐ CỤC.
 *
 * Mọi bộ trước đều để video phủ kín khung rồi dán chữ lên. Bộ này để video vào
 * một Ô trên nền đen, và Ô ấy ĐỔI theo màn — ô đơn, toàn khung, ô lệch, hai ô.
 * Đó là trục không bộ nào khác có, và cũng là trục đổi diện mạo mạnh nhất: nó
 * đổi cả khung hình chứ không đổi mấy chữ trong khung.
 *
 * Lấy ý từ `pulse.mp4` trong kho mẫu, nhưng KHÔNG chép mốc thời gian của nó —
 * mốc là của một video cụ thể, còn `layout-schedule.ts` xếp màn theo luật đo
 * được và theo mép cụm chữ của CHÍNH video đang dựng.
 *
 * Chữ nằm NGOÀI ô, trên nền đen tuyền. Đó là điểm mạnh chứ không phải hạn chế:
 * chữ trên nền đen luôn đọc được, không phải lo tương phản với một khung hình
 * không đoán trước được — cũng là lý do bộ này không cần viền chữ dày.
 */
export const NHIP_DEN: StylePack = {
  ...BASE,
  id: "nhip-den",
  label: "Nhịp đen",
  theme: "manh",
  fonts: { voice: FONT.beVietnamProBlack, accent: FONT.beVietnamProBlack },
  letterCase: "upper",
  color: {
    ...BASE.color,
    key: { color: "#2FA8FF", alpha: 1 },
  },
  // Nền đen tuyền + lưới mờ: dấu "có thiết kế" rẻ nhất trong kho — một tệp PNG
  // sẵn có, một lớp phủ, mà nhìn phát biết không phải nền đen trơn.
  page: {
    tone: { color: "#08090C", alpha: 1 },
    grid: { id: "luoi-ba", tone: { color: "#2A3340", alpha: 0.4 } },
  },
  // Sáu bố cục xoay vòng. Ba cái cần tư liệu tự biến mất khi dự án chưa có.
  layouts: [
    "o-don",
    "toan-khung",
    "hai-o",
    "vuong-ngang",
    "ngang-vuong",
    "o-lech",
  ],
  /*
   * Dồn 6 %/giây trên 30% số màn — giữa dải đo được (2–10) và đúng cái tần suất
   * đo được (1–3 chỗ trong 30 giây, mà 30 giây có chừng bảy màn).
   *
   * Bộ MẠNH thì hợp: một cú dồn chậm là câu nói to, và bộ êm không có gì để nói
   * to. Cùng lý lẽ với vệt quét.
   */
  scenePush: { ratePerSecond: 0.06, share: 0.3 },
  // Không viền chữ: chữ đứng trên nền đen, không cần bao ngoài để tách khỏi nền.
  edge: null,
  density: { ...BASE.density, maxScale: 0.09, lineHeight: 1.2, wordGap: 0.14 },
  effectBias: { junction: ["cross-fade", "zoom-in"], insertReveal: ["slide"] },
  rhythm: { junctionShare: 0.83, brollEverySec: 9 },
  musicBias: { energy: ["vua", "manh"], density: [], vocal: ["khong-loi"] },
  intensity: { ...BASE.intensity, keywordShare: 0.5, minSilence: 0.7 },
  grouping: { ...BASE.grouping, maxWords: 7, maxChars: 32 },
  defaults: { ...BASE.defaults, align: "left", emphasis: "even" },
};

/**
 * PRISM PRO — bộ dựng theo lối EDITORIAL, nhấn bằng CỠ + SẮP XẾP, không đổi font.
 *
 * Hai bộ kia nhấn bằng MÀU (vàng / xanh) đều cỡ. Bộ này nhấn bằng BỐ CỤC CHỮ:
 * `emphasis: "keyword-large"` — cụm từ khoá PHÓNG TO trắng tinh, phần dẫn trước
 * lùi nhỏ lên trên, phần sau nhỏ xuống dưới. Một họ chữ sạch (Lexend) cho cả cụm
 * — tương phản HOÀN TOÀN đến từ CỠ + cách xếp, không hiệu ứng thừa. Đúng lối
 * `examples/caption-styles/prism-pro.mp4` ("The Price", "Is The Monthly Cost").
 * Title Case (`letterCase: "title"`) cho dáng đầu đề sang.
 *
 * (Từng thử hai font sans↔serif per-word và ánh kim chrome — bỏ cả hai vì đọc
 * "cố quá". Hạ tầng per-word (`pieceFont`) và `sheen` vẫn còn, ngủ đông.)
 *
 * KHÔNG nắn màu (`grade` null — quyết định của user). Ô tư liệu là THẺ SẠCH
 * (`insetCard`): thẳng, bo góc, bóng đổ, cảnh b-roll đơn phủ người mờ sau thẻ.
 */
export const PRISM_PRO: StylePack = {
  ...BASE,
  id: "prism-pro",
  label: "Prism Pro",
  theme: "gon",
  // MỘT họ chữ sạch cho cả cụm — nhấn bằng CỠ, không bằng font. `accent` trùng
  // `voice` (bộ một-họ) nên hạ tầng per-word ngủ đông, không đổi nét.
  fonts: { voice: FONT.lexend, accent: FONT.lexend },
  letterCase: "title",
  color: {
    main: { color: "#FFFFFF", alpha: 0.96 },
    // Context (tiếng phụ) TRẮNG-MỜ, KHÔNG xám: xám cố định chìm trên nền SÁNG.
    // Trắng-mờ + quầng tối đọc được cả nền sáng lẫn tối.
    dim: { color: "#FFFFFF", alpha: 0.78 },
    // Cụm nhấn (tiếng to) TRẮNG TINH — nổi bằng cỡ, không cần màu riêng.
    key: { color: "#FFFFFF", alpha: 1 },
  },
  // KHÔNG ánh kim: chữ to trắng đã đủ nổi, chrome đọc ra "cố quá".
  sheen: null,
  // Viền RẤT MẢNH + MỜ (0.35): chỉ gợi mép, KHÔNG phải viền đen gắt (high-contrast
  // đọc ra rẻ tiền). Tách nền chủ yếu nhờ QUẦNG TỐI MỀM bên dưới.
  edge: { share: 0.009, tone: { color: "#0A0F16", alpha: 0.35 } },
  // QUẦNG TỐI MỀM mạnh: bóng nhoè tối quanh chữ → chữ trắng nổi trên MỌI nền
  // (kể cả sáng) mà không cần viền cứng. Đây là cách tách nền cao cấp.
  glow: { opacity: 0.82, radiusPx: 11, cssBlurShare: 11 },
  // Nền trang TỐI sạch (KHÔNG lưới): lấp khoảng trống của bố cục ô bằng nền phòng
  // tối cao cấp. Cảnh b-roll đơn phủ NGƯỜI MỜ đè lên (`insetCard.blurBackdrop`).
  // Bắt buộc có `page` khi đã khai `layouts` — không thì đường ffmpeg bỏ qua cả
  // khối bố cục. Khác Nhịp đen ở chỗ KHÔNG lưới (`grid: null`).
  page: { tone: { color: "#0B0E13", alpha: 1 }, grid: null },
  // Thẻ tư liệu SẠCH: bo góc NHẸ (editorial, không vuông sắc), bóng đổ; cảnh
  // b-roll đơn phủ người mờ sau thẻ.
  insetCard: { shadowShare: 0.05, blurBackdrop: true, cornerShare: 0.04 },
  // DEFOCUS GIỮ ở cụm-nhấn — dùng THƯA (mỗi ≥14s): là ĐIỂM NHẤN hiếm, không phải
  // hiệu ứng thường. Lạm dụng blur toàn-khình thì user khó theo dõi. Chỉ mờ cụm dài
  // ≥ 0,8s. Ramp 0,45s ease mềm hai đầu.
  punchDefocus: { blurPx: 16, minGapSec: 14, rampSec: 0.45, minSpanSec: 0.8 },
  // KHÔNG viền vẽ tay quanh người — đó là bản sắc Phấn, không phải Prism.
  subjectEdge: null,
  // Toàn khung CHỦ ĐẠO (người phủ kín — dễ theo dõi) + b-roll thẻ nổi + hai ô.
  // BỎ `o-lech` (ô người đơn): khung-đơn nhiều quá làm video vụn, khó theo dõi —
  // người để toàn-khung, chỉ dùng thẻ khi CÓ tư liệu (b-roll).
  layouts: ["toan-khung", "o-vuong", "broll-don", "broll-vuong", "hai-o"],
  // Máy quay dồn MƯỢT, nhẹ — chất cinematic bình tĩnh, trên một phần ba số màn.
  scenePush: { ratePerSecond: 0.03, share: 0.35 },
  density: { ...BASE.density, maxScale: 0.12, lineHeight: 1.15, wordGap: 0.14 },
  // Chuyển cảnh MỀM (mờ chồng) — KHÔNG dùng junction `defocus`: scheduler đặt nó
  // dài bất định (đo được 15s!) làm blur cả đoạn = "nhập nhằng". Defocus của Prism
  // đi qua `punchDefocus` (kiểm soát: chỉ ở cụm-nhấn, giữ đúng cụm, ramp mượt).
  effectBias: { junction: ["cross-fade", "cross-smooth"], insertReveal: ["fade-up"] },
  // B-roll THƯA hơn (mỗi 15s thay vì 11): khung đơn ít lại, video đỡ vụn.
  rhythm: { junctionShare: 0.68, brollEverySec: 15 },
  musicBias: { energy: ["em", "vua"], density: [], vocal: ["khong-loi"] },
  intensity: { ...BASE.intensity, keywordShare: 0.45, minSilence: 0.8 },
  grouping: { ...BASE.grouping, maxWords: 7, maxChars: 36 },
  // NHẤN BẰNG CỠ: cụm từ khoá phóng to (phần dẫn nhỏ lên trên, phần sau nhỏ xuống
  // dưới) — bố cục chữ sáng tạo thay cho đổi font. `align: left` để khối bám lề.
  defaults: { ...BASE.defaults, align: "left", emphasis: "keyword-large" },
};

export const STYLE_PACKS: StylePack[] = [NHIP_DEN, PHAN, PRISM_PRO];

export const DEFAULT_STYLE_PACK_ID: StylePackId = "prism-pro";

/**
 * MỘT cổng duy nhất chịu trách nhiệm rơi-về-mặc-định.
 *
 * Tên rác trong CSDL không được làm sập lượt xuất video — kể cả tên của MƯỜI bộ
 * dáng cũ đã bỏ (`goc`, `chu-hoa-vang`…): thà ra bộ dáng mặc định còn hơn dừng cả
 * mạch vì một chuỗi lạ hay một chuỗi đã lỗi thời.
 */
export function findStylePack(id: string | null | undefined): StylePack {
  // Tên lạ/rác → rơi về bộ MẶC ĐỊNH hiện hành (một nguồn: `DEFAULT_STYLE_PACK_ID`);
  // `?? NHIP_DEN` là lưới cuối phòng khi chính default lỗi thời.
  return (
    STYLE_PACKS.find((pack) => pack.id === id) ??
    STYLE_PACKS.find((pack) => pack.id === DEFAULT_STYLE_PACK_ID) ??
    NHIP_DEN
  );
}

/**
 * PHONG CÁCH CHỮ — mượn RIÊNG phần chữ của một bộ khác, giữ nguyên phần còn lại.
 *
 * "Đổi phong cách chữ" khác hẳn "đổi phong cách video": nó chỉ thay dáng CHỮ
 * (font, HOA/thường, màu, viền, quầng) mà KHÔNG đụng nhịp cắt, mật độ b-roll, bố
 * cục, nắn màu hình hay nhạc — nên không kéo theo lệch nhịp/hiệu ứng đã đặt tay,
 * đúng thứ khiến đổi cả phong cách phải dè chừng.
 *
 * Trục này đã GỠ khỏi giao diện (không còn màn nào cho người dùng chọn phong
 * cách chữ riêng nữa) — hàm vẫn giữ lại làm hạ tầng ngủ đông cho lượt mở rộng
 * sau. Vì thế `styleId` giờ chỉ được ÁP khi nó trỏ đúng một bộ dáng THẬT còn
 * trong `STYLE_PACKS`; tên của mười bộ đã bỏ (dự án cũ lỡ lưu lại) đọc ra như
 * KHÔNG đè — nếu vẫn rơi về `findStylePack` (tức luôn có một bộ) thì dự án cũ sẽ
 * ÂM THẦM trộn font của bộ mặc định mới vào, đúng thứ ghi chú đầu tệp cấm.
 */
export function applyFontStyle(
  main: StylePack,
  styleId: string | null | undefined,
): StylePack {
  if (!styleId) return main;
  const source = STYLE_PACKS.find((pack) => pack.id === styleId);
  if (!source) return main;
  return {
    ...main,
    fonts: source.fonts,
    letterCase: source.letterCase,
    color: source.color,
    edge: source.edge,
    glow: source.glow,
  };
}

/**
 * Đổi chữ theo trục `letterCase`. MỘT hàm cho cả hai đường vẽ.
 *
 * Trang xem KHÔNG dùng `text-transform: uppercase`: làm thế thì phép đo chạy
 * trên chuỗi gốc còn nét vẽ ra là chuỗi hoa, và cụm chữ tự rộng thêm sau lưng
 * phép đo. Đổi thẳng chuỗi thì đo cái gì vẽ cái đó.
 */
export const styleCase = (text: string, pack: StylePack) =>
  pack.letterCase === "upper"
    ? text.toLocaleUpperCase("vi-VN")
    : pack.letterCase === "title"
      ? text.replace(
          /(\p{L})(\p{L}*)/gu,
          (_, head: string, tail: string) =>
            head.toLocaleUpperCase("vi-VN") + tail,
        )
      : text;
