import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";

/**
 * DỮ LIỆU VÀ THAO TÁC CỦA BƯỚC SOÁT LỜI.
 *
 * ══ SOÁT CÁI GÌ ══
 *
 * Máy nghe gán mỗi từ một ĐỘ TIN. Dưới ngưỡng thì nó tự nhận "chỗ này tôi không
 * chắc" — đó đúng là chỗ đáng người nhìn: tên riêng, từ mượn tiếng Anh, số liệu.
 * Màn này bày trọn bản chép, chấm dưới những từ ngờ, để người soát nhảy thẳng
 * tới chúng thay vì đọc lại từng chữ.
 *
 * ══ MỘT ĐƯỜNG GHI CHO CẢ SỬA LẪN XÁC NHẬN ══
 *
 * `PATCH /api/words/:id` vừa đổi chữ vừa đặt `confidence=1`. Nên "sửa thành chữ
 * khác" và "chữ này đúng rồi" đi chung một cửa: cái đầu ghi chữ mới, cái sau ghi
 * lại đúng chữ cũ. Cả hai đều hạ cờ ngờ, và đó là thứ người soát muốn thấy —
 * chấm dưới biến mất.
 */

/** Dưới mức này thì máy nghe KHÔNG chắc — cùng mốc 0,6 với bàn dựng. */
const UNSURE_BELOW = 0.6;

export type ReviewWord = {
  id: string;
  text: string;
  start: number;
  end: number;
  /** Máy nghe không chắc — chấm dưới, mời soát. */
  unsure: boolean;
};

export type ReviewSentence = { id: string; start: number; words: ReviewWord[] };

export function useTextReview(projectId: string | undefined) {
  const [sentences, setSentences] = useState<ReviewSentence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    void (async () => {
      try {
        const data = await api.getProject(projectId);
        if (!alive) return;
        // Gom từ về câu của nó rồi xếp theo thời gian — bản chép đọc xuôi.
        const byId = new Map<string, ReviewWord[]>();
        for (const word of data.words) {
          const list = byId.get(word.sentence_id) ?? [];
          list.push({
            id: word.id,
            text: word.text,
            start: word.start_sec,
            end: word.end_sec,
            unsure: (word.confidence ?? 1) < UNSURE_BELOW,
          });
          byId.set(word.sentence_id, list);
        }
        setSentences(
          data.sentences
            .slice()
            .sort((a, b) => a.start_sec - b.start_sec)
            .map((sentence) => ({
              id: sentence.id,
              start: sentence.start_sec,
              words: (byId.get(sentence.id) ?? []).sort(
                (a, b) => a.start - b.start,
              ),
            })),
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  /**
   * Ghi chữ mới VÀ hạ cờ ngờ — máy chủ đặt `confidence=1` cùng lượt. Cập nhật
   * lạc quan để chấm dưới biến ngay, không đợi máy chủ trả về.
   */
  const fix = useCallback(async (wordId: string, text: string) => {
    const next = text.trim();
    if (!next) return;
    setSentences((prev) =>
      prev.map((sentence) => ({
        ...sentence,
        words: sentence.words.map((word) =>
          word.id === wordId ? { ...word, text: next, unsure: false } : word,
        ),
      })),
    );
    await api.setWordText(wordId, next);
  }, []);

  /** "Nghe đúng rồi" — giữ nguyên chữ, chỉ hạ cờ ngờ (cùng đường ghi). */
  const confirm = useCallback(
    (wordId: string) => {
      const word = sentences
        .flatMap((sentence) => sentence.words)
        .find((item) => item.id === wordId);
      if (word) void fix(wordId, word.text);
    },
    [sentences, fix],
  );

  const unsure = sentences
    .flatMap((sentence) => sentence.words)
    .filter((word) => word.unsure);

  return { sentences, unsure, loading, fix, confirm };
}
