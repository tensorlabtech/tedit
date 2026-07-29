import { useEffect, useState } from "react";

import { api } from "@/lib/api";

/**
 * Lấy VIDEO THẬT của dự án gần nhất để xem thử, thay vì ảnh mẫu.
 *
 * Ảnh mẫu tĩnh không cho biết hiệu ứng có thấy được hay không: hiện mờ trên một
 * khung đứng im đọc ra rất khác hiện mờ trên hình đang động. Mà đây là màn để
 * QUYẾT ĐỊNH thẩm mỹ, nên phải xem trên đúng loại chất liệu sẽ dùng.
 *
 * Không có dự án nào thì trả `null` và nơi gọi rơi về ảnh mẫu — màn này phải mở
 * được cả khi chưa có dự án.
 */
export function useDemoMedia() {
  const [main, setMain] = useState<string | null>(null);
  const [insert, setInsert] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void api
      .listProjects()
      .then(async (list) => {
        const ready = list.find(
          (item) => item.status === "ready" && item.sentence_count > 0,
        );
        if (!ready || !alive) return;
        setMain(api.baseVideoUrl(ready.id));
        const project = await api.getProject(ready.id);
        const file = project.files.find((item) => item.role === "insert");
        if (alive && file) setInsert(api.mediaUrl(file.id));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return { main, insert };
}
