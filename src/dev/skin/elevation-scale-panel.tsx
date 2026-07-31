import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Năm nấc sáng, bày ra kèm NGHĨA của từng nấc.
 *
 * Bày cả nghĩa chứ không chỉ bày màu, vì thang này chỉ có giá trị khi mỗi nấc
 * nói đúng một điều. Hai nấc cùng nói "một khối nào đó" là thang hỏng — đó
 * chính là chỗ bản đang chạy hỏng: `muted` `secondary` `accent` chênh nhau
 * 1–1,7%, mắt gộp chúng làm một.
 */
const STEPS = [
  {
    index: 0,
    role: "nền trang",
    note: "thứ không đụng vào được",
    dark: "0.115",
    light: "0.925",
  },
  {
    index: 1,
    role: "mặt thẻ",
    note: "mặt bàn làm việc",
    dark: "0.195",
    light: "0.99",
  },
  {
    index: 2,
    role: "chỗ nhận thao tác",
    note: "ô nhập · mục danh sách · khối trên dải",
    dark: "0.245",
    light: "0.955",
  },
  {
    index: 3,
    role: "đang trỏ vào",
    note: "hover",
    dark: "0.275",
    light: "0.93",
  },
  {
    index: 4,
    role: "đang nhấn / đang gõ",
    note: "ô đang gõ · nút đang bị nhấn",
    dark: "0.305",
    light: "0.905",
  },
];

export function ElevationScalePanel({ skin }: { skin: "dark" | "light" }) {
  return (
    <Card className="col-span-12">
      <CardHeader>
        <CardTitle>Thang 5 nấc</CardTitle>
        <CardAction>
          <span className="text-xs text-muted-foreground">
            {skin === "dark"
              ? "nền tối · nền trang cách 8%, trong thẻ cách đều 5%"
              : "nền sáng · mặt thẻ vọt lên rồi trong thẻ đi xuống ~3%"}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        {/* Năm ô LIỀN NHAU, không khe.
            Có khe thì nấc 1 biến mất ở bản sáng — nó đúng bằng màu mặt thẻ nên
            nằm trên thẻ là vô hình. Thêm viền để thấy thì bảng đo lại đi ngược
            chính cái luật nó đang minh hoạ.
            Xếp liền thì mỗi nấc luôn có hai nấc kề bên làm mốc, và ranh giới
            hiện ra không cần một đường kẻ nào — đó cũng đúng là điều cả bộ luật
            này khẳng định. */}
        <div className="grid overflow-hidden rounded-lg sm:grid-cols-3 lg:grid-cols-5">
          {STEPS.map((step) => (
            <div
              key={step.index}
              className="h-20"
              style={{ background: `var(--step-${step.index})` }}
            />
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {STEPS.map((step) => (
            <div key={step.index}>
              <div className="grid gap-0.5">
                <span className="text-xs text-muted-foreground">
                  nấc {step.index}
                </span>
                <span className="text-sm">{step.role}</span>
                <span className="text-xs text-muted-foreground">
                  {step.note}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {skin === "dark" ? step.dark : step.light}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
