import { useState } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertPanel } from "@/dev/skin/alert-panel";
import { CardHeaderPanel } from "@/dev/skin/card-header-panel";
import { ElevationScalePanel } from "@/dev/skin/elevation-scale-panel";
import { GroupingPanel } from "@/dev/skin/grouping-panel";
import { LanePanel } from "@/dev/skin/lane-panel";
import { MockEditorScreen } from "@/dev/skin/mock-editor-screen";
import {
  ButtonPanel,
  InputPanel,
} from "@/dev/skin/input-and-button-panel";
import {
  SelectionStatePanel,
  TextHierarchyPanel,
} from "@/dev/skin/text-hierarchy-panel";
import "@/dev/skin/skin-tokens.css";

/**
 * Bàn thử ngôn ngữ thị giác: tách tầng bằng ánh sáng thay cho đường kẻ.
 *
 * Token khai trong phạm vi `.skin-lab` (xem `skin-tokens.css`), nên `index.css`
 * không đụng tới và app thật không lệch một pixel. Chốt xong phương án nào thì
 * mới chuyển nó vào token toàn cục.
 *
 * Nút sáng/tối ở đây là CỦA RIÊNG TRANG NÀY, không phải `ThemeToggle` chung:
 * nút chung ghi vào `localStorage` và đổi cả ứng dụng, mà việc cần làm ở đây là
 * lật qua lật lại để so hai bản — không phải chọn giao diện để dùng.
 */
export function SkinLabPage() {
  const [skin, setSkin] = useState<"dark" | "light">("dark");

  return (
    <div
      // `dark` đặt lên chính khối này để các biến thể `dark:` của component bên
      // trong còn kích hoạt — chúng khai theo `.dark *`, tức con cháu của một
      // thẻ mang lớp đó.
      className={`skin-lab min-h-svh bg-background p-2 text-foreground ${
        skin === "dark" ? "dark" : ""
      }`}
      data-skin={skin}
    >
      <div className="grid grid-cols-12 gap-2">
        <Card size="sm" className="col-span-12">
          <CardHeader>
            <CardTitle>Bàn thử — tách tầng bằng ánh sáng</CardTitle>
            <CardAction className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                token nằm trong phạm vi trang · app thật không đổi
              </span>
              {/* Nút nền nấc 2, không phải `variant="outline"` — chính trang
                  này bỏ nút viền thì cái nút của nó cũng không được là ngoại lệ */}
              <button
                type="button"
                className="rounded-md bg-muted px-3 py-2 text-sm hover:bg-accent"
                onClick={() =>
                  setSkin((current) => (current === "dark" ? "light" : "dark"))
                }
              >
                {skin === "dark" ? "Xem bản sáng" : "Xem bản tối"}
              </button>
            </CardAction>
          </CardHeader>
        </Card>

        <ElevationScalePanel skin={skin} />
        <CardHeaderPanel />
        <InputPanel />
        <ButtonPanel />

        <GroupingPanel />
        <TextHierarchyPanel />
        <SelectionStatePanel />

        {/* Nhắc lại luật ngay cạnh chỗ nó được minh hoạ, để lúc nhìn còn biết
            mình đang phải quyết định cái gì */}
        <Card className="col-span-12">
          <CardHeader>
            <CardTitle>Luật đang thử</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid list-decimal gap-2 pl-4 text-sm text-muted-foreground sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
              <li>Nổi lên thì sáng lên — bốn nấc đều nhau, không bóng đổ.</li>
              <li>Viền chỉ dùng khi hai thứ cùng độ sáng đứng cạnh nhau.</li>
              <li>Ô nhập là một mảng, không phải một cái khung.</li>
              <li>
                Gom nhóm bằng kẻ ngang chạy hết bề ngang thẻ, kể cả dưới tiêu
                đề; mảng nền chỉ cấp cho thứ bấm được.
              </li>
              <li>
                Nút: trần khi đứng thành thanh icon, nền nấc 2 khi có chữ, đặc
                màu chủ đạo cho đúng một việc chính. Không nút viền.
              </li>
              <li>Màu chủ đạo chỉ ở chỗ đang xảy ra — không quá bốn vệt.</li>
              <li>Dải thời gian là nơi duy nhất được đậm màu.</li>
              <li>Nhãn mờ, giá trị rõ — cùng cỡ, cùng không đậm.</li>
              <li>Nội dung là vật sáng, giao diện là bóng tối quanh nó.</li>
            </ol>
          </CardContent>
        </Card>

        <AlertPanel skin={skin} />
        <LanePanel skin={skin} />

        <Card size="sm" className="col-span-12">
          <CardHeader>
            <CardTitle>Màn editor giả — cả bộ luật cùng lúc</CardTitle>
          </CardHeader>
        </Card>
        <MockEditorScreen />
      </div>
    </div>
  );
}
