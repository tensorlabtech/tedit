import path from "node:path";

import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

/**
 * Cấu hình bundler Remotion để TÁI DÙNG component preview:
 *  - Tailwind v4 (overlay dùng class Tailwind).
 *  - Alias `@` → src (khớp Vite/tsconfig) để import `@/...` giải được.
 *
 * Lưu ý ma sát đã biết: overlay tải asset PNG bằng `import.meta.glob` (đặc thù
 * Vite) — webpack không hiểu. Component chỉ-chữ (Headline) không đụng, dùng được
 * ngay; component có graphic cần lớp tải asset trung lập bundler (việc P1).
 */
Config.overrideWebpackConfig((current) => {
  const withTailwind = enableTailwind(current);
  return {
    ...withTailwind,
    resolve: {
      ...withTailwind.resolve,
      alias: {
        ...(withTailwind.resolve?.alias ?? {}),
        "@": path.join(process.cwd(), "src"),
      },
    },
  };
});
