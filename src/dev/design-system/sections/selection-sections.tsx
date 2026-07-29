import { useState } from "react";
import { CalendarIcon, SettingsIcon, UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ShowcaseSection } from "@/dev/design-system/showcase-types";

const fruits = ["Xoài", "Chuối", "Vải", "Nhãn", "Sầu riêng", "Măng cụt"];

const selectSection: ShowcaseSection = {
  id: "select",
  title: "Select",
  description: "Danh sách chọn có popup, hỗ trợ nhóm và trạng thái.",
  cases: [
    {
      name: "Cơ bản",
      node: (
        <Select>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Chọn thành phố" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hn">Hà Nội</SelectItem>
            <SelectItem value="hcm">TP. Hồ Chí Minh</SelectItem>
            <SelectItem value="dn">Đà Nẵng</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      name: "Nhóm, nhãn và dấu ngăn",
      node: (
        <Select
          defaultValue="react"
          items={{ react: "React", vue: "Vue", nest: "NestJS", go: "Go" }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Frontend</SelectLabel>
              <SelectItem value="react">React</SelectItem>
              <SelectItem value="vue">Vue</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Backend</SelectLabel>
              <SelectItem value="nest">NestJS</SelectItem>
              <SelectItem value="go">Go</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      ),
    },
    {
      name: "Size sm và trạng thái",
      node: (
        <>
          <Select defaultValue="a" items={{ a: "Nhỏ gọn", b: "Lựa chọn khác" }}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Nhỏ gọn</SelectItem>
              <SelectItem value="b">Lựa chọn khác</SelectItem>
            </SelectContent>
          </Select>
          <Select disabled>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Disabled" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">A</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger aria-invalid className="w-36">
              <SelectValue placeholder="Chưa chọn" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">A</SelectItem>
            </SelectContent>
          </Select>
        </>
      ),
    },
  ],
};

const comboboxSection: ShowcaseSection = {
  id: "combobox",
  title: "Combobox",
  description: "Ô nhập kèm gợi ý, lọc theo từ khoá.",
  cases: [
    {
      name: "Cơ bản",
      node: (
        <Combobox items={fruits}>
          <ComboboxInput placeholder="Chọn loại quả" className="w-56" />
          <ComboboxContent>
            <ComboboxEmpty>Không tìm thấy kết quả.</ComboboxEmpty>
            <ComboboxList>
              {(fruit: string) => (
                <ComboboxItem key={fruit} value={fruit}>
                  {fruit}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      ),
    },
    {
      name: "Có nhóm và nút xoá",
      node: (
        <Combobox items={fruits} defaultValue="Xoài">
          <ComboboxInput
            showClear
            placeholder="Tìm loại quả"
            className="w-56"
          />
          <ComboboxContent>
            <ComboboxEmpty>Không tìm thấy kết quả.</ComboboxEmpty>
            <ComboboxList>
              <ComboboxGroup>
                <ComboboxLabel>Trái cây</ComboboxLabel>
                {fruits.map((fruit) => (
                  <ComboboxItem key={fruit} value={fruit}>
                    {fruit}
                  </ComboboxItem>
                ))}
              </ComboboxGroup>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      ),
    },
  ],
};

function CommandDialogDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Mở bảng lệnh
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Gõ lệnh hoặc tìm kiếm..." />
          <CommandList>
            <CommandEmpty>Không có kết quả.</CommandEmpty>
            <CommandGroup heading="Gợi ý">
              <CommandItem>
                <CalendarIcon />
                Lịch làm việc
              </CommandItem>
              <CommandItem>
                <UserIcon />
                Hồ sơ
                <CommandShortcut>⌘P</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

const commandSection: ShowcaseSection = {
  id: "command",
  title: "Command",
  description: "Bảng lệnh tìm kiếm nhanh, dùng trực tiếp hoặc trong dialog.",
  cases: [
    {
      name: "Nhúng trực tiếp",
      node: (
        <Command className="w-80 rounded-lg bg-popover ring-1 ring-foreground/10">
          <CommandInput placeholder="Tìm kiếm..." />
          <CommandList>
            <CommandEmpty>Không có kết quả.</CommandEmpty>
            <CommandGroup heading="Gợi ý">
              <CommandItem>
                <CalendarIcon />
                Lịch làm việc
              </CommandItem>
              <CommandItem>
                <UserIcon />
                Hồ sơ
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Thiết lập">
              <CommandItem>
                <SettingsIcon />
                Cài đặt
                <CommandShortcut>⌘,</CommandShortcut>
              </CommandItem>
              <CommandItem disabled>Mục bị khoá</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      ),
    },
    { name: "Trong dialog", node: <CommandDialogDemo /> },
  ],
};

export const selectionSections: ShowcaseSection[] = [
  selectSection,
  comboboxSection,
  commandSection,
];
