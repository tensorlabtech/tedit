import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { DirectionProvider } from "@/components/ui/direction";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { ShowcaseSection } from "@/dev/design-system/showcase-types";

const toastSection: ShowcaseSection = {
  id: "toast",
  title: "Toast",
  description: "Thông báo nổi góc màn hình, có các loại và nút hành động.",
  cases: [
    {
      name: "Theo loại",
      node: (
        <>
          <Button
            variant="outline"
            onClick={() => toast.add({ title: "Đã lưu bản nháp" })}
          >
            Mặc định
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.add({ title: "Xuất video thành công", type: "success" })
            }
          >
            Success
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.add({ title: "Sắp hết dung lượng", type: "warning" })
            }
          >
            Warning
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.add({ title: "Render thất bại", type: "error" })
            }
          >
            Error
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.add({ title: "Đang tải tư liệu", type: "loading" })
            }
          >
            Loading
          </Button>
        </>
      ),
    },
    {
      name: "Có mô tả và hành động",
      node: (
        <Button
          onClick={() =>
            toast.add({
              title: "Đã xoá bản dựng",
              description: "Bạn có thể hoàn tác trong 10 giây.",
              type: "info",
              actionProps: { children: "Hoàn tác" },
            })
          }
        >
          Hiện toast đầy đủ
        </Button>
      ),
    },
  ],
};

const chartData = [
  { month: "T1", ban: 186, thue: 80 },
  { month: "T2", ban: 305, thue: 200 },
  { month: "T3", ban: 237, thue: 120 },
  { month: "T4", ban: 173, thue: 190 },
  { month: "T5", ban: 209, thue: 130 },
  { month: "T6", ban: 264, thue: 140 },
];

const chartConfig = {
  ban: { label: "Bán", color: "var(--chart-1)" },
  thue: { label: "Thuê", color: "var(--chart-3)" },
} satisfies ChartConfig;

const chartSection: ShowcaseSection = {
  id: "chart",
  title: "Chart",
  description: "Biểu đồ dựng trên Recharts, dùng token màu của hệ thống.",
  cases: [
    {
      name: "Cột kèm chú giải",
      node: (
        <ChartContainer config={chartConfig} className="h-56 w-96">
          <BarChart data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="ban" fill="var(--color-ban)" radius={4} />
            <Bar dataKey="thue" fill="var(--color-thue)" radius={4} />
          </BarChart>
        </ChartContainer>
      ),
    },
    {
      name: "Đường",
      node: (
        <ChartContainer config={chartConfig} className="h-56 w-96">
          <LineChart data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="ban"
              stroke="var(--color-ban)"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ChartContainer>
      ),
    },
  ],
};

const directionSection: ShowcaseSection = {
  id: "direction",
  title: "Direction",
  description: "Đổi chiều đọc của cả cụm component sang phải-qua-trái.",
  cases: [
    {
      name: "RTL",
      node: (
        <DirectionProvider direction="rtl">
          <div dir="rtl" className="flex w-72 flex-col gap-3">
            <Input placeholder="نص تجريبي" />
            <Button>زر</Button>
          </div>
        </DirectionProvider>
      ),
    },
    {
      name: "LTR (mặc định)",
      node: (
        <DirectionProvider direction="ltr">
          <div className="flex w-72 flex-col gap-3">
            <Input placeholder="Nội dung mẫu" />
            <Button>Nút</Button>
          </div>
        </DirectionProvider>
      ),
    },
  ],
};

export const feedbackSections: ShowcaseSection[] = [
  toastSection,
  chartSection,
  directionSection,
];
