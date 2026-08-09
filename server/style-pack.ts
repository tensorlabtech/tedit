/**
 * BỘ DÁNG CHỮ — mọi hằng số quyết định vẻ ngoài của chữ, gom vào một chỗ.
 *
 * Tệp này bị import từ CẢ HAI phía: máy chủ (ffmpeg) và trang xem (CSS). Nên nó
 * **không được đụng `node:*`** — không đọc tệp, không `join` đường dẫn. Font khai
 * bằng đường dẫn TƯƠNG ĐỐI so với gốc dự án; bên máy chủ tự đổi thành đường dẫn
 * tuyệt đối, bên trang xem chỉ cần tên họ chữ.
 *
 * Khai một chỗ, hai bên cùng import. Chép sang là có bản thứ hai để lệch — mà
 * lệch giữa hai đường vẽ chính là lỗi `/_dev/overlays` sinh ra để bắt.
 *
 * ## Bốn thứ KHÔNG bao giờ vào đây
 *
 * `SAFE` · `MAX_BLOCK_SHARE` · `MAX_LINES` · **sàn** `LINE_HEIGHT` — chúng là
 * ràng buộc của sản phẩm chứ không phải vẻ ngoài. Cho bộ dáng đổi chúng là mỗi
 * bộ phải chạy lại bộ kiểm 1920 tổ hợp, và bảo đảm "chữ không bao giờ tràn
 * khung" mất đi một lần cho mỗi bộ dáng.
 *
 * `MIN_SCALE` cũng ở ngoài: sàn 0,09 là ngưỡng ĐỌC ĐƯỢC, không phải chuyện phong
 * cách. Trần `maxScale` thì vào được — nó là lựa chọn thẩm mỹ và
 * `MAX_BLOCK_SHARE` vẫn chặn phía sau.
 */

import type { MusicBias } from "./music-tags";
import type { LayoutKindId } from "./layout-kinds";
// `applyFontStyle` sống ở catalog (cạnh `findStylePack`). Catalog chỉ `import
// type` ngược lại đây nên KHÔNG có vòng runtime, và nó không chạm `node:*` nên
// trang xem vẫn nạp được tệp này.
import { applyFontStyle } from "./style-pack-catalog";

/*
 * Cách đánh dấu CHỖ NỐI — lấy thẳng từ `junction-kinds.ts`, không chép lại.
 *
 * Bản trước tệp này khai riêng năm kiểu ("none" | "zoom-in" | "zoom-out" |
 * "flash" | "dip") trong khi `junction-kinds.ts` có ba mươi hai. Hậu quả im
 * lặng: bộ dáng KHÔNG khai được hai mươi bảy kiểu còn lại — không phải vì bộ
 * dựng không vẽ nổi, mà vì một dòng khai kiểu ở đây chặn.
 *
 * `junction-kinds.ts` không import `node:*` nào nên trang xem vẫn nạp được —
 * đó là ràng buộc duy nhất của tệp này.
 */
export type { JunctionId } from "./junction-kinds";
import type { JunctionId } from "./junction-kinds";

/**
 * BA dải, không phải bốn.
 *
 * Bốn dải liên tiếp phủ gần kín chiều dọc khung: đặt chữ ở hai dải giữa là che
 * đúng mặt người nói — thứ mà cả video đang nói về. Ba chỗ thì mỗi chỗ có nghĩa
 * rõ ràng, và hai chỗ mặc định (trên / dưới) chừa hẳn khoảng giữa cho hình.
 *
 * Ba trục dưới đây khai ở ĐÂY chứ không ở `text-layout.ts`: tệp này là tệp duy
 * nhất cả máy chủ lẫn trang xem cùng import được, vì nó không đụng `node:*`.
 */
export type Band = "top" | "middle" | "bottom";

/** Trục CĂN: các hàng nằm đâu theo bề ngang. */
export type AlignId = "left" | "center" | "right" | "stair" | "stagger";

/** Trục NHẤN: trong cụm, tiếng nào to hơn tiếng nào. */
export type EmphasisId = "even" | "keyword-large" | "mixed-size" | "taper";

/** Màu tách khỏi độ đục: `drawtext` nhận hai thứ đó ở hai tham số khác nhau. */
export type Tone = { color: string; alpha: number };

/**
 * Mười bộ dáng THAM SỐ trước đây đã bỏ (chỉ khác màu/font/nhanh chậm) — xem ghi
 * chú ở `findStylePack` trong `style-pack-catalog.ts`. Chỉ còn hai bộ dựng theo
 * lối THIẾT BỊ. Dự án cũ trong CSDL vẫn có thể mang một trong mười tên đã bỏ;
 * cột lưu kiểu `string` (không phải `StylePackId`) đúng vì lý do đó — xem
 * `projects-routes.ts`/`elements-routes.ts`.
 */
export type StylePackId = "nhip-den" | "phan";

/**
 * NHÓM Ý ĐỒ — người dùng chọn theo "video của tôi thuộc loại gì".
 *
 * Không nhóm theo cái nhìn ("nghiêng", "hẹp", "có viền"): người dùng không mở
 * màn chọn để tìm một cái font, họ mở để tìm thứ hợp với video mình vừa quay.
 * Nhóm theo ý đồ thì mười ô thành ba câu hỏi dễ trả lời; nhóm theo cái nhìn thì
 * nó vẫn là mười ô phải so từng cái.
 */
export type StyleTheme = "manh" | "ke-chuyen" | "gon";

/**
 * MỘT họ chữ — cùng một tệp cho cả hai đường vẽ.
 *
 * Tách thành kiểu riêng vì một bộ dáng nay cầm HAI họ chứ không một. Khai lồng
 * hai lần cùng một hình dạng thì bên nào sửa cũng phải nhớ sửa bên kia.
 */
export type FontSpec = {
  /** Đường dẫn tương đối từ gốc dự án tới tệp `.ttf` mà ffmpeg sẽ in. */
  file: string;
  /** Họ chữ cho trang xem — phải là ĐÚNG font mà `file` trỏ tới. */
  cssStack: string;
  cssWeight: number;
  italic: boolean;
};

/**
 * HAI VAI CHỮ trong một bộ dáng.
 *
 * - `voice` — phụ đề chạy theo tiếng nói. Đây là chữ phải ĐỌC ĐƯỢC.
 * - `accent` — cụm cần đọng lại. Đây là chữ để CẢM.
 *
 * Đây là trục mà mọi style ngoài kia dùng để phân biệt nhau, và tám họ font đầu
 * tiên của kho đều là sans đậm nên nó chưa từng tồn tại được: hai vai chỉ đứng
 * riêng ra khi chúng khác NHÓM chữ, không phải khác độ đậm.
 */
export type FontRole = "voice" | "accent";

export const THEME_LABELS: Record<StyleTheme, string> = {
  manh: "Mạnh",
  "ke-chuyen": "Kể chuyện",
  gon: "Gọn",
};

export const THEME_NOTES: Record<StyleTheme, string> = {
  manh: "Cắt dày, chữ to, nhạc đẩy",
  "ke-chuyen": "Nhịp tự nhiên, chữ dễ đọc",
  gon: "Ít hiệu ứng, chữ tiết chế",
};

