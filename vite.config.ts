import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Cổng Fastify — khớp `process.env.PORT` ở `server/main.ts`. */
const API_PORT = process.env.PORT ?? '5190'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    /**
     * Chuyển tiếp API và tệp về Fastify để trình duyệt chỉ thấy MỘT gốc.
     *
     * Cookie phiên là `httpOnly` + `sameSite`, nên nó chỉ được gửi khi trang và
     * API cùng gốc. Gọi thẳng `127.0.0.1:5190` từ trang ở `5173` là khác gốc:
     * trình duyệt không gửi cookie, và `access-control-allow-origin: *` cũng
     * KHÔNG cứu được — chuẩn CORS cấm dùng dấu sao cùng lúc với cookie.
     *
     * `/files/` cũng phải qua đây: thẻ `<img>` và `<video>` không gắn được tiêu
     * đề nào, chúng chỉ mang cookie — mà chỉ mang khi cùng gốc.
     *
     * Lúc chạy thật không cần khối này: Fastify tự trả bản build nên mọi thứ
     * vốn đã cùng một gốc.
     */
    proxy: {
      '/api': { target: `http://127.0.0.1:${API_PORT}`, changeOrigin: false },
      '/files': { target: `http://127.0.0.1:${API_PORT}`, changeOrigin: false },
    },
  },
})
