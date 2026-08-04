/**
 * Chạy THẬT hai bộ detect cắt trên một dự án rồi in ra từng chỗ, kèm lời.
 *
 * Để cùng nhìn chất lượng: chỗ nào là lặng (deterministic từ sóng), chỗ nào là
 * LLM đề xuất (nói lỗi), và mỗi chỗ nuốt lời gì. Không phải để ghi đè — chạy
 * xong in bảng, dữ liệu để nguyên ở trạng thái vừa cắt cho màn soi.
 *
 *   npx tsx scripts/cut-guard/thu-detect.ts <projectId>
 */
import { db } from "../../server/db";
import { readEnvelope } from "../../server/audio-envelope";
import { trimSilence } from "../../server/auto-trim-silence";
import { proposeCuts } from "../../server/ai-cuts";
import { seedSegmentsByCaption } from "../../server/segment-seed";
import { readStylePack } from "../../server/style-pack-store";
import { listSegments } from "../../server/segments";

const projectId = process.argv[2];
if (!projectId) throw new Error("thiếu projectId");

type Word = { text: string; start_sec: number; end_sec: number };

function wordsIn(words: Word[], start: number, end: number): string {
  return words
    .filter((w) => (w.start_sec + w.end_sec) / 2 >= start && (w.start_sec + w.end_sec) / 2 < end)
    .map((w) => w.text)
    .join(" ");
}

async function main() {
  const words = db
    .prepare("SELECT text, start_sec, end_sec FROM words WHERE project_id=? ORDER BY start_sec")
    .all(projectId) as Word[];
  const total = (
    db
      .prepare("SELECT COALESCE(SUM(duration),0) t FROM media_files WHERE project_id=? AND role='main'")
      .get(projectId) as { t: number }
  ).t;
  const minSilence = (
    db.prepare("SELECT min_silence FROM projects WHERE id=?").get(projectId) as {
      min_silence: number | null;
    }
  ).min_silence;
  const style = (
    db.prepare("SELECT style_pack FROM projects WHERE id=?").get(projectId) as {
      style_pack: string | null;
    }
  ).style_pack;

  console.log(`\nVIDEO ${total.toFixed(1)}s · ${words.length} từ · phong cách "${style}" · ngưỡng lặng ${minSilence}s\n`);

  // Gieo lại đoạn sạch để hai bộ chạy từ đầu.
  db.prepare("DELETE FROM segments WHERE project_id=?").run(projectId);
  await seedSegmentsByCaption(projectId, total, readStylePack(projectId));

  // ── Bộ 1: LẶNG (deterministic từ sóng) ──────────────────────────────────
  const before1 = listSegments(projectId).filter((s) => s.removed).length;
  const silence = trimSilence(projectId, await readEnvelope(projectId));
  const afterSilence = listSegments(projectId).filter((s) => s.removed);
  console.log(`── LẶNG (đo sóng) — rút ${silence.trimmed} chỗ · ${silence.saved.toFixed(1)}s ──`);
  for (const s of afterSilence.slice(0, 40)) {
    const said = wordsIn(words, s.start_sec, s.end_sec);
    console.log(
      `  ${s.start_sec.toFixed(1)}→${s.end_sec.toFixed(1)} (${(s.end_sec - s.start_sec).toFixed(1)}s)  ${said ? "⚠ CÓ LỜI: " + said : "· lặng"}`,
    );
  }

  // ── Bộ 2: NÓI LỖI (LLM) ─────────────────────────────────────────────────
  const cuts = await proposeCuts(projectId);
  const afterAll = listSegments(projectId).filter((s) => s.removed);
  const fromLlm = afterAll.filter((s) => !afterSilence.some((p) => Math.abs(p.start_sec - s.start_sec) < 0.05));
  console.log(`\n── NÓI LỖI (LLM) — áp ${cuts.applied} chỗ · gạt ${cuts.rejected} ──`);
  for (const s of afterAll.slice(0, 60)) {
    const said = wordsIn(words, s.start_sec, s.end_sec);
    if (!said) continue; // chỗ lặng đã in ở trên
    console.log(`  ${s.start_sec.toFixed(1)}→${s.end_sec.toFixed(1)} (${(s.end_sec - s.start_sec).toFixed(1)}s)  "${said}"`);
  }

  const cut = afterAll.reduce((a, s) => a + (s.end_sec - s.start_sec), 0);
  console.log(
    `\nTỔNG: bỏ ${afterAll.length} chỗ · ${cut.toFixed(1)}s / ${total.toFixed(1)}s (${((cut / total) * 100).toFixed(0)}%) · còn ${(total - cut).toFixed(1)}s`,
  );
  void before1;
  void fromLlm;
}

void main();