export type StylePack = {
  id: StylePackId;
  /**
   * Tên người dùng đọc và NHỚ.
   *
   * Một từ, gợi cảm giác, KHÔNG mô tả kỹ thuật. Tên kiểu "Nét thưa" hay "Chữ
   * hoa vàng" nghe thì rõ nhưng nó dạy người dùng rằng đây là bảng chọn font —
   * mà bộ dáng còn cầm cả nhịp cắt, mật độ tư liệu và tông nhạc. Phần cơ học để
   * `describeStyleFeel` nói, tên chỉ để nhận ra và gọi lại.
   */
  label: string;
  /** Nhóm ý đồ — thứ người dùng lọc theo trước khi so từng ô. */
  theme: StyleTheme;
  /**
   * Hai họ chữ, một cho mỗi vai. Bộ nào chưa dùng vai thứ hai thì khai `accent`
   * TRÙNG `voice` — không có nhánh "bỏ trống", vì bỏ trống là mỗi nơi vẽ lại tự
   * đoán một kiểu.
   */
  fonts: { voice: FontSpec; accent: FontSpec };
  /**
   * Viết hoa lúc VẼ, không đụng `elements.content`.
   *
   * Người dùng mở bảng sửa phải thấy đúng thứ họ đã gõ, không phải bản viết hoa.
   * Và phép ĐO cũng phải chạy trên chuỗi đã hoa: chữ hoa rộng hơn chữ thường, đo
   * bằng chuỗi thường là chữ tràn khung.
   */
  letterCase: "as-typed" | "upper";
  /**
   * Ba mức màu — thứ tạo ra lớp lang trong khối chữ.
   *
   * `key` là màu của tiếng được đánh dấu từ khoá. Trước đây nó trắng đặc còn
   * `main` trắng 0,92 — chênh 0,08 độ đục trên cùng một màu trắng, tức là trên
   * nền video mắt không phân biệt được, và trục từ khoá gần như vô hình.
   */
  color: { main: Tone; dim: Tone; key: Tone };
  /** Viền mảnh bám sát nét, tính theo cỡ chữ. `null` là không viền. */
  edge: { share: number; tone: Tone } | null;
  /**
   * NẮN MÀU trên HÌNH. `null` là để nguyên khung hình gốc.
   *
   * Đây là thứ Tedit chưa từng đụng tới, và là khoảng cách lớn nhất còn lại so
   * với phần mềm dựng thật: đo trên khung hình thật của một video quay trong
   * phòng thiếu sáng, cả gánh nặng "trông có nghề" đổ hết lên chữ vì hình không
   * ai nắn.
   *
   * Bốn trục, và chúng được chọn vì CẢ HAI ĐƯỜNG VẼ đều diễn đạt được chính xác:
   *
   * | trục | ffmpeg | trang xem |
   * |---|---|---|
   * | `brightness` · `warmth` | `colorchannelmixer` đường chéo | `feColorMatrix` đường chéo |
   * | `contrast` | `eq=contrast` | `feComponentTransfer` tuyến tính |
   * | `saturation` | `eq=saturation` | `feColorMatrix type="saturate"` |
   *
   * Dùng bộ lọc SVG ở trang xem chứ không dùng `filter: brightness()` của CSS:
   * CSS không có trục nào nhân RIÊNG từng kênh, mà ấm/lạnh chính là nhân riêng
   * từng kênh. Ép nó bằng `sepia()` thì trang xem và bản xuất ra hai màu khác
   * nhau — đúng lỗi cả hệ này chống.
   */
  grade: {
    /** Nhân đều ba kênh. `1` là không đổi. */
    brightness: number;
    /**
     * `1` là không đổi. Trên 1 là tương phản mạnh hơn.
     *
     * TRẦN THỰC TẾ khoảng 1,12, và không phải vì thẩm mỹ. `eq=contrast` xoay
     * quanh mức xám GIỮA (0,5), trong khi video quay bằng điện thoại trong nhà
     * nằm quanh 0,14. Ở đó mọi mức trên 1 đều kéo ảnh XUỐNG chứ không làm nó
     * mạnh lên: đo trên khung hình thật, `contrast: 1.2` hạ độ sáng trung bình
     * từ 37,8 xuống 27,9 — hình đục đi chứ không gắt lên.
     *
     * Nên phần "chất" của một bộ dáng nằm ở `warmth` và `saturation`: hai trục
     * đó nhân theo tỉ lệ nên không phụ thuộc video sáng hay tối.
     */
    contrast: number;
    /** `1` là không đổi, `0` là đen trắng. */
    saturation: number;
    /**
     * Ấm ⇄ lạnh, −1…1. Dương là ấm (đỏ lên, lam xuống).
     *
     * Nhân riêng từng kênh chứ không xoay sắc: xoay sắc trên khuôn mặt làm da
     * ngả sang xanh hoặc tím ngay ở mức nhỏ, còn nhân kênh thì giữ nguyên tương
     * quan sáng tối của da.
     */
    warmth: number;
  } | null;
  /**
   * ĐỘ MẠNH — thứ trước đây mọi bộ dáng dùng chung.
   *
   * Bộ dáng vốn cầm KIỂU (chọn `flash` hay `dip`) nhưng không cầm ĐỘ MẠNH: mọi
   * cú zoom đều đẩy 8%, mọi cú nháy đều sáng 0,7, mọi bộ đều nhấn từ khoá dày
   * như nhau. Nên hai bộ dáng chọn kiểu khác nhau mà xem video thật vẫn hao hao.
   *
   * Năm con số này đều ĐÃ tồn tại, chỉ là chúng nằm sai chỗ — rải trong
   * `render.ts`, `ai-keywords.ts` và một cột riêng của dự án.
   */
  intensity: {
    /** Mức đẩy của một cú zoom ở chỗ nối, theo tỉ lệ khung. */
    punchScale: number;
    /** Mức sáng của một cú nháy, 0–1. */
    flashAmount: number;
    /** Nhiều nhất bao nhiêu phần trăm số cụm được có từ nhấn. */
    keywordShare: number;
    /** Mỗi cụm nhiều nhất mấy từ nhấn. */
    keywordsPerGroup: number;
    /**
     * Ngưỡng rút chỗ lặng gợi ý, tính bằng giây. `0` là không rút.
     *
     * KHÔNG phải cột dữ liệu — dự án có `projects.min_silence` riêng và người
     * dùng kéo được. Con số này chỉ là thứ màn nạp tệp ĐIỀN HỘ khi chọn bộ dáng,
     * và thanh kéo nhảy theo ngay trước mắt nên họ thấy nguyên nhân rồi kéo lại
     * được. Ghi đè lặng lẽ ở máy chủ thì họ mất lựa chọn mà không biết vì sao.
     */
    minSilence: number;
  };
  /**
   * Tô sáng tiếng ĐANG ĐƯỢC NÓI — kiểu karaoke. `null` là tắt.
   *
   * Màu riêng chứ không dùng lại `color.key`: từ khoá là thứ NGƯỜI dùng đánh
   * dấu và nó đứng yên suốt cụm, còn tô sáng thì chạy theo lời. Dùng chung một
   * màu là hai nghĩa khác hẳn nhau đọc ra giống hệt nhau.
   *
   * Chỉ chạy được khi chữ CÒN KHỚP lời (`wordStarts` có thật). Người dùng viết
   * lại chữ thì không còn tiếng nào ứng với tiếng nào — lúc đó tắt lặng lẽ chứ
   * không tô bừa theo nhịp đều.
   */
  highlight: { tone: Tone; box: Tone | null } | null;
  /**
   * Luật CHIA CỤM — "một lúc hiện mấy tiếng".
   *
   * Đây là trục quyết định dáng phụ đề mạnh không kém font, mà trước đây nó là
   * năm hằng số chôn trong `caption-groups.ts` và không ai đổi được. Đúng cái
   * bẫy mà cả nhánh này sinh ra để chữa: *"công cụ đã đủ, mặc định mới là thứ
   * quyết định dáng"*.
   *
   * Mô hình dữ liệu vốn đã chịu được: chữ neo vào KHOẢNG TỪ, mà khoảng một từ
   * là hợp lệ. Nên `maxWords: 1` cho ra phụ đề từng chữ mà không cần thêm loại
   * `element` nào.
   */
  grouping: {
    /** Nhiều nhất mấy tiếng một cụm. `1` = phụ đề từng chữ. */
    maxWords: number;
    /**
     * Trần KÝ TỰ, tính cả dấu cách. Ràng buộc thật, còn trần số tiếng chỉ là
     * ước: "Mình" và "nghiêng" đều một tiếng nhưng dài gấp đôi nhau.
     */
    maxChars: number;
    /** Cụm dài quá thì chữ đứng lâu, mất cảm giác chạy theo lời. */
    maxSpan: number;
    /**
     * SÀN thời gian một cụm được hiện. Cụm ngắn hơn thì gộp thêm tiếng kế tiếp.
     *
     * Cần vì `maxWords: 1`: một tiếng dài 0,12 giây là chữ hiện 3–4 khung hình
     * rồi tắt — mắt đọc ra là nhấp nháy chứ không ra phụ đề. `0` là không có
     * sàn, tức hành vi cũ.
     */
    minHold: number;
  };
  /**
   * Quầng tối sau lưng chữ. Hai con số vì hai đường vẽ dùng hai mô hình khác
   * nhau: ffmpeg làm mờ cả LỚP chữ nên bán kính tính bằng px trên khung 1080,
   * còn CSS đặt `text-shadow` cho từng tiếng nên bán kính tính theo CỠ CHỮ.
   * Chúng gần nhau ở cỡ chữ hay gặp chứ không bằng nhau về công thức.
   */
  glow: { opacity: number; radiusPx: number; cssBlurShare: number } | null;
  /**
   * Nền khối sau chữ. `null` là không có.
   *
   * Nền vẽ theo TỪNG TIẾNG, không phải sau cả khối chữ: `drawtext` vẽ nền cho
   * chính lệnh vẽ của nó, mà mỗi tiếng là một lệnh. Đó cũng là dáng đang thịnh —
   * mỗi tiếng một ô nền, không phải một tấm bảng sau cả câu.
   *
   * Góc VUÔNG, không bo: `drawtext` chỉ cho góc vuông, bo tròn phải vẽ lớp riêng
   * và ngốn bằng cả ba trục khác cộng lại. Góc vuông vốn đã là dáng bản tin.
   */
  box: { tone: Tone; padShare: number } | null;
  /**
   * MẢNG MÀU đặc — dải màu chiếm một phần khung. `null` là không có.
   *
   * Vẽ SAU hình, TRƯỚC chữ: nó là nền cho chữ, không phải lớp phủ lên chữ.
   *
   * Đây là trục rẻ nhất mà một style dễ nhận ra bậc nhất dùng tới —
   * `anh/mo-focus.jpg` dựng cả phong cách bằng khối màu và nền chữ, không một tệp
   * đồ hoạ nào. `drawbox` + `drawtext`, không PNG, không SVG, không phụ thuộc mới.
   *
   * ## Vì sao mảng màu phải nằm NGOÀI dải an toàn
   *
   * `SAFE` là hằng của sản phẩm, mọi thứ khác đã bám vào nó. Cho mảng màu lấn
   * vào rồi bắt chữ tính lại là mở một đường cho chữ nhảy chỗ giữa hai lần dựng —
   * đúng thứ cả hệ bố cục này sinh ra để chặn. Nên mảng màu chỉ đặt ở mép trên
   * hoặc mép dưới, và dày nhiều nhất bằng lề an toàn ở phía đó.
   *
   * ## Chữ trong mảng là chữ nào
   *
   * KHÔNG phải phụ đề. Phụ đề sống trong `SAFE`, mảng màu sống ngoài `SAFE`, nên
   * chúng không bao giờ chồng nhau — cố ý. Chữ nằm trong mảng là **dòng tiêu
   * đề**, thứ đi đường vẽ riêng và được ra ngoài `SAFE`.
   *
   * `anh/ba-bo-thu-tren-footage-that.jpg` ô thứ hai là dáng đích: dải cam mỏng
   * sát đáy mang dòng chữ nhỏ của riêng nó, còn phụ đề chạy nằm giữa khung với
   * nền từng tiếng. Mảng màu TRỐNG thì đọc ra như lỗi vẽ — phép kiểm canh chỗ đó,
   * xem `style-pack-check.ts`.
   *
   * Bản thử đầu để mảng đáy dày 214px và nó che đúng bàn tay với mic của người
   * dùng — footage quay ngang 1280×720 rồi crop dọc thì đáy khung là chỗ đó. Nên
   * dày bao nhiêu là một quyết định về NỘI DUNG khung hình, không phải về thẩm mỹ.
   */
  plate: {
    /** Chỉ `top` hoặc `bottom`. `middle` là che đúng mặt người nói. */
    band: Band;
    /** Phần chiều cao khung mảng màu chiếm, tính từ mép của dải nó bám. */
    heightShare: number;
    tone: Tone;
  } | null;
  /**
   * NỀN TRANG — màu phía sau khi video KHÔNG phủ kín khung. `null` là không có.
   *
   * Chỉ có nghĩa với bố cục nào để lại chỗ trống (`o-don`, `hai-o`, `o-lech`,
   * `trang-chu`). Bố cục `toan-khung` thì video che hết, nền không lộ ra.
   *
   * `grid` là hình trong kho phủ mờ lên nền — dấu "có thiết kế" rẻ nhất: một tệp
   * PNG có sẵn, một lớp phủ, mà nhìn phát biết ngay không phải nền đen trơn.
   */
  page: {
    tone: Tone;
    /** Tên hình trong manifest, phủ mờ lên nền. `null` là nền trơn. */
    grid: { id: string; tone: Tone } | null;
  } | null;
  /**
   * BỐ CỤC bộ dáng dùng, theo thứ tự xoay vòng. Rỗng là chỉ `toan-khung`.
   *
   * Chỉ khai DÙNG CÁI NÀO. Đổi lúc nào là việc của `layout-schedule.ts`, theo
   * luật thời gian — bộ dáng không được khai mốc giây, vì mốc giây là của một
   * video cụ thể chứ không phải của một phong cách.
   */
  layouts: LayoutKindId[];
  /**
   * MÁY QUAY DỒN VÀO — ô lớn dần trong lúc một màn chạy. `null` là đứng yên.
   *
   * ══ VÌ SAO LÀ LỰA CHỌN CHỨ KHÔNG PHẢI LUẬT ══
   *
   * Đo phép phóng trực tiếp trên kho mẫu: lấy hai khung cách nhau nửa giây, thử
   * vài hệ số phóng, chọn hệ số làm hai khung khớp nhất. Đo chính phép phóng
   * chứ không đo "hình đổi nhiều hay ít" — người nói cử động cũng làm hình đổi,
   * mà đó không phải chuyển động cảnh.
   *
   *   core 10 %/giây · focus 10 · pulse 6 · ember 4 · volt 2 · rocket 0
   *
   * Nhưng con số quan trọng hơn là TẦN SUẤT: chỉ 1–3 trên 15–59 cặp khung có
   * phóng. Máy quay dồn vào là thứ xảy ra ở vài chỗ, không phải nền chạy suốt —
   * nên nó khai `share`, cùng lối với thiết bị nổi.
   *
   * `rocket` được 0 và vẫn là một bộ hoàn chỉnh. Đó là lý do trục này có `null`.
   */
  scenePush: {
    /** Dồn bao nhiêu phần khung trong MỘT GIÂY. Dải đo được: 0,02–0,10. */
    ratePerSecond: number;
    /** Bao nhiêu phần các màn có chuyển động này. */
    share: number;
  } | null;
  /**
   * VỆT QUÉT — một dải màu chạy ngang khung ở mỗi chỗ nối. `null` là không có.
   *
   * Trục duy nhất của bộ dáng chỉ tồn tại LÚC CHUYỂN CẢNH. Mọi trục khác — mảng
   * màu, hình dán, khung, hình bám chữ — hoặc đứng suốt phim hoặc bám vào cụm
   * chữ; không cái nào đánh dấu chính cái mốc mà video được cắt.
   *
   * Đo trên một bản dựng thật: tám chỗ nối đều có hiệu ứng, nhưng cả tám đều là
   * hiệu ứng MÁY QUAY (zoom, flash, mờ chồng) — tức là cách quay, không phải
   * cách vẽ. Người xem đọc chúng ra là "máy quay làm gì đó", không đọc ra là
   * "có người dựng cái này".
   *
   * Chỉ hợp bộ MẠNH. Một vệt màu bay ngang khung là câu nói to nhất mà bộ dáng
   * có thể nói, và bộ êm thì không có gì để nói to.
   */
  /**
   * VIỀN VÀNG QUANH Ô B-ROLL. `null` là không có.
   *
   * Dựng từ CHÍNH mặt nạ ô tư liệu chèn (co mặt nạ vào trong rồi trừ đi → một
   * vành bám mép trong), tô bằng `tone`. Nướng thẳng vào lớp cutout ở
   * `layout-render.ts` nên tự đi theo ô lúc đổi bố cục. KHÔNG cần mặt nạ người.
   * `steps`/`share` là dấu tích bản cũ (viền bám dáng người) — nay không dùng.
   */
  subjectEdge: {
    tone: Tone;
    steps: number;
    /**
     * Bao nhiêu phần các quãng giữa hai vết cắt được bật viền.
     *
     * KHÔNG bật suốt phim. Một nét bám dáng người mà đứng đó 133 giây thì sau
     * mười giây đầu mắt thôi đăng ký nó, và nó thành đường viền của khung hình
     * chứ không còn là một dấu ai đó vẽ vào. Cùng cái bệnh mà mảng màu rỗng và
     * cái khung Thép đã mắc.
     *
     * Bật theo QUÃNG GIỮA HAI VẾT CẮT chứ không theo đồng hồ riêng: video đã có
     * một nhịp rồi, và thêm một nhịp thứ hai không liên quan là hai thứ đập lệch
     * nhau. Vào ở một vết cắt, ra ở vết cắt sau.
     */
    share: number;
  } | null;
  /**
   * KHỐI CHỮ LỚN CHẠY SAU NGƯỜI. `null` là không có.
   *
   * Chữ nằm giữa nền và người, nên người che một phần — đó là cả hiệu quả. Vẽ
   * đè lên thì mất chiều sâu và nó chỉ còn là một dòng tiêu đề nữa.
   *
   * Chỗ đặt KHÔNG khai ở đây: `emptiestBand` đọc từ mặt nạ xem dải nào ít người
   * nhất rồi đặt vào đó. Người ngồi cao hay thấp trong khung là chuyện của từng
   * bản quay, không phải của bộ dáng.
   */
  behindText: {
    font: FontRole;
    sizeShare: number;
    tone: Tone;
    /** Số tầng chồng lên nhau, mỗi tầng nhạt dần. */
    repeats: number;
    /**
     * Giây thứ mấy thì tắt. Mờ dần trong `HEADLINE_FADE` giây cuối.
     *
     * Đây là câu MỞ, không phải hoa văn nền: nó có việc ở đúng mấy giây người
     * xem quyết định ở lại hay lướt.
     */
    seconds: number;
  } | null;
  /**
   * NÉT VẼ TAY rải vào chỗ trống. `null` là không có.
   *
   * Lấy hình từ kho `doodle` của manifest. Đặt vào dải ít người nhất, cùng phép
   * đo với `behindText` — hai thiết bị tranh chỗ thì thiết bị chữ được ưu tiên,
   * nét vẽ lùi sang mép.
   */
  doodles: { ids: string[]; tone: Tone; sizeShare: number } | null;
  sweep: {
    tone: Tone;
    /** Bề rộng vệt, tính theo bề rộng khung. */
    widthShare: number;
    /** Bao lâu để đi hết một lượt. */
    seconds: number;
  } | null;
  /**
   * HÌNH DÁN — phủ đúng khung, dán một lần cả video. `null` là không có.
   *
   * Loại `plate` trong `assets/graphics/manifest.json`: không co theo chữ, không
   * phụ thuộc cụm. Đó chính là điều làm nó đáng giá — trục cặp font của đợt
   * trước chỉ hiện **6,7%** thời lượng vì nó gắn với cụm có từ khoá; hình dán thì
   * ở đó suốt.
   *
   * Màu tách khỏi hình: một tệp PNG dùng cho cả mười bộ, mỗi bộ khai một mã màu
   * và ffmpeg tô bằng `alphamerge`. Không có điều đó thì thêm một bộ dáng là thêm
   * một bộ tệp, và catalog thôi là bảng số.
   *
   * ## Vì sao độ đục là HAI con số chứ không một
   *
   * Đo được ở phiên brainstorm: cùng `alpha 0.22`, trên cảnh cửa sổ đêm gần như
   * biến mất, trên tường trắng rõ mồn một. Một hằng số không sống được qua hai
   * loại cảnh.
   *
   * Hai mức dưới đây nội suy theo độ sáng khung hình (`sceneLuma`) để đồ hoạ đậm
   * lên ở cảnh tối và nhạt đi ở cảnh sáng. Hiện chưa có nguồn đo (đã bỏ tự cân
   * sáng) nên lấy điểm giữa; bước Chuẩn bị sau có thể nối lại con số đo.
   */
  graphics: Array<{
    /** Khoá trong `assets/graphics/manifest.json`. */
    id: string;
    /**
     * Chỉ MÀU, dạng `#RRGGBB` — không phải `Tone`.
     *
     * `Tone` mang sẵn một trục độ đục, mà `opacity` bên dưới cũng là độ đục. Hai
     * trục cho cùng một thứ thì lúc hình quá mờ không ai biết phải chỉnh cái nào,
     * và chỉnh nhầm cái thì con số kia lặng lẽ triệt tiêu.
     */
    color: string;
    /** Độ đục ở cảnh TỐI và ở cảnh SÁNG. `onDark` phải cao hơn — nền tối nuốt hình. */
    opacity: { onDark: number; onLight: number };
  }> | null;
  /**
   * HÌNH BÁM CHỮ — vòng khoanh, gạch chân. `null` là không có.
   *
   * Khác `graphics` ở một điều quyết định cả cách vẽ: nó **co giãn theo bề rộng
   * cụm chữ**. Nên nó gắn với CỤM, và vì thế nó chịu đúng cái trần mà trục cặp
   * font chịu — chỉ hiện ở những cụm thuộc phạm vi.
   *
   * Co giãn kiểu BA LÁT: hai đầu giữ nguyên, khúc giữa kéo dài. Kéo giãn cả hình
   * thì nét dọc ở hai đầu mảnh dần theo bề rộng cụm, và cùng một bộ dáng đọc ra
   * hai kiểu ở cụm ngắn với cụm dài.
   */
  wrap: {
    /** Khoá trong manifest, loại `wrap`. */
    id: string;
    color: string;
    /**
     * Bọc cụm nào.
     *
     * `keyword` dùng CÙNG luật với vai chữ (`fontRoleFor`) — cụm có từ khoá.
     * Trên dữ liệu thật đó là ~7% số cụm, nên `all` mới là lựa chọn thấy được
     * ở mọi khung.
     */
    scope: "keyword" | "all";
    /** Đệm quanh khối chữ, theo cỡ chữ lớn nhất trong cụm. */
    padShare: number;
    opacity: { onDark: number; onLight: number };
  } | null;
  /**
   * KHUNG bao quanh hình. `null` là hình phủ kín, đúng như mọi bộ hiện nay.
   *
   * Thu hình lại, chừa lề, phần lề là nền màu. Đây là trục `lens` dùng để tách
   * mình khỏi 45 style còn lại, và nó không cần một tệp đồ hoạ nào.
   *
   * ## Vì sao nó đáng làm trước cả đồ hoạ
   *
   * Đo trên video xuất thật của đợt trước: bộ chỉ đổi CẶP FONT khác bộ gốc ở
   * **6,7%** số khung hình — đúng bằng tỉ lệ cụm có từ khoá, vì trục ấy gắn với
   * cụm chữ. Khung thì không gắn với gì cả: nó ở đó suốt thời lượng.
   *
   * ## Lề đo theo BỀ RỘNG khung, cả bốn phía
   *
   * Kể cả lề trên và lề dưới. Nghe ngược, nhưng đó là cách duy nhất để một cái
   * khung đều bốn cạnh ra ĐỀU bốn cạnh: đo lề dọc theo chiều cao thì trên khung
   * 9:16 cạnh trên dày gấp 1,78 lần cạnh bên, và mắt đọc ra ngay là lệch.
   */
  frame: {
    /** Lề mỗi phía, theo phần BỀ RỘNG khung. */
    inset: { top: number; right: number; bottom: number; left: number };
    /** Màu phần lề. */
    background: Tone;
  } | null;
  /**
   * DÒNG TIÊU ĐỀ — một dòng chữ đại diện cho cả video. `null` là bộ không có.
   *
   * Thứ 12/12 style khảo sát đều có mà Tedit chưa từng có. Nó KHÔNG phải phụ đề,
   * và khác biệt ấy là quyết định kiến trúc lớn nhất của đợt này:
   *
   * | | Phụ đề | Tiêu đề |
   * |---|---|---|
   * | neo vào | KHOẢNG TỪ (`from_word_id`) | cả dự án, một cột trên `projects` |
   * | bố cục | `layoutText` · `SAFE` · `MAX_LINES` · `MIN_SCALE` | đường riêng, một dòng |
   * | bộ kiểm | `scripts/layout-guard/` | không vào đó |
   * | tràn mép | không bao giờ | được, nếu `bleed` |
   *
   * Neo tiêu đề vào một từ là hẹn giờ cho một lỗi: nó không thuộc tiếng nào, nên
   * người dùng cắt mất câu đầu là nó biến mất. Cho nó đi chung đường bố cục với
   * phụ đề rồi nới `SAFE` thì mất bảo đảm "chữ không bao giờ tràn khung" **một
   * lần cho tất cả** — `style-pack.ts` ghi rõ bốn hằng đó là ràng buộc của sản
   * phẩm chứ không phải vẻ ngoài.
   */
  title: {
    /** Vai chữ, dùng lại cặp font của chính bộ dáng. Không khai họ mới. */
    font: FontRole;
    /** Cỡ chữ theo BỀ RỘNG khung — cùng trục với mọi số đo khác. */
    sizeShare: number;
    band: Band;
    tone: Tone;
    /** Cho chữ chạy quá mép khung hay không. Đây là DÁNG, không phải lỗi. */
    bleed: boolean;
  } | null;
  density: {
    /** Trần cỡ chữ theo bề rộng khung. Dải cho phép: [0.11, 0.16]. */
    maxScale: number;
    /** Bước dòng theo cỡ chữ. Dải cho phép: [1.0, 1.4] — dưới 1 là cắt cụt dấu. */
    lineHeight: number;
    /** Khoảng giữa hai tiếng cùng hàng, theo cỡ chữ. */
    wordGap: number;
    /** Cỡ hàng dẫn của kiểu `taper`, theo cỡ hàng ý. */
    leadRatio: number;
    /** Cỡ tiếng nhỏ của kiểu `mixed-size`, theo cỡ tiếng lớn. */
    mixedSmallRatio: number;
  };
  motion: {
    /**
     * Chữ hiện ra theo TỪNG TIẾNG hay CẢ CỤM một lượt.
     *
     * Trước đây không có trục này: chữ luôn chạy từng tiếng, không tắt được. Ghi
     * chú cũ ở `reveal-expr.ts` gọi đó là *"khác biệt lớn nhất giữa có làm đồ hoạ
     * và có gắn phụ đề"* — câu đó đúng, nhưng nó là một LỰA CHỌN PHONG CÁCH chứ
     * không phải chân lý, và áp cho mọi người là lý do lớn nhất khiến mọi video
     * giống nhau.
     *
     * `none` KHÔNG đụng tới mốc hiện/ẩn của cả cụm (`enableRange`) — cụm vẫn vào
     * và ra đúng khoảng từ nó neo vào, chỉ là vào một lượt.
     */
    reveal: "per-word" | "none";
    /** Thời gian một tiếng hiện xong. */
    enterSeconds: number;
    /** Trễ của tiếng đầu tiên. */
    baseDelay: number;
    /** Trễ cộng thêm cho mỗi hàng — nhịp dòng thưa hơn nhịp tiếng. */
    rowDelay: number;
    /** Trễ cộng thêm cho mỗi tiếng trong hàng. */
    colDelay: number;
    /** Từ cỡ này trở lên là CHỮ LỚN — trượt dọc thay vì trượt ngang. */
    largeScale: number;
    /** Quãng trượt của chữ nhỏ, theo bề rộng CHÍNH NÓ. */
    smallShift: number;
    /** Quãng trượt của chữ lớn, theo chiều cao hộp dòng của nó. */
    largeShift: number;
    /**
     * Chiều cao hộp một tiếng, dùng để quy `largeShift` ra pixel ở máy chủ.
     *
     * Đang là 1,15 trong khi trang xem xếp dòng ở `lineHeight` 1,0 — hai bên
     * lệch nhau 15% quãng trượt dọc, chỉ thấy được TRONG LÚC chữ đang hiện chứ
     * không thấy ở khung tĩnh. Giữ nguyên con số cũ ở phase gom hằng số này để
     * bản render không đổi; sửa cho khớp là một việc riêng, có bằng chứng riêng.
     */
    lineBox: number;
  };
  /**
   * Thiên lệch HIỆU ỨNG — kho ưu tiên cho AI, không phải hàng rào.
   *
   * Bảng sửa vẫn bày ĐỦ mọi kiểu cho người dùng: bộ dáng đặt điểm xuất phát,
   * không dựng hàng rào. Mảng rỗng nghĩa là không thiên về đâu cả.
   */
  effectBias: {
    /** Kiểu đánh dấu chỗ nối đoạn được ưu tiên. */
    junction: JunctionId[];
    /** Cách tư liệu chèn hiện ra được ưu tiên. */
    insertReveal: RevealId[];
  };
  /**
   * NHỊP — phần quyết định "nhanh" hay "êm" nhiều hơn cả danh sách kiểu.
   *
   * Một bộ dáng chỉ nhặt `flash` + `zoom-in` mà vẫn đặt 3 giây một cái thì không
   * "nhanh" — nó chỉ chói. Bao nhiêu phần trăm chỗ nối được đánh dấu, b-roll mấy
   * giây một lần và giữ bao lâu: đó là con số, không phải enum.
   */
  rhythm: {
    /** Tỉ lệ chỗ nối đoạn được đánh dấu, 0–1. */
    junctionShare: number;
    /** Khoảng cách mong muốn giữa hai lần chèn tư liệu, tính bằng giây. */
    brollEverySec: number;
    /** Một lần chèn giữ bao lâu, tính bằng giây. */
    brollHoldSec: number;
  };
  /**
   * Thiên lệch NHẠC — ưu tiên, không phải hàng rào.
   *
   * Nhạc thuộc loại "AI đặt hộ": đổi bộ dáng KHÔNG được tự đổi nhạc, vì bài nhạc
   * là một đoạn nằm trên dải mà người dùng nhìn thấy và có thể đã chỉnh mốc,
   * chỉnh âm lượng. Bộ dáng chỉ đặt thiên lệch cho LƯỢT CHỌN TIẾP THEO.
   *
   * Mảng rỗng ở một trục nghĩa là trục đó không lọc gì.
   */
  musicBias: MusicBias;
  /**
   * Mặc định ghi vào TỪNG `element` lúc sinh chữ.
   *
   * Đây là thứ DUY NHẤT của bộ dáng đi vào bảng `elements`. Mọi trường khác chỉ
   * là hằng lúc vẽ, nên đổi bộ dáng không đụng một hàng dữ liệu nào — đó là lý
   * do đổi bộ dáng an toàn tuyệt đối.
   *
   * **Cả năm bộ dáng để `defaults` GIỐNG HỆT NHAU.** Đó là cách né rủi ro đã
   * chốt: giống nhau thì đổi bộ dáng không đụng một hàng `elements` nào, nên
   * không cần dialog xác nhận, không cần luật giữ/đè, không cần đếm "đổi 47 giữ
   * 6". Giá phải trả là năm bộ không khác nhau ở bố cục — chấp nhận được, vì đổi
   * `center` sang `left` hầu như không ai nhận ra, còn đổi từ chữ thường trắng
   * mảnh sang CHỮ HOA vàng thì đọc ra hai sản phẩm khác hẳn.
   *
   * Không có `band` ở đây: dải đã là một cột riêng của dự án
   * (`projects.subtitle_band`), thêm vào bộ dáng nữa là hai nguồn sự thật cho
   * cùng một thứ.
   */
  defaults: { align: AlignId; emphasis: EmphasisId; reveal: RevealId };
};

