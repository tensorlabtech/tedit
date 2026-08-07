import { join } from "node:path";

import { readEnvelope } from "./server/audio-envelope";
import { buildAsrPrompt } from "./server/asr-bias";
import { db } from "./server/db";
import { workDir } from "./server/paths";
import { refillTranscriptionGaps } from "./server/refill-transcription-gaps";

const pid = "prj_msh633d6hygz5t";

const sentences = db
  .prepare(
    "SELECT id, text, start_sec, end_sec FROM sentences WHERE project_id=? ORDER BY start_sec",
  )
  .all(pid) as Array<{ id: string; text: string; start_sec: number; end_sec: number }>;

const segments = sentences.map((s) => ({
  text: s.text,
  start: s.start_sec,
  end: s.end_sec,
  words: (
    db
      .prepare(
        "SELECT text, start_sec, end_sec, confidence FROM words WHERE sentence_id=? ORDER BY position",
      )
      .all(s.id) as Array<{ text: string; start_sec: number; end_sec: number; confidence: number }>
  ).map((w) => ({ text: w.text, start: w.start_sec, end: w.end_sec, confidence: w.confidence })),
}));

const env = await readEnvelope(pid);
const audio = join(workDir(pid), "audio.wav");
const prompt = buildAsrPrompt(pid);

console.log("segments trước:", segments.length, "· envelope:", env ? "có" : "null");
const res = await refillTranscriptionGaps(pid, audio, segments, env, prompt);
console.log(">>> refilled:", res.refilled, "câu · addedWords:", res.addedWords);
for (const seg of res.segments) {
  if (seg.start >= 24 && seg.start <= 104) {
    console.log(seg.start.toFixed(1) + "-" + seg.end.toFixed(1) + ": " + seg.text.slice(0, 90));
  }
}
process.exit(0);
