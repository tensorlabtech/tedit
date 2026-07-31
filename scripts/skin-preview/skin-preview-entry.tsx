import { createRoot } from "react-dom/client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SkinLabPage } from "@/dev/skin/skin-lab-page";
import "@/index.css";

/**
 * Mở bàn thử KHÔNG cần đăng nhập.
 *
 * `/_dev/skin` nằm sau cổng Google, mà Google chối đăng nhập từ trình duyệt bị
 * điều khiển tự động — nên không có cửa này thì mọi lượt kiểm bằng máy đều phải
 * nhờ người ngồi bấm. Cùng lý do với `scripts/ui-preview/`.
 *
 * `SkinLabPage` không gọi API và không đọc đường dẫn, nên dựng thẳng được.
 *
 *   npm run dev
 *   mở http://localhost:5173/scripts/skin-preview/skin-preview.html
 */
createRoot(document.getElementById("root")!).render(
  <TooltipProvider>
    <SkinLabPage />
  </TooltipProvider>,
);
