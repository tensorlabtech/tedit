import type { Band } from "../../server/style-pack";

/**
 * Bộ chữ mẫu dùng CHUNG cho cả hai nửa phép kiểm lệch.
 *
 * Chọn theo chỗ dễ lệch nhất chứ không chọn ngẫu nhiên: cụm chạm trần cỡ chữ
 * (rất ngắn), cụm chạm trần bề rộng (dài vừa), cụm chạm trần dòng (rất dài), và
 * chữ HOA — vì dấu chồng dấu chữ hoa là chỗ hai đường đo xa nhau nhất.
 */
export const CASES: Array<{
  text: string;
  band: Band;
  /**
   * Có từ khoá là cụm đi VAI CHỮ THỨ HAI — cùng luật với đường in
   * (`fontRoleFor`). Không có bốn ca cuối thì phép so này chỉ soi vai phụ đề, và
   * bộ dáng nào dùng hai họ chữ thì nửa dáng của nó không ai canh.
   */
  keywords?: string[];
}> = [
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
  // Bốn ca VAI CẢM XÚC — cùng chỗ dễ lệch như trên, nhưng đi họ chữ thứ hai:
  // cụm rất ngắn (chạm trần cỡ), cụm dài (chạm trần bề rộng), chữ HOA có dấu
  // chồng dấu, và cụm dài nhất (chạm trần dòng).
  { text: "Đủ rồi", band: "middle", keywords: ["đủ"] },
  {
    text: "Mình đã từng nghĩ chuyện này rất khó",
    band: "bottom",
    keywords: ["khó"],
  },
  // Cùng chữ, cùng dải với ca không-từ-khoá ở trên: chỉ đổi MỖI vai chữ, nên
  // lệch ở đây chỉ có thể do vai chữ. Đổi thêm dải nữa là hai biến một lúc.
  { text: "ẾCH ỮA ẶNG ẮT ỔN ỖI ỰC ỠM", band: "bottom", keywords: ["ếch"] },
  {
    text: "Nghĩ kỹ trước khi quyết định điều gì đó thật sự quan trọng với mình",
    band: "bottom",
    keywords: ["quyết"],
  },
];
