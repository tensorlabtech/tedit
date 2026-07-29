import { Fragment } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SectionShowcase } from "@/dev/design-system/section-showcase";
import { showcaseGroups } from "@/dev/design-system/section-registry";

// Trang tra cứu component, xếp theo lưới bento phủ hết bề ngang màn hình
export function DesignSystemPage() {
  const componentCount = showcaseGroups.reduce(
    (total, group) => total + group.sections.length,
    0,
  );

  return (
    <div className="min-h-svh bg-background p-2 text-foreground">
      <div className="grid grid-cols-12 gap-2">
        <Card size="sm" className="col-span-12">
          <CardHeader className="has-data-[slot=card-action]:grid-cols-1 sm:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
            <CardTitle>Design System</CardTitle>
            <CardAction className="col-start-1 row-start-2 mt-1 flex items-center gap-3 justify-self-start sm:col-start-2 sm:row-start-1 sm:mt-0 sm:justify-self-end">
              <span className="text-xs text-muted-foreground">
                {componentCount} component · {showcaseGroups.length} nhóm ·
                shadcn/ui trên Base UI, preset Nova
              </span>
              <ThemeToggle />
            </CardAction>
          </CardHeader>
        </Card>

        <Card className="col-span-12 h-fit md:sticky md:top-2 md:col-span-3 md:max-h-[calc(100svh-1rem)] xl:col-span-2">
          <CardHeader>
            <CardTitle>Danh mục</CardTitle>
          </CardHeader>
          <CardContent className="no-scrollbar max-h-64 overflow-y-auto rounded-xl md:max-h-[calc(100svh-7rem)]">
            <ul className="grid gap-3 text-sm">
              {showcaseGroups.map((group) => (
                <li key={group.id} className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    {group.title}
                  </span>
                  <ul className="grid">
                    {group.sections.map((section) => (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          className="block rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {section.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="col-span-12 grid gap-2 md:col-span-9 xl:col-span-10">
          {showcaseGroups.map((group) => (
            <Fragment key={group.id}>
              <Card size="sm" id={group.id} className="scroll-mt-4">
                <CardHeader>
                  <CardTitle>{group.title}</CardTitle>
                  <CardAction>
                    <span className="text-xs text-muted-foreground">
                      {group.sections.length} component
                    </span>
                  </CardAction>
                </CardHeader>
              </Card>
              {/* Lưới riêng cho từng nhóm để ô của nhóm này không lọt sang nhóm khác */}
              <div className="grid auto-rows-min grid-flow-row-dense grid-cols-1 items-start gap-2 lg:grid-cols-2 2xl:grid-cols-3">
                {group.sections.map((section) => (
                  <SectionShowcase key={section.id} section={section} />
                ))}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
