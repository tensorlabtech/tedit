/**
 * TÁM BƯỚC NGƯỜI DÙNG ĐI QUA — vốn từ của sidebar.
 *
 * ══ KHÁC GÌ `STEP_PLAN` ══
 *
 * `pipeline-steps.ts` khai MƯỜI BỐN chặng máy chạy. Đó là nhật ký của máy, và
 * nó phải chi tiết vì mỗi chặng chạy lại riêng được.
 *
 * Tệp này khai TÁM bước NGƯỜI đi qua. Đó là bản đồ, và nó phải thưa — người
 * dùng cần biết "đang ở đâu, còn mấy chặng", không cần biết máy vừa xong lượt
 * chọn từ khoá hay lượt đặt tư liệu.
 *
 * Mười bốn chặng máy gộp vào đúng hai bước ở đây (`chuan-bi` và `dung-not`).
 * Chi tiết vẫn hiện, nhưng ở BÊN PHẢI lúc bước ấy đang chạy — không lên sidebar.
 *
 * ══ VÌ SAO SUY RA CHỨ KHÔNG LƯU ══
 *
 * Bước hiện tại KHÔNG có cột trong CSDL. Nó suy từ trạng thái thật: đã có tệp
 * chính chưa, đã chọn bộ dáng chưa, cổng nào đang mở.
 *
 * Lưu thì thành nguồn thứ hai, và hai nguồn thì có ngày lệch — người dùng đứng
 * ở bước 6 mà cột nói bước 3, không ai gỡ được. Suy ra thì không bao giờ sai,
 * chỉ có thể thiếu dữ liệu để suy.
 *
 * ══ CHỈ MỘT CỬA MỘT CHIỀU ══
 *
 * Giữa `cat-doan` và `soat-loi`. Qua đó là chép lời lại, bản chép cũ mất hẳn.
 *
 * Bảy chỗ còn lại quay về được mà chẳng hỏng gì. Khoá hết là chặt hơn dữ liệu
 * đòi hỏi, và người dùng va vào cái khoá vô cớ đầu tiên là mất tin vào cả cái
 * sidebar — một cái khoá có lý do thì họ chấp nhận, bảy cái thì họ đọc ra là
 * phần mềm cứng nhắc.
 */

export type FlowStepId =
  | "canh-chinh"
  | "canh-phu"
  | "de-bai"
  | "chuan-bi"
  | "cat-doan"
  | "soat-loi"
  | "dung-not"
  | "ban-dung";

/** Bước này ai làm — quyết định bên phải bày gì, và sidebar tô màu ra sao. */
export type FlowActor = "nguoi" | "may";

export type FlowStep = {
  id: FlowStepId;
  label: string;
  /** Cụm thị giác. Tám dòng gom thành bốn cụm thì đọc ra bốn chặng. */
  group: "nap-vao" | "soat" | "chinh";
  actor: FlowActor;
  /**
   * Bước này có CHẶN không.
   *
   * `false` là người dùng đi tiếp được mà không cần nó xong — ba bước nạp tệp
   * đều thế: tải chạy nền, quyết định của người không động tới byte nào, nên
   * bắt đợi là bịa ra một khoảng chờ.
   */
  blocks: boolean;
};

export const FLOW_STEPS: FlowStep[] = [
  // Ba bước nạp KHÔNG chặn: tệp tải nền, còn người thì đi tiếp. Bước "chuẩn bị"
  // mới là chỗ đợi, và lúc ấy nó đợi thật chứ không phải một thanh giả.
  { id: "canh-chinh", label: "Cảnh chính", group: "nap-vao", actor: "nguoi", blocks: false },
  { id: "canh-phu", label: "Cảnh phụ", group: "nap-vao", actor: "nguoi", blocks: false },
  /*
   * Đề bài đứng TRƯỚC chặng nghe, và đó là chỗ đắt nhất của cả luồng.
   *
   * `asr-bias.ts` đưa `profile` vào lời mồi cho máy nghe. Nên mô tả người dùng
   * gõ ở đây SỬA CHÍNH TẢ TRƯỚC KHI LỖI XẢY RA: gõ "frontend, layoff, JD,
   * onsite" thì máy nghe ra đúng ngay, và bước soát lời ngắn hẳn.
   *
   * Chọn bộ dáng cũng ở đây vì bộ dáng khai `minSilence` từ 0,5 tới 1,2 giây —
   * chênh 2,4 lần, và đó chính là ngưỡng quyết quãng lặng nào bị cắt. Chọn sau
   * khi đã soát cắt là làm phần vừa soát thành vô nghĩa.
   */
  { id: "de-bai", label: "Đề bài & phong cách", group: "nap-vao", actor: "nguoi", blocks: false },
  { id: "chuan-bi", label: "Chuẩn bị", group: "nap-vao", actor: "may", blocks: true },
  { id: "cat-doan", label: "Cắt đoạn lỗi", group: "soat", actor: "nguoi", blocks: true },
  { id: "soat-loi", label: "Soát lời", group: "soat", actor: "nguoi", blocks: true },
  { id: "dung-not", label: "Máy dựng nốt", group: "soat", actor: "may", blocks: true },
  { id: "ban-dung", label: "Bàn dựng", group: "chinh", actor: "nguoi", blocks: false },
];

/** Bước duy nhất qua rồi không về được, và bước ngay sau nó. */
export const ONE_WAY_AFTER: FlowStepId = "cat-doan";

/** Trạng thái thật cần để suy ra bước. Gọn nhất có thể — thêm trường là thêm chỗ lệch. */
export type FlowState = {
  hasMain: boolean;
  hasBrief: boolean;
  /** Cổng máy chủ đang mở, `null` là không cổng nào. */
  awaiting: string | null;
  /** Mạch đã chạy hết chưa. */
  settled: boolean;
  /** Mạch đã khởi động chưa — chưa thì người dùng còn ở phần nạp. */
  started: boolean;
};

/**
 * Đang ở bước nào.
 *
 * Đọc từ dưới lên: trạng thái muộn nhất thắng. Viết xuôi thì mỗi nhánh phải
 * loại trừ mọi nhánh sau nó, và cái đó hỏng ngay khi thêm bước thứ chín.
 */
export function currentStep(state: FlowState): FlowStepId {
  if (state.settled) return "ban-dung";
  if (state.awaiting === "soat-chu") return "soat-loi";
  if (state.awaiting === "soat-cat") return "cat-doan";
  // Mạch chạy mà không cổng nào mở: máy đang làm việc của nó. Chưa qua cổng cắt
  // thì là chặng chuẩn bị, qua rồi thì là chặng dựng nốt.
  if (state.started) return "chuan-bi";
  if (!state.hasMain) return "canh-chinh";
  if (!state.hasBrief) return "de-bai";
  return "canh-phu";
}

/** Bước `id` đứng thứ mấy. `-1` với tên lạ. */
export function stepIndex(id: FlowStepId): number {
  return FLOW_STEPS.findIndex((step) => step.id === id);
}

/**
 * Bước `to` có quay về được từ `from` không.
 *
 * Đi tới luôn được. Quay lui chỉ bị chặn khi phải bước qua cửa một chiều —
 * `cat-doan` là bước cuối còn về được, mọi bước sau nó không về trước nó.
 */
export function canGoBack(from: FlowStepId, to: FlowStepId): boolean {
  const a = stepIndex(from);
  const b = stepIndex(to);
  if (b >= a) return true;
  const door = stepIndex(ONE_WAY_AFTER);
  return !(a > door && b <= door);
}
