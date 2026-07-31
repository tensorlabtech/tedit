import type { StylePack, StylePackId } from "./style-pack";

/**
 * TÁM BỘ DÁNG — dữ liệu, không phải logic.
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
    main: { color: "#FFFFFF", alpha: 0.92 },
    dim: { color: "#D6DBE0", alpha: 0.72 },
    key: { color: "#FFFFFF", alpha: 1 },
  },
  edge: { share: 0.022, tone: { color: "#000000", alpha: 0.7 } },
  glow: { opacity: 0.9, radiusPx: 10, cssBlurShare: 12 },
  box: null,
  // Emoji BẬT ở nền chung, tỉ lệ dè dặt. Ba bộ nhóm "Gọn" tự tắt bằng `null`.
  //
  // Khác `grade` (bộ gốc để `null` làm mốc so): nắn màu là đụng vào KHUNG HÌNH
  // của người dùng, còn emoji là thêm một vật lên lớp phủ — mà lớp phủ thì bộ
  // gốc vốn đã làm rất nhiều. Vả lại bộ gốc là bộ mặc định, để `null` ở đây là
  // phần lớn người dùng không bao giờ thấy trục này tồn tại.
  emoji: { scale: 1.15, share: 0.18 },
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
  grouping: { maxWords: 5, maxChars: 26, maxSpan: 2.2, minHold: 0 },
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
  rhythm: { junctionShare: 0.5, brollEverySec: 12, brollHoldSec: 3 },
  musicBias: { energy: [], density: [], vocal: ["khong-loi"] },
  // `taper` (Dẫn nhỏ · ý to) chứ không phải `even`: đo video tham khảo
  // (`examples/`) thấy dòng dẫn cao 4,0% khung còn dòng ý cao 6,5% — chênh 1,6
  // lần, và chính cái chênh đó ép hai dòng cài răng lược vào nhau.
  defaults: { align: "center", emphasis: "taper", reveal: "none" },
} satisfies Omit<StylePack, "id" | "label" | "font">;

/**
 * Bộ dáng gốc — đúng dáng đang chạy, và là mốc để so bốn bộ kia.
 *
 * Font là bản thay của `Arial Bold Italic`: Arial không phát hành kèm phần mềm
 * được và máy chủ Linux không có nó. Xem `reports/font-audit.md`.
 */
export const GOC: StylePack = {
  ...BASE,
  id: "goc",
  label: "Mộc",
  theme: "ke-chuyen",
  font: {
    file: "assets/fonts/BeVietnamPro-ExtraBoldItalic.ttf",
    cssStack: "'Be Vietnam Pro', sans-serif",
    cssWeight: 800,
    italic: true,
  },
};

/**
 * Chữ hoa vàng — dáng tít báo. Khác bộ gốc ở: CHỮ HOA · màu nhấn vàng · font hẹp
 * đứng · viền dày · bước dòng nới hẳn.
 *
 * `lineHeight` 1,4 là TRẦN mà bộ dáng được phép đặt. Số đo không-đè của Anton ở
 * dạng chữ hoa là 1,409 (`reports/font-audit.md`), tức còn hụt 0,6% — đủ để hai
 * dấu chạm nhau ở ca xấu nhất chứ không đủ để đè lên nét chữ. Nới trần lên nữa
 * thì ba hàng chữ hoa vượt `MAX_BLOCK_SHARE`, mà đó là hằng không được đụng.
 */
