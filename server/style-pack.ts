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

/** Cách đánh dấu CHỖ NỐI giữa hai đoạn. Khớp `JUNCTIONS` của trang tra cứu. */
export type JunctionId = "none" | "zoom-in" | "zoom-out" | "flash" | "dip";

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

export type StylePackId =
  | "goc"
  | "chu-hoa-vang"
  | "nhan-xanh"
  | "net-thua"
  | "dung-yen"
  | "net-dac"
  | "nghieng-tron"
  | "dung-dung"
  | "tung-chu"
  | "sang-theo-loi";

/**
 * NHÓM Ý ĐỒ — người dùng chọn theo "video của tôi thuộc loại gì".
 *
 * Không nhóm theo cái nhìn ("nghiêng", "hẹp", "có viền"): người dùng không mở
 * màn chọn để tìm một cái font, họ mở để tìm thứ hợp với video mình vừa quay.
 * Nhóm theo ý đồ thì mười ô thành ba câu hỏi dễ trả lời; nhóm theo cái nhìn thì
 * nó vẫn là mười ô phải so từng cái.
 */
export type StyleTheme = "manh" | "ke-chuyen" | "gon";

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
  font: {
    /** Đường dẫn tương đối từ gốc dự án tới tệp `.ttf` mà ffmpeg sẽ in. */
    file: string;
    /** Họ chữ cho trang xem — phải là ĐÚNG font mà `file` trỏ tới. */
    cssStack: string;
    cssWeight: number;
    italic: boolean;
  };
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
export const styleCase = (text: string, pack: StylePack) =>
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
): StylePack {
  if (!override?.letterCase && !override?.keyColor) return pack;
  return {
    ...pack,
    letterCase: override.letterCase ?? pack.letterCase,
    color: override.keyColor
      ? { ...pack.color, key: { color: override.keyColor, alpha: 1 } }
      : pack.color,
  };
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
export function boxPadShare(pack: StylePack): number {
  return pack.box ? pack.box.padShare * BOX_PAD_X : 0;
}

/** Đệm nền khối theo chiều DỌC ở mỗi cạnh, tính theo cỡ chữ. */
export function boxPadShareY(pack: StylePack): number {
  return pack.box ? pack.box.padShare : 0;
}

/**
 * Đệm nền khối cho `drawtext`, viết theo bốn cạnh `trên|phải|dưới|trái`.
 *
 * Một con số cho cả bốn cạnh là chỗ hai đường vẽ từng lệch: trang xem dùng
 * `padding: Xem Yem` với bề ngang gấp 1,4 lần bề dày, còn bản xuất đệm đều —
 * nên cùng một bộ dáng ra hai bề rộng nền khác nhau.
 */
export function boxBorderW(fontSize: number, pack: StylePack) {
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

/** `#RRGGBB` + độ đục, đúng cú pháp màu của ffmpeg. */
export const ffmpegColor = (tone: Tone) => `${tone.color}@${tone.alpha}`;

/** `rgba(...)` cho trang xem — cùng một `Tone`, hai cách viết. */
export function cssColor(tone: Tone) {
  const hex = tone.color.replace("#", "");
  const channel = (at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
  return `rgba(${channel(0)},${channel(2)},${channel(4)},${tone.alpha})`;
}
