import { Copy, Scissors, Sparkles, Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Ô nhập là một mảng, không phải một cái khung.
 *
 * Nhãn nằm bên trái cùng hàng với ô: nhãn nằm trên ô tốn hai dòng cho mỗi
 * trường, và phần lớn cảm giác "thưa" đến từ đó chứ không từ đệm.
 */

const FIELDS = [
  { label: "Tên dự án", value: "Dự án 31/7" },
  { label: "Đang gõ", value: "TensorLab", focused: true },
  { label: "Khoá", value: "không sửa được", disabled: true },
];

export function InputPanel() {
  return (
    <Card className="col-span-12 lg:col-span-6">
      <CardHeader>
        <CardTitle>Ô nhập</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {FIELDS.map((field) => (
          <div key={field.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm text-muted-foreground">
              {field.label}
            </span>
            <div
              className={[
                "flex h-9 flex-1 items-center rounded-md bg-muted px-3 text-sm",
                // Đang gõ = LÊN NẤC, không phải mọc thêm vòng sáng. Vòng sáng
                // lúc focus là cùng một thứ với viền, chỉ dày hơn và có màu:
                // nó vẽ lại đúng cái khung mà cả bộ luật này đang bỏ.
                // Nấc 4 cao hơn hover một nấc nên "đang trỏ vào" và "đang gõ"
                // vẫn tách được nhau.
                field.focused && "bg-[var(--accent-active)]",
                field.disabled && "text-muted-foreground opacity-60",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {field.value}
              {field.focused && (
                // Con trỏ nhấp nháy làm việc mà vòng sáng đang làm: chỉ ra đúng
                // chỗ chữ sắp hiện ra.
                <span className="ml-px h-4 w-px animate-pulse bg-foreground" />
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const TOOLS = [
  { icon: Copy, label: "Nhân đôi" },
  { icon: Scissors, label: "Cắt" },
  { icon: Sparkles, label: "Hiệu ứng" },
  { icon: Layers, label: "Lớp" },
];

/**
 * Nút: trần, nền nấc 2, hay đặc màu chủ đạo — cả ba đều dùng được.
 *
 * Nút KHÔNG lẫn với ô nhập kể cả khi cùng nền nấc 2, vì chúng khác nhau ở hai
 * chỗ mắt bắt trước cả màu: nút ôm sát chữ và chữ căn giữa, ô nhập kéo hết bề
 * ngang và chữ căn trái.
 *
 * Cái phải bỏ là `variant="outline"`, và lý do không phải "nhầm với ô nhập" —
 * mà là viền không còn chỗ trong hệ thống này: luật 2 chỉ cho viền sống khi hai
 * thứ cùng độ sáng đứng cạnh nhau, còn nút nằm trên mặt thẻ thì luôn có nền để
 * dùng.
 *
 * Chọn dạng nào theo mật độ: thanh nhiều icon → trần, không thì cả thanh thành
 * một dãy ô xám. Nút có chữ đứng riêng → nền nấc 2.
 */
export function ButtonPanel() {
  return (
    <Card className="col-span-12 lg:col-span-6">
      <CardHeader>
        <CardTitle>Nút</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <span className="text-xs text-muted-foreground">
            Thanh nhiều icon → trần
          </span>
          <div className="flex items-center gap-1">
            {TOOLS.map((tool) => (
              <button
                key={tool.label}
                type="button"
                aria-label={tool.label}
                className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <tool.icon className="size-4" />
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <span className="text-xs text-muted-foreground">
            Nút có chữ → nền nấc 2 · việc chính → đặc màu chủ đạo
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="flex h-9 items-center rounded-md bg-muted px-3 text-sm hover:bg-accent"
            >
              Huỷ
            </button>
            <button
              type="button"
              className="flex h-9 items-center rounded-md bg-muted px-3 text-sm hover:bg-accent"
            >
              Lưu nháp
            </button>
            <Button className="h-9">Xuất video</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
