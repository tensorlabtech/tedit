import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
