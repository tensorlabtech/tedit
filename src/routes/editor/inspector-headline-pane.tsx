import { useState } from "react";
import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

import { findStylePack } from "../../../server/style-pack-catalog";
import type { EditorState } from "./use-editor";

/**
 * Ô nhập DÒNG TIÊU ĐỀ — một dòng chữ đại diện cho cả video.
 *
 * Đặt ở nhánh "Chưa chọn gì" của khung sửa, và đó là chỗ đúng chứ không phải chỗ
 * còn trống: mọi nhánh khác của khung này sửa MỘT phần tử đang chọn, còn tiêu đề
 * thuộc về cả dự án — nó nằm trên `projects` chứ không nằm trong `elements`. Nhét
 * nó vào khung sửa chữ thì người dùng đọc ra "tiêu đề là một cụm phụ đề nữa", mà
 * cả kiến trúc của trục này dựng lên để nói ngược lại.
 *
 * Bộ dáng nào không khai `title` thì ô này KHÔNG hiện. Bày một ô nhập cho thứ sẽ
 * không được vẽ ra là mời người dùng gõ vào chỗ không ai đọc.
 */
export function InspectorHeadlinePane({ editor }: { editor: EditorState }) {
  const [lines, setLines] = useState<string[] | null>(null);
  const [asking, setAsking] = useState(false);
  const pack = findStylePack(editor.stylePack);
  const projectId = editor.projectId;

  // Chưa mở dự án thì không có gì để lưu vào.
  if (!pack.title || !projectId) return null;

  const suggest = async () => {
    setAsking(true);
    // Không có khoá mô hình thì trả mảng rỗng chứ không nổ: ô nhập vẫn gõ tay
    // được, và một lỗi ở đây không được chặn đường còn lại.
    const result = await api
      .suggestOpeningLines(projectId, "headline")
      .catch(() => ({ lines: [] }));
    setLines(result.lines);
    setAsking(false);
  };

  return (
    <Field>
      <FieldLabel htmlFor="headline">Dòng tiêu đề</FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          id="headline"
          value={editor.headline}
          placeholder="3–6 tiếng"
          onChange={(event) => editor.setHeadline(event.target.value)}
        />
        {/* Nút chỉ có icon nên `aria-label` tự dựng tooltip — quy ước của dự án,
            xem README mục "Quy ước đã tuỳ biến". Đừng bọc `Tooltip` ở đây. */}
        <Button
          variant="secondary"
          size="icon"
          aria-label="Gợi ý tiêu đề từ lời trong video"
          disabled={asking}
          onClick={suggest}
        >
          <SparklesIcon />
        </Button>
      </div>
      <FieldDescription>
        Hiện suốt video, không neo vào tiếng nào — cắt mất câu đầu thì nó vẫn còn.
      </FieldDescription>
      {lines && lines.length > 0 && (
        <div className="grid gap-1">
          {lines.map((line) => (
            <Button
              key={line}
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => editor.setHeadline(line)}
            >
              {line}
            </Button>
          ))}
        </div>
      )}
      {lines?.length === 0 && (
        <FieldDescription>
          Chưa gợi ý được — cần có lời đã chép và khoá mô hình.
        </FieldDescription>
      )}
    </Field>
  );
}
