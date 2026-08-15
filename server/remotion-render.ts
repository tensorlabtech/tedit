import path from "node:path";

import { bundle, type WebpackOverrideFn } from "@remotion/bundler";
import {
  makeCancelSignal,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";

import { ffmpeg } from "./media-tools";
import { buildRemotionPayload } from "./remotion-payload";

/**
 * MÁY VẼ REMOTION cho hàng đợi export — thay nhánh `burnElements` (ffmpeg dựng
 * hình). Remotion vẽ hình CÂM từ lịch màn thật; tiếng (giọng đã cắt) ghép từ
 * chính video `cut`. Nhạc do `mixMusic` thêm sau (như luồng ffmpeg cũ).
 *
 * Bundle SAU khi `buildRemotionPayload` copy media vào `public/` — Remotion nướng
 * `public/` vào bundle lúc dựng, nên phải copy trước rồi mới bundle.
 */

/** Cùng cấu hình với `remotion.config.ts` (CLI) — Tailwind + alias `@`. */
const webpackOverride: WebpackOverrideFn = (config) => {
  const tw = enableTailwind(config);
  return {
    ...tw,
    resolve: {
      ...tw.resolve,
      alias: {
        ...((tw.resolve?.alias as Record<string, string> | undefined) ?? {}),
        "@": path.join(process.cwd(), "src"),
      },
    },
  };
};

/**
 * Render một project ra `outputPath` (video + giọng đã cắt, CHƯA nhạc — để
 * `mixMusic` xử tiếp, khớp hợp đồng của `burnElements`).
 */
export async function renderViaRemotion(
  projectId: string,
  cutVideo: string,
  outputPath: string,
  /**
   * `signal` để HUỶ giữa chừng (nút Huỷ ở modal xuất): buộc vào `cancelSignal` của
   * Remotion nên khâu dựng hình dừng ngay, không chờ tới hết. `onProgress` (0..1)
   * để nhích % khâu Remotion — đây là khâu LÂU nhất, không nối thì thanh đứng im.
   */
  opts?: { signal?: AbortSignal; onProgress?: (ratio: number) => void },
): Promise<string> {
  if (opts?.signal?.aborted) throw new Error("Đã huỷ");
  // Copy media + dựng payload TRƯỚC (dùng video ĐÃ CẮT cho người → khớp timeline).
  const payload = await buildRemotionPayload(projectId, cutVideo);
  if (!payload) throw new Error("Không dựng được payload Remotion");

  const serveUrl = await bundle({
    entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
    webpackOverride,
  });

  const composition = await selectComposition({
    serveUrl,
    id: "Video",
    inputProps: payload as unknown as Record<string, unknown>,
  });

  // HUỶ: Remotion nhận `cancelSignal` riêng của nó — bắc cầu từ AbortSignal sang.
  const { cancelSignal, cancel } = makeCancelSignal();
  const onAbort = () => cancel();
  opts?.signal?.addEventListener("abort", onAbort);

  const silent = outputPath.replace(/\.mp4$/, "-silent.mp4");
  try {
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: silent,
      inputProps: payload as unknown as Record<string, unknown>,
      concurrency: null,
      cancelSignal,
      onProgress: opts?.onProgress
        ? ({ progress }) => opts.onProgress!(progress)
        : undefined,
    });
  } catch (error) {
    // Bị huỷ thì báo bằng thông điệp GỌN, không đổ nguyên vết lỗi của Remotion.
    if (opts?.signal?.aborted) throw new Error("Đã huỷ");
    throw error;
  } finally {
    opts?.signal?.removeEventListener("abort", onAbort);
  }

  if (opts?.signal?.aborted) throw new Error("Đã huỷ");
  // Ghép GIỌNG (đã cắt) từ `cut` vào video Remotion câm. Nhạc thêm ở `mixMusic`.
  await ffmpeg([
    "-y",
    "-i",
    silent,
    "-i",
    cutVideo,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    outputPath,
  ]);

  return outputPath;
}
