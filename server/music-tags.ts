/**
 * VỐN TỪ ĐÓNG cho kho nhạc — ba trục, giá trị cố định.
 *
 * Vì sao cần: cột `tags` cũ là chuỗi TỰ DO, nên bài này gắn `energetic, upbeat`
 * còn bài kia gắn `sôi động, mạnh`. Bộ dáng không khai được "thiên về nhạc sôi
 * nổi" khi hai bên không nói cùng một ngôn ngữ. Đây không phải vấn đề cấu hình,
 * là vấn đề vốn từ.
 *
 * Vì sao chỉ BA trục: ba trục là đủ để ghép với bộ dáng. Nhiều hơn thì gán nhãn
 * thành việc nặng mà không đổi được quyết định nào — một nhãn không đổi được
 * quyết định nào là một nhãn không đáng gán.
 *
 * `tags` tự do vẫn giữ nguyên cho phần MÔ TẢ ("chiptune", "lofi", "buồn"): nó là
 * thứ người dùng đọc, còn ba trục này là thứ máy lọc.
 */

/** Nhạc đẩy tới mức nào. Trục quyết định nhiều nhất khi ghép với dáng chữ. */
export const ENERGY = ["manh", "vua", "em"] as const;
/** Nhiều lớp nhạc chồng nhau hay thưa thoáng. */
export const DENSITY = ["day", "thua"] as const;
/** Có giọng hát hay không — nhạc có lời đè lên tiếng người nói. */
export const VOCAL = ["co-loi", "khong-loi"] as const;

export type Energy = (typeof ENERGY)[number];
export type Density = (typeof DENSITY)[number];
export type Vocal = (typeof VOCAL)[number];

export type MusicTags = {
  energy: Energy | null;
  density: Density | null;
  vocal: Vocal | null;
};

export const ENERGY_LABELS: Record<Energy, string> = {
  manh: "Mạnh",
  vua: "Vừa",
  em: "Êm",
};

export const DENSITY_LABELS: Record<Density, string> = {
  day: "Dày",
  thua: "Thưa",
};

export const VOCAL_LABELS: Record<Vocal, string> = {
  "co-loi": "Có lời",
  "khong-loi": "Không lời",
};

/**
 * Thiên lệch nhạc của một bộ dáng — ƯU TIÊN, không phải hàng rào.
 *
 * Nhạc thuộc loại **AI đặt hộ**: đổi bộ dáng KHÔNG được tự đổi nhạc. Bài nhạc là
 * một đoạn nằm trên dải — người dùng nhìn thấy nó, và có thể đã chỉnh mốc, chỉnh
 * âm lượng. Bộ dáng chỉ đặt thiên lệch cho LƯỢT CHỌN TIẾP THEO.
 */
export type MusicBias = {
  energy: Energy[];
  density: Density[];
  vocal: Vocal[];
};

const isOneOf = <T extends string>(values: readonly T[], value: unknown) =>
  typeof value === "string" && (values as readonly string[]).includes(value)
    ? (value as T)
    : null;

/** Đọc ba trục từ một hàng CSDL, bỏ mọi giá trị lạ. */
export function readMusicTags(row: {
  energy?: string | null;
  density?: string | null;
  vocal?: string | null;
}): MusicTags {
  return {
    energy: isOneOf(ENERGY, row.energy),
    density: isOneOf(DENSITY, row.density),
    vocal: isOneOf(VOCAL, row.vocal),
  };
}

/**
 * Bài này có hợp thiên lệch không.
 *
 * Bài CHƯA GÁN NHÃN luôn lọt qua. Bảng `library_tracks` là lớp bổ sung — thư mục
 * mới là nguồn sự thật — nên bài mới thả vào thư mục chưa có hàng nào, và loại
 * nó ra là bài mới biến mất khỏi mọi lượt chọn cho tới khi có người gán nhãn.
 */
export function matchesBias(tags: MusicTags, bias: MusicBias): boolean {
  const axis = <T extends string>(value: T | null, wanted: T[]) =>
    value === null || wanted.length === 0 || wanted.includes(value);
  return (
    axis(tags.energy, bias.energy) &&
    axis(tags.density, bias.density) &&
    axis(tags.vocal, bias.vocal)
  );
}

/**
 * Nhãn gọn cho một bài, để bày ở kho nhạc và để đưa cho mô hình.
 *
 * **`khong-loi` KHÔNG in ra.** Kho hiện có 55/55 bài không lời, nên in nhãn đó
 * lên mọi dòng là thêm một chữ vào 55 dòng mà không phân biệt được bài nào với
 * bài nào — và nó còn thành một thẻ lọc khớp đúng cả kho. `co-loi` thì ngược
 * lại: nó là ngoại lệ đáng biết, vì lời hát đè lên tiếng người nói.
 */
export function describeMusicTags(tags: MusicTags): string {
  return [
    tags.energy && ENERGY_LABELS[tags.energy],
    tags.density && DENSITY_LABELS[tags.density],
    tags.vocal === "co-loi" ? VOCAL_LABELS["co-loi"] : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