export const CHU_HOA_VANG: StylePack = {
  ...BASE,
  id: "chu-hoa-vang",
  label: "Thép",
  theme: "manh",
  font: {
    file: "assets/fonts/Anton-Regular.ttf",
    cssStack: "Anton, sans-serif",
    cssWeight: 400,
    italic: false,
  },
  letterCase: "upper",
  color: {
    main: { color: "#FFFFFF", alpha: 0.95 },
    dim: { color: "#C8CDD2", alpha: 0.7 },
    key: { color: "#FFD400", alpha: 1 },
  },
  // Đo trên kho 55 bài: `manh` một mình chỉ còn 5 bài, tức mọi video dùng bộ
  // này đều rút từ đúng năm bài — chính là thứ cả kế hoạch đang chống. Nới sang
  // `manh|vua` thành 22 bài mà vẫn nằm hẳn về phía nhạc đẩy tới.
  // Nhanh và chói: đánh dấu gần hết chỗ nối, b-roll dày và ngắn.
  effectBias: {
    junction: ["flash", "zoom-in"],
    insertReveal: ["pop", "slide", "none"],
  },
  rhythm: { junctionShare: 0.8, brollEverySec: 7, brollHoldSec: 2 },
  musicBias: { energy: ["manh", "vua"], density: ["day"], vocal: ["khong-loi"] },
  // Viền dày hơn bộ gốc: nét Anton rất đặc nên viền mảnh chìm mất vào chính nó.
  edge: { share: 0.03, tone: { color: "#000000", alpha: 0.8 } },
  density: { ...BASE.density, lineHeight: 1.4 },
  // Cỡ ĐỀU, không dẫn nhỏ ý to: chữ HOA đã đủ mạnh, thêm một tầng nhấn nữa là
  // hai thứ tranh nhau. Đây là dáng tít báo — tít không có dòng dẫn.
  intensity: { ...BASE.intensity, punchScale: 0.12, flashAmount: 0.9, keywordShare: 0.5, minSilence: 0.5 },
  // Ít tiếng một cụm → CHỮ TO.
  //
  // Đo trên khung hình thật: cụm 5 tiếng ở trần 3 dòng ra ba dòng nhỏ, mà cái
  // nhóm "Mạnh" đang bán là chữ to đập vào mắt. Trần dòng là hằng không đụng
  // được, nên đường duy nhất để chữ to hơn là bớt tiếng — và đó đúng là knob
  // `grouping` vừa mở ra.
  grouping: { ...BASE.grouping, maxWords: 3, maxChars: 18 },
  // LẠNH và cứng — thép. Rút bớt bão hoà để màu da không tranh với chữ hoa,
  // và kéo hẳn về phía lam: đây là bộ lạnh nhất trong mười bộ.
  grade: { brightness: 1.08, contrast: 1.1, saturation: 0.92, warmth: -0.35 },
  emoji: { scale: 1.25, share: 0.3 },
  defaults: { ...BASE.defaults, emphasis: "even" },
};

/**
 * Nhấn xanh — dáng bảng hiệu. Khác bộ gốc ở: chữ ĐỨNG rộng bản · màu nhấn xanh
 * lá · trần cỡ hạ xuống.
 *
 * Xanh lá là màu duy nhất trong bảng không đụng vàng hay trắng, nên đặt cạnh bộ
 * chữ hoa vàng vẫn đọc ra hai bộ khác nhau chứ không ra một bộ hai màu.
 */
export const NHAN_XANH: StylePack = {
  ...BASE,
  id: "nhan-xanh",
  label: "Nắng",
  theme: "ke-chuyen",
  font: {
    file: "assets/fonts/Archivo-ExpandedBlack.ttf",
    cssStack: "'Archivo Expanded', sans-serif",
    cssWeight: 900,
    italic: false,
  },
  color: { ...BASE.color, key: { color: "#00E676", alpha: 1 } },
  effectBias: { junction: ["zoom-in", "zoom-out"], insertReveal: ["slide", "fade-up"] },
  rhythm: { junctionShare: 0.6, brollEverySec: 10, brollHoldSec: 3 },
  musicBias: { energy: ["vua"], density: ["day"], vocal: ["khong-loi"] },
  density: {
    ...BASE.density,
    // Font rộng bản nên cùng một cụm đã chiếm nhiều bề ngang hơn; hạ trần cỡ để
    // cụm ngắn không phình ra chạm mép.
    maxScale: 0.135,
    lineHeight: 1.05,
  },
  // Bám lề TRÁI: font rộng bản đứng thẳng, căn giữa thì cả khối đọc ra như một
  // tấm biển treo giữa khung. Lệch trái mới ra dáng "đặt vào" chứ không "dán lên".
  intensity: { ...BASE.intensity, punchScale: 0.09, keywordShare: 0.45 },
  // ẤM và tươi — nắng. Sáng lên, bão hoà lên, đẩy hẳn sang đỏ.
  grade: { brightness: 1.1, contrast: 1.04, saturation: 1.18, warmth: 0.45 },
  emoji: { scale: 1.2, share: 0.25 },
  defaults: { ...BASE.defaults, align: "left" },
};

