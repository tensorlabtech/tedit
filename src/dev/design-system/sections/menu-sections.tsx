import { useState } from "react";
import {
  LogOutIcon,
  MoreHorizontalIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import type { ShowcaseSection } from "@/dev/design-system/showcase-types";

function DropdownMenuDemo() {
  const [showStatus, setShowStatus] = useState(true);
  const [position, setPosition] = useState("bottom");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline">Tài khoản</Button>}
      />
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tài khoản của tôi</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <UserIcon />
            Hồ sơ
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <SettingsIcon />
            Cài đặt
          </DropdownMenuItem>
          <DropdownMenuItem disabled>Mục bị khoá</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={showStatus}
          onCheckedChange={setShowStatus}
        >
          Hiện trạng thái
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={position} onValueChange={setPosition}>
          <DropdownMenuRadioItem value="top">Trên</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="bottom">Dưới</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Chia sẻ</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>Sao chép liên kết</DropdownMenuItem>
            <DropdownMenuItem>Gửi email</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <LogOutIcon />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const dropdownMenuSection: ShowcaseSection = {
  id: "dropdown-menu",
  title: "Dropdown Menu",
  description: "Menu thả xuống: mục thường, chọn, radio, menu con.",
  cases: [
    { name: "Đầy đủ loại mục", node: <DropdownMenuDemo /> },
    {
      name: "Nút chỉ có icon",
      node: (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Thao tác khác">
                <MoreHorizontalIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Đổi tên</DropdownMenuItem>
            <DropdownMenuItem>Nhân bản</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Xoá</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ],
};

function ContextMenuDemo() {
  const [bordered, setBordered] = useState(true);
  const [zoom, setZoom] = useState("100");

  return (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-28 w-72 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        Bấm chuột phải vào đây
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuGroup>
          <ContextMenuLabel>Khung hình</ContextMenuLabel>
        </ContextMenuGroup>
        <ContextMenuItem>
          Quay lại
          <ContextMenuShortcut>⌘[</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled>Đi tới</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem
          checked={bordered}
          onCheckedChange={setBordered}
        >
          Hiện viền
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuRadioGroup value={zoom} onValueChange={setZoom}>
          <ContextMenuRadioItem value="100">100%</ContextMenuRadioItem>
          <ContextMenuRadioItem value="150">150%</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>Công cụ</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem>Thước</ContextMenuItem>
            <ContextMenuItem>Lưới</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}

const contextMenuSection: ShowcaseSection = {
  id: "context-menu",
  title: "Context Menu",
  description: "Menu chuột phải với đủ loại mục.",
  cases: [{ name: "Chuột phải vào vùng nội dung", node: <ContextMenuDemo /> }],
};

function MenubarDemo() {
  const [wrap, setWrap] = useState(false);

  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>Tệp</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            Tạo mới
            <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>Mở...</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Lưu</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Sửa</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Hoàn tác</MenubarItem>
          <MenubarItem>Làm lại</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Hiển thị</MenubarTrigger>
        <MenubarContent>
          <MenubarCheckboxItem checked={wrap} onCheckedChange={setWrap}>
            Ngắt dòng
          </MenubarCheckboxItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}

const menubarSection: ShowcaseSection = {
  id: "menubar",
  title: "Menubar",
  description: "Thanh menu kiểu ứng dụng desktop.",
  cases: [{ name: "Ba menu", node: <MenubarDemo /> }],
};

const navigationMenuSection: ShowcaseSection = {
  id: "navigation-menu",
  title: "Navigation Menu",
  description: "Menu điều hướng chính có bảng nội dung mở rộng.",
  cases: [
    {
      name: "Có bảng nội dung",
      node: (
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Sản phẩm</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-64 gap-1">
                  <NavigationMenuLink href="#navigation-menu">
                    Dựng video tự động
                  </NavigationMenuLink>
                  <NavigationMenuLink href="#navigation-menu">
                    Thư viện tư liệu
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Tài liệu</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-64 gap-1">
                  <NavigationMenuLink href="#navigation-menu">
                    Bắt đầu nhanh
                  </NavigationMenuLink>
                  <NavigationMenuLink href="#navigation-menu">
                    Hướng dẫn API
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      ),
    },
  ],
};

export const menuSections: ShowcaseSection[] = [
  dropdownMenuSection,
  contextMenuSection,
  menubarSection,
  navigationMenuSection,
];