/**
 * Cách TƯ LIỆU CHÈN hiện ra — trục của từng `element`, không phải của chữ.
 *
 * Ba giá trị đầu đều là biến thể của mờ dần; `slide` và `pop` là nhóm chuyển
 * động thật mà kho cũ thiếu hẳn. Xem `server/insert-reveal.ts`.
 */
export type RevealId = "none" | "fade" | "fade-up" | "slide" | "pop";

/**
 * Đổi chữ theo trục `letterCase`. MỘT hàm cho cả hai đường vẽ.
 *
 * Trang xem KHÔNG dùng `text-transform: uppercase`: làm thế thì phép đo chạy
 * trên chuỗi gốc còn nét vẽ ra là chuỗi hoa, và cụm chữ tự rộng thêm sau lưng
 * phép đo. Đổi thẳng chuỗi thì đo cái gì vẽ cái đó.
 */
export const styleCase = (text: string, pack: Pick<StylePack, "letterCase">) =>
  pack.letterCase === "upper" ? text.toLocaleUpperCase("vi-VN") : text;

/**
 * Những trục người dùng đè được ở cấp TỪNG CỤM. `null` = theo bộ dáng.
 *
 * Chỉ hai trục, và cả hai đều là trục NHÌN RA NGAY: viết hoa, và màu của tiếng
 * được đánh dấu từ khoá. Font hay mật độ thì để ở cấp dự án — đổi chúng cho
 * riêng một cụm là cụm đó rơi ra khỏi cả video.
 */
