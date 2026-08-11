import path from "node:path";

import { bundle, type WebpackOverrideFn } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
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
): Promise<string> {
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

  const silent = outputPath.replace(/\.mp4$/, "-silent.mp4");
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: silent,
    inputProps: payload as unknown as Record<string, unknown>,
    concurrency: null,
  });

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
