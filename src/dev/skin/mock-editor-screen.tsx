import { Play, SkipBack, SkipForward, Volume2, Maximize2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MockEditorTimeline } from "@/dev/skin/mock-editor-timeline";

/**
 * Màn editor giả — dữ liệu tĩnh, dựng để nhìn CẢ BỘ LUẬT hoạt động cùng lúc.
 *
 * Chọn editor chứ không phải upload vì nó va vào nhiều luật nhất: có vùng cuộn
 * (kẻ ngang), có dải nhiều loại (chỉ dải được đậm màu), và có khung xem trước
 * (nội dung là vật sáng, giao diện là bóng tối quanh nó).
 */

const TABS = ["Chữ trên màn", "Tư liệu chèn", "Nhạc nền"];

const SETTINGS = [
  {
    title: "Đoạn đang chọn",
    rows: [
      ["Bắt đầu", "0:52,4"],
      ["Kết thúc", "1:04,8"],
      ["Dài", "12,4s"],
    ],
  },
  {
    title: "Dáng chữ",
    rows: [
      ["Bộ dáng", "Gõ Mạnh"],
      ["Cỡ chữ", "42"],
      ["Giãn dòng", "1,2"],
    ],
  },
  {
    title: "Hiện ra",
    rows: [
      ["Kiểu", "Một tiếng một"],
      ["Nhịp", "nhanh"],
    ],
  },
  {
    title: "Nhạc nền",
    rows: [
      ["Bài", "Đường phố · mạnh"],
      ["Âm lượng", "-18 dB"],
    ],
  },
];

export function MockEditorScreen() {
  const [tab, setTab] = useState(0);

  return (
    <div className="col-span-12 grid gap-2">
      {/* Thanh trên — tab đổi màu chữ, một nút chính duy nhất có mảng nền */}
      <Card size="sm">
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex gap-1">
            {TABS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setTab(index)}
                className={[
                  "border-b-2 px-3 py-2 text-sm",
                  index === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
          <Button className="h-9">Xuất video</Button>
        </CardContent>
      </Card>

      <div className="grid gap-2 lg:grid-cols-12">
        {/* Bảng chỉnh — nhóm bằng kẻ ngang, mỗi nhóm tự đệm đều hai đầu nên
            đường kẻ nằm chính giữa. Cùng cấu trúc với thẻ "Gom nhóm". */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Bảng sửa</CardTitle>
          </CardHeader>
          <CardContent className="no-scrollbar grid max-h-96 gap-0 overflow-y-auto">
            {SETTINGS.map((group, index) => (
              <div
                key={group.title}
                className={[
                  "-mx-(--card-spacing) grid gap-2 px-(--card-spacing) py-4",
                  index > 0 && "border-t border-border",
                  index === 0 && "pt-0",
                  index === SETTINGS.length - 1 && "pb-0",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="text-xs text-muted-foreground">
                  {group.title}
                </span>
                {group.rows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                      {label}
                    </span>
                    <span className="flex h-9 min-w-20 items-center justify-end rounded-md bg-muted px-3 text-sm tabular-nums hover:bg-accent">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Xem trước — chỗ SÁNG NHẤT màn. Khung hình không nằm trong thang nấc:
            nó là vật đặt lên bàn, không phải một tầng của cái bàn. */}
        <Card className="lg:col-span-9">
          <CardContent className="grid gap-3">
            <div className="relative grid aspect-video place-items-center overflow-hidden rounded-lg bg-[oklch(0.82_0.01_310)]">
              <div className="grid gap-1 text-center">
                <span className="text-3xl font-medium tracking-tight text-[oklch(0.99_0_0)]">
                  SOPRA STUDIO
                </span>
                <span className="font-mono text-[0.65rem] tracking-widest text-[oklch(0.99_0_0)]">
                  LOU NADAL · DIRECTEUR ARTISTIQUE · PARIS 75000
                </span>
              </div>
              {/* Thanh chạy nằm TRÊN khung hình, dùng màu chủ đạo */}
              <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
                <span className="rounded bg-[oklch(0.145_0_0/60%)] px-1.5 py-0.5 font-mono text-[0.65rem] tabular-nums text-[oklch(0.99_0_0)]">
                  00:07:21
                </span>
                <div className="h-0.5 flex-1 rounded-full bg-[oklch(0.99_0_0/35%)]">
                  <div className="h-full w-[43%] rounded-full bg-primary" />
                </div>
              </div>
            </div>

            {/* Nút phát: icon trần, không viền không nền — việc phụ */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Soprastudio_Commercial.mp4
              </span>
              <div className="flex items-center gap-1">
                {[SkipBack, Play, SkipForward].map((Icon, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label="Điều khiển phát"
                    className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {[Volume2, Maximize2].map((Icon, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label="Âm lượng và toàn màn"
                    className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <MockEditorTimeline />
        </CardContent>
      </Card>
    </div>
  );
}
