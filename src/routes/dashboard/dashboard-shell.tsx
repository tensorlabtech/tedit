import { Outlet } from "react-router-dom";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { DashboardSidebar } from "./dashboard-sidebar";

/**
 * Khung của bảng điều khiển: thanh bên bên trái, màn đang mở bên phải.
 *
 * Bọc bằng route lồng chứ không dựng lại trong từng màn: dựng lại thì mỗi lần
 * chuyển mục React tháo cả thanh bên rồi lắp lại — thanh bên nháy một cái, và
 * trạng thái đóng/mở của nó mất theo.
 *
 * `h-svh overflow-hidden` đè `min-h-svh` mặc định của `SidebarProvider`: dự án này
 * không dùng thanh cuộn trang (xem `CLAUDE.md`), chiều cao phải chốt đúng một màn
 * để thẻ bên trong tự chia phần còn lại.
 */
export function DashboardShell() {
  return (
    <SidebarProvider className="h-svh overflow-hidden bg-background">
      <DashboardSidebar />
      {/* Đệm nằm ở đây, không ở từng màn: mọi màn bên trong đều được cùng một
          khoảng lề mà không phải nhớ tự thêm.

          Thanh bên nay KHÔNG còn nền riêng (trong suốt, hoà vào nền trang) nên nó
          không phải một "thẻ" cạnh thẻ nội dung nữa — chỉ thẻ nội dung nổi lên.
          `pl-0` để nội dung bắt đầu ngay sau lề phải của thanh bên; khe đọc ra từ
          chính đệm trong của thanh bên. */}
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden p-2 pl-0">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
