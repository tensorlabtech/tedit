import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme, type Theme } from "@/hooks/use-theme";

const options: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: "light", label: "Sáng", icon: SunIcon },
  { value: "dark", label: "Tối", icon: MoonIcon },
  { value: "system", label: "Hệ thống", icon: MonitorIcon },
];

// Nút đổi giao diện: sáng / tối / theo hệ điều hành
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      value={[theme]}
      onValueChange={(value: string[]) => {
        const next = value[0] as Theme | undefined;
        if (next) {
          setTheme(next);
        }
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={`Giao diện ${option.label.toLowerCase()}`}
        >
          <option.icon data-icon="inline-start" />
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * Bản MỘT NÚT của thứ ở trên: icon của chế độ đang dùng, bấm ra danh sách ba mục.
 *
 * Có mặt vì bản dải ba nút chiếm gần hết bề ngang thanh bên (16rem) — nó biến một
 * cài đặt phụ thành thứ to nhất trong khung, và tới lúc thanh bên thu về dạng icon
 * thì không còn chỗ mà đứng.
 *
 * Vẫn là ba lựa chọn chứ không phải cái công tắc sáng/tối hai trạng thái: "Hệ
 * thống" là mặc định của dự án, mà một công tắc hai chiều thì không diễn đạt được
 * "theo máy" — bấm một lần là ghim cứng mãi mãi.
 */
export function ThemeToggleIcon() {
  const { theme, setTheme } = useTheme();
  const active = options.find((option) => option.value === theme) ?? options[2];

  return (
    <DropdownMenu>
      {/* Tooltip phải bọc TỪ NGOÀI, không để `Button` tự dựng.
          `Button` với `size="icon*"` vốn tự bọc mình trong một tooltip, nhưng khi
          `DropdownMenuTrigger` nhận nó qua `render` thì hai trigger cùng gộp lên
          một thẻ và trigger của dropdown thắng — đo trong DOM: `data-slot` ra
          `dropdown-menu-trigger`, còn `tooltip-trigger` biến mất hoàn toàn, nên
          nút này chưa từng có chú giải nào.
          `tooltip={false}` để `Button` khỏi dựng thêm một lớp nữa.

          Nhãn nói chế độ ĐANG dùng, nên đứng ngoài cũng biết máy đang ở đâu mà
          không phải mở menu. */}
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  tooltip={false}
                  aria-label={`Giao diện ${active.label.toLowerCase()}`}
                />
              }
            >
              <active.icon />
            </DropdownMenuTrigger>
          }
        />
        <TooltipContent>Giao diện {active.label.toLowerCase()}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as Theme)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
