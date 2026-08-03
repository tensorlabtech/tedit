"""Tách người khỏi nền, xuất một VIDEO MẶT NẠ xám cùng nhịp với video vào.

    python segment.py <video vào> <mặt nạ ra.mp4> [bề rộng mặt nạ]

Chạy cục bộ, cùng lý lẽ với `asr/transcribe.py`: không gửi hình của người dùng
đi đâu, và không cần khoá API nào.

── VÌ SAO XUẤT RA MỘT VIDEO, KHÔNG XUẤT DÃY PNG ──

Bên vẽ là ffmpeg, và ffmpeg nhận một luồng video làm đầu vào thứ hai rồi
`alphamerge` là xong. Dãy PNG thì phải khai `-framerate` khớp tay, và một video
133 giây là bốn nghìn tệp trong `work/` — mỗi lượt dựng lại phải dọn.

── VÌ SAO MẶT NẠ NHỎ HƠN KHUNG ──

Mô hình chạy ở 256×256 rồi phóng ngược, nên mặt nạ vốn đã MỀM MÉP — không có
chi tiết nào để giữ ở khổ đầy. Đo trên máy này: xuất ở nửa khổ thì nhanh hơn và
tệp nhỏ hơn hẳn, mà mép cắt không đổi. Bên dùng cứ `scale` lên là khớp.

── MÔ HÌNH ──

`selfie_segmenter.tflite` của MediaPipe, 244 KB, sinh ra đúng cho ca người ngồi
nói trước máy. Không phải mô hình phân đoạn tổng quát — và đó là điều tốt: nó
nhanh hơn hai bậc, mà video của sản phẩm này gần như luôn là ca ấy.

── ĐỪNG ĐẢO KÊNH ──

Kênh 0 của `selfie_segmenter` là NGƯỜI, không phải nền. Bản đầu tôi lấy
`1 − kênh0` theo thói quen từ các mô hình khác, và mặt nạ ra ngược hoàn toàn.

Điều đáng sợ là nó **vẫn trông đúng** ở hai phép thử: dán chữ ra sau người thì
chữ hiện lên trên mặt người (mà mặt người đang che nửa khung nên nhìn thoáng vẫn
ra "có chữ"), còn viền quanh người thì nở NỀN vào trong nên vành rơi vào mép
trong của người — nhìn vẫn ra một cái viền.

Thứ bắt được nó là phép đo: chia khung năm dải rồi hỏi "người chiếm bao nhiêu
phần trăm mỗi dải". Dải trên cùng ra 100% trong khi trên đó là trần nhà.
"""

import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
MODEL = HERE / "selfie_segmenter.tflite"

# Nửa khổ dọc chuẩn. Xem ghi chú đầu tệp.
DEFAULT_WIDTH = 540


def probe(path: str) -> tuple[int, int, str]:
    """Bề rộng, chiều cao, nhịp khung của video vào."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,r_frame_rate",
         "-of", "csv=p=0:s=x", path],
        capture_output=True, text=True, check=True).stdout.strip()
    w, h, rate = out.split("x")
    return int(w), int(h), rate


def main() -> int:
    if len(sys.argv) < 3:
        print("Cần: <video vào> <mặt nạ ra.mp4> [bề rộng]", file=sys.stderr)
        return 2
    src, dst = sys.argv[1], sys.argv[2]
    if not MODEL.exists():
        print(f"Thiếu mô hình: {MODEL}", file=sys.stderr)
        return 3

    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision
    import mediapipe as mp

    src_w, src_h, rate = probe(src)
    out_w = int(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_WIDTH
    # Chẵn cả hai chiều — bộ mã hoá từ chối số lẻ.
    out_h = int(round(src_h * out_w / src_w)) // 2 * 2
    out_w = out_w // 2 * 2

    # Giải mã sang RGB thô ở ĐÚNG khổ mặt nạ: để ffmpeg thu nhỏ thay vì thu bằng
    # Python, vì nó làm việc ấy nhanh hơn nhiều và ta vốn đã phải gọi nó.
    dec = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", src,
         "-vf", f"scale={out_w}:{out_h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE)
    # Kèm một luồng tiếng CÂM.
    #
    # Mặt nạ phải đi qua đúng hàm cắt đoạn mà bản xuất đi qua (`cutRanges`), vì
    # chỉ thế mới chắc hai bên không lệch một khung nào. Mà hàm ấy dựng cả nhánh
    # tiếng rồi `-map [aout]` — nạp một tệp câm vào là nó gãy.
    #
    # Thêm ở đây rẻ hơn nhiều so với thêm một nhánh "tệp này không có tiếng" vào
    # hàm cắt: hàm ấy là đường đi của MỌI bản xuất, còn tiếng câm thì tốn vài
    # kilobyte và làm mặt nạ thành một video bình thường như mọi tệp khác.
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y",
         "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{out_w}x{out_h}",
         "-r", rate, "-i", "-",
         "-f", "lavfi", "-i", "anullsrc=channel_layout=mono:sample_rate=16000",
         "-shortest", "-c:a", "aac", "-b:a", "8k",
         # `-crf 0` không cần: mép mặt nạ vốn mềm, và một chút nhiễu nén ở đó
         # không nhìn ra được. `18` cho tệp nhỏ hơn nhiều lần.
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
         "-pix_fmt", "gray", dst],
        stdin=subprocess.PIPE)

    opts = vision.ImageSegmenterOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(MODEL)),
        running_mode=vision.RunningMode.VIDEO,
        output_category_mask=False,
        output_confidence_masks=True)

    frame_bytes = out_w * out_h * 3
    # Nhịp khung dạng "30000/1001" — đổi ra mili giây cho mốc của mô hình.
    num, den = (rate.split("/") + ["1"])[:2]
    step_ms = 1000.0 * float(den) / float(num)

    count = 0
    with vision.ImageSegmenter.create_from_options(opts) as seg:
        while True:
            raw = dec.stdout.read(frame_bytes)
            if len(raw) < frame_bytes:
                break
            rgb = np.frombuffer(raw, np.uint8).reshape(out_h, out_w, 3)
            image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
            res = seg.segment_for_video(image, int(count * step_ms))
            person = np.squeeze(res.confidence_masks[0].numpy_view())
            enc.stdin.write((person * 255).astype(np.uint8).tobytes())
            count += 1

    enc.stdin.close()
    dec.stdout.close()
    enc.wait()
    dec.wait()
    print(f'{{"frames": {count}, "width": {out_w}, "height": {out_h}}}')
    return 0


if __name__ == "__main__":
    sys.exit(main())
