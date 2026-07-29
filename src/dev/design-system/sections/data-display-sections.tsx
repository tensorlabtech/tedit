import {
  FileTextIcon,
  FileVideoIcon,
  FolderIcon,
  InboxIcon,
  PlusIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ShowcaseSection } from "@/dev/design-system/showcase-types";

const tableSection: ShowcaseSection = {
  id: "table",
  title: "Table",
  description: "Bảng dữ liệu với đầu bảng, chân bảng và chú thích.",
  cases: [
    {
      name: "Đầy đủ",
      node: (
        <Table className="w-96">
          <TableCaption>Danh sách bản dựng gần đây.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thời lượng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { name: "Tập 12", status: "Hoàn tất", duration: "3:20" },
              { name: "Tập 13", status: "Đang dựng", duration: "2:45" },
              { name: "Tập 14", status: "Nháp", duration: "—" },
            ].map((row) => (
              <TableRow key={row.name}>
                <TableCell>{row.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{row.status}</Badge>
                </TableCell>
                <TableCell className="text-right">{row.duration}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Tổng</TableCell>
              <TableCell className="text-right">6:05</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      ),
    },
  ],
};

const itemSection: ShowcaseSection = {
  id: "item",
  title: "Item",
  description: "Một dòng danh sách: ảnh/icon, nội dung và hành động.",
  cases: [
    {
      name: "Variant",
      node: (
        <div className="grid w-80 gap-3">
          {(["default", "outline", "muted"] as const).map((variant) => (
            <Item key={variant} variant={variant}>
              <ItemMedia variant="icon">
                <FolderIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Thư mục dự án</ItemTitle>
                <ItemDescription>variant = {variant}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="ghost" size="sm">
                  Mở
                </Button>
              </ItemActions>
            </Item>
          ))}
        </div>
      ),
    },
    {
      name: "Size",
      node: (
        <div className="grid w-80 gap-3">
          {(["default", "sm", "xs"] as const).map((size) => (
            <Item key={size} variant="outline" size={size}>
              <ItemMedia variant="icon">
                <FileTextIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>size = {size}</ItemTitle>
              </ItemContent>
            </Item>
          ))}
        </div>
      ),
    },
    {
      name: "Ô ảnh",
      node: (
        <div className="grid w-80 gap-3">
          {(["image", "preview"] as const).map((variant) => (
            <Item key={variant} variant="outline" size="sm">
              <ItemMedia variant={variant}>
                <FileVideoIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>variant = {variant}</ItemTitle>
                <ItemDescription>
                  {variant === "image"
                    ? "Ảnh đại diện cỡ dòng chữ, co theo size của hàng"
                    : "Ảnh xem trước tệp media — cỡ cố định, nhìn ra được cảnh"}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </div>
      ),
    },
    {
      name: "Nhóm có dấu ngăn",
      node: (
        <ItemGroup className="w-80 rounded-xl border border-border bg-card">
          <Item>
            <ItemContent>
              <ItemTitle>Bản dựng 01</ItemTitle>
              <ItemDescription>Cập nhật 2 giờ trước</ItemDescription>
            </ItemContent>
          </Item>
          <ItemSeparator />
          <Item>
            <ItemContent>
              <ItemTitle>Bản dựng 02</ItemTitle>
              <ItemDescription>Cập nhật hôm qua</ItemDescription>
            </ItemContent>
          </Item>
        </ItemGroup>
      ),
    },
  ],
};

const emptySection: ShowcaseSection = {
  id: "empty",
  title: "Empty",
  description: "Trạng thái rỗng khi chưa có dữ liệu.",
  cases: [
    {
      name: "Có icon và hành động",
      node: (
        <Empty className="w-80 rounded-xl border border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>Chưa có bản dựng nào</EmptyTitle>
            <EmptyDescription>
              Tạo bản dựng đầu tiên để bắt đầu làm việc.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button>
              <PlusIcon data-icon="inline-start" />
              Tạo bản dựng
            </Button>
          </EmptyContent>
        </Empty>
      ),
    },
    {
      name: "Chỉ chữ",
      node: (
        <Empty className="w-80 rounded-xl border border-border bg-card">
          <EmptyHeader>
            <EmptyTitle>Không tìm thấy kết quả</EmptyTitle>
            <EmptyDescription>Thử từ khoá khác xem sao.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ),
    },
  ],
};

export const dataDisplaySections: ShowcaseSection[] = [
  tableSection,
  itemSection,
  emptySection,
];
