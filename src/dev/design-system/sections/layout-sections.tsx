import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { ShowcaseSection } from "@/dev/design-system/showcase-types";

const separatorSection: ShowcaseSection = {
  id: "separator",
  title: "Separator",
  description: "Đường phân cách ngang hoặc dọc.",
  cases: [
    {
      name: "Ngang",
      node: (
        <div className="w-72">
          <div className="text-sm">Phần trên</div>
          <Separator className="my-3" />
          <div className="text-sm">Phần dưới</div>
        </div>
      ),
    },
    {
      name: "Dọc",
      node: (
        <div className="flex h-6 items-center gap-3 text-sm">
          <span>Bản nháp</span>
          <Separator orientation="vertical" />
          <span>Đã đăng</span>
          <Separator orientation="vertical" />
          <span>Lưu trữ</span>
        </div>
      ),
    },
  ],
};

const aspectRatioSection: ShowcaseSection = {
  id: "aspect-ratio",
  title: "Aspect Ratio",
  description: "Giữ tỉ lệ khung hình cho nội dung bên trong.",
  cases: [
    {
      name: "16 / 9",
      node: (
        <div className="w-72">
          <AspectRatio
            ratio={16 / 9}
            className="flex items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground"
          >
            16 / 9
          </AspectRatio>
        </div>
      ),
    },
    {
      name: "1 / 1 và 9 / 16",
      node: (
        <div className="flex gap-4">
          <div className="w-40">
            <AspectRatio
              ratio={1}
              className="flex items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground"
            >
              1 / 1
            </AspectRatio>
          </div>
          <div className="w-28">
            <AspectRatio
              ratio={9 / 16}
              className="flex items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground"
            >
              9 / 16
            </AspectRatio>
          </div>
        </div>
      ),
    },
  ],
};

const scrollAreaSection: ShowcaseSection = {
  id: "scroll-area",
  title: "Scroll Area",
  description: "Vùng cuộn có thanh cuộn đồng bộ với giao diện.",
  cases: [
    {
      name: "Cuộn dọc",
      node: (
        <ScrollArea className="h-48 w-64 rounded-xl border border-border bg-card p-3">
          <div className="grid gap-2">
            {Array.from({ length: 20 }, (_, index) => (
              <div key={index} className="text-sm">
                Dòng nội dung số {index + 1}
              </div>
            ))}
          </div>
        </ScrollArea>
      ),
    },
    {
      name: "Cuộn ngang",
      node: (
        <ScrollArea className="w-72 rounded-xl border border-border bg-card p-3">
          <div className="flex gap-2 pb-3">
            {Array.from({ length: 12 }, (_, index) => (
              <Badge key={index} variant="secondary" className="shrink-0">
                Thẻ {index + 1}
              </Badge>
            ))}
          </div>
        </ScrollArea>
      ),
    },
  ],
};

const resizableSection: ShowcaseSection = {
  id: "resizable",
  title: "Resizable",
  description: "Chia bố cục thành các khung kéo giãn được.",
  cases: [
    {
      name: "Hai khung ngang",
      node: (
        <div className="h-40 w-80 overflow-hidden rounded-xl border border-border bg-card">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize={40}>
              <div className="flex h-full items-center justify-center text-sm">
                Trái
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={60}>
              <div className="flex h-full items-center justify-center text-sm">
                Phải
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ),
    },
    {
      name: "Lồng khung dọc",
      node: (
        <div className="h-48 w-80 overflow-hidden rounded-xl border border-border bg-card">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center text-sm">
                Danh sách
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={50}>
              <ResizablePanelGroup orientation="vertical">
                <ResizablePanel defaultSize={50}>
                  <div className="flex h-full items-center justify-center text-sm">
                    Xem trước
                  </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={50}>
                  <div className="flex h-full items-center justify-center text-sm">
                    Chi tiết
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ),
    },
  ],
};

export const layoutSections: ShowcaseSection[] = [
  separatorSection,
  aspectRatioSection,
  scrollAreaSection,
  resizableSection,
];
