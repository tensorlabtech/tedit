import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { Section } from "../landing-section";
import { SectionHeading } from "../landing-ui";
import { ProductFrame } from "../product-frame";
import { Reveal } from "../reveal";

/**
 * Khoe sản phẩm bằng tabs đổi ảnh — như dải "Edit / Audio / Color…" của Filmora.
 * Mỗi tab một màn thật của app, kèm một câu nói việc màn đó làm. Dùng lại đúng ba
 * ảnh chụp thật ở `public/landing/`.
 */
const TABS = [
  {
    value: "ban-dung",
    label: "Bàn dựng",
    src: "/landing/studio.png",
    alt: "Bàn dựng: bản chép lời, xem trước và dòng thời gian nhiều lớp",
    caption: "Bản chép lời, xem trước và dòng thời gian — cùng một màn.",
  },
  {
    value: "soat-loi",
    label: "Soát lời",
    src: "/landing/soat-loi.png",
    alt: "Màn soát lời: bản chép chữ lớn, chỗ máy nghe chưa chắc tô màu",
    caption: "Chữ máy nghe chưa chắc được tô màu — bấm để nghe lại và sửa.",
  },
  {
    value: "tu-lieu",
    label: "Tư liệu & nhạc",
    src: "/landing/upload.png",
    alt: "Kho tư liệu: lưới cảnh phụ có ảnh xem trước",
    caption: "Kho tư liệu và nhạc nền — chèn đúng chỗ đang nói tới.",
  },
];

export function ShowcaseTabs() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Xem tận mắt"
        title="Một màn, làm hết mọi việc"
        subtitle="Chép lời, soát chữ, chèn tư liệu và dựng dòng thời gian — không nhảy qua năm phần mềm."
        className="mb-16"
      />

      <Reveal>
        <Tabs defaultValue="ban-dung" className="items-center gap-8">
          <TabsList variant="line" className="flex-wrap justify-center">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-base">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((tab) => (
            <TabsContent
              key={tab.value}
              value={tab.value}
              className="flex w-full flex-col items-center gap-4 duration-500 ease-out animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
            >
              <ProductFrame
                src={tab.src}
                alt={tab.alt}
                glow
                className="w-full max-w-4xl"
              />
              <p className="max-w-xl text-center text-sm text-muted-foreground text-pretty">
                {tab.caption}
              </p>
            </TabsContent>
          ))}
        </Tabs>
      </Reveal>
    </Section>
  );
}
