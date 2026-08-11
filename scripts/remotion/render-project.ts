/**
 * Dựng payload thật cho một project rồi render bằng Remotion (một máy vẽ).
 *   npx tsx scripts/remotion/render-project.ts <projectId>
 * Ra: out/video-<id>.mp4 + out/payload-<id>.json
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { buildRemotionPayload } from "../../server/remotion-payload";

const projectId = process.argv[2];
if (!projectId) {
  console.error("Thiếu projectId. Ví dụ: npx tsx scripts/remotion/render-project.ts prj_...");
  process.exit(1);
}

const payload = await buildRemotionPayload(projectId);
if (!payload) {
  console.error("Không dựng được payload (thiếu base.mp4 hoặc bộ dáng không có bố cục).");
  process.exit(1);
}

mkdirSync("out", { recursive: true });
const propsPath = `out/payload-${projectId}.json`;
writeFileSync(propsPath, JSON.stringify(payload));
console.log(
  `Payload: ${payload.scenes.length} màn, ${payload.inserts.length} tư liệu, ${payload.seconds.toFixed(1)}s`,
);

// Tuỳ chọn: `still <frameNumber>` render một frame để so A/B nhanh.
const stillFrame = process.argv[3] === "still" ? Number(process.argv[4] ?? 0) : null;
if (stillFrame != null) {
  execSync(
    `npx remotion still src/remotion/index.ts Video out/still-${projectId}.png --props=${propsPath} --frame=${stillFrame}`,
    { stdio: "inherit" },
  );
} else {
  const silent = `out/video-${projectId}.mp4`;
  execSync(
    `npx remotion render src/remotion/index.ts Video ${silent} --props=${propsPath}`,
    { stdio: "inherit" },
  );

  // AUDIO: Remotion vẽ hình CÂM (roadmap: tầng tiếng ở ffmpeg). Ghép giọng-đã-cắt
  // + nhạc từ export ffmpeg hiện tại. (Proper Phase B sau: gọi cutRanges+mixMusic
  // trực tiếp, không phụ thuộc final.mp4 có sẵn.)
  const finalMp4 = `server/data/projects/${projectId}/out/final.mp4`;
  if (existsSync(finalMp4)) {
    const av = `out/video-${projectId}-av.mp4`;
    execSync(
      `ffmpeg -y -v error -i ${silent} -i ${finalMp4} -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest ${av}`,
      { stdio: "inherit" },
    );
    console.log(`AV (có tiếng): ${av}`);
  } else {
    console.log("Không có final.mp4 → video câm (chạy fresh export để có tiếng).");
  }
}
