"""Kiểm phủ ký tự tiếng Việt của từng tệp font trong `assets/fonts/`.

Đọc thẳng bảng `cmap` chứ không nhìn ảnh: ffmpeg in ô vuông rỗng khi thiếu
glyph, mà ô vuông rỗng ở ảnh 1080×1920 thu nhỏ trông y hệt một chữ đậm. Bảng
`cmap` trả lời dứt khoát, ảnh chỉ trả lời chuyện đẹp xấu.

    python3 scripts/font-audit/check-glyph-coverage.py

Quét THƯ MỤC chứ không quét danh sách ứng viên. ffmpeg in bằng tệp nằm trong
`assets/fonts/`, nên thứ phải bảo đảm là "mọi tệp đi theo repo đều đủ dấu" —
một tệp thả vào mà quên khai vào `font-candidates.json` thì vẫn in ra được, và
đó đúng là ca mà phép kiểm chạy theo danh sách bỏ lọt.
"""

import json
import unicodedata
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
FONTS_DIR = ROOT / "assets" / "fonts"
CATALOG = json.loads((Path(__file__).parent / "font-candidates.json").read_text())

BASE_VOWELS = "aăâeêioôơuưy"
TONES = ["", "̀", "́", "̃", "̉", "̣"]


def vietnamese_alphabet() -> list[str]:
    """Toàn bộ chữ cái tiếng Việt ở dạng dựng sẵn, cả hoa lẫn thường."""
    letters: list[str] = []
    for vowel in BASE_VOWELS:
        for tone in TONES:
            composed = unicodedata.normalize("NFC", vowel + tone)
            if len(composed) == 1:
                letters.append(composed)
    letters.append("đ")
    return letters + [letter.upper() for letter in letters]


def covered_codepoints(path: Path) -> set[int]:
    font = TTFont(str(path), fontNumber=0, lazy=True)
    codepoints: set[int] = set()
    for table in font["cmap"].tables:
        codepoints.update(table.cmap.keys())
    font.close()
    return codepoints


def has_variable_axes(path: Path) -> bool:
    """Font còn bảng `fvar` là font biến thiên — freetype sẽ vẽ thể mặc định.

    Tức là chữ in ra mảnh dính dù tên tệp ghi Bold. Bắt ở đây vì đó là ca duy
    nhất mà mọi phép kiểm khác đều xanh còn bản xuất thì sai dáng.
    """
    font = TTFont(str(path), fontNumber=0, lazy=True)
    variable = "fvar" in font
    font.close()
    return variable


def main() -> int:
    alphabet = vietnamese_alphabet()
    print(f"Kiểm {len(alphabet)} chữ cái tiếng Việt dựng sẵn\n")

    labels = {f["file"]: f["label"] for f in CATALOG["families"]}
    # Quét thư mục: đây là tập tệp ffmpeg thật sự in bằng.
    entries = [
        (labels.get(path.name, f"{path.name} (chưa khai trong font-candidates.json)"), path)
        for path in sorted(FONTS_DIR.glob("*.ttf"))
    ]
    # Ứng viên đã khai mà thiếu tệp cũng là trượt — nếu không thì xoá một tệp
    # font đi vẫn xanh, và lỗi chỉ lộ ra lúc xuất video.
    entries += [
        (f["label"], FONTS_DIR / f["file"])
        for f in CATALOG["families"]
        if not (FONTS_DIR / f["file"]).exists()
    ]
    reference = CATALOG["reference"]
    if Path(reference["file"]).exists():
        entries.append((reference["label"], Path(reference["file"])))

    failures = 0
    for label, path in entries:
        if not path.exists():
            print(f"✗ {label}: không có tệp {path}")
            failures += 1
            continue
        if has_variable_axes(path):
            failures += 1
            print(f"✗ {label}: font biến thiên chưa đông cứng (còn bảng fvar)")
            continue
        codepoints = covered_codepoints(path)
        missing = [ch for ch in alphabet if ord(ch) not in codepoints]
        if missing:
            failures += 1
            print(f"✗ {label}: thiếu {len(missing)} — {''.join(missing[:24])}")
        else:
            print(f"✓ {label}: đủ")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
