import { InfoIcon, TrashIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ShowcaseSection } from "@/dev/design-system/showcase-types";

const dialogSection: ShowcaseSection = {
  id: "dialog",
  title: "Dialog",
  description: "Hộp thoại chặn thao tác, dùng cho biểu mẫu ngắn.",
  cases: [
    {
      name: "Có biểu mẫu",
      node: (
        <Dialog>
          <DialogTrigger
            render={<Button variant="outline">Sửa hồ sơ</Button>}
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Sửa hồ sơ</DialogTitle>
              <DialogDescription>
                Thay đổi thông tin hiển thị công khai của bạn.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 px-5">
              <Label htmlFor="demo-dialog-name">Tên</Label>
              <Input id="demo-dialog-name" defaultValue="Nguyễn Văn A" />
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="secondary">Huỷ</Button>} />
              <Button>Lưu</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ),
    },
    {
      name: "Không có nút đóng",
      node: (
        <Dialog>
          <DialogTrigger
            render={<Button variant="outline">Thông báo</Button>}
          />
          <DialogContent showCloseButton={false} className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Đã cập nhật</DialogTitle>
              <DialogDescription>Phiên bản mới đã sẵn sàng.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button>Đã hiểu</Button>} />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ),
    },
  ],
};

const alertDialogSection: ShowcaseSection = {
  id: "alert-dialog",
  title: "Alert Dialog",
  description: "Hộp thoại xác nhận cho hành động không hoàn tác được.",
  cases: [
    {
      name: "Xác nhận xoá",
      node: (
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="destructive">Xoá dự án</Button>}
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xoá dự án này?</AlertDialogTitle>
              <AlertDialogDescription>
                Hành động này không thể hoàn tác. Toàn bộ dữ liệu sẽ bị xoá vĩnh
                viễn.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Huỷ</AlertDialogCancel>
              <AlertDialogAction>Xoá</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
    },
    {
      name: "Có icon minh hoạ",
      node: (
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="outline">Dọn thùng rác</Button>}
          />
          <AlertDialogContent>
            <AlertDialogMedia>
              <TrashIcon />
            </AlertDialogMedia>
            <AlertDialogHeader>
              <AlertDialogTitle>Dọn toàn bộ thùng rác?</AlertDialogTitle>
              <AlertDialogDescription>
                12 tệp trong thùng rác sẽ bị xoá ngay lập tức.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Để sau</AlertDialogCancel>
              <AlertDialogAction>Dọn ngay</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
    },
  ],
};

const sheetSection: ShowcaseSection = {
  id: "sheet",
  title: "Sheet",
  description: "Bảng trượt từ cạnh màn hình, mở được ở cả bốn hướng.",
  cases: [
    {
      name: "Bốn hướng",
      node: (
        <>
          {(["right", "left", "top", "bottom"] as const).map((side) => (
            <Sheet key={side}>
              <SheetTrigger
                render={<Button variant="outline">{side}</Button>}
              />
              <SheetContent side={side}>
                <SheetHeader>
                  <SheetTitle>Bảng trượt {side}</SheetTitle>
                  <SheetDescription>
                    Nội dung phụ, không rời khỏi trang hiện tại.
                  </SheetDescription>
                </SheetHeader>
                <SheetFooter>
                  <SheetClose
                    render={<Button variant="secondary">Đóng</Button>}
                  />
                </SheetFooter>
              </SheetContent>
            </Sheet>
          ))}
        </>
      ),
    },
  ],
};

