import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { Section } from "../landing-section";
import { SectionHeading } from "../landing-ui";
import { Reveal } from "../reveal";

/**
 * Câu hỏi thường gặp. Nội dung nói THẬT về trạng thái sản phẩm (bản thử nội bộ,
 * invite-only, tiếng Việt) — không hứa thứ chưa có.
 */
const FAQS = [
  {
    q: "Tedit là gì?",
    a: "Công cụ biến bản ghi thành video có chữ chạy theo tiếng, có nhạc và tư liệu chèn. Máy chép lời, cắt lặng, gieo chữ và dựng sẵn bản nháp; bạn chỉ sửa chỗ cần.",
  },
  {
    q: "Có cần biết dựng video không?",
    a: "Không. Máy lo phần nháp — chép lời, cắt lặng, gieo chữ. Bạn chỉ nghe lại, sửa chữ và chọn phong cách. Việc khó và nhàm đã có máy làm.",
  },
  {
    q: "Chép lời tiếng Việt có chuẩn dấu không?",
    a: "Có. Máy chép lời tiếng Việt đầy đủ dấu. Chỗ nào máy nghe nhầm thì bạn sửa ngay trên bản chép, chữ trên video tự cập nhật theo.",
  },
  {
    q: "Tải video nặng lên có được không?",
    a: "Được. Tệp đi lên theo từng mảnh nhỏ, đứt ở đâu tải tiếp từ đó, nên video quay bằng điện thoại vài trăm MB vẫn lên tới nơi.",
  },
  {
    q: "Ai dùng được bây giờ?",
    a: "Đang là bản thử nội bộ, chỉ mở cho tài khoản được cấp quyền. Đăng nhập bằng Google bằng email đã được thêm vào danh sách.",
  },
];

export function Faq() {
  return (
    <Section id="cau-hoi" width="narrow" className="scroll-mt-16 bg-muted/20">
      <SectionHeading
        eyebrow="Câu hỏi"
        title="Những điều hay được hỏi"
        className="mb-16"
      />

      <Reveal>
        <Accordion className="rounded-2xl border border-border bg-card px-6">
          {FAQS.map((item, index) => (
            <AccordionItem key={item.q} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-base font-medium">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-pretty">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </Section>
  );
}
