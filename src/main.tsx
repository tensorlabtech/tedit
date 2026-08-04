import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";

import "./index.css";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MENU } from "@/routes/dashboard/dashboard-menu";
import { DashboardShell } from "@/routes/dashboard/dashboard-shell";
import { PlaceholderPage } from "@/routes/dashboard/placeholder-page";
import { HomeRoute } from "@/routes/home-route";
import { RequireSession } from "@/routes/require-session";
import { ProjectsPage } from "@/routes/projects/projects-page";
import { useTheme } from "@/hooks/use-theme";

/*
 * Màn nào KHÔNG nằm trên đường vào thì nạp khi cần, không nạp sẵn.
 *
 * Cả trang từng là MỘT tệp 1,74 MB, và trong đó có luôn ba màn `/_dev/*` —
 * riêng trang design system đã bày đủ 60 component với mọi biến thể. Người dùng
 * thật tải hết chỗ đó về để xem một danh sách dự án mà họ sẽ không bao giờ mở
 * mấy trang kia.
 *
 * `HomeRoute` và `ProjectsPage` nạp thẳng: chúng CHÍNH LÀ đường vào, tách ra chỉ
 * đổi một lần tải thành hai.
 */
const DesignSystemPage = lazy(() =>
  import("@/dev/design-system/design-system-page").then((m) => ({
    default: m.DesignSystemPage,
  })),
);
const SkinLabPage = lazy(() =>
  import("@/dev/skin/skin-lab-page").then((m) => ({ default: m.SkinLabPage })),
);
const StylePage = lazy(() =>
  import("@/dev/overlays/style-page").then((m) => ({ default: m.StylePage })),
);
const FlowPage = lazy(() =>
  import("./routes/flow/flow-page").then((m) => ({ default: m.FlowPage })),
);
const PipelinePage = lazy(() =>
  import("./routes/pipeline/pipeline-page").then((m) => ({
    default: m.PipelinePage,
  })),
);
const EditorPage = lazy(() =>
  import("@/routes/editor/editor-page").then((m) => ({ default: m.EditorPage })),
);
const UploadPage = lazy(() =>
  import("@/routes/upload/upload-page").then((m) => ({ default: m.UploadPage })),
);
const AssetsPage = lazy(() =>
  import("@/routes/library/assets-page").then((m) => ({
    default: m.AssetsPage,
  })),
);
const MusicPage = lazy(() =>
  import("@/routes/library/music-page").then((m) => ({ default: m.MusicPage })),
);
const SettingsPage = lazy(() =>
  import("@/routes/library/settings-page").then((m) => ({
    default: m.SettingsPage,
  })),
);

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
            {/* Chỗ chờ IM LẶNG — một khối trống đúng chỗ, không con quay.
                Chunk về gần như tức thì trên mạng bình thường, nên nháy một con
                quay rồi hiện nội dung đọc ra như trang bị giật chứ không như
                trang đang tải. */}
            <Suspense fallback={<div className="min-h-svh" />}>
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
                {/* Bàn thử ngôn ngữ thị giác — token khai trong phạm vi trang,
                    không rò ra app thật. */}
                <Route path="/_dev/skin" element={<SkinLabPage />} />
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
                {/* Luồng tám bước — một màn, sidebar trái. Hai tuyến cũ giữ
                    nguyên trong lúc nội dung từng bước dựng dần. */}
                <Route path="/lam/:projectId" element={<FlowPage />} />
                <Route path="/pipeline/:projectId" element={<PipelinePage />} />
                <Route path="/editor/:projectId" element={<EditorPage />} />
              </Route>
            </Routes>
            </Suspense>
          </TooltipProvider>
        </Toaster>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
