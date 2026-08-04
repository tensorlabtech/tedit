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
 * Mười bốn chặng máy gộp vào đúng hai bước ở đây (`preparing` và `building`).
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
 * Giữa `cut` và `proofread`. Qua đó là chép lời lại, bản chép cũ mất hẳn.
 *
 * Bảy chỗ còn lại quay về được mà chẳng hỏng gì. Khoá hết là chặt hơn dữ liệu
 * đòi hỏi, và người dùng va vào cái khoá vô cớ đầu tiên là mất tin vào cả cái
 * sidebar — một cái khoá có lý do thì họ chấp nhận, bảy cái thì họ đọc ra là
 * phần mềm cứng nhắc.
 */

export type FlowStepId =
  | "main-footage"
  | "b-roll"
  | "brief"
  | "preparing"
  | "cut"
  | "proofread"
  | "building"
  | "studio";

/** Bước này ai làm — quyết định bên phải bày gì, và sidebar tô màu ra sao. */
export type FlowActor = "user" | "machine";

export type FlowStep = {
  id: FlowStepId;
  label: string;
  /** Cụm thị giác. Tám dòng gom thành bốn cụm thì đọc ra bốn chặng. */
  group: "intake" | "review" | "polish";
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
  { id: "main-footage", label: "Cảnh chính", group: "intake", actor: "user", blocks: false },
  { id: "b-roll", label: "Cảnh phụ", group: "intake", actor: "user", blocks: false },
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
  { id: "brief", label: "Đề bài", group: "intake", actor: "user", blocks: false },
  { id: "preparing", label: "Chuẩn bị", group: "intake", actor: "machine", blocks: true },
  { id: "cut", label: "Cắt đoạn lỗi", group: "review", actor: "user", blocks: true },
  { id: "proofread", label: "Soát lời", group: "review", actor: "user", blocks: true },
  { id: "building", label: "Máy dựng nốt", group: "review", actor: "machine", blocks: true },
  { id: "studio", label: "Bàn dựng", group: "polish", actor: "user", blocks: false },
];

/** Bước duy nhất qua rồi không về được, và bước ngay sau nó. */
export const ONE_WAY_AFTER: FlowStepId = "cut";

/** Trạng thái thật cần để suy ra bước. Gọn nhất có thể — thêm trường là thêm chỗ lệch. */
export type FlowState = {
  hasMain: boolean;
  hasBrief: boolean;
  /**
   * Chặng máy ĐANG dừng ở — đang chạy, hoặc đang mở cổng chờ người.
   *
   * Một trường thay cho hai (`awaiting` + `started`) vì cả hai đều là câu trả lời
   * mờ cho cùng câu hỏi "máy đang ở đâu", và mờ thì phải đoán nốt phần còn lại.
   * Đúng chỗ ấy đã sai: có `started` mà không có cổng nào mở thì bản cũ luôn trả
   * "Chuẩn bị", nên chốt bản cắt xong sidebar NHẢY LÙI từ bước 5 về bước 4 trong
   * khi máy đang chạy `commit-cut` — chặng của bước 6.
   */
  stage: string | null;
  /** Mạch đã chạy hết chưa. */
  settled: boolean;
  /** Mạch đã khởi động chưa — chưa thì người dùng còn ở phần nạp. */
  started: boolean;
};

/** Bước nào nhận chặng máy này. `null` với chặng lạ. */
export function stepOfStage(stage: string): FlowStepId | null {
  const owner = (Object.keys(STAGES_OF) as FlowStepId[]).find((id) =>
    STAGES_OF[id].includes(stage),
  );
  return owner ?? null;
}

/**
 * Đang ở bước nào.
 *
 * Đọc từ dưới lên: trạng thái muộn nhất thắng. Viết xuôi thì mỗi nhánh phải
 * loại trừ mọi nhánh sau nó, và cái đó hỏng ngay khi thêm bước thứ chín.
 */
export function currentStep(state: FlowState): FlowStepId {
  if (state.settled) return "studio";
  /*
   * Máy đang ở chặng nào thì người đang ở bước SỞ HỮU chặng ấy.
   *
   * Tra bảng chứ không xét từng cổng một: `STAGES_OF` đã khai mười bốn chặng
   * thuộc bước nào rồi, nên thêm một chặng vào mạch là bảng ấy tự trả lời. Bản
   * cũ liệt kê tay hai cổng rồi rơi về "Chuẩn bị" cho mọi trường hợp khác —
   * đúng với năm chặng đầu, sai với chín chặng sau.
   */
  if (state.stage) {
    const owner = stepOfStage(state.stage);
    if (owner) return owner;
  }
  if (state.started) return "preparing";
  /*
   * Đi theo ĐÚNG thứ tự sidebar: cảnh chính → cảnh phụ → đề bài.
   *
   * Bản đầu xét `hasBrief` trước `b-roll`, nên dự án có cảnh chính mà chưa nhập
   * đề bài nhảy thẳng bước 3 và bỏ qua bước 2 — luồng tám bước mà bước 2 chỉ
   * tới được sau khi đã làm bước 3.
   *
   * Cảnh phụ KHÔNG bắt buộc, nên không có cách nào biết người dùng "xong" nó.
   * Mốc để đi tiếp là ĐỀ BÀI: có đề bài nghĩa là họ đã đi qua bước 2 rồi.
   */
  if (!state.hasMain) return "main-footage";
  if (!state.hasBrief) return "b-roll";
  return "brief";
}

/** Bước `id` đứng thứ mấy. `-1` với tên lạ. */
export function stepIndex(id: FlowStepId): number {
  return FLOW_STEPS.findIndex((step) => step.id === id);
}

/**
 * Bước `to` có quay về được từ `from` không.
 *
 * Đi tới luôn được. Quay lui chỉ bị chặn khi phải bước qua cửa một chiều —
 * `cut` là bước cuối còn về được, mọi bước sau nó không về trước nó.
 */
export function canGoBack(from: FlowStepId, to: FlowStepId): boolean {
  const a = stepIndex(from);
  const b = stepIndex(to);
  if (b >= a) return true;
  const door = stepIndex(ONE_WAY_AFTER);
  return !(a > door && b <= door);
}

/**
 * Chặng máy nào thuộc bước nào — để ô phải chỉ bày phần của bước đang đứng.
 *
 * ══ VÌ SAO CẦN ══
 *
 * Bản đầu bước "Chuẩn bị" bày cả mười bốn chặng, kể cả những chặng chạy sau khi
 * người dùng soát cắt xong. Người xem đọc ra là "máy đang làm hết mọi thứ", rồi
 * tới bước 7 lại thấy y nguyên danh sách ấy lần nữa.
 *
 * ══ KHE GIỮA BƯỚC 5 VÀ 6 ══
 *
 * `commit-cut` và `fix` chạy SAU cổng soát cắt và TRƯỚC cổng soát chính tả — hai
 * chặng không bước nào nhận. Chúng thuộc về bước SOÁT LỜI: chúng chính là thứ
 * dựng nên bản chép mà bước ấy sắp soát, nên lúc chờ chúng, người dùng đang chờ
 * bước 6 mở ra.
 */
export const STAGES_OF: Record<FlowStepId, string[]> = {
  "main-footage": [],
  "b-roll": [],
  brief: [],
  preparing: ["prepare", "describe", "transcribe", "silence", "cuts"],
  cut: ["review-cut"],
  proofread: ["commit-cut", "fix", "review-text"],
  building: ["captions", "keywords", "place", "effects", "music"],
  studio: [],
};
