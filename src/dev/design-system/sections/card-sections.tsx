import { MoreHorizontalIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import type { ShowcaseSection } from "@/dev/design-system/showcase-types";

// Ảnh mẫu dạng data URI để demo không phụ thuộc mạng
const sampleImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='140'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23d4d4d4'/%3E%3Cstop offset='1' stop-color='%23a3a3a3'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='320' height='140' fill='url(%23g)'/%3E%3C/svg%3E";

const cardSection: ShowcaseSection = {
  id: "card",
  title: "Card",
  description:
    "Thẻ gom nhóm nội dung. Các phần: header (title, action), content, footer; hai size; nhận ảnh ở đầu hoặc cuối thẻ. Tiêu đề chỉ là TÊN — không phụ đề, không ghi chú, không số liệu; những thứ đó thuộc về thân thẻ hoặc huy hiệu ở góc phải. Tiêu đề cao đúng bằng một nút nên mốc chữ không xê dịch khi thêm hay bớt hành động.",
  cases: [
    {
      name: "Đầy đủ thành phần",
      node: (
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Bản dựng tháng 7</CardTitle>
            <CardAction>
              <Button variant="ghost" size="icon-sm" aria-label="Thêm bản dựng">
                <PlusIcon />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Thời lượng trung bình 3 phút 20 giây mỗi video.
            </p>
          </CardContent>
          <CardFooter>
            <Button>Xem chi tiết</Button>
          </CardFooter>
        </Card>
      ),
    },
    {
      name: "Chỉ tiêu đề và nội dung",
      node: (
        <Card className="w-64">
          <CardHeader>
            <CardTitle>Dung lượng</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">48,2 GB</div>
          </CardContent>
        </Card>
      ),
    },
    {
      name: "Chỉ có tiêu đề",
      node: (
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Hàng chờ render</CardTitle>
          </CardHeader>
        </Card>
      ),
    },
    {
      name: "Chỉ có nội dung",
      node: (
        <Card className="w-64">
          <CardContent>
            Thẻ không có header, dùng khi nội dung tự nói lên ý nghĩa.
          </CardContent>
        </Card>
      ),
    },
    {
      name: "Ba kiểu hành động ở góc phải",
      node: (
        <div className="flex flex-wrap gap-3">
          <Card className="w-64">
            <CardHeader>
              <CardTitle>Nút icon</CardTitle>
              <CardAction>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Thao tác khác"
                >
                  <MoreHorizontalIcon />
                </Button>
              </CardAction>
            </CardHeader>
          </Card>
          <Card className="w-64">
            <CardHeader>
              <CardTitle>Công tắc</CardTitle>
              <CardAction>
                <Switch defaultChecked />
              </CardAction>
            </CardHeader>
          </Card>
          <Card className="w-64">
            <CardHeader>
              <CardTitle>Huy hiệu</CardTitle>
              <CardAction>
                <Badge variant="secondary">Pro</Badge>
              </CardAction>
            </CardHeader>
          </Card>
        </div>
      ),
    },
    {
      name: "Header có đường kẻ",
      node: (
        <Card className="w-80">
          <CardHeader className="border-b">
            <CardTitle>Nhật ký hoạt động</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-muted-foreground">
            <span>09:12 — bắt đầu render</span>
            <span>09:15 — ghép nhạc nền</span>
            <span>09:17 — hoàn tất</span>
          </CardContent>
        </Card>
      ),
    },
    {
      name: "Size sm so với default",
      node: (
        <div className="flex flex-wrap items-start gap-3">
          <Card size="sm" className="w-64">
            <CardHeader>
              <CardTitle>size = sm</CardTitle>
            </CardHeader>
            <CardContent>Dùng cho danh sách thẻ dày đặc.</CardContent>
            <CardFooter>
              <Button size="sm">Mở</Button>
            </CardFooter>
          </Card>
          <Card className="w-64">
            <CardHeader>
              <CardTitle>size = default</CardTitle>
            </CardHeader>
            <CardContent>Dùng cho khối nội dung chính.</CardContent>
            <CardFooter>
              <Button>Mở</Button>
            </CardFooter>
          </Card>
        </div>
      ),
    },
    {
      name: "Ảnh trên đầu thẻ",
      node: (
        <Card className="w-72">
          <img src={sampleImage} alt="Ảnh minh hoạ bản dựng" />
          <CardHeader>
            <CardTitle>Tập 14 — Hậu trường</CardTitle>
          </CardHeader>
        </Card>
      ),
    },
    {
      name: "Ảnh cuối thẻ",
      node: (
        <Card className="w-72">
          <CardHeader>
            <CardTitle>Xem trước khung hình</CardTitle>
          </CardHeader>
          <img src={sampleImage} alt="Khung hình xem trước" />
        </Card>
      ),
    },
    {
      name: "Footer nhiều nút, căn phải",
      node: (
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Xoá bản dựng</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Thao tác này không thể hoàn tác.
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="secondary">Huỷ</Button>
            <Button variant="destructive">Xoá</Button>
          </CardFooter>
        </Card>
      ),
    },
    {
      name: "Thẻ chứa biểu mẫu",
      node: (
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Đăng nhập</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Field>
              <FieldLabel htmlFor="demo-card-email">Email</FieldLabel>
              <Input
                id="demo-card-email"
                type="email"
                placeholder="ban@teddit.vn"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="demo-card-password">Mật khẩu</FieldLabel>
              <Input id="demo-card-password" type="password" />
            </Field>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Đăng nhập</Button>
          </CardFooter>
        </Card>
      ),
    },
    {
      name: "Thẻ chứa danh sách",
      node: (
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Bản dựng gần đây</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm">
                Xem tất cả
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ItemGroup>
              <Item size="sm">
                <ItemContent>
                  <ItemTitle>Tập 12</ItemTitle>
                  <ItemDescription>Hoàn tất · 3:20</ItemDescription>
                </ItemContent>
              </Item>
              <ItemSeparator />
              <Item size="sm">
                <ItemContent>
                  <ItemTitle>Tập 13</ItemTitle>
                  <ItemDescription>Đang dựng · 2:45</ItemDescription>
                </ItemContent>
              </Item>
            </ItemGroup>
          </CardContent>
        </Card>
      ),
    },
    {
      name: "Tiêu đề dài, chữ tự xuống dòng",
      node: (
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Ghi chú bàn giao cho ca trực đêm nay</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Máy render số 2 đang chạy hàng chờ tồn từ chiều, dự kiến xong lúc
            23:40. Nếu tác vụ treo quá 20 phút thì khởi động lại tiến trình và
            báo lại nhóm kỹ thuật.
          </CardContent>
          <CardFooter className="justify-between">
            <span className="text-muted-foreground">Cập nhật 21:05</span>
            <Button size="sm">Đã đọc</Button>
          </CardFooter>
        </Card>
      ),
    },
    {
      name: "Lưới nhiều thẻ ngang hàng",
      node: (
        <div className="grid w-full gap-3 sm:grid-cols-3">
          {[
            { title: "Video đã xuất", value: "128" },
            { title: "Đang xử lý", value: "4" },
            { title: "Lỗi render", value: "1" },
          ].map((stat) => (
            <Card key={stat.title}>
              <CardHeader>
                <CardTitle>{stat.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-medium">
                {stat.value}
              </CardContent>
            </Card>
          ))}
        </div>
      ),
    },
  ],
};

export const cardSections: ShowcaseSection[] = [cardSection];
