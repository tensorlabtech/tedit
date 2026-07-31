import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Lời nhắn — nền pha sắc, không vệt mép, không viền.
 *
 * Alert vướng vào hai luật kéo ngược nhau: màu chỉ ở chỗ đang xảy ra (một lỗi
 * ĐÚNG LÀ chỗ đang xảy ra) nhưng chỉ dải thời gian mới được đậm màu. Lối ra là
 * nền MANG SẮC mà không đậm: đủ để liếc qua biết loại gì, không nặng tới mức
 * tranh chỗ nhấn với nút chính.
 *
 * Vệt màu mép trái đã bỏ: nó là một cái viền, chỉ dày hơn và chỉ có một cạnh.
 * Nền đã mang sắc rồi thì vệt ấy nói lại đúng điều nền vừa nói.
 */

const KINDS = [
  {
    id: "info",
    icon: Info,
    title: "Đang chép lời",
    body: "Còn khoảng 2 phút nữa.",
    hue: null,
  },
  {
    id: "success",
    icon: CircleCheck,
    title: "Xuất xong",
    body: "Video nằm ở thư mục Tải về.",
    hue: 155,
  },
  {
    id: "warning",
    icon: TriangleAlert,
    title: "Thiếu nhạc nền",
    body: "Mạch này chưa có nhạc — video sẽ chỉ có tiếng nói.",
    hue: 75,
  },
  {
    id: "error",
    icon: CircleAlert,
    title: "Không đọc được tệp",
    body: "Định dạng .wmv chưa hỗ trợ.",
    hue: 25,
  },
];

function ToneAlert({
  kind,
  skin,
}: {
  kind: (typeof KINDS)[number];
  skin: "dark" | "light";
}) {
  // Lời nhắn KHÔNG có sắc riêng thì rơi về nấc 2 — cùng một mảng như mọi chỗ
  // nhận thao tác khác, vì "đang chép lời" không phải chuyện cần đánh dấu màu.
  const background =
    kind.hue === null
      ? "var(--muted)"
      : skin === "dark"
        ? `oklch(0.245 0.028 ${kind.hue})`
        : `oklch(0.955 0.028 ${kind.hue})`;
  const tint =
    kind.hue === null
      ? undefined
      : {
          color:
            skin === "dark"
              ? `oklch(0.85 0.12 ${kind.hue})`
              : `oklch(0.45 0.15 ${kind.hue})`,
        };

  return (
    <div
      className="flex items-start gap-3 rounded-md p-3"
      style={{ background }}
    >
      <kind.icon className="mt-0.5 size-4 shrink-0" style={tint} />
      <div className="grid gap-0.5">
        <span className="text-sm" style={tint}>
          {kind.title}
        </span>
        <span className="text-sm text-muted-foreground">{kind.body}</span>
      </div>
    </div>
  );
}

export function AlertPanel({ skin }: { skin: "dark" | "light" }) {
  return (
    <Card className="col-span-12">
      <CardHeader>
        <CardTitle>Lời nhắn</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 lg:grid-cols-2">
        {KINDS.map((kind) => (
          <ToneAlert key={kind.id} kind={kind} skin={skin} />
        ))}
      </CardContent>
    </Card>
  );
}