/**
 * Nét thưa — dáng thoáng. Khác bộ gốc ở: KHÔNG VIỀN · font hẹp nghiêng · chữ
 * giãn hẳn ra (bước dòng 1,25 · khoảng tiếng 0,2).
 *
 * Bộ duy nhất không có viền, chỉ còn quầng tối mềm — chữ như nằm trong hình chứ
 * không dán lên. Đổi lại quầng phải đậm và rộng hơn, vì mất viền thì đó là thứ
 * duy nhất còn tách chữ khỏi tư liệu sáng.
 */
export const NET_THUA: StylePack = {
  ...BASE,
  id: "net-thua",
  label: "Sương",
  theme: "gon",
  font: {
    file: "assets/fonts/BarlowCondensed-BoldItalic.ttf",
    cssStack: "'Barlow Condensed', sans-serif",
    cssWeight: 700,
    italic: true,
  },
  edge: null,
  glow: { opacity: 1, radiusPx: 16, cssBlurShare: 18 },
  // Êm và thưa: ít đánh dấu, b-roll xa nhau và giữ lâu.
  effectBias: { junction: ["dip"], insertReveal: ["fade", "fade-up"] },
  rhythm: { junctionShare: 0.25, brollEverySec: 18, brollHoldSec: 5 },
  musicBias: { energy: ["em"], density: ["thua"], vocal: ["khong-loi"] },
  density: {
    ...BASE.density,
    // Font hẹp nên cùng một cụm còn thừa bề ngang; nới trần cỡ để bù lại.
    maxScale: 0.16,
    lineHeight: 1.25,
    wordGap: 0.2,
  },
  // So le: cả bộ này sống bằng khoảng thở, mà so le là cách xếp dòng thoáng nhất
  // trong năm cách — nhịp KHÔNG đều mới ra thiết kế.
  intensity: { punchScale: 0.05, flashAmount: 0.45, keywordShare: 0.25, keywordsPerGroup: 1, minSilence: 1.2 },
  // Phai và mát: bộ này bán khoảng thở, nên hình cũng phải lùi lại một bước để
  // chữ mảnh không phải tranh với nền.
  grade: { brightness: 1.12, contrast: 0.9, saturation: 0.72, warmth: -0.25 },
  // KHÔNG emoji. Cả bộ này bán khoảng thở; một hình nảy lên giữa khung là thứ
  // đầu tiên phá nó.
  emoji: null,
  defaults: { ...BASE.defaults, align: "stagger" },
};

/**
 * Đứng yên — dáng phụ đề sạch. Khác bộ gốc ở: CẢ CỤM HIỆN MỘT LƯỢT · font đứng
 * thoáng · màu nhấn vàng.
 *
 * Trục `reveal` gánh gần hết bộ này: bốn bộ kia chạy từng tiếng, nên chỉ riêng
 * việc chữ đứng im đã đọc ra một sản phẩm khác — kể cả khi font và màu không xa
 * nhau lắm.
 */
