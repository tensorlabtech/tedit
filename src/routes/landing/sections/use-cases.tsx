import { useEffect, useState } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

import { Section } from "../landing-section";
import { SectionHeading } from "../landing-ui";
import { Reveal } from "../reveal";

/**
 * Đối tượng dùng — carousel thẻ ẢNH kiểu "Edit in Your Own Way" của Filmora. Mỗi
 * thẻ một kiểu video người Việt hay làm bằng lời nói trước máy, ảnh mock (sinh ra)
 * kèm nhãn đè ở đáy. Tự trượt chậm, kéo tay được, dừng nếu máy "giảm chuyển động".
 */
const USE_CASES = [
  { src: "/landing/mock/vlogger.jpg", title: "Vlog & nhật ký", desc: "Kể chuyện trước máy, để chữ và nhạc lo phần nhìn." },
  { src: "/landing/mock/podcast.jpg", title: "Podcast lên hình", desc: "Biến buổi thu tiếng thành video có chữ chạy theo lời." },
  { src: "/landing/mock/giangday.jpg", title: "Bài giảng & hướng dẫn", desc: "Giảng một mạch, máy chép lời và cắt chỗ ngập ngừng." },
  { src: "/landing/mock/banhang.jpg", title: "Review & bán hàng", desc: "Nói về sản phẩm, chèn cảnh minh hoạ vào đúng câu." },
  { src: "/landing/mock/bantin.jpg", title: "Bản tin & tóm tắt", desc: "Đọc tin thành video có phụ đề gọn gàng, đúng dấu." },
  { src: "/landing/mock/phongvan.jpg", title: "Phỏng vấn & lời chứng", desc: "Giữ nguyên lời người nói, tô sẵn chỗ cần soát lại." },
];

export function UseCases() {
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => api.scrollNext(), 3500);
    return () => clearInterval(timer);
  }, [api]);

  return (
    <Section>
      <SectionHeading
        eyebrow="Hợp với ai"
        title="Một công cụ cho mọi kiểu nói trước máy"
        subtitle="Bất kể bạn làm nội dung gì, phần chép lời và gieo chữ đều giống nhau — máy lo hết."
        className="mb-16"
      />

      <Reveal>
        <Carousel
          setApi={setApi}
          opts={{ loop: true, align: "start" }}
          className="mx-auto max-w-6xl"
        >
          <CarouselContent>
            {USE_CASES.map((item) => (
              <CarouselItem
                key={item.title}
                className="basis-4/5 sm:basis-1/2 lg:basis-1/3"
              >
                <div className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-border">
                  <img
                    src={item.src}
                    alt={item.title}
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5 text-white">
                    <h3 className="font-heading text-lg font-semibold">
                      {item.title}
                    </h3>
                    <p className="text-sm text-white/80 text-pretty">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden sm:flex" />
          <CarouselNext className="hidden sm:flex" />
        </Carousel>
      </Reveal>
    </Section>
  );
}