export type ElementStyleOverride = {
  letterCase: StylePack["letterCase"] | null;
  keyColor: string | null;
  /** Phong cách chữ RIÊNG của cụm này — đè phần chữ, `null` là theo dự án. */
  fontStyle: string | null;
};

/**
 * Bộ dáng HIỆU LỰC cho một cụm: bộ dáng của dự án, cộng phần cụm đó tự đè.
 *
 * Vì sao trả về một `StylePack` thay vì luồn thêm tham số xuống từng hàm vẽ:
 * mọi thứ phía sau đã nhận `pack` rồi, nên đổi ở đây là đổi được cho cả hai
 * đường vẽ mà không đụng một chữ ký hàm nào.
 *
 * **Cột đè mặc định là `null`, và đổi bộ dáng KHÔNG BAO GIỜ ghi vào chúng.** Nhờ
 * vậy cụm chưa đè thì đổi theo dáng mới, cụm người dùng đã tự đặt thì giữ nguyên
 * — đúng §20: *"người dùng đã tự chọn thì đó là lựa chọn của họ"*.
 */
export function packForElement(
  pack: StylePack,
  override: Partial<ElementStyleOverride> | null | undefined,
  /**
   * Từ khoá của chính cụm này — thứ quyết định VAI CHỮ.
   *
   * Bắt buộc, không có mặc định: vai chữ mà đoán hộ được thì chỗ nào quên truyền
   * cũng vẫn biên dịch, và cụm cảm xúc lặng lẽ vẽ bằng font phụ đề.
   */
  keywords: readonly string[] | null | undefined,
): ShownPack {
  // Phong cách chữ RIÊNG của cụm đè TRƯỚC: mọi trục chữ (font, HOA/thường, màu,
  // viền, quầng) đọc theo bản đã đè, rồi `letterCase`/`keyColor` của cụm mới đè
  // tiếp lên trên — nên đổi màu từ nhấn của cụm vẫn thắng màu của phong cách chữ.
  const base = override?.fontStyle
    ? applyFontStyle(pack, override.fontStyle)
    : pack;
  const font = base.fonts[fontRoleFor(keywords)];
  if (!override?.letterCase && !override?.keyColor) return { ...base, font };
  return {
    ...base,
    font,
    letterCase: override.letterCase ?? base.letterCase,
    color: override.keyColor
      ? { ...base.color, key: { color: override.keyColor, alpha: 1 } }
      : base.color,
  };
}

/**
 * Bộ dáng ĐÃ CHỐT vai chữ. Không đo được, không vẽ được, cho tới khi có kiểu này.
 *
 * `fonts` bị bỏ đi chứ không giữ lại: để cả hai thì một chỗ đo bằng `font` còn
 * chỗ khác đọc `fonts.voice`, và chúng lệch nhau đúng ở cụm dùng vai thứ hai —
 * loại lỗi mà mọi phép kiểm đều xanh còn chữ thì tràn khung.
 *
 * Đây là lý do kiểu này tồn tại thay vì luồn thêm một tham số `role` xuống từng
 * hàm: `pack` và `role` đi cạnh nhau qua mười lăm chỗ gọi là mười lăm cơ hội để
 * chúng rời nhau. Gộp lại thì không còn cơ hội nào.
 */
export type ShownPack = Omit<StylePack, "fonts"> & { font: FontSpec };

/**
 * VAI CHỮ của một cụm — MỘT luật, hai đường vẽ cùng import.
 *
 * Cụm có từ khoá vẽ bằng `accent`, còn lại vẽ bằng `voice`. Dùng thẳng dữ liệu
 * đã có (`elements.keywords`, do `ai-keywords.ts` ghi) chứ không mở một trục
 * "cụm nào là cảm xúc": mô hình đã có đúng khái niệm đó rồi, thêm trục thứ hai
 * là có hai nguồn sự thật cho cùng một câu hỏi.
 *
 * Cần gạt mật độ cũng đã có sẵn: `intensity.keywordShare` giới hạn bao nhiêu
 * phần trăm số cụm được có từ nhấn, nên nó chính là "bao nhiêu cụm được đổi vai
 * chữ". Không cần con số mới.
 */
export function fontRoleFor(
  keywords: readonly string[] | null | undefined,
): FontRole {
  return keywords && keywords.length > 0 ? "accent" : "voice";
}

/**
 * Chốt vai chữ khi KHÔNG có cụm nào để hỏi — ô mẫu, bảng so, khung dựng thử.
 *
 * Tách khỏi `packForElement` vì hai câu hỏi khác nhau: bên kia là *"cụm này vẽ
 * bằng vai nào"*, bên này là *"tôi muốn xem vai này trông ra sao"*.
 */