export const DUNG_YEN: StylePack = {
  ...BASE,
  id: "dung-yen",
  label: "Lặng",
  theme: "gon",
  font: {
    file: "assets/fonts/Lexend-Bold.ttf",
    cssStack: "Lexend, sans-serif",
    cssWeight: 700,
    italic: false,
  },
  color: {
    ...BASE.color,
    main: { color: "#FFFFFF", alpha: 0.95 },
    key: { color: "#FFD400", alpha: 1 },
  },
  density: {
    ...BASE.density,
    maxScale: 0.13,
    lineHeight: 1.15,
    wordGap: 0.14,
  },
  motion: { ...BASE.motion, reveal: "none" },
  effectBias: { junction: ["dip", "zoom-out"], insertReveal: ["fade", "none"] },
  rhythm: { junctionShare: 0.35, brollEverySec: 15, brollHoldSec: 4 },
  musicBias: { energy: ["em", "vua"], density: ["thua"], vocal: ["khong-loi"] },
  // Cỡ đều, căn giữa — dáng phụ đề sạch đúng nghĩa. Cả cụm hiện một lượt mà còn
  // chia hai tầng cỡ chữ thì mất luôn cái tĩnh mà bộ này đang bán.
  intensity: { punchScale: 0.05, flashAmount: 0.5, keywordShare: 0.3, keywordsPerGroup: 1, minSilence: 1 },
  // Gần như không đụng vào màu, chỉ hạ tương phản và rút bão hoà: bộ này bán
  // cái TĨNH, mà một sắc ám rõ ràng là một thứ để ý.
  grade: { brightness: 1.05, contrast: 0.96, saturation: 0.85, warmth: 0.05 },
  emoji: null,
  defaults: { ...BASE.defaults, emphasis: "even" },
};

/**
 * Nét đặc — dáng khối. Khác bộ gốc ở: chữ ĐỨNG nét dày đặc · màu nhấn đỏ · chữ
 * dồn sát nhau · căn phải.
 *
 * Be Vietnam Pro bản Black đứng: cùng họ chữ với bộ gốc nên chữ cái quen mắt,
 * nhưng bỏ hẳn nghiêng và đẩy nét lên đậm nhất — đọc ra chắc nịch thay vì lướt.
 */
export const NET_DAC: StylePack = {
  ...BASE,
  id: "net-dac",
  label: "Lửa",
  theme: "manh",
  font: {
    file: "assets/fonts/BeVietnamPro-Black.ttf",
    cssStack: "'Be Vietnam Pro Black', sans-serif",
    cssWeight: 900,
    italic: false,
  },
  color: { ...BASE.color, key: { color: "#FF5252", alpha: 1 } },
  edge: { share: 0.026, tone: { color: "#000000", alpha: 0.75 } },
  density: {
    ...BASE.density,
    maxScale: 0.14,
    lineHeight: 1.1,
    // Khoảng tiếng hẹp nhất trong tám bộ: cả hàng dồn lại thành một mảng đặc,
    // đúng thứ cái tên hứa.
    wordGap: 0.08,
  },
  effectBias: { junction: ["flash", "dip"], insertReveal: ["pop", "none"] },
  rhythm: { junctionShare: 0.7, brollEverySec: 9, brollHoldSec: 2.5 },
  musicBias: { energy: ["manh", "vua"], density: ["day"], vocal: ["khong-loi"] },
  intensity: { ...BASE.intensity, punchScale: 0.11, flashAmount: 0.85, keywordShare: 0.5, minSilence: 0.6 },
  // Độ đục 0,8 chứ không phải 0,55.
  //
  // Đo trên khung hình thật của một video quay trong phòng thiếu sáng: nền đen
  // 0,55 chồng lên một nền vốn đã tối thì gần như không đọc ra là có nền — trục
  // dáng mạnh nhất của bộ này biến mất đúng ở loại video hay gặp nhất.
  box: { tone: { color: "#000000", alpha: 0.8 }, padShare: 0.14 },
  grouping: { ...BASE.grouping, maxWords: 3, maxChars: 18 },
  // ẤM NHẤT trong mười bộ, tương phản cao — lửa.
  grade: { brightness: 1.06, contrast: 1.12, saturation: 1.15, warmth: 0.5 },
  emoji: { scale: 1.3, share: 0.32 },
  defaults: { ...BASE.defaults, align: "right", emphasis: "even" },
};

