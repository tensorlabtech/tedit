import { useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * "Nhãn mờ, giá trị rõ" — phân tầng bằng ĐỘ SÁNG, không bằng cỡ chữ hay in đậm.
 *
 * Cùng một cỡ, cùng không đậm. Đây là cách ảnh tham khảo giữ được vẻ đơn sắc mà
 * vẫn đọc ra tầng: nhãn tụt xuống ~45% sáng, giá trị giữ ~90%.
 */
export function TextHierarchyPanel() {
  return (
    <Card className="col-span-12 lg:col-span-4">
      <CardHeader>
        <CardTitle>Nhãn mờ, giá trị rõ</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <span className="text-xs text-muted-foreground">
            Phân tầng bằng độ sáng
          </span>
          <div className="grid gap-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Bộ dáng chữ</span>
              <span className="text-sm">Gõ Mạnh</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Nhịp tư liệu</span>
              <span className="text-sm">8 giây / lần</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Nhạc nền</span>
              <span className="text-sm">Mạnh</span>
            </div>
          </div>
        </div>

        {/* "Số liệu phải đứng yên." `tabular-nums` là ĐỦ — chữ số đều bề ngang
            thì đồng hồ chạy mà con số không nhảy trái phải.
            Không dùng `font-mono`: nó đổi cả dáng chữ, nên một mốc thời gian
            đọc ra như một dòng mã giữa một bảng điều khiển. */}
        <div className="grid gap-2">
          <span className="text-xs text-muted-foreground">Số liệu</span>
          <div className="grid gap-1 text-sm">
            <span className="tabular-nums">00:07:21 / 00:01:37</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const TABS = ["Chữ trên màn", "Tư liệu chèn", "Nhạc nền"];

const ROWS = ["Cảnh 1 · mở đầu", "Cảnh 2 · giới thiệu", "Cảnh 3 · kết"];

/**
 * Đang chọn thì đổi MÀU CHỮ, không đổi nền — cả tab lẫn mục trong danh sách.
 *
 * Khác nhau ở chỗ mục danh sách còn thêm nền nấc 2, vì một danh sách có hàng
 * chục mục cùng dạng thì chỉ đổi màu chữ chưa đủ để mắt bắt ngay cái đang chọn.
 * Tab chỉ có vài cái và luôn nhìn thấy hết, nên một vạch màu là đủ.
 *
 * Nấc 4 không dùng ở đây: nó là trạng thái NGẮN (đang nhấn, đang gõ), gán cho
 * một mục đứng yên suốt buổi thì màn hình lúc nào cũng có một mảng sáng không
 * tắt.
 */
export function SelectionStatePanel() {
  const [tab, setTab] = useState(0);
  const [row, setRow] = useState(1);

  return (
    <Card className="col-span-12 lg:col-span-4">
      <CardHeader>
        <CardTitle>Đang chọn: chữ hay nền</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <span className="text-xs text-muted-foreground">
            Tab — màu chữ và một vạch
          </span>
          <div className="flex gap-1">
            {TABS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setTab(index)}
                className={[
                  "border-b-2 px-3 py-2 text-sm",
                  index === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Mục đang chọn: nấc 2 và chữ SÁNG LÊN — không phải chữ màu chủ đạo.
            Màu chủ đạo có độ sáng 0,62 còn chữ thường 0,985, nên tô tím vào là
            mục đang chọn TỐI HƠN mấy mục kia: nó tụt xuống đúng lúc đáng ra
            phải nổi lên.
            Gốc của lỗi ấy là mọi mục đều đang để chữ trắng. Trong một danh sách
            thì chưa chọn phải MỜ — cùng đúng một luật với nhãn mờ giá trị rõ,
            chỉ khác chỗ áp dụng.
            Nấc 4 cũng không dùng ở đây: nó là trạng thái ngắn, gán cho một mục
            đứng yên suốt buổi thì màn hình lúc nào cũng có một mảng sáng. */}
        <div className="grid gap-2">
          <span className="text-xs text-muted-foreground">
            Mục đang chọn — nấc 2 và chữ sáng lên
          </span>
          <div className="grid gap-1">
            {ROWS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setRow(index)}
                className={[
                  "rounded-md px-3 py-2 text-left text-sm",
                  index === row
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
