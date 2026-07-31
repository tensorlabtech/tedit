import { ImageIcon, SearchIcon, StarIcon, VideoIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type Tab = "project" | "library";
export type Loc = "all" | "starred" | "image" | "video";

/**
 * Hàng đầu của hộp chọn tư liệu: chọn nguồn, tìm, lọc.
 *
 * Cả ba nằm trên CÙNG MỘT HÀNG vì đều trả lời chung một câu hỏi — "thu hẹp lại
 * còn cái nào". Tách xuống hai hàng thì lưới tụt mất một hàng ảnh mà chẳng rõ
 * hơn chút nào.
 */
export function MediaPickerToolbar({
  tab,
  onTabChange,
  search,
  onSearchChange,
  filter,
  onFilterChange,
}: {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  filter: Loc;
  onFilterChange: (value: Loc) => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Tabs value={tab} onValueChange={(value) => onTabChange(value as Tab)}>
        <TabsList>
          <TabsTrigger value="project">Của dự án</TabsTrigger>
          <TabsTrigger value="library">Kho tư liệu</TabsTrigger>
        </TabsList>
      </Tabs>

      <InputGroup className="min-w-40 flex-1">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Tìm theo tên hoặc mô tả"
          spellCheck={false}
        />
      </InputGroup>

      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        value={[filter]}
        onValueChange={(value) => onFilterChange((value[0] as Loc) ?? "all")}
      >
        <ToggleGroupItem value="all">Tất cả</ToggleGroupItem>
        {/* Dấu sao chỉ có nghĩa với kho — tư liệu của dự án không đánh dấu được. */}
        {tab === "library" && (
          <ToggleGroupItem value="starred" aria-label="Đã đánh dấu">
            <StarIcon />
          </ToggleGroupItem>
        )}
        <ToggleGroupItem value="image" aria-label="Chỉ ảnh">
          <ImageIcon />
        </ToggleGroupItem>
        <ToggleGroupItem value="video" aria-label="Chỉ video">
          <VideoIcon />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
