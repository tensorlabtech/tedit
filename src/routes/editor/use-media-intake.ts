import { useCallback, useState } from "react";

import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";

import { shape } from "./shape-project";

type Shaped = ReturnType<typeof shape>;

/**
 * Nhận tệp vào dự án — kéo thả từ máy, hoặc lấy từ kho tư liệu.
 *
 * Tách khỏi `use-editor.ts` vì đây là nhóm khép kín nhất trong cả bàn dựng: nó
 * chỉ cần ghi vào `data` và biết video chính dài bao nhiêu. Không đụng tới dải
 * thời gian, không đụng bản chép lời.
 *
 * Thứ tự gọi hook giữ nguyên vị trí cũ trong `useEditor` — React đòi thứ tự nhất
 * quán giữa các lần render, mà gọi hook con ở đúng chỗ khối cũ đứng thì mọi hook
 * bên trong vẫn nằm đúng chỗ ấy.
 */
export function useMediaIntake(
  projectId: string | undefined,
  setData: React.Dispatch<React.SetStateAction<Shaped | null>>,
  durationRef: React.RefObject<number>,
) {
  const [uploading, setUploading] = useState(false);

  /**
   * Thêm tư liệu vào dự án ĐANG mở.
   *
   * Không bắt quay về màn upload: màn đó luôn tạo dự án MỚI, nên người dùng
   * muốn chèn thêm một cái ảnh là mất cả buổi sửa.
   */
  /**
   * Lấy một tư liệu TỪ KHO DÙNG CHUNG về dự án này.
   *
   * Máy chủ chép một bản sang thư mục dự án và mang theo cả mô tả đã viết trong
   * kho — nhờ vậy chặng ghép tư liệu dùng được ngay, không phải đọc lại tấm ảnh.
   *
   * Nạp lại cả dự án sau đó, cùng lý do với `addMedia`: tệp mới phải có mặt trong
   * kho tư liệu của dự án thì mới chèn được.
   */
  /**
   * Lấy tư liệu TỪ KHO về dự án, nhiều tệp một lượt.
   *
   * Chép từng tệp một chứ không `Promise.all`: thứ tự trong dự án là thứ tự người
   * dùng vừa bấm, mà chạy song song thì tệp nào máy chủ xong trước sẽ giành chỗ
   * đứng trước.
   *
   * Chỉ nạp lại dự án MỘT LẦN ở cuối. Nạp sau mỗi tệp thì lấy năm cái là năm lượt
   * tải cả dự án về, mà bốn lượt đầu vứt đi ngay.
   */
  const addAssetsFromLibrary = useCallback(
    async (chosen: string[]) => {
      if (!projectId || chosen.length === 0) return [];
      const ids: string[] = [];
      let hong = 0;
      for (const file of chosen) {
        try {
          const row = await api.addAssetFromLibrary(projectId, file);
          ids.push(row.id);
        } catch {
          hong += 1;
        }
      }
      if (ids.length > 0) {
        const fresh = await api.getProject(projectId);
        const shaped = shape(fresh);
        durationRef.current = shaped.duration;
        setData(shaped);
      }
      if (hong > 0) {
        toast.add({
          title: `Không lấy được ${hong} tư liệu từ kho`,
          type: "error",
        });
      }
      return ids;
    },
    [projectId],
  );

  const addMedia = useCallback(
    async (files: File[]) => {
      if (!projectId || files.length === 0) return;
      setUploading(true);
      try {
        const result = await api.uploadFiles(projectId, files, () => {});
        for (const item of result.rejected) {
          toast.add({
            title: item.name,
            description: item.reason,
            type: "error",
          });
        }
        if (result.saved.length > 0) {
          toast.add({
            title: `Đã thêm ${result.saved.length} tư liệu`,
            type: "success",
          });
          // Nạp lại cả dự án: tệp mới phải vào kho tư liệu để chèn được ngay.
          const fresh = await api.getProject(projectId);
          const shaped = shape(fresh);
          durationRef.current = shaped.duration;
          setData(shaped);
        }
      } catch (error) {
        toast.add({
          title: "Không thêm được tư liệu",
          description: (error as Error).message.slice(0, 100),
          type: "error",
        });
      } finally {
        setUploading(false);
      }
    },
    [projectId],
  );

  /** Sửa một từ máy nghe sai — giữ mốc, hạ cờ "không chắc". */
  /**
   * "Máy nghe đúng rồi" — hạ cờ ngờ vực mà không đổi một chữ nào.
   *
   * Trước đây không có đường này. Cờ `confidence` chỉ hạ khi người dùng SỬA từ,
   * nên lúc máy nghe đúng thì không có cách nào nói với nó điều đó: gạch chấm
   * dưới chữ nằm lại vĩnh viễn, và hàng soát nhắc lại mỗi lần mở dự án. "Bỏ
   * qua" thì chỉ giấu dòng nhắc, gạch chấm vẫn còn — hai chỗ nói hai điều khác
   * nhau về cùng một chữ.
   *
   * Ghi lại chính chữ cũ là đủ: máy chủ luôn hạ cờ khi có người ghi vào từ, vì
   * "người đã nghe lại rồi thì máy không còn quyền nghi ngờ nữa".
   */

  return { uploading, addAssetsFromLibrary, addMedia };
}
