import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * "Dải thời gian là nơi duy nhất được đậm màu."
 *
 * Ba mức bày dọc để chọn. Mức 1 là bản đang chạy: chroma 0,05 trên lightness
 * 0,93 — nhạt nhất màn, trong khi đây lại là chỗ phân loại quan trọng nhất và
 * là chỗ mắt lướt qua hàng trăm lần một buổi.
 *
 * Mức 3 đi ngược một quyết định đã ghi lý do trong `src/index.css`: nền đặc màu
 * chủ đạo thì một khối trên dải nặng ngang nút Xuất video. Lý do đó dựng trên
 * NỀN SÁNG. Nền tối làm mặc định thì cùng một khối đặc lại không còn nặng như
 * vậy — nên phải nhìn tận mắt rồi mới chốt, không suy từ ghi chú cũ.
 */

const LANE_KINDS = [
  { name: "Chữ trên màn", hue: 310 },
  { name: "Tư liệu chèn", hue: 195 },
  { name: "Nhạc nền", hue: 145 },
  { name: "Chỗ nối", hue: 25 },
];

type LaneLevel = {
  id: string;
  title: string;
  note: string;
  /** Trả về nền và màu chữ cho một sắc. */
  paint: (hue: number, skin: "dark" | "light") => { bg: string; fg: string };
};

const LEVELS: LaneLevel[] = [
  {
    id: "raised",
    title: "chroma 0,15",
    note: "nền mang sắc, chữ cùng sắc nhưng sáng hơn",
    paint: (hue, skin) =>
      skin === "dark"
        ? { bg: `oklch(0.44 0.15 ${hue})`, fg: `oklch(0.96 0.05 ${hue})` }
        : { bg: `oklch(0.84 0.13 ${hue})`, fg: `oklch(0.32 0.15 ${hue})` },
  },
];

/** Bề rộng giả của từng khối trên dải, cho trông ra một dải thật. */
const WIDTHS = ["w-[28%]", "w-[19%]", "w-[34%]", "w-[12%]"];

export function LanePanel({ skin }: { skin: "dark" | "light" }) {
  return (
    <Card className="col-span-12">
      <CardHeader>
        <CardTitle>Dải thời gian</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {LEVELS.map((level) => (
          <div key={level.id} className="grid gap-2">
            <div className="flex items-baseline gap-3">
              <span className="text-sm">{level.title}</span>
              <span className="text-xs text-muted-foreground">
                {level.note}
              </span>
            </div>
            {/* Dải nằm trên nấc 2 — nó là chỗ nhận thao tác, không phải mặt thẻ */}
            <div className="grid gap-1 rounded-lg bg-muted p-2">
              {LANE_KINDS.map((kind, index) => {
                const paint = level.paint(kind.hue, skin);
                return (
                  <div key={kind.name} className="flex gap-1">
                    <div
                      className={[
                        // Khối trên dải cao 24px nên bo 3px: bo 8px ở đây ăn
                        // mất một phần ba chiều cao
                        "flex h-6 items-center rounded-[3px] px-2 text-xs whitespace-nowrap",
                        WIDTHS[index],
                      ].join(" ")}
                      style={{ background: paint.bg, color: paint.fg }}
                    >
                      {kind.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
