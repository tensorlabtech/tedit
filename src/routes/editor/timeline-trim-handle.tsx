/** Bề rộng vùng bắt tay — đặc tả §5 chốt ≥14px để không thành mục tiêu 6px. */
export const HANDLE_WIDTH = 14;

/** Cặp tay nắm hai đầu một khối — dùng chung cho đoạn video và bài nhạc. */
export function TrimHandles({
  start,
  end,
  onGrab,
  onRestore,
}: {
  start: number;
  end: number;
  onGrab: (edge: "start" | "end") => void;
  /** Nhấp đúp: trả lại trọn chỗ đã gọt ở mép này, nếu có chỗ nào để trả */
  onRestore?: (edge: "start" | "end") => void;
}) {
  return (
    <>
      {(["start", "end"] as const).map((edge) => (
        <TrimHandle
          key={edge}
          x={edge === "start" ? start : end}
          edge={edge}
          onPointerDown={(event) => {
            event.stopPropagation();
            onGrab(edge);
          }}
          onDoubleClick={
            onRestore &&
            ((event) => {
              event.stopPropagation();
              onRestore(edge);
            })
          }
        />
      ))}
    </>
  );
}

/**
 * Tay nắm gọt mép — vạch nằm TRONG khối, vùng bắt vắt qua mép.
 *
 * Bản trước để vạch nằm HẲN NGOÀI thân khối. Đo ra: khối `[785 … 1051]`, vạch
 * trái `[781 … 784]`, vạch phải `[1052 … 1055]` — mỗi bên hở đúng 1px, và vì
 * khối bo góc `rounded-md` còn vạch thì vuông suốt chiều cao nên ở bốn góc cái
 * khe ấy loe ra trông rộng hơn nhiều. Đọc ra thành "một khối và hai thanh rời",
 * không thành "một khối có hai mép kéo được".
 *
 * Đời thứ hai kéo vạch vào trong 2px và thụt 3px trên dưới cho lọt vào đường bo
 * góc. Vẫn hở — và phóng to 5 lần mới thấy vì sao: vạch bo tròn CẢ HAI ĐẦU, nên
 * ở góc trên và góc dưới nó cong tách khỏi mép khối, chừa lại đúng hai cái khe
 * hình lưỡi liềm. Thụt vào để tránh góc bo thì chính chỗ thụt ấy thành khe.
 *
 * Cách duy nhất không bao giờ hở là ĐỪNG VẼ MỘT VẬT RỜI: vạch phải là chính cái
 * MÉP của khối, dày lên. Nên nó chạy SUỐT chiều cao và bo góc CÙNG BÁN KÍNH với
 * khối, chỉ bo phía ngoài — phía trong vuông để dính liền vào thân. Không còn
 * chỗ nào cho khe len vào.
 *
 * Vùng bắt vẫn VẮT QUA mép (7px trong, 7px ngoài), đủ 14px như đặc tả §5, và
 * chạm được từ cả hai phía.
 */
export function TrimHandle({
  x,
  edge,
  onPointerDown,
  onDoubleClick,
}: {
  x: number;
  edge: "start" | "end";
  onPointerDown: (event: React.PointerEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      data-block
      tabIndex={-1}
      aria-label={edge === "start" ? "Gọt mép trái" : "Gọt mép phải"}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className="group absolute inset-y-0 z-20"
      style={{
        left: x - HANDLE_WIDTH / 2,
        width: HANDLE_WIDTH,
        cursor: "ew-resize",
      }}
    >
      {/* KHÔNG vẽ gì ở đây nữa — tay nắm chỉ còn là vùng bắt chuột.
          Phần nhìn thấy là hai MÉP DÀY của chính khối (xem `TimelineBlock`,
          thuộc tính `trimmable`). Mọi đời trước đều vẽ một vật rời rồi tìm cách
          ép nó khít với khối: lệch 1px, khe hình lưỡi liềm ở góc bo, rồi bậc
          chuyển tiếp giữa 2px và 4px. Vật rời thì luôn còn một chỗ để hở. */}
    </button>
  );
}
