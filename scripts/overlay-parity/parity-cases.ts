import type { Band } from "../../server/style-pack";

/**
 * Bộ chữ mẫu dùng CHUNG cho cả hai nửa phép kiểm lệch.
 *
 * Chọn theo chỗ dễ lệch nhất chứ không chọn ngẫu nhiên: cụm chạm trần cỡ chữ
 * (rất ngắn), cụm chạm trần bề rộng (dài vừa), cụm chạm trần dòng (rất dài), và
 * chữ HOA — vì dấu chồng dấu chữ hoa là chỗ hai đường đo xa nhau nhất.
 */
export const CASES: Array<{ text: string; band: Band }> = [
  { text: "Bắt đầu đi", band: "top" },
  { text: "Nghĩ kỹ", band: "middle" },
  { text: "Mình đã từng nghĩ chuyện này rất khó", band: "top" },
  { text: "Mình đã từng nghĩ chuyện này rất khó", band: "bottom" },
  { text: "Ba mươi tuổi vẫn chưa có gì trong tay", band: "middle" },
  {
    text: "Nghĩ kỹ trước khi quyết định điều gì đó thật sự quan trọng với mình",
    band: "top",
  },
  { text: "ĐỪNG BỎ CUỘC Ở ĐÂY", band: "top" },
  { text: "ẾCH ỮA ẶNG ẮT ỔN ỖI ỰC ỠM", band: "bottom" },
  { text: "Chuyện này khó hơn tôi tưởng rất nhiều lần", band: "bottom" },
  { text: "Một câu ngắn", band: "bottom" },
];
