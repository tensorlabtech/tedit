import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import "./index.css";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DesignSystemPage } from "@/dev/design-system/design-system-page";
import { StylePage } from "@/dev/overlays/style-page";
import { EditorPage } from "@/routes/editor/editor-page";
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
              <Route path="/" element={<ProjectsPage />} />
              <Route
                path="/_dev/design-system"
                element={<DesignSystemPage />}
              />
              {/* Tên cũ giữ lại vì tôi đã đưa đường dẫn này cho người dùng. */}
              <Route path="/_dev/overlays" element={<StylePage />} />
              <Route path="/_dev/style" element={<StylePage />} />
              {/* MỘT đường dẫn với đoạn cuối không bắt buộc, không phải hai
                  route riêng: hai route là hai chỗ khác nhau trong bảng nên
                  React Router dựng lại màn từ đầu đúng lúc dự án vừa sinh ra mã
                  — mạch vừa xếp bị xoá sạch ngay giữa lần tải tệp đầu tiên.
                  Mã dự án nằm trên đường dẫn để tải lại trang không mất việc
                  đang làm dở — xem `use-upload.ts`. */}
              <Route path="/upload/:projectId?" element={<UploadPage />} />
              <Route path="/editor/:projectId" element={<EditorPage />} />
            </Routes>
          </TooltipProvider>
        </Toaster>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
