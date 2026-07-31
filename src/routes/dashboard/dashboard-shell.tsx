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

          `pl-0` là cố ý. Thanh bên dạng `floating` đã tự đệm 8px quanh mình, kể cả
          mép phải — cộng thêm đệm trái ở đây nữa thì khe giữa hai thẻ thành 16px
          trong khi mọi khe khác trong ứng dụng là 8px, và một khe rộng gấp đôi đọc
          ra như hai vùng không liên quan. */}
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden p-2 pl-0">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
