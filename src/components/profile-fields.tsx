import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * HỒ SƠ CẤU TRÚC — vài trường ngắn máy đọc làm ngữ cảnh cho mọi chặng AI.
 *
 * Dùng CHUNG cho trang Cài đặt và màn onboarding lần đầu, nên chỉ nhận giá trị +
 * một hàm chốt: nơi gọi tự quyết lưu xuống máy chủ hay giữ ở state tạm.
 *
 * `compact` cho ONBOARDING: bỏ dòng mô tả, chỉ nhãn + ví dụ trong ô. Nhãn ở đây
 * tự nói được, còn ví dụ đã nằm sẵn trong placeholder — thêm một đoạn mô tả nữa
 * là ba trường thành một biển chữ, đúng thứ làm người ta bỏ qua cả màn. Ở Cài đặt
 * thì `compact=false`: đó là màn tra cứu, một dòng gợi ý ngắn là đáng.
 *
 * Chốt lúc RỜI Ô (`onBlur`), không mỗi phím: ghi mỗi lần gõ là một lượt lưu thừa.
 */
export function ProfileFields({
  value,
  onCommit,
  compact = false,
}: {
  value: { trade: string; names: string; videoKind: string };
  onCommit: (
    patch: Partial<{ trade: string; names: string; videoKind: string }>,
  ) => void;
  compact?: boolean;
}) {
  return (
    <>
      <ProfileField
        id="pf-trade"
        label="Bạn làm nội dung về gì?"
        placeholder="vd: lập trình web, chia sẻ nghề frontend"
        hint="Để máy hiểu kênh nói về mảng gì mà nhấn đúng từ, chọn đúng tư liệu."
        compact={compact}
        value={value.trade}
        onCommit={(v) => v !== value.trade && onCommit({ trade: v })}
        autoFocus
      />
      <ProfileField
        id="pf-names"
        label="Tên riêng hay bị nghe sai"
        placeholder="vd: TensorLab, Golang, Redis, tên bạn"
        hint="Tên công ty, sản phẩm, người — viết một lần là máy chép đúng mọi video."
        compact={compact}
        value={value.names}
        onCommit={(v) => v !== value.names && onCommit({ names: v })}
      />
      <ProfileField
        id="pf-kind"
        label="Kiểu video thường làm"
        placeholder="vd: hướng dẫn, vlog, review"
        compact={compact}
        value={value.videoKind}
        onCommit={(v) => v !== value.videoKind && onCommit({ videoKind: v })}
      />
    </>
  );
}

function ProfileField({
  id,
  label,
  placeholder,
  hint,
  compact,
  value,
  onCommit,
  autoFocus,
}: {
  id: string;
  label: string;
  placeholder: string;
  /** Một dòng gợi ý — chỉ hiện khi KHÔNG compact. */
  hint?: string;
  compact: boolean;
  value: string;
  onCommit: (clean: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        autoFocus={autoFocus}
        // Dựng lại khi giá trị ngoài đổi — `defaultValue` chỉ đọc một lần lúc
        // dựng, mà lúc ấy ô còn rỗng (chờ máy chủ trả cài đặt về).
        key={value}
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(event) => onCommit(event.target.value.trim())}
      />
      {!compact && hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}
