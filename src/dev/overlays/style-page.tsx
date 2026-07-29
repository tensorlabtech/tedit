import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { InsertCard } from "./insert-card";
import { OverlayPanel } from "./overlay-panel";
import { TransitionCard } from "./transition-card";

/**
 * Màn STYLE — mọi thứ được THÊM VÀO video, ở một chỗ.
 *
 * Tên cũ là "overlays" nhưng nội dung đã vượt ra ngoài lớp chữ: có tư liệu chèn, có
 * chỗ nối giữa hai đoạn. Đặt tên theo thứ hẹp nhất trong nhóm thì mỗi lần thêm loại
 * mới lại phải giải thích vì sao nó nằm ở đây.
 *
 * Luật của màn này: KHÔNG bày thứ chưa in ra được. Chọn được ở đây thì xuất video ra
 * phải thấy đúng thứ đó.
 */
export function StylePage() {
  return (
    <div className="grid min-h-svh gap-2 bg-background p-2 text-foreground">
      <Card>
        <CardHeader>
          <CardTitle>Style — những thứ thêm vào video</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Chữ trên màn · tư liệu chèn · chỗ nối giữa hai đoạn. Mọi lựa chọn ở
            đây đều in ra được thật; thứ chưa in ra được thì không có ở đây.
          </p>
        </CardContent>
      </Card>

      <OverlayPanel />
      <InsertCard />
      <TransitionCard />
    </div>
  );
}
