import { toast } from "@/components/ui/toast";

/**
 * Bắt lỗi của một lệnh GHI — và nói ra, thay vì nuốt im lặng.
 *
 * Bàn dựng đổi hình ngay khi bấm rồi mới ghi xuống máy chủ (lạc quan). Ghi hỏng
 * mà không báo thì màn hình nói một đằng, dữ liệu một nẻo — người dùng chỉ biết
 * ở lần mở sau, lúc đó công đã mất và không còn manh mối nào.
 *
 * Từng có 25 chỗ viết `.catch(boQuaLoi())`. Một hàm dùng chung thì chỗ nào cũng
 * báo giống nhau, và không ai phải nhớ tự viết lấy.
 */
export const boQuaLoi = () => (error: unknown) => {
  toast.add({
    title: "Không lưu được thay đổi",
    description:
      error instanceof Error && error.message
        ? error.message
        : "Máy chủ không trả lời — thử lại giúp mình",
    type: "error",
  });
};