export function withFontRole(pack: StylePack, role: FontRole): ShownPack {
  return { ...pack, font: pack.fonts[role] };
}

/**
 * MỌI vai chữ bộ dáng này có thể vẽ ra, đã bỏ trùng.
 *
 * Dùng ở những chỗ phải đúng cho **cả hai vai** mà chưa biết vai nào sẽ tới:
 * phép chia cụm chạy lúc SINH chữ, trước khi `ai-keywords.ts` đánh dấu từ khoá,
 * nên cụm nó vừa chốt "vừa một dòng" có thể về sau lại vẽ bằng vai `accent`.
 * Vai đó rộng hơn thì chữ tràn khung — và không lệnh nào sai, chỉ phép đo hỏi
 * nhầm font.
 *
 * Bộ nào chưa dùng vai thứ hai thì trả về đúng MỘT phần tử, nên bảy bộ ngoài
 * phạm vi không phải trả thêm một đồng nào cho phép đo.
 */
export function shownPacks(pack: StylePack): ShownPack[] {
  const roles: FontRole[] =
    pack.fonts.accent.file === pack.fonts.voice.file
      ? ["voice"]
      : ["voice", "accent"];
  return roles.map((role) => withFontRole(pack, role));
}

/**
 * Màu nhấn người dùng chọn được cho riêng một cụm.
 *
 * Tập ĐÓNG, không phải bộ chọn màu tự do: màu tự do thì người dùng chọn được
 * màu trùng nền hoặc màu không đọc nổi trên video, mà không có gì cản.
 *
 * SÁU màu, không phải bảy: cộng thêm nút "Theo dáng" thì bảy ô xuống dòng ở cột
 * bảng sửa và ô cuối đứng lẻ một mình — đọc ra như lỗi vẽ. Bỏ cam vì nó nằm
 * giữa vàng và đỏ, hai màu đã có.
 */
export const KEY_COLORS: Array<{ value: string; label: string }> = [
  { value: "#FFFFFF", label: "Trắng" },
  { value: "#FFD400", label: "Vàng" },
  { value: "#00E676", label: "Xanh lá" },
  { value: "#4FC3F7", label: "Xanh dương" },
  { value: "#FF5252", label: "Đỏ" },
  { value: "#B388FF", label: "Tím" },
];

/**
 * Một dòng nói bộ dáng này quyết định gì NGOÀI chữ.
 *
 * Cần vì ô mẫu chỉ vẽ được chữ, mà bộ dáng còn cầm cả nhịp cắt, mật độ tư liệu
 * chèn, kiểu chuyển cảnh và tông nhạc. Không nói ra thì người dùng đọc màn chọn
 * như một bảng chọn font — đúng thứ nó KHÔNG phải.
 *
 * Ba con số thôi, và là ba con số đổi được quyết định: nhanh hay êm, bao lâu có
 * một tư liệu chèn, nhạc đẩy hay nhạc lặng. Kiểu chuyển cảnh không vào đây —
 * `flash` với `dip` là chữ của người làm phim, người dùng không đọc ra được.
 */
export function describeStyleFeel(pack: StylePack): string {
  const { junctionShare, brollEverySec } = pack.rhythm;
  // Hai trục PHỤ ĐỀ đứng trước, vì chúng đổi hẳn kiểu phụ đề chứ không chỉ đổi
  // vẻ ngoài — và tên bộ dáng cố ý không nói ra chúng.
  const caption =
    pack.grouping.maxWords === 1
      ? "một tiếng một · "
      : pack.highlight
        ? "sáng theo lời · "
        : "";
  const nhip =
    junctionShare >= 0.65 ? "nhịp nhanh" : junctionShare >= 0.45 ? "nhịp vừa" : "nhịp êm";
  const energy = pack.musicBias.energy;
  const nhac = energy.includes("manh")
    ? "nhạc mạnh"
    : energy.length === 0
      ? "nhạc tuỳ nội dung"
      : energy.includes("em") && !energy.includes("vua")
        ? "nhạc êm"
        : "nhạc vừa";
  return `${caption}${nhip} · tư liệu ${brollEverySec} giây/lần · ${nhac}`;
}

/**
 * Nền khối rộng theo BỀ NGANG gấp 1,4 lần bề dày theo chiều dọc.
 *
 * Chữ vốn cao hơn rộng, nên đệm đều bốn phía thì hai mép trái phải trông chật
 * hơn hai mép trên dưới dù cùng một con số.
 */
const BOX_PAD_X = 1.4;

/**
 * Phần đệm nền khối ở MỖI BÊN của một tiếng, tính theo cỡ chữ. `0` là không nền.
 *
 * Đây là con số mà PHÉP ĐO bề rộng phải cộng vào, và nó là chỗ đã hỏng một lần:
 * nền khối nới mỗi tiếng ra hai bên mà phép bẻ dòng lẫn phép đặt hàng đều chỉ đo
 * bề rộng CHỮ. Bộ "Lửa" ba tiếng một cụm vì thế tràn hẳn ra ngoài mép trái —
 * chữ "N" của "Nghĩ" bị xén mất một nửa.
 *
 * Trả về phần MỘT BÊN: nơi gọi tự nhân đôi. Viết vậy vì `drawtext` cũng nhận
 * đệm theo từng cạnh, nên hai bên nói cùng một thứ tiếng.
 */
export function boxPadShare(pack: Pick<StylePack, "box">): number {
  return pack.box ? pack.box.padShare * BOX_PAD_X : 0;
}

/** Đệm nền khối theo chiều DỌC ở mỗi cạnh, tính theo cỡ chữ. */
export function boxPadShareY(pack: Pick<StylePack, "box">): number {
  return pack.box ? pack.box.padShare : 0;
}

/**
 * Đệm nền khối cho `drawtext`, viết theo bốn cạnh `trên|phải|dưới|trái`.
 *
 * Một con số cho cả bốn cạnh là chỗ hai đường vẽ từng lệch: trang xem dùng
 * `padding: Xem Yem` với bề ngang gấp 1,4 lần bề dày, còn bản xuất đệm đều —
 * nên cùng một bộ dáng ra hai bề rộng nền khác nhau.
 */
export function boxBorderW(fontSize: number, pack: Pick<StylePack, "box">) {
  const y = Math.max(1, Math.round(fontSize * boxPadShareY(pack)));
  const x = Math.max(1, Math.round(fontSize * boxPadShare(pack)));
  return `${y}|${x}|${y}|${x}`;
}

/**
 * Hệ số nhân của từng kênh — MỘT phép tính cho cả hai đường vẽ.
 *
 * Ấm/lạnh đẩy đỏ và kéo lam ngược chiều nhau. Biên độ 25% ở mức `warmth = 1`,
 * tức bộ ấm nhất (0,5) lệch hai kênh 12,5% mỗi bên.
 *
 * Mức này đo trên khung hình THẬT mà chọn, không chọn trên bảng màu: bản đầu để
 * 10%, in ra mười khung của một video quay trong phòng thiếu sáng thì cả mười
 * gần như một màu — hiệu số đỏ trừ lam giữa bộ ấm nhất và bộ lạnh nhất chỉ 6/255,
 * nằm dưới ngưỡng mắt nhận ra. Nắn màu mà không ai thấy thì bằng không nắn.
 */
const WARMTH_GAIN = 0.25;

export function gradeChannels(grade: NonNullable<StylePack["grade"]>) {
  const { brightness: b, warmth: w } = grade;
  return {
    r: b * (1 + w * WARMTH_GAIN),
    g: b,
    b: b * (1 - w * WARMTH_GAIN),
  };
}

/**
 * Chuỗi bộ lọc ffmpeg cho phần nắn màu.
 *
 * Thứ tự PHẢI khớp trang xem: nhân kênh → tương phản → độ bão hoà. Đổi thứ tự là
 * ra màu khác, vì ba phép này không giao hoán.
 */
export function gradeFilter(grade: StylePack["grade"]): string | null {
  if (!grade) return null;
  const gain = gradeChannels(grade);
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return (
    `colorchannelmixer=rr=${round(gain.r)}:gg=${round(gain.g)}:bb=${round(gain.b)},` +
    `eq=contrast=${round(grade.contrast)}:saturation=${round(grade.saturation)}`
  );
}

/*
 * Gọt tiêu đề nằm ở ĐÂY chứ không ở `headline.ts`, và đó là ràng buộc của tệp
 * này chứ không phải sở thích: `headline.ts` import `text-layout` để đo chữ, mà
 * `text-layout` kéo theo `media-tools` tức `node:child_process`. Trang xem import
 * vào là gói dựng hỏng. Tệp này là tệp DUY NHẤT cả hai bên cùng import được.
 */
/** Trần độ dài, đếm bằng ký tự. Dài hơn thì cắt ở BIÊN GIỚI TIẾNG. */
export const HEADLINE_MAX_CHARS = 80;

/**
 * Gọt tiêu đề về trần ký tự, cắt ở BIÊN GIỚI TIẾNG.
 *
 * Cắt giữa tiếng thì tiếng Việt ra một từ khác hẳn ("quyết" thành "quyế"), đọc
 * ra như lỗi mã hoá chứ không ra như chữ bị cắt. Gọt ở đây chứ không gọt lúc
 * lưu: dữ liệu người dùng gõ vào là của họ, phần cắt chỉ thuộc về lúc VẼ.
 */
