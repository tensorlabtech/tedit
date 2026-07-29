import { useState } from "react";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckIcon,
  RotateCcwIcon,
} from "lucide-react";

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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * BẢN THỬ màn "Máy đang làm" — chưa nối vào dữ liệu thật.
 *
 * Đây là màn thứ ba, sau màn nạp tệp và bàn dựng. Nó sinh ra để giải ba việc mà
 * hôm nay không có chỗ nào giải:
 *
 * · Phòng chờ. Chép lời mất vài phút, mà chỗ chờ hiện tại là bàn dựng với ba cột
 *   gần như rỗng — chỗ tệ nhất để ngồi đợi.
 * · Rời đi rồi quay lại. `ProjectSummary` hôm nay không có một chữ nào về việc
 *   đang chạy, nên đóng trang là mất dấu.
 * · LÀM LẠI MỘT BƯỚC. Đây mới là phần đáng giá nhất, và nó thiếu kể cả khi chưa
 *   có AI: máy chia đoạn sai thì hiện chẳng có đường nào bảo nó làm lại.
 *
 * Màn này ĐẾM gợi ý chứ không CHỨA gợi ý. Câu "'chạm' có phải 'chọn' không" chỉ
 * trả lời được khi nghe được tiếng và thấy câu trước câu sau — bê sang một màn
 * danh sách là biến phán đoán có căn cứ thành đoán mò.
 */

type TrangThai = "xong" | "dang" | "cho" | "hong";

type Buoc = {
  ten: string;
  /** Thứ bước này ĐẺ RA — căn cứ duy nhất để quyết có làm lại hay không */
  ketQua?: string;
  trangThai: TrangThai;
  /** Vì sao hỏng — chỉ có ở bước hỏng */
  vault?: string;
  /** Làm lại được không. Bước ghép video gốc thì không có gì để làm lại khác đi */
  lamLai?: boolean;
};

const BUOC: Buoc[] = [
  { ten: "Ghép video chính", ketQua: "1:13 · 3 tệp", trangThai: "xong" },
  { ten: "Dựng dải ảnh", ketQua: "74 khung", trangThai: "xong" },
  { ten: "Tách tiếng", ketQua: "48kHz · 1:13", trangThai: "xong" },
  {
    ten: "Nghe và chép lời",
    ketQua: "232 từ · 55 câu",
    trangThai: "xong",
    lamLai: true,
  },
  { ten: "Chia đoạn", ketQua: "219 đoạn", trangThai: "xong", lamLai: true },
  { ten: "Sinh chữ trên màn", ketQua: "189 chữ", trangThai: "xong", lamLai: true },
  { ten: "Đọc lại bản chép lời", ketQua: "tìm được 7 chỗ", trangThai: "dang" },
  { ten: "Chọn từ khoá", trangThai: "cho" },
  { ten: "Tìm chỗ nên bỏ", trangThai: "cho" },
  {
    ten: "Ghép tư liệu chèn",
    trangThai: "hong",
    vault: "Chưa mô tả xong 10 tệp tư liệu",
    lamLai: true,
  },
];

const DAU: Record<TrangThai, React.ReactNode> = {
  xong: <CheckIcon className="text-primary" />,
  dang: <Spinner />,
  cho: <span className="size-1.5 rounded-full bg-muted-foreground/40" />,
  hong: <AlertTriangleIcon className="text-destructive" />,
};

