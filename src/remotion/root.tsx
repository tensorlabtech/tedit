import { Composition } from "remotion";

import { SpikeComposition } from "./spike-composition";
import { SpikeReuseComposition } from "./spike-reuse-composition";
import { SpikeHardFxComposition } from "./spike-hardfx-composition";
import { SpikeRealSceneComposition } from "./spike-real-scene-composition";
import { VideoComposition } from "./video-composition";
import { NHIP_DEN } from "../../server/style-pack-catalog";
import type { RemotionPayload } from "../../server/remotion-payload";

const EMPTY_PAYLOAD: RemotionPayload = {
  fps: 30,
  width: 1080,
  height: 1920,
  seconds: 1,
  sourceAspect: null,
  personUrl: "",
  maskUrl: null,
  basePage: null,
  pack: NHIP_DEN,
  scenes: [],
  inserts: [],
  captions: [],
};

/**
 * Gốc Remotion — các composition xuất được.
 *  - "Spike"      : P0a, khung tự chứa (chứng minh vòng lặp render).
 *  - "SpikeReuse" : P0b, tái dùng component overlay THẬT (Headline).
 * Khung 1080×1920 · 30fps (khớp khổ xuất thật).
 */
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Spike"
        component={SpikeComposition}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="SpikeReuse"
        component={SpikeReuseComposition}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="SpikeHardFx"
        component={SpikeHardFxComposition}
        durationInFrames={60}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="SpikeRealScene"
        component={SpikeRealSceneComposition}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* MÁY VẼ DUY NHẤT — ăn payload thật từ buildRemotionPayload. Duration/khổ
          suy từ payload. */}
      <Composition
        id="Video"
        component={VideoComposition}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={EMPTY_PAYLOAD}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, Math.round(props.seconds * props.fps)),
          fps: props.fps,
          width: props.width,
          height: props.height,
        })}
      />
    </>
  );
}
