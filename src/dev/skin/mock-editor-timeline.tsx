/**
 * Dải thời gian của màn editor giả.
 *
 * Dùng mức 2 (chroma 0,12) — mức trung dung trong ba mức của bảng phía trên.
 * Bảng kia để so ba mức cạnh nhau; ở đây là để xem một mức hoạt động thế nào
 * khi đứng cùng cả màn.
 */

const TICKS = [
  "0:45",
  "0:50",
  "0:55",
  "1:00",
  "1:05",
  "1:10",
  "1:15",
  "1:20",
  "1:25",
  "1:30",
];

/** Sóng âm — cố định chứ không sinh ngẫu nhiên, để mỗi lần vẽ lại không nhảy. */
const WAVE = [
  3, 7, 12, 8, 15, 22, 18, 11, 6, 9, 14, 20, 24, 19, 13, 8, 5, 10, 16, 21, 17,
  12, 7, 4, 8, 13, 18, 23, 20, 15, 9, 6, 11, 17, 22, 16, 10, 7, 4, 9,
];

const BLOCKS = [
  {
    lane: "Chữ trên màn",
    hue: 310,
    items: [
      { label: "Sopra Studio", left: "2%", width: "22%" },
      { label: "LOU NADAL · PARIS 75000", left: "26%", width: "38%" },
      { label: "2023", left: "68%", width: "14%" },
    ],
  },
  {
    lane: "Tư liệu chèn",
    hue: 195,
    items: [
      { label: "phố đêm", left: "6%", width: "16%" },
      { label: "bàn tay", left: "30%", width: "12%" },
      { label: "cận mặt", left: "48%", width: "20%" },
      { label: "toàn cảnh", left: "72%", width: "18%" },
    ],
  },
];

export function MockEditorTimeline() {
  return (
    <div className="grid gap-2">
      {/* Thước — chữ số đều bề ngang, mốc không nhảy khi cuộn */}
      <div className="flex justify-between px-1 font-mono text-[0.7rem] tabular-nums text-muted-foreground">
        {TICKS.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>

      <div className="relative grid gap-1">
        {BLOCKS.map((row) => (
          <div key={row.lane} className="relative h-6">
            {row.items.map((item) => (
              <div
                key={item.label}
                className="absolute flex h-6 items-center overflow-hidden rounded-[3px] px-2 text-xs whitespace-nowrap"
                style={{
                  left: item.left,
                  width: item.width,
                  background: `oklch(0.44 0.15 ${row.hue})`,
                  color: `oklch(0.96 0.05 ${row.hue})`,
                }}
              >
                {item.label}
              </div>
            ))}
          </div>
        ))}

        {/* Lời chép — khối dài liền một mạch, kèm sóng âm.
            "Trang trí duy nhất được phép là dữ liệu": sóng âm vừa làm dải bớt
            trơ vừa cho biết chỗ nào có tiếng. */}
        <div
          className="flex h-10 items-center gap-px overflow-hidden rounded-[3px] px-2"
          style={{ background: "oklch(0.44 0.15 145)" }}
        >
          {WAVE.map((height, index) => (
            <div
              key={index}
              className="flex-1 rounded-full"
              style={{
                height: `${height}px`,
                background: "oklch(0.96 0.05 145)",
                opacity: 0.75,
              }}
            />
          ))}
        </div>

        {/* Con trỏ chạy — một trong bốn vệt màu chủ đạo được phép có trên màn.
            Nó ở đây vì đây đúng là "chỗ đang xảy ra". */}
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-primary"
          style={{ left: "43%" }}
        >
          <div className="absolute -top-1 -left-1 size-2 rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
