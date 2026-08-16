"""Tách TỪ tiếng Việt cho chunker phụ đề — trả chỗ CẤM ngắt (giữa một từ nhiều tiếng).

Đầu vào (stdin, JSON): {"sentences": [["mình","muốn","xây","dựng",...], ...]}
  mỗi câu là danh sách TIẾNG (đúng thứ tự, như Whisper chép).

Đầu ra (stdout, JSON): {"noBreak": [[<local idx>...], ...]}
  với mỗi câu, danh sách chỉ số tiếng (0-based, CỤC BỘ trong câu) mà SAU nó KHÔNG
  được ngắt cụm — vì nó dính với tiếng sau thành một TỪ ("phần"→"mềm").

underthesea `word_tokenize(format='text')` nối các tiếng cùng một từ bằng '_'
("phần_mềm"). Ta căn ngược output về đúng dãy tiếng đầu vào; tiếng KHÔNG-cuối của
một từ nhiều tiếng thì "cấm ngắt sau". Lệch căn (dấu câu, tách lạ) thì bỏ qua an
toàn (coi như không dính) — thà mất một cơ hội giữ-từ còn hơn dán nhầm.
"""

import json
import re
import sys

from underthesea import word_tokenize

_norm = lambda s: re.sub(r"[^0-9a-zà-ỹ]", "", s.lower())


def no_break_indices(syllables):
    """Căn theo TIẾNG đã bỏ dấu câu, khớp CẢ DÃY — lệch thì bỏ glue (an toàn).

    Bản trước căn theo cấu trúc token nên dấu câu ("?" dính thành "?_Thế_là") làm
    con trỏ lệch, kéo mọi glue sau đó trật chỗ. Giờ chuẩn-hoá bỏ dấu câu cả hai
    phía rồi so vị-trí-với-vị-trí: chỉ đánh dấu khi TOÀN dãy tiếng khớp (underthesea
    không thêm/bớt tiếng, chỉ NHÓM lại). Sai một chỗ là bỏ cả câu, thà mất bảo hiểm
    còn hơn dán nhầm.
    """
    # tiếng của ta: (chỉ số gốc, dạng chuẩn), bỏ tiếng thuần dấu câu (chuẩn rỗng)
    ours = [(i, _norm(s)) for i, s in enumerate(syllables)]
    ours = [(i, n) for (i, n) in ours if n]

    text = " ".join(syllables)
    tokens = word_tokenize(text, format="text").split(" ")
    # duỗi phẳng: (dạng chuẩn, dính-tiếng-sau) — tiếng KHÔNG-cuối của một từ thì dính
    flat = []
    for tok in tokens:
        reals = [n for n in (_norm(p) for p in tok.split("_")) if n]
        for j, n in enumerate(reals):
            flat.append((n, j < len(reals) - 1))

    if len(flat) != len(ours):
        return []  # lệch dãy → bỏ glue an toàn
    out = []
    for (n_flat, glued), (idx, n_our) in zip(flat, ours):
        if n_flat != n_our:
            return []  # nội dung lệch → bỏ glue an toàn
        if glued:
            out.append(idx)
    return out


def main():
    data = json.load(sys.stdin)
    result = [no_break_indices(s) for s in data.get("sentences", [])]
    json.dump({"noBreak": result}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