const drawerSection: ShowcaseSection = {
  id: "drawer",
  title: "Drawer",
  description: "Ngăn kéo kéo-vuốt, hợp với thao tác trên di động.",
  cases: [
    {
      name: "Cơ bản",
      node: (
        <Drawer>
          <DrawerTrigger
            render={<Button variant="outline">Mở ngăn kéo</Button>}
          />
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Bộ lọc</DrawerTitle>
              <DrawerDescription>
                Chọn tiêu chí để lọc danh sách.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <Button>Áp dụng</Button>
              <DrawerClose render={<Button variant="secondary">Đóng</Button>} />
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ),
    },
    {
      name: "Có tay nắm vuốt",
      node: (
        <Drawer showSwipeHandle>
          <DrawerTrigger
            render={<Button variant="outline">Có tay nắm</Button>}
          />
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Kéo để đóng</DrawerTitle>
              <DrawerDescription>
                Vuốt xuống để đóng ngăn kéo.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose render={<Button variant="secondary">Đóng</Button>} />
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ),
    },
  ],
};

const popoverSection: ShowcaseSection = {
  id: "popover",
  title: "Popover",
  description: "Bảng nổi neo theo phần tử, chứa nội dung tương tác.",
  cases: [
    {
      name: "Cơ bản",
      node: (
        <Popover>
          <PopoverTrigger
            render={<Button variant="outline">Mở popover</Button>}
          />
          <PopoverContent className="w-72">
            <PopoverHeader>
              <PopoverTitle>Kích thước</PopoverTitle>
              <PopoverDescription>
                Đặt chiều rộng khung hiển thị.
              </PopoverDescription>
            </PopoverHeader>
            <div className="grid gap-2">
              <Label htmlFor="demo-popover-width">Chiều rộng</Label>
              <Input id="demo-popover-width" defaultValue="1280" />
            </div>
          </PopoverContent>
        </Popover>
      ),
    },
    {
      name: "Đổi hướng hiển thị",
      node: (
        <>
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <Popover key={side}>
              <PopoverTrigger
                render={<Button variant="secondary">{side}</Button>}
              />
              <PopoverContent side={side} className="w-40">
                Hiển thị phía {side}.
              </PopoverContent>
            </Popover>
          ))}
        </>
      ),
    },
  ],
};

const hoverCardSection: ShowcaseSection = {
  id: "hover-card",
  title: "Hover Card",
  description: "Thẻ xem trước khi rê chuột.",
  cases: [
    {
      name: "Xem trước hồ sơ",
      node: (
        <HoverCard>
          <HoverCardTrigger render={<Button variant="link">@teddit</Button>} />
          <HoverCardContent className="w-72">
            <div className="flex gap-3">
              <Avatar>
                <AvatarFallback>TD</AvatarFallback>
              </Avatar>
              <div className="grid gap-1">
                <div className="text-sm font-medium">Teddit</div>
                <p className="text-sm text-muted-foreground">
                  Công cụ dựng video tự động từ bản ghi.
                </p>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      ),
    },
  ],
};

const tooltipSection: ShowcaseSection = {
  id: "tooltip",
  title: "Tooltip",
  description: "Chú thích ngắn khi rê chuột hoặc focus.",
  cases: [
    {
      name: "Cơ bản",
      node: (
        <Tooltip>
          <TooltipTrigger
            render={<Button variant="outline">Rê chuột vào đây</Button>}
          />
          <TooltipContent>Chú thích ngắn gọn</TooltipContent>
        </Tooltip>
      ),
    },
    {
      name: "Bốn hướng",
      node: (
        <>
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <Tooltip key={side}>
              <TooltipTrigger
                render={
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label={side}
                    tooltip={false}
                  >
                    <InfoIcon />
                  </Button>
                }
              />
              <TooltipContent side={side}>Phía {side}</TooltipContent>
            </Tooltip>
          ))}
        </>
      ),
    },
    {
      name: "Kèm phím tắt",
      node: (
        <Tooltip>
          <TooltipTrigger render={<Button variant="outline">Lưu</Button>} />
          <TooltipContent>
            Lưu thay đổi
            <Kbd>⌘S</Kbd>
          </TooltipContent>
        </Tooltip>
      ),
    },
  ],
};

export const overlaySections: ShowcaseSection[] = [
  dialogSection,
  alertDialogSection,
  sheetSection,
  drawerSection,
  popoverSection,
  hoverCardSection,
  tooltipSection,
];
