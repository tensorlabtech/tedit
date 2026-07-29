import { useState } from "react";
import { ChevronsUpDownIcon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ShowcaseSection } from "@/dev/design-system/showcase-types";

const accordionSection: ShowcaseSection = {
  id: "accordion",
  title: "Accordion",
  description: "Danh sách mục gập/mở, một hoặc nhiều mục cùng lúc.",
  cases: [
    {
      name: "Mở nhiều mục (mặc định)",
      node: (
        <Accordion defaultValue={["item-1"]} className="w-80">
          <AccordionItem value="item-1">
            <AccordionTrigger>Teddit là gì?</AccordionTrigger>
            <AccordionContent>
              Công cụ dựng video tự động từ bản ghi có sẵn.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Có xuất được phụ đề không?</AccordionTrigger>
            <AccordionContent>
              Có, phụ đề được tạo và căn theo lời nói.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>Hỗ trợ định dạng nào?</AccordionTrigger>
            <AccordionContent>
              MP4, MOV và WAV cho âm thanh rời.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ),
    },
    {
      name: "Chỉ mở một mục",
      node: (
        <Accordion multiple={false} className="w-80">
          <AccordionItem value="a">
            <AccordionTrigger>Mục A</AccordionTrigger>
            <AccordionContent>Nội dung mục A.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>Mục B</AccordionTrigger>
            <AccordionContent>Nội dung mục B.</AccordionContent>
          </AccordionItem>
        </Accordion>
      ),
    },
    {
      name: "Mục bị khoá",
      node: (
        <Accordion className="w-80">
          <AccordionItem value="a">
            <AccordionTrigger>Mục mở được</AccordionTrigger>
            <AccordionContent>Nội dung bình thường.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="b" disabled>
            <AccordionTrigger>Mục bị khoá</AccordionTrigger>
            <AccordionContent>Không mở được.</AccordionContent>
          </AccordionItem>
        </Accordion>
      ),
    },
  ],
};

function CollapsibleDemo() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-72">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">3 kho lưu trữ</span>
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Mở rộng danh sách"
            >
              <ChevronsUpDownIcon />
            </Button>
          }
        />
      </div>
      <div className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
        teddit-api
      </div>
      <CollapsibleContent className="grid gap-2">
        <div className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          teddit-web
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
          teddit-render
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const collapsibleSection: ShowcaseSection = {
  id: "collapsible",
  title: "Collapsible",
  description: "Thu gọn / mở rộng một khối nội dung.",
  cases: [
    { name: "Cơ bản", node: <CollapsibleDemo /> },
    {
      name: "Mở sẵn",
      node: (
        <Collapsible defaultOpen className="w-72">
          <CollapsibleTrigger
            render={<Button variant="outline">Chi tiết đơn hàng</Button>}
          />
          <CollapsibleContent className="mt-2 rounded-lg border border-border bg-card p-3 text-sm">
            Giao hàng dự kiến trong 3 ngày làm việc.
          </CollapsibleContent>
        </Collapsible>
      ),
    },
  ],
};

const carouselSection: ShowcaseSection = {
  id: "carousel",
  title: "Carousel",
  description: "Băng chuyền nội dung, trượt ngang hoặc dọc.",
  cases: [
    {
      name: "Ngang",
      node: (
        <Carousel className="w-64">
          <CarouselContent>
            {Array.from({ length: 5 }, (_, index) => (
              <CarouselItem key={index}>
                <div className="flex h-28 items-center justify-center rounded-xl border border-border bg-card text-2xl font-medium">
                  {index + 1}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      ),
    },
    {
      name: "Nhiều mục trên một khung",
      node: (
        <Carousel className="w-72" opts={{ align: "start" }}>
          <CarouselContent>
            {Array.from({ length: 6 }, (_, index) => (
              <CarouselItem key={index} className="basis-1/3">
                <div className="flex h-20 items-center justify-center rounded-xl border border-border bg-card text-lg">
                  {index + 1}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      ),
    },
    {
      name: "Dọc",
      node: (
        <Carousel orientation="vertical" className="w-56">
          <CarouselContent className="h-40">
            {Array.from({ length: 4 }, (_, index) => (
              <CarouselItem key={index} className="basis-1/2">
                <div className="flex h-full items-center justify-center rounded-xl border border-border bg-card">
                  Mục {index + 1}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      ),
    },
  ],
};

function CalendarSingleDemo() {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 6, 25));

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      className="rounded-xl border border-border bg-card"
    />
  );
}

function CalendarRangeDemo() {
  const [range, setRange] = useState<{ from?: Date; to?: Date } | undefined>({
    from: new Date(2026, 6, 20),
    to: new Date(2026, 6, 27),
  });

  return (
    <Calendar
      mode="range"
      selected={range as never}
      onSelect={setRange as never}
      numberOfMonths={2}
      className="rounded-xl border border-border bg-card"
    />
  );
}

const calendarSection: ShowcaseSection = {
  id: "calendar",
  title: "Calendar",
  description: "Lịch chọn ngày, chọn một ngày hoặc một khoảng.",
  cases: [
    { name: "Chọn một ngày", node: <CalendarSingleDemo /> },
    { name: "Chọn khoảng, hai tháng", node: <CalendarRangeDemo /> },
    {
      name: "Khoá ngày quá khứ",
      node: (
        <Calendar
          mode="single"
          disabled={{ before: new Date(2026, 6, 25) }}
          className="rounded-xl border border-border bg-card"
        />
      ),
    },
  ],
};

export const disclosureSections: ShowcaseSection[] = [
  accordionSection,
  collapsibleSection,
  carouselSection,
  calendarSection,
];
