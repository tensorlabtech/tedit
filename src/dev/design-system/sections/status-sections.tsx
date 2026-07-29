import { CheckIcon, CircleAlertIcon, InfoIcon, StarIcon } from "lucide-react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { ShowcaseSection } from "@/dev/design-system/showcase-types";

const badgeSection: ShowcaseSection = {
  id: "badge",
  title: "Badge",
  description: "Nhãn trạng thái nhỏ gọn.",
  cases: [
    {
      name: "Variant",
      node: (
        <>
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="ghost">Ghost</Badge>
          <Badge variant="link">Link</Badge>
        </>
      ),
    },
    {
      name: "Kèm icon và số",
      node: (
        <>
          <Badge>
            <CheckIcon />
            Đã duyệt
          </Badge>
          <Badge variant="secondary">
            <StarIcon />
            Nổi bật
          </Badge>
          <Badge variant="destructive">3</Badge>
        </>
      ),
    },
    {
      name: "Render thành liên kết",
      node: <Badge variant="outline" render={<a href="#badge">Xem thêm</a>} />,
    },
  ],
};

const alertSection: ShowcaseSection = {
  id: "alert",
  title: "Alert",
  description: "Thông báo tại chỗ, có biến thể cảnh báo.",
  cases: [
    {
      name: "Mặc định",
      node: (
        <Alert className="w-96">
          <InfoIcon />
          <AlertTitle>Bản dựng đang chạy</AlertTitle>
          <AlertDescription>
            Quá trình render mất khoảng 5 phút cho mỗi 10 phút video.
          </AlertDescription>
        </Alert>
      ),
    },
    {
      name: "Destructive",
      node: (
        <Alert variant="destructive" className="w-96">
          <CircleAlertIcon />
          <AlertTitle>Không tải được tư liệu</AlertTitle>
          <AlertDescription>Kiểm tra lại đường dẫn tệp nguồn.</AlertDescription>
        </Alert>
      ),
    },
    {
      name: "Có nút hành động",
      node: (
        <Alert className="w-96">
          <InfoIcon />
          <AlertTitle>Có phiên bản mới</AlertTitle>
          <AlertDescription>
            Cập nhật để dùng bộ dựng mới nhất.
          </AlertDescription>
          <AlertAction>
            <Button size="sm" variant="secondary">
              Cập nhật
            </Button>
          </AlertAction>
        </Alert>
      ),
    },
    {
      name: "Chỉ tiêu đề",
      node: (
        <Alert className="w-96">
          <CheckIcon />
          <AlertTitle>Đã lưu thay đổi</AlertTitle>
        </Alert>
      ),
    },
  ],
};

const avatarSection: ShowcaseSection = {
  id: "avatar",
  title: "Avatar",
  description: "Ảnh đại diện, có size, huy hiệu và nhóm.",
  cases: [
    {
      name: "Size",
      node: (
        <>
          <Avatar size="sm">
            <AvatarFallback>SM</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>MD</AvatarFallback>
          </Avatar>
          <Avatar size="lg">
            <AvatarFallback>LG</AvatarFallback>
          </Avatar>
        </>
      ),
    },
    {
      name: "Ảnh và ảnh lỗi",
      node: (
        <>
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="shadcn" />
            <AvatarFallback>SC</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarImage src="/khong-ton-tai.png" alt="ảnh lỗi" />
            <AvatarFallback>NA</AvatarFallback>
          </Avatar>
        </>
      ),
    },
    {
      name: "Huy hiệu trạng thái",
      node: (
        <Avatar size="lg">
          <AvatarFallback>TD</AvatarFallback>
          <AvatarBadge />
        </Avatar>
      ),
    },
    {
      name: "Nhóm avatar",
      node: (
        <AvatarGroup>
          <Avatar>
            <AvatarFallback>A</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>B</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>C</AvatarFallback>
          </Avatar>
          <AvatarGroupCount>+5</AvatarGroupCount>
        </AvatarGroup>
      ),
    },
  ],
};

const progressSection: ShowcaseSection = {
  id: "progress",
  title: "Progress",
  description: "Thanh tiến trình, kèm nhãn và phần trăm.",
  cases: [
    {
      name: "Các mức",
      node: (
        <div className="grid w-72 gap-4">
          <Progress value={0} />
          <Progress value={35} />
          <Progress value={100} />
        </div>
      ),
    },
    {
      name: "Có nhãn và giá trị",
      node: (
        <Progress value={62} className="w-72">
          <ProgressLabel>Đang render</ProgressLabel>
          <ProgressValue className="ml-auto" />
        </Progress>
      ),
    },
    {
      name: "Không xác định",
      node: <Progress value={null} className="w-72" />,
    },
  ],
};

const skeletonSection: ShowcaseSection = {
  id: "skeleton",
  title: "Skeleton",
  description: "Khung xương chờ dữ liệu.",
  cases: [
    {
      name: "Khối cơ bản",
      node: (
        <div className="grid w-72 gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ),
    },
    {
      name: "Dạng thẻ hồ sơ",
      node: (
        <div className="flex w-72 items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ),
    },
  ],
};

const markerSection: ShowcaseSection = {
  id: "marker",
  title: "Marker",
  description: "Dấu mốc gắn nhãn cho một dòng nội dung.",
  cases: [
    {
      name: "Variant",
      node: (
        <div className="grid w-80 gap-4">
          {(["default", "separator", "border"] as const).map((variant) => (
            <Marker key={variant} variant={variant}>
              <MarkerIcon>
                <StarIcon />
              </MarkerIcon>
              <MarkerContent>variant = {variant}</MarkerContent>
            </Marker>
          ))}
        </div>
      ),
    },
    {
      name: "Chỉ có chữ",
      node: (
        <Marker className="w-80">
          <MarkerContent>Hôm nay</MarkerContent>
        </Marker>
      ),
    },
  ],
};

export const statusSections: ShowcaseSection[] = [
  badgeSection,
  alertSection,
  avatarSection,
  progressSection,
  skeletonSection,
  markerSection,
];
