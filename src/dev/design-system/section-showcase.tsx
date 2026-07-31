import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getSectionSpan } from "@/dev/design-system/section-spans";
import type {
  ShowcaseSection,
  ShowcaseSpan,
} from "@/dev/design-system/showcase-types";

// Ô bento rộng bao nhiêu cột, theo từng ngưỡng màn hình
const spanClasses: Record<ShowcaseSpan, string> = {
  1: "",
  2: "lg:col-span-2",
  3: "lg:col-span-2 2xl:col-span-3",
};

// Một ô bento: tiêu đề component + danh sách trường hợp sử dụng
export function SectionShowcase({ section }: { section: ShowcaseSection }) {
  return (
    <Card
      id={section.id}
      className={cn("scroll-mt-4", spanClasses[getSectionSpan(section.id)])}
    >
      <CardHeader>
        <CardTitle>{section.title}</CardTitle>
      </CardHeader>
      <CardContent className="@container">
        {section.description ? (
          <p className="mb-4 text-sm text-muted-foreground">
            {section.description}
          </p>
        ) : null}
        {/* Ô bento càng rộng thì các trường hợp càng xếp nhiều cột */}
        <div className="grid gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3">
          {section.cases.map((showcaseCase) => (
            <div key={showcaseCase.name} className="grid content-start gap-2">
              <div className="text-xs font-medium text-muted-foreground">
                {showcaseCase.name}
              </div>
              <div className="no-scrollbar flex flex-wrap items-start gap-3 overflow-x-auto rounded-xl p-5">
                {showcaseCase.node}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
