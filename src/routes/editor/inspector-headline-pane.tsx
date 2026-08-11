import { useEffect, useState } from "react";
import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

import {
  applyFontStyle,
  findStylePack,
} from "../../../server/style-pack-catalog";
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
  const pack = applyFontStyle(
    findStylePack(editor.stylePack),
    editor.fontStyle,
  );
  const projectId = editor.projectId;
  // Chữ-sau-người là chữ mở màn của cả video — cùng bậc DỰ ÁN với dòng tiêu đề, nên
  // sống chung nhánh "Chưa chọn gì". Chỉ hiện khi bộ dáng KHAI nó (Phấn).
  const behindId = editor.sceneLayout?.behindTextId ?? null;

  // Chưa mở dự án thì không có gì để lưu vào. Không có CẢ tiêu đề lẫn chữ-nền thì
  // pane này rỗng — ẩn hẳn.
  if (!projectId) return null;
  if (!pack.title && !behindId) return null;

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
    <div className="grid gap-4">
      {pack.title && (
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
            Hiện suốt video, không neo vào tiếng nào — cắt mất câu đầu thì nó
            vẫn còn.
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
      )}
      {behindId && (
        <BehindTextField
          editor={editor}
          elementId={behindId}
          value={editor.sceneLayout?.behindLine ?? ""}
        />
      )}
    </div>
  );
}

/**
 * Ô nhập CHỮ-SAU-NGƯỜI — chữ VIẾT HOA hiện sau người ở đoạn mở đầu (người che bớt).
 *
 * Là một LOẠI KHUNG như b-roll: b-roll có ô ẢNH, khung này có ô CHỮ. Để TRỐNG là
 * cách TẮT nó mà không xoá khung. Giữ chữ ở state cục bộ, chỉ ghi khi RỜI ô để
 * không nạp lại lịch màn sau mỗi phím.
 */
function BehindTextField({
  editor,
  elementId,
  value,
}: {
  editor: EditorState;
  elementId: string;
  value: string;
}) {
  const [text, setText] = useState(value);
  // Lịch màn nạp lại đưa câu mới về (vd đổi bộ dáng) → đồng bộ lại ô nhập.
  useEffect(() => {
    setText(value);
  }, [value]);

  return (
    <Field>
      <FieldLabel htmlFor="behindtext">Chữ sau người</FieldLabel>
      <Input
        id="behindtext"
        value={text}
        placeholder="Để trống để tắt"
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          if (text !== value) editor.setBehindText(elementId, text);
        }}
      />
      <FieldDescription>
        Chữ VIẾT HOA hiện SAU người ở đoạn mở đầu, người che bớt — để trống thì
        tắt.
      </FieldDescription>
    </Field>
  );
}
