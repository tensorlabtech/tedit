import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Gom nhóm bằng KẺ NGANG chạy hết bề ngang thẻ.
 *
 * Âm lề đúng bằng đệm thẻ nên đường kẻ chạm được hai mép; thụt lề thì nó đọc ra
 * như một cái gạch chân lạc chỗ chứ không như ranh giới.
 *
 * Kẻ dưới TIÊU ĐỀ thẻ nằm ở `skin-tokens.css` — áp cho mọi thẻ một lượt, chứ
 * không gõ tay ở từng nơi gọi. Đây chính là chỗ `CardSeparator` sẽ thay thế khi
 * đưa vào design system thật: `-mx-(--card-spacing) border-t` viết tay mỗi nơi
 * một kiểu là nguồn của phần lớn 123 chỗ viền tự chế trong `src/routes/`.
 */

const GROUPS = [
  {
    title: "Vị trí",
    rows: [
      ["Ngang", "120"],
      ["Dọc", "64"],
    ],
  },
  {
    title: "Cỡ",
    rows: [
      ["Rộng", "1080"],
      ["Cao", "1920"],
    ],
  },
  {
    title: "Dáng chữ",
    rows: [
      ["Cỡ chữ", "42"],
      ["Giãn dòng", "1,2"],
    ],
  },
];

/** Nhãn mờ bên trái, giá trị rõ bên phải — cùng một hàng, cùng một cỡ chữ. */
function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex h-9 min-w-20 items-center justify-end rounded-md bg-muted px-3 text-sm tabular-nums hover:bg-accent">
        {value}
      </span>
    </div>
  );
}

export function GroupingPanel() {
  return (
    <Card className="col-span-12 lg:col-span-4">
      <CardHeader>
        <CardTitle>Gom nhóm</CardTitle>
      </CardHeader>
      {/* `gap-0`: khoảng cách giữa hai nhóm KHÔNG do gap của lưới tạo ra nữa,
          mà do đệm của chính mỗi nhóm. Đó là điều kiện để đường kẻ nằm chính
          giữa: kẻ trước đây là con đầu của nhóm dưới nên nó ăn `gap` phía trên
          (20px) và `gap` trong nhóm phía dưới (8px) — lệch hơn gấp đôi. */}
      <CardContent className="grid gap-0">
        {GROUPS.map((group, index) => (
          <div
            key={group.title}
            className={[
              // Âm lề rồi trả lại bằng `px`: đường kẻ chạm được hai mép thẻ
              // trong khi chữ vẫn thụt đúng đệm thẻ.
              "-mx-(--card-spacing) grid gap-2 px-(--card-spacing) py-4",
              index > 0 && "border-t border-border",
              // Nhóm đầu và nhóm cuối không tự đệm: thẻ đã đệm sẵn ở hai đầu.
              index === 0 && "pt-0",
              index === GROUPS.length - 1 && "pb-0",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="text-xs text-muted-foreground">{group.title}</span>
            {group.rows.map(([label, value]) => (
              <FieldRow key={label} label={label} value={value} />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