export function trimHeadline(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= HEADLINE_MAX_CHARS) return clean;
  const cut = clean.slice(0, HEADLINE_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * Bao lâu thì tiêu đề tắt.
 *
 * Bản trước vẽ nó SUỐT video, với lý do "tiêu đề đại diện cho cả video". Lý do
 * ấy sai ở khổ dọc: một dòng chữ đứng yên hai phút rưỡi thì sau mười giây đầu
 * mắt thôi nhìn nó, còn nó thì vẫn chiếm chỗ và vẫn che mặt người nói. Tiêu đề
 * là câu MỞ — nó có việc ở đúng mấy giây người xem quyết định ở lại hay lướt.
 *
 * Thời gian giữ theo SỐ KÝ TỰ chứ không cố định: "Video số 1" với một tiêu đề
 * mười tiếng cần thời gian đọc khác hẳn nhau, mà trần là 80 ký tự nên khoảng
 * chênh không nhỏ.
 */
/** Ký tự mỗi giây. Chậm hơn phụ đề vì tiêu đề bị đọc bằng mắt LIẾC, không đọc chăm. */
const HEADLINE_CPS = 10;
/** Ngắn hơn thì chưa kịp nhận ra là có chữ; dài hơn thì thành ra đứng mãi. */
const HEADLINE_MIN_HOLD = 2.5;
const HEADLINE_MAX_HOLD = 5;
/**
 * Tắt phụt là một cú giật. Mờ dần thì mắt không bị gọi về chỗ nó vừa biến mất.
 *
 * 0,35 chứ không phải 0,5: đo sáu bộ mẫu thì cú RA luôn nhanh hơn cú vào, và
 * không bộ nào ra quá 0,4 giây. `check:timing` canh dải ấy.
 */
export const HEADLINE_FADE = 0.35;

/**
 * LỐI VÀO CỦA ĐỒ HOẠ — mấy phần mười giây đầu, rồi thôi.
 *
 * Đồ hoạ của bộ dáng vốn đứng im từ khung đầu tới khung cuối. Đứng im thì mắt
 * đọc nó ra là một phần của khung hình, không đọc ra là một nét thiết kế — người
 * xem lướt qua mà không hề đăng ký rằng có ai đó đã dựng cái này.
 *
 * Cho nó một lối vào là đủ để đổi điều đó, mà KHÔNG phải cho nó động suốt phim:
 * đồ hoạ nhúc nhích liên tục phía sau một người đang nói thì nó tranh mất chỗ
 * của lời. Vào rồi nằm yên.
 */
/** Hình dán mờ dần vào. Nhanh hơn nữa thì thành một cái nháy. */
const GRAPHIC_FADE_IN = 0.6;
/** Mảng màu trượt vào từ mép nó bám. */
const PLATE_SLIDE_IN = 0.5;
/**
 * Hình bám chữ hiện dần.
 *
 * Ngắn hơn hẳn hai cái trên vì nó lặp lại mấy chục lần trong một video, chứ
 * không vào một lần rồi thôi. Dài bằng chúng thì mỗi cụm từ khoá kéo theo một
 * cú chuyển động nửa giây, và cái đó mới là rối.
 */
export const WRAP_FADE_IN = 0.18;

/**
 * Gọt câu tiêu đề thành MỘT CỤM NGẮN để vẽ chạy sau người.
 *
 * Thiết bị này vẽ chữ ở cỡ bằng một phần năm bề rộng khung, chồng ba tầng. Ở cỡ
 * ấy một câu bảy tiếng tràn ra ngoài khung và ba tầng chồng lên nhau thành một
 * mảng đặc không đọc được — nó cần một TỪ, không cần một câu.
 *
 * Lấy mấy tiếng ĐẦU chứ không lấy tiếng dài nhất: tiếng đầu là chỗ người viết
 * đặt chủ ngữ, và một cụm cắt từ đầu vẫn đọc ra ý, còn một tiếng nhặt từ giữa
 * câu thì đọc ra như lỗi.
 */
const BEHIND_MAX_CHARS = 12;

export function behindPhrase(text: string | null | undefined): string | null {
  const clean = (text ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return null;
  if (clean.length <= BEHIND_MAX_CHARS) return clean;
  const cut = clean.slice(0, BEHIND_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() || null;
}

/** Giây cuối cùng tiêu đề còn ĐỦ đậm, trước khi bắt đầu mờ dần. */
export function headlineHold(text: string): number {
  const chars = trimHeadline(text).length;
  return Math.min(HEADLINE_MAX_HOLD, Math.max(HEADLINE_MIN_HOLD, chars / HEADLINE_CPS));
}

/**
 * Bề rộng dòng tiêu đề được chiếm, tính bằng pixel.
 *
 * `bleed` KHÔNG có nghĩa là "được cắt mất chữ". Bản đầu cho tiêu đề chạy quá mép
 * khung 15%, và dựng ra thì "Ba năm mới hiểu" đọc thành "3a năm mới hiể" — mất
 * đúng chữ đầu và chữ cuối. Không một style nào trong ảnh khảo sát làm thế:
 * `anh/mo-focus.jpg` và `anh/ba-bo-thu-tren-footage-that.jpg` đều để tiêu đề
 * NẰM TRỌN trong khung, chỉ khác nhau ở chỗ nó lấn vào lề bao nhiêu.
 *
 * Nên hai mức là:
 *
 * - `bleed: false` — nằm trong đúng lề của phụ đề. Tiêu đề đọc ra như một phần
 *   của cùng một khối chữ.
 * - `bleed: true` — dùng hết bề rộng KHUNG, tràn qua lề an toàn. Đây là dáng
 *   "chữ chạm mép", và nó là thứ phụ đề không bao giờ được làm.
 *
 * `safeWidth` truyền từ ngoài vào chứ không khai ở đây: lề an toàn là hằng của
 * `text-layout.ts`, mà tệp này không import được nó (`node:*`). Truyền vào thì
 * hai đường vẽ vẫn dùng đúng một con số, không ai phải chép.
 */
export function headlineRoom(
  title: NonNullable<StylePack["title"]>,
  frameWidth: number,
  /** Bề rộng dùng được của phụ đề, tính bằng pixel. */
  safeWidth: number,
) {
  return title.bleed ? frameWidth : safeWidth;
}

/**
 * Mép TRÊN của dòng tiêu đề, tính bằng pixel.
 *
 * Có mảng màu cùng dải thì tiêu đề nằm GIỮA mảng ấy — đó là cách hai trục này
 * ăn khớp nhau, và là lý do phép kiểm đòi bộ nào khai `plate` cũng phải khai
 * `title` cùng dải: mảng màu trống đọc ra như lỗi vẽ
 * (`anh/ba-bo-thu-tren-footage-that.jpg`).
 *
 * Không có mảng màu thì bám sát mép khung — tiêu đề là chữ trang trí, đứng lùi
 * vào như phụ đề thì nó đọc ra như một cụm phụ đề lạc đàn.
 */
const HEADLINE_EDGE = 0.03;

export function headlineTopShare(
  pack: Pick<StylePack, "title" | "plate">,
  /** Chiều cao hộp dòng của chữ tiêu đề, theo phần chiều cao khung. */
  lineHeightShare: number,
) {
  const title = pack.title!;
  const plate = pack.plate;
  if (plate && plate.band === title.band) {
    const top = plate.band === "top" ? 0 : 1 - plate.heightShare;
    return top + (plate.heightShare - lineHeightShare) / 2;
  }
  if (title.band === "top") return HEADLINE_EDGE;
  if (title.band === "bottom") return 1 - HEADLINE_EDGE - lineHeightShare;
  return (1 - lineHeightShare) / 2;
}

/**
 * VÙNG HÌNH thật sự — mọi thứ bộ dáng vẽ đều đo theo nó, không theo khung.
 *
 * Bộ không khai `frame` thì nó trả về đúng cả khung, nên bảy bộ đối chứng đi qua
 * nhánh y hệt trước khi có trục này.
 *
 * ## Vì sao trả một hình chữ nhật thay vì sửa `SAFE`
 *
 * `SAFE` · `MAX_BLOCK_SHARE` · `MAX_LINES` · `MIN_SCALE` là ràng buộc của sản
 * phẩm, và cả một bộ kiểm 260 tổ hợp dựng lên để canh chúng. Đụng vào là mất bảo
 * đảm "chữ không bao giờ tràn khung" một lần cho tất cả.
 *
 * May là không cần đụng: `layoutText` và `placeWords` đều **nhận bề rộng và
 * chiều cao qua tham số**, không đọc hằng toàn cục. Nên chỉ cần truyền kích
 * thước vùng hình vào, rồi cộng gốc toạ độ lúc vẽ. Lõi bố cục không đổi một dòng,
 * và `SAFE` vẫn là `SAFE` — chỉ là của một khung nhỏ hơn.
 *
 * ## Bề rộng và chiều cao luôn CHẴN
 *
 * ffmpeg từ chối luồng `yuv420` có cạnh lẻ. Thu xuống chứ không nới lên: nới thì
 * vùng hình có thể lấn ra ngoài lề đã khai.
 */
export function contentRect(
  pack: Pick<StylePack, "frame">,
  frameWidth: number,
  frameHeight: number,
): { x: number; y: number; w: number; h: number } {
  if (!pack.frame) return { x: 0, y: 0, w: frameWidth, h: frameHeight };
  const { inset } = pack.frame;
  const px = (share: number) => Math.round(frameWidth * share);
  const even = (value: number) => (value % 2 === 0 ? value : value - 1);
  const left = px(inset.left);
  const top = px(inset.top);
  return {
    x: left,
    y: top,
    w: even(frameWidth - left - px(inset.right)),
    h: even(frameHeight - top - px(inset.bottom)),
  };
}

/**
 * Độ sáng trung bình mà từ đó trở lên coi là cảnh SÁNG (thang 0–255).
 *
 * 128 là điểm giữa, và nó đủ dùng vì hai mức `onDark`/`onLight` nội suy TUYẾN
 * TÍNH qua nó chứ không nhảy bậc — cảnh nửa sáng nửa tối ra một con số ở giữa,
 * không ra một trong hai đầu.
 */
const SCENE_MID_LUMA = 128;

/**
 * Độ đục của hình dán trên một cảnh có độ sáng cho trước.
 *
 * `luma` là `yAvg` khung hình. Không có (hiện luôn `null` vì đã bỏ bước đo) thì
 * lấy điểm giữa hai mức — một con số xác định, không phải một nhánh lặng lẽ.
 */
export function graphicOpacity(
  opacity: { onDark: number; onLight: number },
  luma: number | null,
): number {
  if (luma === null) return (opacity.onDark + opacity.onLight) / 2;
  const t = Math.min(1, Math.max(0, luma / (SCENE_MID_LUMA * 2)));
  return opacity.onDark + (opacity.onLight - opacity.onDark) * t;
}

/**
 * Chuỗi lọc dán hình lên khung, đã tô màu. Mảng rỗng là bộ dáng không có hình.
 *
 * Trả về TỪNG BƯỚC chứ không một chuỗi liền: mỗi hình cần một nhãn riêng trong
 * đồ thị lọc, và nơi gọi là nơi biết nhãn nào đang trôi tới đâu.
 *
 * Nạp PNG bằng nguồn `movie=` ngay trong đồ thị, KHÔNG thêm `-i`: thêm đầu vào
 * là mọi chỉ số luồng phía sau (`[1:v]`, `[2:v]`…) trôi đi một bậc, mà chúng
 * được tính từ số tư liệu chèn nên lỗi chỉ lộ ra ở video có b-roll.
 */
export function graphicsSteps(
  pack: Pick<StylePack, "graphics">,
  /** Đường dẫn TUYỆT ĐỐI tới thư mục PNG — tệp này không đụng `node:*`. */
  pngDir: string,
  frameWidth: number,
  frameHeight: number,
  /** Độ sáng trung bình khung hình, thang 0–255. `null` là chưa đo. */
  luma: number | null,
  /**
   * `false` bỏ phần hiện dần — trạng thái ĐÃ YÊN, cùng cờ với `plateFilter`.
   *
   * Bảng ảnh dựng đúng khung `t=0` của đồ thị lọc, mà phần hiện dần cũng bắt
   * đầu ở giây 0 — để nguyên thì bảng bày ra hình dán TRONG SUỐT, và ai nhìn
   * bảng cũng kết luận bộ dáng ấy không có hình. Đúng kiểu lỗi "bảng nói dối"
   * đã mắc bốn lần.
   */
  animate = true,
  /**
   * Mốc CẮT của các chỗ nối. Rỗng thì hình dán chỉ nằm im.
   *
   * Xem `pulseChain` để biết vì sao cần.
   */
  cuts: readonly number[] = [],
): Array<{ chain: string; label: string; pulse: { chain: string; label: string; enable: string } | null }> {
  if (!pack.graphics) return [];
  return pack.graphics.map((item, index) => {
    const label = `[gfx${index}]`;
    const alpha = graphicOpacity(item.opacity, luma).toFixed(3);
    const tint = (suffix: string, aa: string) =>
      `movie=${pngDir}/${item.id}.png,alphaextract[gmask${suffix}];` +
      `color=c=${item.color}:s=${frameWidth}x${frameHeight}[gcolor${suffix}];` +
      `[gcolor${suffix}][gmask${suffix}]alphamerge,` +
      `format=rgba,colorchannelmixer=aa=${aa}`;
    return {
      label,
      // Ba bước: bóc kênh trong suốt của hình → dựng một tấm màu đặc → ghép hai
      // thứ lại. `colorchannelmixer=aa` hạ độ đục của cả tấm đã ghép, cùng cách
      // lớp quầng chữ ở `render.ts` làm.
      chain:
        tint(String(index), alpha) +
        (animate ? `,fade=t=in:st=0:d=${GRAPHIC_FADE_IN}:alpha=1` : "") +
        label,
      // `overlay` do nơi gọi ghép, vì nó mới biết luồng hình đang mang nhãn gì.
      pulse:
        animate && cuts.length > 0
          ? {
              chain: `${tint(`p${index}`, "1.000")}[gpulse${index}]`,
              label: `[gpulse${index}]`,
              enable: pulseEnable(cuts),
            }
          : null,
    };
  });
}

/**
 * NHỊP ĐẬP CỦA HÌNH DÁN — cùng một hình, tô ĐẶC, chỉ bật ở quanh mỗi vết cắt.
 *
 * Hình dán mờ dần vào trong sáu phần mười giây đầu rồi đứng im tới hết phim.
 * Đứng im thì nó không còn là đồ hoạ nữa, nó là trang trí đậu ở đó — không phản
 * ứng với vết cắt, với từ nhấn, với nhịp nói. Người xem lướt qua mà không hề
 * đăng ký rằng có ai đó đã dựng cái này.
 *
 * Cách rẻ nhất để nó phản ứng: dán CHÍNH NÓ thêm một lớp nữa ở độ đục tối đa,
 * và chỉ bật lớp ấy trong hai phần mười giây quanh mỗi vết cắt. Viền vàng đang
 * ở 0,5 bỗng đặc lại đúng lúc hình đổi, rồi trở về. Không cần biểu thức alpha
 * chạy theo khung — `colorchannelmixer=aa` vốn không nhận biểu thức, mà `enable`
 * thì nhận, nên bật/tắt cả một lớp là đường duy nhất còn lại.
 *
 * Vào SỚM hơn vết cắt một chút: mắt cần vài khung để bắt được thay đổi, nên nếu
 * đập đúng lúc cắt thì nó rơi vào sau cú cắt chứ không rơi vào cú cắt.
 */
const PULSE_LEAD = 0.06;
const PULSE_HOLD = 0.2;

/** `between(...)+between(...)` — các khoảng không chồng nhau nên cộng là HOẶC. */
function pulseEnable(cuts: readonly number[]): string {
  return cuts
    .map((cut) => `between(t\\,${(cut - PULSE_LEAD).toFixed(3)}\\,${(cut - PULSE_LEAD + PULSE_HOLD).toFixed(3)})`)
    .join("+");
}

/**
 * Hộp mà hình bám chữ sẽ lấp đầy — tính theo cách đặt của chính hình đó.
 *
 * `around` bao quanh cả khối; `under` nằm dưới chân khối và cao theo CỠ CHỮ, không
 * cao theo khối. Đây là chỗ đã hỏng một lần: gạch chân kéo cao bằng khối ba hàng
 * thì nó cắt ngang giữa chữ chứ không nằm dưới chân.
 *
 * Cả hai đều kẹp vào vùng hình: đệm quanh chữ không được đẩy hình ra ngoài khung.
 */
export function wrapBox(
  fit: "around" | "under",
  ink: { left: number; right: number; top: number; bottom: number },
  /** Cỡ chữ lớn nhất trong cụm — thang của gạch chân. */
  maxFontSize: number,
  padShare: number,
  rect: { x: number; y: number; w: number; h: number },
) {
  const pad = Math.round(maxFontSize * padShare);
  const clampX = (value: number) => Math.min(rect.x + rect.w, Math.max(rect.x, value));
  const clampY = (value: number) => Math.min(rect.y + rect.h, Math.max(rect.y, value));
  const x = clampX(Math.round(ink.left - pad));
  const w = clampX(Math.round(ink.right + pad)) - x;
  if (fit === "under") {
    // Cao 45% cỡ chữ: đủ để nét cong đọc ra, chưa đủ để nó thành một cái gạch
    // ngang đè lên hàng dưới. Nhích lên 8% cho nét chạm chân chữ thay vì rời ra.
    const h = Math.max(2, Math.round(maxFontSize * 0.45));
    const y = clampY(Math.round(ink.bottom - maxFontSize * 0.08));
    return { x, y, w, h: Math.min(h, rect.y + rect.h - y) };
  }
  const y = clampY(Math.round(ink.top - pad));
  return { x, y, w, h: clampY(Math.round(ink.bottom + pad)) - y };
}

/**
 * Chuỗi lọc vẽ hình BÁM CHỮ quanh một khối chữ, cắt ba lát.
 *
 * `null` là bộ dáng không có hình bám chữ, hoặc cụm này ngoài phạm vi.
 *
 * ## Ba lát, và vì sao không kéo giãn cả hình
 *
 * Hai đầu giữ nguyên bề rộng `cap`, khúc giữa kéo cho vừa. Kéo cả hình thì nét
 * dọc ở hai đầu mảnh dần theo bề rộng cụm — cụm một tiếng có vòng khoanh nét dày,
 * cụm năm tiếng có vòng khoanh nét mảnh, và người xem đọc ra hai bộ dáng.
 *
 * Chiều dọc kéo tự do: hình bám chữ vốn cao bằng một khối chữ, mà khối chữ thì
 * cao theo số hàng — không có "hai đầu" nào ở trục dọc để mà giữ.
 *
 * ## `index` để làm gì
 *
 * Mỗi cụm cần một bộ nhãn riêng trong đồ thị lọc của ffmpeg. Trùng nhãn là ffmpeg
 * từ chối cả đồ thị, và thông báo lỗi của nó không chỉ ra cụm nào.
 */
export function wrapSteps(
  pack: Pick<StylePack, "wrap">,
  meta: { nominalWidth: number; nominalHeight: number; cap: number },
  pngDir: string,
  box: { x: number; y: number; w: number; h: number },
  luma: number | null,
  index: number,
  /**
   * Giây mà cụm này bắt đầu hiện — mốc để `fade` bám vào. `null` là không hiện
   * dần, dùng cho bảng ảnh tĩnh (xem cờ `animate` của `plateFilter`).
   *
   * Phải truyền vào chứ không tự suy được: `fade` đọc mốc trên trục của chính
   * luồng hình, mà luồng ấy là một nguồn `color` chạy từ giây 0 suốt cả phim.
   * Không có mốc thì mọi hình bám chữ đều hiện dần ở giây 0 rồi nằm đó đủ đục
   * cho tới lúc `enable` cho phép vẽ — tức là mất hẳn phần hiện dần.
   */
  fadeFrom: number | null,
): { chain: string; overlays: Array<{ label: string; x: number; y: number }> } | null {
  if (!pack.wrap) return null;
  const { cap, nominalWidth, nominalHeight } = meta;
  // Hai đầu co theo CHIỀU CAO, giữ nguyên tỉ lệ của chính chúng — thế mới là
  // "giữ nguyên hai đầu". Co theo bề rộng khối là quay lại đúng phép kéo giãn.
  const ratio = box.h / nominalHeight;
  const capOut = Math.max(1, Math.round(cap * ratio));
  const midOut = Math.max(1, box.w - capOut * 2);
  const alpha = graphicOpacity(pack.wrap.opacity, luma).toFixed(3);
  const t = `w${index}`;
  return {
    chain:
      `movie=${pngDir}/${pack.wrap.id}.png,alphaextract[${t}m];` +
      `color=c=${pack.wrap.color}:s=${nominalWidth}x${nominalHeight}[${t}c];` +
      `[${t}c][${t}m]alphamerge,format=rgba,colorchannelmixer=aa=${alpha},` +
      (fadeFrom === null
        ? ""
        : `fade=t=in:st=${Math.max(0, fadeFrom).toFixed(2)}:d=${WRAP_FADE_IN}:alpha=1,`) +
      `split=3[${t}a][${t}b][${t}d];` +
      `[${t}a]crop=${cap}:${nominalHeight}:0:0,scale=${capOut}:${box.h}[${t}L];` +
      `[${t}b]crop=${nominalWidth - cap * 2}:${nominalHeight}:${cap}:0,scale=${midOut}:${box.h}[${t}M];` +
      `[${t}d]crop=${cap}:${nominalHeight}:${nominalWidth - cap}:0,scale=${capOut}:${box.h}[${t}R]`,
    overlays: [
      { label: `[${t}L]`, x: box.x, y: box.y },
      { label: `[${t}M]`, x: box.x + capOut, y: box.y },
      { label: `[${t}R]`, x: box.x + capOut + midOut, y: box.y },
    ],
  };
}

/**
 * Chuỗi lọc thu hình vào khung. `null` là bộ dáng không có khung.
 *
 * Khai ở đây chứ không ở `render.ts` vì ba chỗ cùng vẽ nó: đường xuất video và
 * hai script dựng bảng so. Bảng so mà thiếu bước này thì nó bày ra một dáng
 * không tồn tại — đã xảy ra thật ở lượt thử đầu.
 *
 * `scale`+`crop` giữ tỉ lệ rồi cắt, KHÔNG kéo giãn: lề bốn phía khác nhau thì
 * vùng hình có tỉ lệ khác 9:16, và kéo cho vừa là mặt người bị bóp méo.
 */
export function frameFilter(
  pack: Pick<StylePack, "frame">,
  rect: { x: number; y: number; w: number; h: number },
  frameWidth: number,
  frameHeight: number,
): string | null {
  if (!pack.frame) return null;
  const background = pack.frame.background.color.replace("#", "0x");
  return (
    `scale=${rect.w}:${rect.h}:force_original_aspect_ratio=increase,` +
    `crop=${rect.w}:${rect.h},` +
    `pad=${frameWidth}:${frameHeight}:${rect.x}:${rect.y}:${background}`
  );
}

/**
 * Chuỗi `drawbox` của mảng màu. `null` là bộ dáng không có mảng nào.
 *
 * Khai ở đây chứ không ở `render.ts` vì ba chỗ cùng vẽ nó: đường xuất video, hai
 * script dựng bảng so. Ba bản chép của cùng một phép tính toạ độ là ba bản sẽ
 * trôi khỏi nhau, mà bảng so trôi khỏi bản xuất thì nó so nhầm thứ.
 *
 * `t=fill` chứ không phải bề dày viền: mảng màu là khối ĐẶC, còn `drawbox` mặc
 * định chỉ vẽ đường viền — thiếu nó thì ra một cái khung rỗng.
 */
/**
 * Vệt màu quét ngang khung ở mỗi chỗ nối.
 *
 * Một lớp phủ cho MỖI chỗ nối, không phải một lớp dùng chung: `overlay` chỉ có
 * một biểu thức `x`, mà tám chỗ nối nằm ở tám mốc khác nhau. Gộp lại thì phải
 * viết một biểu thức tám nhánh — dài, khó đọc, và sai một nhánh thì không chỗ
 * nào báo.
 *
 * Vệt đi từ ngoài mép trái tới ngoài mép phải, và mốc CẮT rơi vào đúng giữa
 * đường đi: lúc ấy vệt che phần giữa khung, tức là che đúng chỗ hình đổi. Vào
 * sớm hay muộn hơn thì người xem thấy cú cắt trước rồi mới thấy vệt, và vệt
 * thành ra một thứ trang trí đi sau chứ không phải thứ đậy cú cắt.
 */
export function sweepSteps(
  pack: Pick<StylePack, "sweep">,
  /** Mốc CẮT của từng chỗ nối, tính trên trục phim đã dựng. */
  cuts: readonly number[],
  frameWidth: number,
  frameHeight: number,
): Array<{ chain: string; label: string; xExpr: string; from: number; to: number }> {
  if (!pack.sweep || cuts.length === 0) return [];
  const { tone, widthShare, seconds } = pack.sweep;
  const band = Math.max(2, Math.round(frameWidth * widthShare));
  const travel = frameWidth + band;
  return cuts.map((cut, index) => {
    const from = cut - seconds / 2;
    const to = cut + seconds / 2;
    const label = `[swp${index}]`;
    return {
      label,
      chain: `color=c=${ffmpegColor(tone)}:s=${band}x${frameHeight}${label}`,
      // Ngoài mép trái lúc `from`, ngoài mép phải lúc `to`. Kẹp hai đầu để
      // những khung ngoài khoảng `enable` không tính ra toạ độ vô nghĩa.
      xExpr:
        `${-band}+${travel}*max(0\\,min(1\\,(t-${from.toFixed(3)})/${seconds}))`,
      from,
      to,
    };
  });
}

export function plateFilter(
  pack: Pick<StylePack, "plate" | "title">,
  /** VÙNG HÌNH, không phải cả khung — mảng màu bám mép hình, không bám mép khung. */
  rect: { x: number; y: number; w: number; h: number },
  /**
   * `false` cho ra trạng thái ĐÃ YÊN, bỏ phần trượt vào.
   *
   * Bảng ảnh dựng đúng MỘT khung từ một tấm ảnh tĩnh, tức là luôn ở giây 0 — để
   * nguyên phần trượt thì bảng bày ra một mảng màu nằm ngoài khung, trong khi
   * video thật chỉ như thế trong nửa giây đầu. Bảng phải bày cái mà người xem
   * thấy suốt phim.
   *
   * Hình dạng trả về KHÔNG đổi theo cờ này: vẫn một lớp phủ, vẫn một biểu thức
   * `y`. Chỉ có nội dung biểu thức là hằng số. Nhờ vậy nơi gọi chỉ có một đường
   * vẽ, và bảng ảnh không thể lệch khỏi video vì quên một nhánh.
   */
  animate = true,
  /**
   * Giây mà dòng tiêu đề bắt đầu tắt. `null` là không có tiêu đề, hoặc là bảng
   * ảnh tĩnh không cần biết.
   */
  titleUntil: number | null = null,
): {
  chain: string;
  label: string;
  x: number;
  yExpr: string;
  /** Giây thôi vẽ hẳn. `null` là ở lại suốt phim. */
  until: number | null;
} | null {
  if (!pack.plate) return null;
  const band = Math.round(rect.h * pack.plate.heightShare);
  const top = pack.plate.band === "top" ? rect.y : rect.y + rect.h - band;
  /*
   * Lớp phủ chứ không phải `drawbox`, và đó là vì phần TRƯỢT VÀO.
   *
   * `drawbox` nhận biểu thức cho `w`/`h` trên giấy tờ, nhưng thử trên đúng bản
   * ffmpeg này thì nó tính MỘT LẦN lúc dựng bộ lọc: bốn khung liên tiếp của một
   * mảng khai `w='540*min(1,t/0.4)'` đều ra cùng một bề rộng. `overlay` thì tính
   * lại `x`/`y` theo từng khung — đo được 12,5% → 30,9% → 55,3% → 73,6%.
   *
   * Nên mảng màu dựng thành một tấm màu riêng rồi phủ lên, với `y` chạy theo
   * thời gian. Đắt hơn `drawbox` một luồng nguồn, mà đổi lại là trục duy nhất
   * nằm im suốt phim giờ có một lối vào.
   */
  const slide = pack.plate.band === "top" ? -band : band;
  /*
   * Mảng màu ĐI CÙNG dòng tiêu đề khi nó chở tiêu đề.
   *
   * Mảng màu của `Nhịp` sinh ra để LÀM NỀN cho tiêu đề — chữ trong nó đảo màu
   * so với phụ đề, và đó là cả chữ ký của bộ. Tiêu đề đi mà nó ở lại thì còn
   * một vệt màu rỗng nằm 129 trên 132 giây: nhìn ra không phải một nét thiết
   * kế mà là một thanh giao diện quên nạp nội dung, lại ăn mất 11% chiều cao
   * khung để không mang gì.
   *
   * Đã thử cách ngược lại — giữ nó lại, với lý lẽ "bỏ đi thì `Nhịp` chẳng còn
   * đồ hoạ nào". Lý lẽ ấy đúng lúc chưa có VỆT QUÉT: giờ bộ này có một vệt màu
   * nổ ở mỗi chỗ nối, rải khắp phim, nên nó không cần thêm một dải nằm không.
   *
   * Mảng màu KHÔNG chở tiêu đề thì ở lại — lúc ấy nó là đồ đạc của khung hình
   * chứ không phải cái khay.
   */
  const carries =
    titleUntil !== null && pack.title != null && pack.title.band === pack.plate.band;
  const out = carries ? titleUntil : null;
  return {
    chain:
      `color=c=${ffmpegColor(pack.plate.tone)}:s=${rect.w}x${band}[plateimg]`,
    label: "[plateimg]",
    x: rect.x,
    // Ngoài khung lúc t=0, về đúng chỗ sau `PLATE_SLIDE_IN` giây, đứng yên, rồi
    // trượt ra cùng tiêu đề nếu nó chở tiêu đề.
    yExpr: !animate
      ? String(top)
      : `${top}+${slide}*(max(0\\,1-t/${PLATE_SLIDE_IN})` +
        (out === null
          ? ")"
          : `+max(0\\,min(1\\,(t-${out.toFixed(2)})/${PLATE_SLIDE_IN})))`),
    until: out === null ? null : out + PLATE_SLIDE_IN,
  };
}

/** `#RRGGBB` + độ đục, đúng cú pháp màu của ffmpeg. */
export const ffmpegColor = (tone: Tone) => `${tone.color}@${tone.alpha}`;

/** `rgba(...)` cho trang xem — cùng một `Tone`, hai cách viết. */
export function cssColor(tone: Tone) {
  const hex = tone.color.replace("#", "");
  const channel = (at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
  return `rgba(${channel(0)},${channel(2)},${channel(4)},${tone.alpha})`;
}

/**
 * Chuỗi lọc dựng VÀNH bám dáng người. `null` là bộ dáng không khai, hoặc dự án
 * chưa có mặt nạ.
 *
 * Nở mặt nạ `steps` lần rồi trừ đi chính nó: phần dôi ra là một vành dày đúng
 * `steps` điểm ảnh, ôm sát dáng. Nở ở KHỔ ĐẦY chứ không ở khổ mặt nạ — mặt nạ
 * lưu ở nửa khổ nên nở một bước ở đó ra hai điểm ảnh ở khung xuất, và vành dày
 * mỏng nhảy cóc theo bậc chẵn.
 */
export function subjectEdgeSteps(
  pack: Pick<StylePack, "subjectEdge">,
  maskPath: string | null,
  frameWidth: number,
  frameHeight: number,
  /** Mốc các vết cắt trên trục phim đã dựng, để chia quãng bật/tắt. */
  cuts: readonly number[] = [],
  /** Độ dài phim, làm mép cuối của quãng cuối. */
  total = 0,
  /** Giây mà thiết bị mở màn tắt — mạch viền bắt đầu SAU đó, cộng quãng nghỉ. */
  after = 0,
): { chain: string; label: string; enable: string } | null {
  if (!pack.subjectEdge || !maskPath) return null;
  const { tone, steps } = pack.subjectEdge;
  const grow = Array.from({ length: Math.max(1, steps) }, () => "dilation").join(",");
  return {
    label: "[svien]",
    chain:
      `movie=${maskPath},scale=${frameWidth}:${frameHeight},format=gray,split[sm1][sm2];` +
      `[sm1]${grow}[smfat];` +
      `[smfat][sm2]blend=all_mode=subtract,format=gray[smring];` +
      `color=c=${tone.color}:s=${frameWidth}x${frameHeight}[smcol];` +
      `[smcol][smring]alphamerge,colorchannelmixer=aa=${tone.alpha.toFixed(3)}[svien]`,
    enable: edgeWindows(pack.subjectEdge.share, cuts, total, after),
  };
}

/**
 * Quãng nào bật viền — dựng từ chính các vết cắt.
 *
 * Chia phim thành các quãng ngăn bởi vết cắt, rồi bật một PHẦN các quãng ấy,
 * rải đều chứ không dồn: quãng thứ `k` bật khi `k × share` vượt qua một số
 * nguyên mới. Cách này cho ra khoảng cách đều mà không cần chia hết.
 *
 * Không có vết cắt nào thì bật cả phim — thà có còn hơn im lặng biến mất, và
 * một video không vết cắt nào thì cũng chẳng có nhịp gì để bám.
 */
/**
 * MỘT MẠCH LIỀN, không rải khắp phim.
 *
 * Đếm trên bảng Chalk, 24 ô: viền quanh người xuất hiện ở ô 7 tới ô 12 — **sáu ô
 * LIỀN NHAU**, bật suốt trong đó, rồi thôi hẳn. Không ô nào lẻ loi ở giữa phim.
 *
 * Bản trước tôi rải nó theo `share` khắp video, bật quãng này tắt quãng kia. Kết
 * quả đọc ra là spam: thiết bị nhấp nháy thì mắt không kịp nhận ra nó là một
 * quyết định, chỉ thấy màn hình cứ đổi.
 *
 * Và họ chừa CHỖ NGHỈ: ô 6 — ngay trước mạch viền — trống hẳn, không thiết bị
 * nào. Hai thiết bị dính liền nhau thì cái sau mất hết sức nặng.
 */

/** Mạch viền bắt đầu sau khi thiết bị mở màn đã tắt, cộng một quãng nghỉ. */
const EDGE_REST = 2.5;

/**
 * Một khoảng LIỀN cho viền: bắt đầu sau `after`, dài `share` của phần còn lại.
 *
 * Nắn hai mép về vết cắt gần nhất. Thiết bị vào giữa câu thì nó đọc ra như lỗi
 * bật/tắt; vào đúng chỗ hình vừa đổi thì đọc ra như một quyết định dựng.
 */
function edgeWindows(
  share: number,
  cuts: readonly number[],
  total: number,
  after: number,
): string {
  if (total <= 0) return "0";
  const from = Math.min(total, after + EDGE_REST);
  const span = Math.max(0, total - from) * Math.min(1, Math.max(0, share));
  if (span < 1) return "0";
  const snap = (at: number) => {
    let best = at;
    let gap = Infinity;
    for (const cut of cuts) {
      const d = Math.abs(cut - at);
      // Chỉ nắn khi vết cắt ở gần: xa hơn thì nắn là dời hẳn mạch đi chỗ khác.
      if (d < gap && d < 4) {
        gap = d;
        best = cut;
      }
    }
    return best;
  };
  const start = snap(from);
  const end = snap(Math.min(total, from + span));
  if (end - start < 1) return "0";
  return `between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})`;
}

/**
 * Chuỗi lọc TÁCH NGƯỜI ra khỏi luồng hình, để dán lại lên trên một lớp khác.
 *
 * Trả về một luồng có kênh trong suốt: đục ở chỗ người, trong ở chỗ nền. Nơi
 * gọi vẽ thứ nó muốn giấu ra sau, rồi phủ luồng này lên.
 *
 * `label` nhận vào là luồng hình NGUỒN — phải là bản sao, vì luồng gốc còn phải
 * mang cái nền đã vẽ chữ. Nơi gọi lo `split`.
 */
export function subjectCutChain(
  source: string,
  maskPath: string,
  frameWidth: number,
  frameHeight: number,
  tag: string,
): { chain: string; label: string } {
  return {
    label: `[${tag}cut]`,
    chain:
      `movie=${maskPath},scale=${frameWidth}:${frameHeight},format=gray[${tag}m];` +
      `${source}[${tag}m]alphamerge[${tag}cut]`,
  };
}
