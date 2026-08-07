/**
 * KHỚP LẠI TỪ CỦA MỘT CÂU KHI NGƯỜI DÙNG SỬA CẢ DÒNG.
 *
 * ══ VÌ SAO KHÔNG SỬA TỪNG TỪ ══
 *
 * Bước soát lời cho sửa cả một dòng như gõ văn bản — vừa đổi chữ, vừa chèn chữ
 * máy bỏ sót, vừa bỏ chữ máy nghe thừa, trong một thao tác. Nhưng mốc thời gian
 * thì gắn với TỪNG TỪ. Nên khi dòng đổi, phải dựng lại danh sách từ mà GIỮ mốc
 * của những từ không đổi, chỉ NỘI SUY mốc cho từ mới chèn.
 *
 * ══ CÁCH KHỚP ══
 *
 * Dóng dãy từ cũ với dãy chữ mới bằng chuỗi con chung dài nhất (LCS) trên chữ đã
 * chuẩn hoá. Từ khớp giữ nguyên id + mốc (nên NEO phụ đề của những từ ấy còn
 * sống nếu người dùng quay lại soát sau khi đã dựng xong). Chữ mới nằm giữa hai
 * mốc khớp thì chia đều khoảng giữa chúng; nằm ở đầu/cuối câu thì mượn mốc câu.
 */

/** Một từ cũ trong câu — cần id để giữ neo, và mốc để khớp lại. */
export type OldWord = {
  id: string;
  text: string;
  start_sec: number;
  end_sec: number;
};

/**
 * Một từ sau khi khớp. `id` là từ cũ khớp được (UPDATE tại chỗ) hoặc `null` (từ
 * mới, INSERT). Nơi gọi lo việc ghi CSDL và đặt lại độ tin.
 */
export type ReconciledWord = {
  id: string | null;
  text: string;
  start: number;
  end: number;
};

const norm = (text: string) => text.trim().toLowerCase();

/** Tách một dòng thành các từ — gộp mọi khoảng trắng, bỏ rỗng. */
export function tokenize(text: string): string[] {
  return text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

/**
 * Khớp dãy từ cũ với dãy chữ mới; từ khớp giữ id + mốc, chỗ chèn nội suy mốc.
 * Dùng được cả khi `oldWords` rỗng (thêm câu mới) — khi ấy mọi từ đều nội suy
 * đều trong khoảng `[sentStart, sentEnd]`.
 */
export function reconcileWords(
  oldWords: OldWord[],
  tokens: string[],
  sentStart: number,
  sentEnd: number,
): ReconciledWord[] {
  const m = oldWords.length;
  const n = tokens.length;

  // LCS: dp[i][j] = độ dài chuỗi con chung của oldWords[i:] và tokens[j:].
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        norm(oldWords[i].text) === norm(tokens[j])
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Truy vết: mỗi chữ mới j khớp với từ cũ nào (hoặc -1).
  const matchOld: number[] = new Array(n).fill(-1);
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (norm(oldWords[i].text) === norm(tokens[j])) {
      matchOld[j] = i;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  // Từ khớp lấy id + mốc; từ chưa khớp để NaN chờ nội suy.
  const out: ReconciledWord[] = tokens.map((text) => ({
    id: null,
    text,
    start: Number.NaN,
    end: Number.NaN,
  }));
  for (let k = 0; k < n; k++) {
    const oi = matchOld[k];
    if (oi >= 0) {
      out[k].id = oldWords[oi].id;
      out[k].start = oldWords[oi].start_sec;
      out[k].end = oldWords[oi].end_sec;
    }
  }

  // Nội suy từng CỤM từ mới liền nhau vào khoảng giữa hai mốc khớp kề bên.
  let k = 0;
  while (k < n) {
    if (!Number.isNaN(out[k].start)) {
      k++;
      continue;
    }
    let end = k;
    while (end < n && Number.isNaN(out[end].start)) end++;
    const left = k > 0 ? out[k - 1].end : sentStart;
    const right = end < n ? out[end].start : sentEnd;
    const span = Math.max(0, right - left);
    const count = end - k;
    const slot = span / count;
    for (let t = 0; t < count; t++) {
      out[k + t].start = left + slot * t;
      out[k + t].end = left + slot * (t + 1);
    }
    k = end;
  }

  return out;
}
