import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Bài kiểm cho đầu thẻ: BA THẺ khác nhau ở phần bên phải, đứng cạnh nhau.
 *
 * Đây đúng là ca mà `min-h-10` trong `card.tsx` sinh ra để chống: thẻ có nút,
 * thẻ có huy hiệu, thẻ trống — nếu đầu thẻ cao theo thứ nằm bên phải thì ba mốc
 * chữ lệch nhau trong khi ba thẻ đang nói những việc ngang hàng.
 *
 * Cách ở đây giữ nguyên kết quả ấy mà không tốn 40px: nút bị lề âm kéo cho hết
 * đóng góp chiều cao, nên cả ba đầu thẻ đều cao đúng một dòng chữ.
 *
 * Nhìn vào ba chữ "Mạch chính" · "Tư liệu" · "Nhạc nền" — chúng phải nằm trên
 * cùng một đường ngang. Lệch một pixel là cách này hỏng.
 */
export function CardHeaderPanel() {
  return (
    <>
      <Card className="col-span-12 lg:col-span-4">
        <CardHeader>
          <CardTitle>Mạch chính</CardTitle>
          <CardAction>
            {/* Nút trong đầu thẻ tối đa 32px — cao hơn là bắt đầu đẩy */}
            <button
              type="button"
              className="flex h-8 items-center rounded-md bg-muted px-3 text-sm hover:bg-accent"
            >
              Chọn video
            </button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <span className="text-sm text-muted-foreground">
            Đầu thẻ có nút.
          </span>
        </CardContent>
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <CardHeader>
          <CardTitle>Tư liệu</CardTitle>
          <CardAction>
            <Badge variant="secondary">12</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <span className="text-sm text-muted-foreground">
            Đầu thẻ có huy hiệu.
          </span>
        </CardContent>
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <CardHeader>
          <CardTitle>Nhạc nền</CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-sm text-muted-foreground">
            Đầu thẻ trống.
          </span>
        </CardContent>
      </Card>
    </>
  );
}
