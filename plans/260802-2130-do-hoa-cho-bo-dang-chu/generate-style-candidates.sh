#!/bin/bash
# Sinh hàng loạt ứng viên style pack rồi render lên khung hình thật.
# Mỗi ứng viên = font chính + font phụ + màu nhấn + motif hình học + cách nền chữ.
set -e
cd "$(dirname "$0")"

BG=../mock/vbg.png
R=/Users/lethai/Desktop/projects/startup/teddit-v2/assets/fonts
OUT=out
mkdir -p $OUT svg

printf 'cái' > w1.txt && printf 'QUAN TRỌNG' > w2.txt && printf 'nhất' > w3.txt

# --- motif sinh từ tham số, xuất SVG, dựng ra PNG trắng ---
make_frame() {  # $1=tên $2=lề $3=độ dày $4=hở góc
  cat > svg/$1.svg <<EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" fill="none">
 <path d="M$(($2+$4)) $2 H$((1080-$2-$4)) M$(($2+$4)) $((1920-$2)) H$((1080-$2-$4))
          M$2 $(($2+$4)) V$((1920-$2-$4)) M$((1080-$2)) $(($2+$4)) V$((1920-$2-$4))"
       stroke="#FFFFFF" stroke-width="$3" stroke-linecap="round"/>
</svg>
EOF
  rsvg-convert -w 1080 -h 1920 svg/$1.svg -o $OUT/$1.png
}

make_bar() {    # $1=tên $2=bề rộng thanh dọc trái
  cat > svg/$1.svg <<EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" fill="none">
 <rect x="72" y="1060" width="$2" height="420" fill="#FFFFFF"/>
</svg>
EOF
  rsvg-convert -w 1080 -h 1920 svg/$1.svg -o $OUT/$1.png
}

make_underline() {  # $1=tên — gạch chân lượn kiểu vẽ tay
  cat > svg/$1.svg <<EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" fill="none">
 <path d="M150 1352 C 340 1338, 520 1372, 700 1348 S 880 1330, 936 1352"
       stroke="#FFFFFF" stroke-width="13" stroke-linecap="round"/>
</svg>
EOF
  rsvg-convert -w 1080 -h 1920 svg/$1.svg -o $OUT/$1.png
}

# tô màu cho PNG trắng bằng ffmpeg — một hình dùng cho mọi màu
tint() {  # $1=nguồn $2=màu $3=đích
  ffmpeg -v error -y -i $OUT/$1.png -filter_complex \
    "[0:v]alphaextract[m];color=c=$2:s=1080x1920[c];[c][m]alphamerge[o]" \
    -map "[o]" -frames:v 1 -update 1 $OUT/$3.png
}

make_frame  frame-wide 64 3 120
make_frame  frame-tight 40 6 40
make_bar    bar-left 10
make_underline underline

# --- render một ứng viên ---
# $1 tên · $2 font chính · $3 font phụ · $4 màu nhấn · $5 lớp hình (rỗng = không)
# $6 grade sat · $7 kiểu nền chữ: none | box | invert
render() {
  local name=$1 f1=$2 f2=$3 accent=$4 layer=$5 sat=$6 mode=$7
  local key="drawtext=fontfile=$f1:textfile=w2.txt:fontsize=104"
  case $mode in
    box)    key="$key:fontcolor=black:box=1:boxcolor=$accent@1:boxborderw=20" ;;
    invert) key="$key:fontcolor=$accent:borderw=4:bordercolor=black@0.6" ;;
    none)   key="$key:fontcolor=$accent" ;;
  esac
  local inputs="-i $BG" ; local pre="[0:v]eq=brightness=0.02:saturation=$sat[base];[base]"
  if [ -n "$layer" ]; then
    inputs="$inputs -i $OUT/$layer.png"
    pre="[0:v]eq=brightness=0.02:saturation=$sat[b0];[b0][1:v]overlay=0:0[base];[base]"
  fi
  ffmpeg -v error -y $inputs -filter_complex \
"${pre}drawtext=fontfile=$f2:textfile=w1.txt:fontsize=68:fontcolor=white@0.95:x=(w-text_w)/2:y=1130[a];\
[a]${key}:x=(w-text_w)/2:y=1228[b];\
[b]drawtext=fontfile=$f2:textfile=w3.txt:fontsize=68:fontcolor=white@0.95:x=(w-text_w)/2:y=1400[c]" \
    -map "[c]" -frames:v 1 -update 1 $OUT/style-$name.png
}

tint frame-wide  0xE8DCC8 l-trang
tint frame-tight 0x2ED3B7 l-kinh
tint bar-left    0xFFFFFF l-muc
tint underline   0xFFD400 l-vo

render trang  playfair.ttf   playfair.ttf   0xE8DCC8  l-trang  0.55  none
render muc    lora.ttf       lora.ttf       0xFFFFFF  l-muc    0.70  none
render thu    dancing.ttf    $R/BeVietnamPro-Black.ttf 0x2ED3B7 ""   1.05  none
render vo     patrick.ttf    patrick.ttf    0xFFD400  l-vo     1.00  none
render khoi   bitter.ttf     bitter.ttf     0x3B6FE0  ""       1.10  box
render nang   pacifico.ttf   $R/Lexend-Bold.ttf 0xFFC53D ""    1.15  invert
render kinh   playfair.ttf   $R/Lexend-Bold.ttf 0x2ED3B7 l-kinh 0.85 invert

magick montage -label '' $OUT/style-*.png -tile 7x -geometry 300x+7+7 \
  -background '#141414' candidates.jpg
echo "Sinh xong $(ls $OUT/style-*.png | wc -l | tr -d ' ') ứng viên"