export function PipelineMockPage() {
  const [chay, setChay] = useState(true);
  const goiY = 12;

  return (
    <div className="mx-auto grid max-w-3xl gap-2 p-2">
      {/* Nút bật/tắt CHỈ CÓ Ở BẢN THỬ — để xem cả hai trạng thái mà không phải
          chờ một lượt chạy thật. */}
      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        Bản thử — không nối dữ liệu thật
        <Button variant="ghost" size="sm" onClick={() => setChay((x) => !x)}>
          {chay ? "Xem lúc đã xong" : "Xem lúc đang chạy"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dự án mới</CardTitle>
          <CardAction>
            {/* Mở được NGAY khi đã có bản chép lời, không đợi hết các bước:
                người dùng vào sửa được rồi thì đừng giữ họ lại. */}
            <Button>
              Mở trình sửa
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="min-h-0">
          {/* Chặn cao đặt trên VIEWPORT, không trên gốc: gốc `ScrollArea` chỉ
              `relative`, còn viewport là `size-full` — cho `max-h` lên gốc thì
              chiều cao gốc vẫn tự do nên `h-full` của viewport nở theo nội dung
              và chẳng cắt gì. Đo được: danh sách tràn qua cả chân thẻ. */}
          <ScrollArea viewportClassName="max-h-[60vh] scroll-fade-b">
            {/* `gap-0`: danh sách kiểm thì các dòng dính nhau đọc ra là MỘT
                danh sách; chừa 10px mỗi dòng thì mười bước thành mười thẻ rời,
                và cao thêm 90px chỉ để nói cùng một điều. */}
            {/* Phải ghi đè ĐÚNG biến thể `has-data-[size=sm]:` — khoảng cách
                mặc định đến từ đó, nên `gap-0` thường không thắng nổi. */}
            <ItemGroup className="has-data-[size=sm]:gap-0">
              {BUOC.map((buoc) => {
                const trangThai: TrangThai = chay
                  ? buoc.trangThai
                  : buoc.trangThai === "hong"
                    ? "hong"
                    : "xong";
                return (
                  <Item key={buoc.ten} size="sm">
                    <ItemMedia className="w-4 justify-center">
                      {DAU[trangThai]}
                    </ItemMedia>
                    {/* MỘT dòng cho một bước, không phải hai.
                        Xếp tên trên, kết quả dưới thì mỗi bước cao 76px và mười
                        bước thành một cuộn dài — đọc ra như dòng thời gian của
                        một cỗ máy, trong khi thứ người dùng cần là một danh sách
                        kiểm liếc một cái là hết. */}
                    <ItemContent className="flex-row items-baseline gap-2">
                      <ItemTitle
                        className={cn(
                          "shrink-0",
                          trangThai === "cho" && "text-muted-foreground",
                        )}
                      >
                        {buoc.ten}
                      </ItemTitle>
                      {/* Mỗi bước hiện thứ nó ĐẺ RA. Một dấu tích xanh không nói
                          được gì; "219 đoạn" thì nói được là nhiều hay ít. */}
                      <ItemDescription
                        className={cn(
                          "truncate",
                          trangThai === "hong" && "text-destructive",
                        )}
                      >
                        {trangThai === "dang"
                          ? "đang chạy…"
                          : trangThai === "cho"
                            ? "chờ"
                            : trangThai === "hong"
                              ? buoc.vault
                              : (buoc.ketQua ?? "xong")}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      {trangThai === "hong" ? (
                        <Button variant="secondary" size="sm">
                          Thử lại
                        </Button>
                      ) : (
                        buoc.lamLai &&
                        trangThai === "xong" && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Làm lại: ${buoc.ten}`}
                                />
                              }
                            >
                              <RotateCcwIcon />
                            </TooltipTrigger>
                            {/* Làm lại một bước là các bước SAU nó phải dựng lại
                                theo — mà người dùng có thể đã sửa tay ở đó. Nói
                                trước, đừng để họ biết sau khi mất. */}
                            <TooltipContent>
                              Làm lại — các bước sau sẽ dựng lại
                            </TooltipContent>
                          </Tooltip>
                        )
                      )}
                    </ItemActions>
                  </Item>
                );
              })}
            </ItemGroup>
          </ScrollArea>
        </CardContent>

        <CardFooter className="justify-between">
          <span className="text-sm text-muted-foreground">
            {chay
              ? "Đóng trang này cũng được — việc vẫn chạy tiếp."
              : "Máy đã làm xong phần của mình."}
          </span>
          {/* CỬA DUY NHẤT dẫn sang gợi ý. Màn này đếm chúng, không chứa chúng. */}
          <Button variant="secondary" size="sm">
            <Badge variant="secondary" className="mr-1.5">
              {goiY}
            </Badge>
            gợi ý đang chờ bạn xem
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
