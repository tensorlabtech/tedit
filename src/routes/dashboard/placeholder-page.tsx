import { HammerIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * Màn chưa dựng — chỉ nói thẳng là chưa có gì.
 *
 * Có mặt vì thanh bên đã liệt kê mấy mục này: để chúng trỏ vào chỗ không có route
 * thì bấm vào ra trang trắng, mà trang trắng thì không phân biệt được với lỗi.
 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <Card className="h-full min-h-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HammerIcon />
            </EmptyMedia>
            <EmptyTitle>Chưa dựng màn này</EmptyTitle>
            <EmptyDescription>
              Mục này đang là chỗ giữ sẵn để thấy bố cục. Chưa có gì bên trong.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}
