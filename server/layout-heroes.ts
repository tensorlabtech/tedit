import type { StylePack } from "./style-pack";

/**
 * Thiết bị nổi mà bộ dáng có, để lịch màn xoay vòng qua chúng.
 *
 * Suy từ khai báo, không cho khai tay — một ô khai riêng là nguồn sự thật thứ hai,
 * và nó lệch mà không ai thấy.
 *
 * Tách riêng để cả đường xuất (`pipeline.ts`) lẫn endpoint xem trước
 * (`scene-schedule.ts`) gọi CÙNG một hàm — lịch màn hai nơi phải suy thiết bị nổi
 * giống hệt nhau, không thì bản xem lệch bản xuất.
 */
export function layoutHeroes(pack: StylePack): string[] {
  const out: string[] = [];
  if (pack.behindText) out.push("chu-sau-nguoi");
  if (pack.subjectEdge) out.push("vien-nguoi");
  if (pack.sweep) out.push("vet-quet");
  if (pack.graphics?.length) out.push("hinh-dan");
  // Không thiết bị nào thì bố cục TỰ nó là thiết bị nổi: đổi cả khung hình đã là
  // thay đổi lớn nhất người xem thấy được.
  return out.length > 0 ? out : ["doi-bo-cuc"];
}