/**
 * Nghiêng tròn — dáng sạch. Khác bộ gốc ở: chữ cái hình học tròn · màu nhấn xanh
 * dương · viền mảnh nhất · xếp bậc thang.
 *
 * Montserrat nghiêng: cùng là nghiêng như bộ gốc nhưng chữ cái dựng từ hình
 * tròn và hình vuông thay vì từ nét viết — đọc ra gọn gàng, ít cảm xúc hơn, hợp
 * nội dung hướng dẫn.
 */
export const NGHIENG_TRON: StylePack = {
  ...BASE,
  id: "nghieng-tron",
  label: "Giấy",
  theme: "gon",
  font: {
    file: "assets/fonts/Montserrat-BoldItalic.ttf",
    cssStack: "Montserrat, sans-serif",
    cssWeight: 700,
    italic: true,
  },
  color: { ...BASE.color, key: { color: "#4FC3F7", alpha: 1 } },
  // Viền mảnh nhất trong tám bộ: nét Montserrat đã đều và sạch, viền dày là phủ
  // mất chính cái sạch ấy.
  edge: { share: 0.016, tone: { color: "#000000", alpha: 0.65 } },
  density: {
    ...BASE.density,
    maxScale: 0.145,
    lineHeight: 1.12,
    wordGap: 0.16,
  },
  effectBias: { junction: ["zoom-out"], insertReveal: ["fade-up", "fade"] },
  rhythm: { junctionShare: 0.45, brollEverySec: 12, brollHoldSec: 3.5 },
  musicBias: { energy: ["vua"], density: [], vocal: ["khong-loi"] },
  intensity: { ...BASE.intensity, punchScale: 0.07, flashAmount: 0.6, keywordShare: 0.35, minSilence: 0.9 },
  // Giấy cũ: hơi ngả vàng, bão hoà rút xuống, tương phản để nguyên — mặt giấy
  // không bóng, nên tăng tương phản là ra nhựa chứ không ra giấy.
  grade: { brightness: 1.08, contrast: 1.0, saturation: 0.86, warmth: 0.18 },
  emoji: null,
  defaults: { ...BASE.defaults, align: "stair" },
};

/**
 * Dựng đứng — dáng thể thao. Khác bộ gốc ở: chữ HẸP và CAO · màu nhấn tím ·
 * trần cỡ cao nhất · bám lề trái.
 *
 * Oswald hẹp nhất trong tám font, nên cùng một cụm nhét được nhiều tiếng hơn
 * hẳn: đây là bộ duy nhất giữ được cụm dài trên MỘT hàng.
 */
export const DUNG_DUNG: StylePack = {
  ...BASE,
  id: "dung-dung",
  label: "Nhịp",
  theme: "manh",
  font: {
    file: "assets/fonts/Oswald-Bold.ttf",
    cssStack: "Oswald, sans-serif",
    cssWeight: 700,
    italic: false,
  },
  color: { ...BASE.color, key: { color: "#B388FF", alpha: 1 } },
  density: {
    ...BASE.density,
    maxScale: 0.155,
    lineHeight: 1.25,
    wordGap: 0.1,
  },
  effectBias: { junction: ["zoom-in", "flash"], insertReveal: ["slide"] },
  rhythm: { junctionShare: 0.65, brollEverySec: 8, brollHoldSec: 2.5 },
  musicBias: { energy: ["manh", "vua"], density: [], vocal: ["khong-loi"] },
  intensity: { ...BASE.intensity, punchScale: 0.1, flashAmount: 0.8, keywordShare: 0.45, minSilence: 0.6 },
  grouping: { ...BASE.grouping, maxWords: 4, maxChars: 22 },
  // Lạnh mà TƯƠI: bão hoà cao nhất trong mười bộ, kéo về lam. Màu của video
  // thể thao — không phải màu ấm áp, mà là màu chói.
  grade: { brightness: 1.08, contrast: 1.08, saturation: 1.2, warmth: -0.4 },
  emoji: { scale: 1.25, share: 0.3 },
  defaults: { ...BASE.defaults, align: "left", emphasis: "even" },
};

