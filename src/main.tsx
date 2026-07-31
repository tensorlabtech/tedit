import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";

import "./index.css";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DesignSystemPage } from "@/dev/design-system/design-system-page";
import { PipelinePage } from "./routes/pipeline/pipeline-page";
import { StylePage } from "@/dev/overlays/style-page";
import { MENU } from "@/routes/dashboard/dashboard-menu";
import { DashboardShell } from "@/routes/dashboard/dashboard-shell";
import { PlaceholderPage } from "@/routes/dashboard/placeholder-page";
import { EditorPage } from "@/routes/editor/editor-page";
import { HomeRoute } from "@/routes/home-route";
import { RequireSession } from "@/routes/require-session";
import { AssetsPage } from "@/routes/library/assets-page";
import { MusicPage } from "@/routes/library/music-page";
import { SettingsPage } from "@/routes/library/settings-page";
import { ProjectsPage } from "@/routes/projects/projects-page";
import { UploadPage } from "@/routes/upload/upload-page";
import { useTheme } from "@/hooks/use-theme";

/**
 * Áp giao diện sáng/tối cho CẢ ứng dụng.
 *
 * `useTheme` trước đây chỉ được gọi trong `ThemeToggle`, mà nút đó chỉ có ở trang
 * design system — nên mọi trang thật đều đứng nguyên màu sáng, kể cả khi máy để
 * chế độ tối hoặc người dùng đã chọn "Tối" ở trang kia. Lớp `dark` phải do gốc
 * ứng dụng đặt, không do một cái nút ở một trang đặt.
 */
function ThemeProvider({ children }: { children: React.ReactNode }) {
  useTheme();
  return children;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Toaster>
          <TooltipProvider>
            <Routes>
              {/* MỘT đường duy nhất mở cho người chưa đăng nhập: `/`. `HomeRoute`
                  tự chọn giới thiệu hay bảng điều khiển, và cửa đăng nhập nằm ngay
                  trên trang giới thiệu.

                  Từng có `/login` riêng và nó đã bị gỡ: cùng một nút Google, cùng
                  một câu về danh sách cho phép, chỉ khác vài dòng chữ — hai chỗ
                  phải sửa cho mỗi lần đổi cách đăng nhập, mà quên một chỗ thì hai
                  cửa nói hai điều khác nhau. */}

              {/* Bảng điều khiển: thanh bên giữ nguyên, chỉ phần bên phải đổi.
                  Route lồng chứ không dựng thanh bên trong từng màn — dựng lại
                  thì mỗi lần chuyển mục thanh bên nháy một cái và mất trạng thái
                  đóng/mở. */}
              <Route path="/" element={<HomeRoute />}>
                <Route index element={<ProjectsPage />} />
              </Route>
              <Route
                element={
                  <RequireSession>
                    <DashboardShell />
                  </RequireSession>
                }
              >
                <Route path="/assets" element={<AssetsPage />} />
                <Route path="/music" element={<MusicPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                {/* Mục nào còn đánh dấu `mocked` thì vẫn là màn "đang làm" —
                    giữ nhánh này để thêm một mục mới vào thanh bên không bao giờ
                    trỏ vào trang trắng. */}
                {MENU.filter((item) => item.mocked).map((item) => (
                  <Route
                    key={item.to}
                    path={item.to}
                    element={<PlaceholderPage title={item.label} />}
                  />
                ))}
              </Route>

              {/* Mấy màn làm việc sâu — nạp tệp, màn chờ, bàn dựng — KHÔNG có
                  thanh bên: chúng dùng hết bề ngang cho dải thời gian và bảng
                  lời, mà `/_dev/*` cũng vậy. Vẫn nằm sau cổng đăng nhập. */}
              <Route
                element={
                  <RequireSession>
                    <Outlet />
                  </RequireSession>
                }
              >
                <Route
                  path="/_dev/design-system"
                  element={<DesignSystemPage />}
                />
                <Route path="/_dev/style" element={<StylePage />} />
                {/* Tên cũ giữ lại vì tôi đã đưa đường dẫn này cho người dùng. */}
                <Route path="/_dev/overlays" element={<StylePage />} />
                {/* MỘT đường dẫn với đoạn cuối không bắt buộc, không phải hai
                    route riêng: hai route là hai chỗ khác nhau trong bảng nên
                    React Router dựng lại màn từ đầu đúng lúc dự án vừa sinh ra mã
                    — mạch vừa xếp bị xoá sạch ngay giữa lần tải tệp đầu tiên.
                    Mã dự án nằm trên đường dẫn để tải lại trang không mất việc
                    đang làm dở — xem `use-upload.ts`. */}
                <Route path="/upload/:projectId?" element={<UploadPage />} />
                {/* Màn chờ: máy dựng xong hết rồi mới tới lượt người dùng. */}
                <Route path="/pipeline/:projectId" element={<PipelinePage />} />
                <Route path="/editor/:projectId" element={<EditorPage />} />
              </Route>
            </Routes>
          </TooltipProvider>
        </Toaster>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
