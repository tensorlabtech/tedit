import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";

/**
 * DỮ LIỆU VÀ THAO TÁC CỦA BƯỚC SOÁT LỜI.
 *
 * ══ SOÁT CÁI GÌ ══
 *
 * Máy nghe gán mỗi từ một ĐỘ TIN; dưới ngưỡng thì nó tự nhận không chắc. Nhưng
 * chỗ đáng ngờ chỉ là GỢI Ý mời mắt — máy tự tin vẫn sai ở đồng âm, nên MỌI chữ
 * đều sửa được, không riêng chữ ngờ.
 *
 * ══ MỘT ĐƯỜNG GHI CHO CẢ SỬA, XÁC NHẬN, VÀ SỬA-TẤT-CẢ ══
 *
 * `PATCH /api/words/:id` vừa đổi chữ vừa đặt `confidence=1`. Nên mọi thao tác đi
 * chung một phép `apply`: "sửa" ghi chữ mới cho một từ, "đúng rồi" ghi lại đúng
 * chữ cũ, "sửa tất cả" ghi cùng một chữ cho mọi từ trùng. Cả ba đều hạ cờ ngờ.
 * `apply` chụp lại chữ cũ nên trả về được một hàm HOÀN TÁC — sửa nhầm thì lùi.
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

/** Một phép sửa, kèm đường lùi để nơi gọi mời "Hoàn tác". */
export type Undo = { revert: () => Promise<void> };

const norm = (text: string) => text.trim().toLowerCase();

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
   * Áp một tập đổi chữ: cập nhật lạc quan (chấm dưới biến ngay) + ghi máy chủ,
   * và trả về hàm lùi về nguyên trạng. Máy chủ đặt `confidence=1` khi ghi, nên
   * lùi thì trả cả chữ cũ lẫn cờ ngờ cũ ở bản địa (đủ cho một cú hoàn tác).
   */
  const apply = useCallback(
    async (changes: Array<{ id: string; text: string }>): Promise<Undo> => {
      const clean = changes
        .map((change) => ({ id: change.id, text: change.text.trim() }))
        .filter((change) => change.text.length > 0);
      const before = new Map<string, { text: string; unsure: boolean }>();

      const patch = (
        rows: ReviewSentence[],
        pick: (word: ReviewWord) => { text: string; unsure: boolean } | null,
      ) =>
        rows.map((sentence) => ({
          ...sentence,
          words: sentence.words.map((word) => {
            const next = pick(word);
            return next ? { ...word, ...next } : word;
          }),
        }));

      setSentences((rows) =>
        patch(rows, (word) => {
          const change = clean.find((item) => item.id === word.id);
          if (!change) return null;
          before.set(word.id, { text: word.text, unsure: word.unsure });
          return { text: change.text, unsure: false };
        }),
      );
      await Promise.all(clean.map((change) => api.setWordText(change.id, change.text)));

      return {
        revert: async () => {
          setSentences((rows) =>
            patch(rows, (word) => before.get(word.id) ?? null),
          );
          await Promise.all(
            [...before].map(([id, prev]) => api.setWordText(id, prev.text)),
          );
        },
      };
    },
    [],
  );

  /** Sửa một từ. */
  const fix = useCallback(
    (wordId: string, text: string) => apply([{ id: wordId, text }]),
    [apply],
  );

  /** "Đúng rồi" — giữ nguyên chữ, chỉ hạ cờ ngờ. */
  const confirm = useCallback(
    (wordId: string): Promise<Undo> => {
      const word = sentences
        .flatMap((sentence) => sentence.words)
        .find((item) => item.id === wordId);
      return word ? apply([{ id: wordId, text: word.text }]) : Promise.resolve({ revert: async () => {} });
    },
    [sentences, apply],
  );

  /**
   * Sửa TẤT CẢ chỗ trùng chữ (không phân biệt hoa–thường) trong dự án này. Tên
   * riêng / từ mượn sai thì sai đều, nên sửa một lần áp hết là chỗ tiết kiệm nhất.
   * Chỉ đổi chữ, không đụng cấu trúc — nên không có chuyện mồ côi phần tử.
   */
  const fixAll = useCallback(
    async (fromText: string, toText: string): Promise<Undo & { count: number }> => {
      const from = norm(fromText);
      const ids = sentences
        .flatMap((sentence) => sentence.words)
        .filter((word) => norm(word.text) === from)
        .map((word) => word.id);
      const undo = await apply(ids.map((id) => ({ id, text: toText })));
      return { ...undo, count: ids.length };
    },
    [sentences, apply],
  );

  const unsure = sentences
    .flatMap((sentence) => sentence.words)
    .filter((word) => word.unsure);

  return { sentences, unsure, loading, fix, fixAll, confirm };
}
