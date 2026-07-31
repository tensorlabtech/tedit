"""Đo `lineHeight` TỐI THIỂU của từng font, riêng cho chữ hoa và chữ thường.

Vì sao đo bằng metric chứ không bằng mắt: `drawtext` xếp dòng bằng
`y += fontSize * LINE_HEIGHT`, nên hai dòng không đè nhau khi và chỉ khi
`LINE_HEIGHT >= (yMax cao nhất - yMin thấp nhất) / unitsPerEm` trên tập chữ cái
thật sự in ra. Đó là một phép tính, không phải một cảm nhận — và nó trả lời cho
CẢ hai đường vẽ, vì CSS `line-height` cũng là bội của cỡ chữ.

Chữ HOA đội dấu cao hơn chữ thường nhưng KHÔNG có phần chìa xuống của `g`, `y`,
nên hai dạng phải đo riêng: gộp lại là ra một con số quá rộng cho cả hai.

    python3 scripts/font-audit/measure-line-height.py
"""

import json
import unicodedata
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
FONTS_DIR = ROOT / "assets" / "fonts"
CATALOG = json.loads((Path(__file__).parent / "font-candidates.json").read_text())

BASE_VOWELS = "aăâeêioôơuưy"
TONES = ["", "̀", "́", "̃", "̉", "̣"]
# Phụ âm có phần chìa xuống hoặc nhô lên — không mang dấu nhưng vẫn định khung dòng.
EXTRA_LOWER = "bdghklpqtyđ"
EXTRA_UPPER = "BDGHKLPQTĐ"


def lowercase_alphabet() -> list[str]:
    letters = []
    for vowel in BASE_VOWELS:
        for tone in TONES:
            composed = unicodedata.normalize("NFC", vowel + tone)
            if len(composed) == 1:
                letters.append(composed)
    return letters + list(EXTRA_LOWER)


def glyph_bounds(font: TTFont, letters: list[str]) -> tuple[float, float]:
    """Đỉnh cao nhất và đáy thấp nhất của cả tập, tính theo đơn vị font."""
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    top, bottom = 0.0, 0.0
    for letter in letters:
        name = cmap.get(ord(letter))
        if name is None or name not in glyph_set:
            continue
        pen = BoundsPen(glyph_set)
        glyph_set[name].draw(pen)
        if pen.bounds is None:
            continue
        _, y_min, _, y_max = pen.bounds
        top = max(top, y_max)
        bottom = min(bottom, y_min)
    return top, bottom


def main() -> None:
    lower = lowercase_alphabet()
    upper = [letter.upper() for letter in lower] + list(EXTRA_UPPER)

    entries = [(f["label"], f["id"], FONTS_DIR / f["file"]) for f in CATALOG["families"]]
    reference = CATALOG["reference"]
    if Path(reference["file"]).exists():
        entries.append((reference["label"], reference["id"], Path(reference["file"])))

    print(f"{'font':<34} {'thường':>8} {'HOA':>8} {'trộn':>8}")
    print("-" * 62)
    results = {}
    for label, font_id, path in entries:
        if not path.exists():
            continue
        font = TTFont(str(path), fontNumber=0, lazy=True)
        upem = font["head"].unitsPerEm
        lower_top, lower_bottom = glyph_bounds(font, lower)
        upper_top, upper_bottom = glyph_bounds(font, upper)
        font.close()

        lower_min = (lower_top - lower_bottom) / upem
        upper_min = (upper_top - upper_bottom) / upem
        # Dòng chữ HOA nằm trên dòng chữ thường: đỉnh của HOA, đáy của thường.
        mixed_min = (max(lower_top, upper_top) - min(lower_bottom, upper_bottom)) / upem

        results[font_id] = {
            "lowercase": round(lower_min, 3),
            "uppercase": round(upper_min, 3),
            "mixed": round(mixed_min, 3),
        }
        short = label[:33]
        print(f"{short:<34} {lower_min:>8.3f} {upper_min:>8.3f} {mixed_min:>8.3f}")

    target = (
        ROOT
        / "plans"
        / "260731-1046-caption-style-packs"
        / "reports"
        / "font-audit"
        / "line-height-minimums.json"
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
    print(f"\n→ {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
