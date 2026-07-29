import {
  ArrowRightIcon,
  BoldIcon,
  ItalicIcon,
  PlusIcon,
  TrashIcon,
  UnderlineIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ShowcaseSection } from "@/dev/design-system/showcase-types";

const buttonSection: ShowcaseSection = {
  id: "button",
  title: "Button",
  description: "Nút bấm với 6 variant, 8 size và các trạng thái.",
  cases: [
    {
      name: "Variant",
      node: (
        <>
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </>
      ),
    },
    {
      name: "Size",
      node: (
        <>
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </>
      ),
    },
    {
      name: "Size icon",
      node: (
        <>
          <Button size="icon-xs" aria-label="Thêm">
            <PlusIcon />
          </Button>
          <Button size="icon-sm" aria-label="Thêm">
            <PlusIcon />
          </Button>
          <Button size="icon" aria-label="Thêm">
            <PlusIcon />
          </Button>
          <Button size="icon-lg" aria-label="Thêm">
            <PlusIcon />
          </Button>
        </>
      ),
    },
    {
      name: "Có icon",
      node: (
        <>
          <Button>
            <PlusIcon data-icon="inline-start" />
            Tạo mới
          </Button>
          <Button variant="secondary">
            Tiếp tục
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
          <Button variant="destructive">
            <TrashIcon data-icon="inline-start" />
            Xoá
          </Button>
        </>
      ),
    },
    {
      name: "Trạng thái",
      node: (
        <>
          <Button disabled>Disabled</Button>
          <Button variant="outline" disabled>
            Disabled outline
          </Button>
          <Button disabled>
            <Spinner />
            Đang xử lý
          </Button>
          <Button aria-invalid>Invalid</Button>
        </>
      ),
    },
    {
      name: "Render thành thẻ khác",
      node: (
        <Button nativeButton={false} render={<a href="#button">Là thẻ a</a>} />
      ),
    },
  ],
};

const buttonGroupSection: ShowcaseSection = {
  id: "button-group",
  title: "Button Group",
  description: "Gom nhiều nút thành một khối liền mạch.",
  cases: [
    {
      name: "Ngang",
      node: (
        <ButtonGroup>
          <Button variant="outline">Một</Button>
          <Button variant="outline">Hai</Button>
          <Button variant="outline">Ba</Button>
        </ButtonGroup>
      ),
    },
    {
      name: "Dọc",
      node: (
        <ButtonGroup orientation="vertical">
          <Button variant="outline">Trên</Button>
          <Button variant="outline">Giữa</Button>
          <Button variant="outline">Dưới</Button>
        </ButtonGroup>
      ),
    },
    {
      name: "Có separator và text",
      node: (
        <ButtonGroup>
          <Button variant="outline">Lưu</Button>
          <ButtonGroupSeparator />
          <ButtonGroupText>hoặc</ButtonGroupText>
          <ButtonGroupSeparator />
          <Button variant="outline" aria-label="Thêm">
            <PlusIcon />
          </Button>
        </ButtonGroup>
      ),
    },
  ],
};

const toggleSection: ShowcaseSection = {
  id: "toggle",
  title: "Toggle",
  description: "Nút hai trạng thái bật/tắt.",
  cases: [
    {
      name: "Variant",
      node: (
        <>
          <Toggle aria-label="In đậm">
            <BoldIcon />
          </Toggle>
          <Toggle variant="outline" aria-label="In nghiêng">
            <ItalicIcon />
          </Toggle>
        </>
      ),
    },
    {
      name: "Size",
      node: (
        <>
          <Toggle size="sm">Small</Toggle>
          <Toggle size="default">Default</Toggle>
          <Toggle size="lg">Large</Toggle>
        </>
      ),
    },
    {
      name: "Trạng thái",
      node: (
        <>
          <Toggle defaultPressed>Đang bật</Toggle>
          <Toggle disabled>Disabled</Toggle>
          <Toggle defaultPressed disabled>
            Bật + disabled
          </Toggle>
        </>
      ),
    },
  ],
};

const toggleGroupSection: ShowcaseSection = {
  id: "toggle-group",
  title: "Toggle Group",
  description: "Nhóm toggle chọn một hoặc nhiều giá trị.",
  cases: [
    {
      name: "Chọn một",
      node: (
        <ToggleGroup defaultValue={["left"]}>
          <ToggleGroupItem value="left">Trái</ToggleGroupItem>
          <ToggleGroupItem value="center">Giữa</ToggleGroupItem>
          <ToggleGroupItem value="right">Phải</ToggleGroupItem>
        </ToggleGroup>
      ),
    },
    {
      name: "Chọn nhiều + variant outline",
      node: (
        <ToggleGroup multiple variant="outline" defaultValue={["bold"]}>
          <ToggleGroupItem value="bold" aria-label="In đậm">
            <BoldIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="italic" aria-label="In nghiêng">
            <ItalicIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="underline" aria-label="Gạch chân">
            <UnderlineIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      ),
    },
    {
      name: "Liền khối (spacing 0) và dọc",
      node: (
        <>
          <ToggleGroup spacing={0} variant="outline" defaultValue={["day"]}>
            <ToggleGroupItem value="day">Ngày</ToggleGroupItem>
            <ToggleGroupItem value="week">Tuần</ToggleGroupItem>
            <ToggleGroupItem value="month">Tháng</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup orientation="vertical" variant="outline" size="sm">
            <ToggleGroupItem value="a">A</ToggleGroupItem>
            <ToggleGroupItem value="b">B</ToggleGroupItem>
          </ToggleGroup>
        </>
      ),
    },
  ],
};

const kbdSection: ShowcaseSection = {
  id: "kbd",
  title: "Kbd",
  description: "Hiển thị phím tắt.",
  cases: [
    { name: "Đơn lẻ", node: <Kbd>⌘</Kbd> },
    {
      name: "Tổ hợp phím",
      node: (
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>Shift</Kbd>
          <Kbd>P</Kbd>
        </KbdGroup>
      ),
    },
    {
      name: "Trong nút",
      node: (
        <Button variant="outline">
          Tìm kiếm
          <Kbd>⌘K</Kbd>
        </Button>
      ),
    },
  ],
};

const spinnerSection: ShowcaseSection = {
  id: "spinner",
  title: "Spinner",
  description: "Vòng quay báo đang tải.",
  cases: [
    {
      name: "Kích thước",
      node: (
        <>
          <Spinner className="size-3" />
          <Spinner />
          <Spinner className="size-6" />
        </>
      ),
    },
    {
      name: "Trong nút",
      node: (
        <Button disabled>
          <Spinner />
          Đang lưu
        </Button>
      ),
    },
  ],
};

export const buttonsSections: ShowcaseSection[] = [
  buttonSection,
  buttonGroupSection,
  toggleSection,
  toggleGroupSection,
  kbdSection,
  spinnerSection,
];