/**
 * Từng chữ — mỗi lúc một tiếng trên màn.
 *
 * Bộ duy nhất đổi trục **chia cụm**: `maxWords: 1`. Không cần loại `element`
 * nào mới — chữ vốn neo vào khoảng từ, và khoảng một từ là hợp lệ.
 *
 * Ba con số phải đi kèm nhau, bỏ một cái là hỏng:
 *
 * - `minHold 0.22` — tiếng nào ngắn hơn thì gộp với tiếng sau. Không có sàn này
 *   thì tiếng 0,12 giây hiện đúng 3 khung hình rồi tắt, đọc ra là nhấp nháy.
 * - `enterSeconds 0.1` — hiệu ứng hiện phải NGẮN HƠN thời gian tiếng đó sống.
 *   Giữ 0,3 giây như các bộ khác thì tiếng tắt trước cả lúc nó hiện xong.
 * - `emphasis: "even"` — một tiếng thì `taper` không có hàng dẫn, `mixed-size`
 *   không có gì để xen, `keyword-large` không có gì để tương phản. Trục nhấn
 *   mất nghĩa ở bộ này, nên khai thẳng cái vô hại nhất.
 */
export const TUNG_CHU: StylePack = {
  ...BASE,
  id: "tung-chu",
  label: "Gõ",
  theme: "manh",
  font: {
    file: "assets/fonts/Anton-Regular.ttf",
    cssStack: "Anton, sans-serif",
    cssWeight: 400,
    italic: false,
  },
  letterCase: "upper",
  color: { ...BASE.color, key: { color: "#FFD400", alpha: 1 } },
  edge: { share: 0.03, tone: { color: "#000000", alpha: 0.8 } },
  grouping: { maxWords: 1, maxChars: 99, maxSpan: 2.2, minHold: 0.22 },
  density: { ...BASE.density, maxScale: 0.16, lineHeight: 1.4 },
  motion: { ...BASE.motion, enterSeconds: 0.1, rowDelay: 0, colDelay: 0 },
  effectBias: { junction: ["flash"], insertReveal: ["pop", "none"] },
  rhythm: { junctionShare: 0.75, brollEverySec: 8, brollHoldSec: 2 },
  musicBias: { energy: ["manh"], density: ["day"], vocal: ["khong-loi"] },
  intensity: { punchScale: 0.12, flashAmount: 0.9, keywordShare: 0.15, keywordsPerGroup: 1, minSilence: 0.5 },
  box: { tone: { color: "#000000", alpha: 0.75 }, padShare: 0.18 },
  // Sáng và sắc, gần như không ám màu: bộ này mỗi lúc một tiếng trên nền đen,
  // nên cái cần là hình RÕ chứ không phải hình có sắc thái.
  grade: { brightness: 1.1, contrast: 1.12, saturation: 0.95, warmth: 0.1 },
  // Tỉ lệ hạ hẳn: bộ này mỗi TIẾNG một cụm nên số cụm gấp mấy lần bộ khác —
  // giữ nguyên 0,3 là emoji hiện gần như liên tục. Cạnh cũng nhỏ lại vì chữ ở
  // đây vốn đã rất to.
  emoji: { scale: 1.0, share: 0.08 },
  defaults: { ...BASE.defaults, emphasis: "even" },
};

/**
 * Sáng theo lời — cả cụm đứng yên, tiếng đang nói sáng lên.
 *
 * Bộ duy nhất bật trục **tô sáng**. Nó ngược hẳn với "Từng chữ": người xem đọc
 * được cả cụm nên bắt kịp ý, mà vẫn biết đang nói tới đâu.
 *
 * `reveal: "none"` là bắt buộc chứ không phải chọn: cụm đã đứng yên rồi thì
 * chuyển động duy nhất trên màn là vệt sáng chạy — thêm hiệu ứng hiện từng
 * tiếng nữa là hai thứ chạy cùng lúc và mắt không biết bám vào đâu.
 */
