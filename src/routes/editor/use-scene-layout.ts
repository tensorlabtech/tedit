import { useEffect, useState } from "react";

import { api } from "@/lib/api";

import type { SceneScheduleResult } from "../../../server/scene-schedule";

export type SceneLayoutState = {
  /** Lịch màn hiện tại. `null` khi chưa nạp hoặc bộ dáng không có bố cục. */
  data: SceneScheduleResult | null;
};

/**
 * Lấy LỊCH MÀN của dự án cho khung xem trước và lane bố cục.
 *
 * Server xếp lịch (THƯA — chỉ segment đã đặt), màn hình chỉ vẽ theo. Thêm/sửa/xoá
 * segment đi qua CRUD `elements` như mọi phần tử; nơi gọi bơm `reloadKey` sau mỗi
 * lần đổi để nạp lại lịch.
 */
export function useSceneLayout(
  projectId: string | undefined,
  stylePack: string,
  reloadKey = 0,
): SceneLayoutState {
  const [data, setData] = useState<SceneScheduleResult | null>(null);
  useEffect(() => {
    if (!projectId) {
      setData(null);
      return;
    }
    let alive = true;
    api
      .sceneSchedule(projectId)
      .then((result) => {
        if (alive) setData(result);
      })
      .catch(() => {
        if (alive) setData(null);
      });
    return () => {
      alive = false;
    };
  }, [projectId, stylePack, reloadKey]);

  return { data };
}