export const SANG_THEO_LOI: StylePack = {
  ...BASE,
  id: "sang-theo-loi",
  label: "Sóng",
  theme: "ke-chuyen",
  font: {
    file: "assets/fonts/Montserrat-BoldItalic.ttf",
    cssStack: "Montserrat, sans-serif",
    cssWeight: 700,
    italic: true,
  },
  color: {
    ...BASE.color,
    main: { color: "#FFFFFF", alpha: 0.72 },
    key: { color: "#FFFFFF", alpha: 1 },
  },
  // Vệt sáng phải ĂN ĐỨT màu nền của chữ, không thì nó đọc ra như một lỗi vẽ.
  // Chữ nền hạ xuống 0,72 độ đục cũng vì thế: chênh lệch mới là thứ nhìn ra.
  // Chữ TỐI trên nền VÀNG, không phải chữ vàng trên nền trong: ô sáng chạy dọc
  // câu là thứ mắt bám được ở khổ điện thoại, còn đổi mỗi màu chữ thì trên nền
  // video nhiều chi tiết gần như không thấy.
  highlight: {
    tone: { color: "#1A1A1A", alpha: 1 },
    box: { color: "#FFD400", alpha: 1 },
  },
  density: { ...BASE.density, maxScale: 0.14, lineHeight: 1.15 },
  motion: { ...BASE.motion, reveal: "none" },
  effectBias: { junction: ["zoom-out", "dip"], insertReveal: ["fade"] },
  rhythm: { junctionShare: 0.4, brollEverySec: 13, brollHoldSec: 4 },
  musicBias: { energy: ["vua", "em"], density: [], vocal: ["khong-loi"] },
  intensity: { ...BASE.intensity, punchScale: 0.06, flashAmount: 0.55, keywordShare: 0.3, keywordsPerGroup: 1, minSilence: 0.9 },
  // Ấm vừa, bão hoà vừa — nền cho vệt sáng vàng chạy qua chữ.
  grade: { brightness: 1.06, contrast: 1.04, saturation: 1.12, warmth: 0.35 },
  emoji: { scale: 1.15, share: 0.22 },
  defaults: { ...BASE.defaults, emphasis: "even" },
};

export const STYLE_PACKS: StylePack[] = [
  GOC,
  CHU_HOA_VANG,
  NHAN_XANH,
  NET_THUA,
  DUNG_YEN,
  NET_DAC,
  NGHIENG_TRON,
  DUNG_DUNG,
  TUNG_CHU,
  SANG_THEO_LOI,
];

export const DEFAULT_STYLE_PACK_ID: StylePackId = "goc";

/**
 * MỘT cổng duy nhất chịu trách nhiệm rơi-về-mặc-định.
 *
 * Tên rác trong CSDL không được làm sập lượt xuất video: thà ra bộ dáng gốc còn
 * hơn dừng cả mạch vì một chuỗi lạ.
 */
export function findStylePack(id: string | null | undefined): StylePack {
  return STYLE_PACKS.find((pack) => pack.id === id) ?? GOC;
}

/**
 * Đổi chữ theo trục `letterCase`. MỘT hàm cho cả hai đường vẽ.
 *
 * Trang xem KHÔNG dùng `text-transform: uppercase`: làm thế thì phép đo chạy
 * trên chuỗi gốc còn nét vẽ ra là chuỗi hoa, và cụm chữ tự rộng thêm sau lưng
 * phép đo. Đổi thẳng chuỗi thì đo cái gì vẽ cái đó.
 */
export const styleCase = (text: string, pack: StylePack) =>
  pack.letterCase === "upper" ? text.toLocaleUpperCase("vi-VN") : text;

