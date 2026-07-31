import { useEffect, useRef } from "react";

import { toast } from "@/components/ui/toast";

import { ZOOM_STEP, zoomFactorFromWheel, type EditorState } from "./use-editor";

/**
 * Chặn những gì hệ điều hành và trình duyệt tự làm trên màn bàn dựng.
 *
 * Bàn dựng dùng chính những cử chỉ mà trình duyệt đã đặt trước cho việc khác:
 * lăn ngang là lùi trang, chụm hai ngón là phóng cả trang, dấu cách là bấm lại
 * cái nút vừa bấm, kéo chuột là bôi đen chữ. Mỗi cái đều làm mất chỗ đang làm,
 * mà không cái nào báo trước. Gom hết vào một chỗ để còn biết đã chặn những gì.
 *
 * Cái KHÔNG chặn cũng phải nói rõ: Cmd+F, Cmd+P, phím Tab, và mọi phím khi con
 * trỏ đang ở ô gõ chữ — chặn những thứ đó là giành quyền của trình duyệt mà
 * không trả lại được gì.
 */

/** Con trỏ đang ở ô gõ chữ — mọi phím tắt phải nhường. */
function isTypingIn(target: EventTarget | null) {
  const node = target instanceof HTMLElement ? target : null;
  if (!node) return false;
  if (node.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName);
}

/**
 * Có bảng nổi nào đang mở không.
 *
 * Menu và hộp thoại có luật phím riêng (dấu cách chọn mục, Escape đóng bảng).
 * Cướp phím của chúng thì bảng chọn "Chỗ nối" bấm dấu cách không chọn được gì.
 */
function isMenuOpen() {
  return Boolean(
    document.querySelector(
      '[role="menu"],[role="listbox"],[role="dialog"],[role="alertdialog"]',
    ),
  );
}

export function useEditorGuards({
  editor,
  onTogglePlay,
}: {
  editor: EditorState;
  onTogglePlay: () => void;
}) {
  const togglePlayRef = useRef(onTogglePlay);
  togglePlayRef.current = onTogglePlay;
  const editorRef = useRef(editor);
  editorRef.current = editor;

  useEffect(() => {
    // Bắt ở pha CHỤP: nút đang có focus xử lý phím trước, nên nghe ở pha nổi
    // thì dấu cách đã kịp bấm lại nút đó rồi.
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingIn(event.target) || isMenuOpen()) return;
      const editor = editorRef.current;
      const modifier = event.metaKey || event.ctrlKey;

      // Phóng dải, KHÔNG phóng cả trang. Phóng trang trong bàn dựng làm lệch
      // mọi phép tính px↔giây, mà người dùng bấm Cmd+= là muốn nhìn gần hơn.
      if (modifier && ["=", "+", "-", "_", "0"].includes(event.key)) {
        event.preventDefault();
        if (event.key === "0") editor.resetZoom();
        else if (event.key === "-" || event.key === "_")
          editor.zoomBy(1 / ZOOM_STEP);
        else editor.zoomBy(ZOOM_STEP);
        return;
      }

      // Cmd+S mở hộp "lưu trang này lại" của trình duyệt — vô nghĩa ở đây, mà
      // phản xạ lưu thì ai cũng có. Nói thẳng là không cần lưu.
      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        toast.add({
          title: "Không cần lưu",
          description: "Mọi thay đổi đã ghi ngay lúc bạn sửa",
          type: "info",
        });
        return;
      }

      if (modifier || event.altKey) return;

      if (event.key === " ") {
        // `stopPropagation` chứ không chỉ `preventDefault`: cái nút vừa bấm vẫn
        // đang giữ focus, nên dấu cách sẽ bấm lại chính nó — tắt phụ đề xong
        // bấm cách là bật lại ngay.
        event.preventDefault();
        event.stopPropagation();
        togglePlayRef.current();
        return;
      }

      // Delete / Backspace: bỏ hoặc gỡ thứ đang chọn.
      //
      // Thay cho nút "Bỏ đoạn" từng nổi lên trên khối đang chọn — nút đó che
      // đúng cái dấu chỗ nối ở mép khối, mà chỗ nối cũng chỉ hiện khi đang chọn.
      // Hai thứ tranh nhau một chỗ thì thứ nào cũng dùng không xong.
      if (event.key === "Delete" || event.key === "Backspace") {
        const selection = editor.selection;
        if (!selection) return;
        event.preventDefault();
        if (selection.kind === "clip") void editor.toggleSegment(selection.id);
        else if (selection.kind === "text" || selection.kind === "insert")
          void editor.deleteElement(selection.id);
        else if (selection.kind === "music") void editor.removeMusic(selection.id);
        else if (selection.kind === "junction") void editor.deleteEffect(selection.id);
        return;
      }

      if (event.key === "Escape") {
        editor.setSelection(null);
        return;
      }

      // Mũi tên nhích vạch, không cuộn trang. Một khung hình là bước nhỏ nhất
      // có nghĩa; giữ Shift thì đi một giây.
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const step = event.shiftKey ? 1 : 1 / 30;
        editor.seek(editor.time + (event.key === "ArrowLeft" ? -step : step));
      }
    };

    // Nút HTML kích hoạt ở lúc NHẢ dấu cách, không phải lúc nhấn — chặn một
    // nửa thì nút vẫn tự bấm.
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== " ") return;
      if (isTypingIn(event.target) || isMenuOpen()) return;
      event.preventDefault();
      event.stopPropagation();
    };

    // Thả tệp nhầm ra ngoài vùng nhận là trình duyệt MỞ THẲNG tệp đó, rời khỏi
    // bàn dựng và mất hết thao tác chưa xong.
    const swallowDrop = (event: DragEvent) => event.preventDefault();

    // Chụm hai ngón trên bàn di của Safari phóng cả trang; sự kiện này là của
    // riêng Safari, `wheel` không bắt được.
    const swallowGesture = (event: Event) => event.preventDefault();

    // Chụm hai ngón ở Chrome/Firefox đến dưới dạng lăn có `ctrlKey`. Dải đã tự
    // xử lý phần của nó; chỗ này lo phần CÒN LẠI của màn — chụm trên bản chép
    // lời mà phóng cả trang thì mọi phép tính px↔giây lệch hết.
    const swallowZoom = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      if (!(event.target as HTMLElement | null)?.closest?.("[data-timeline]")) {
        editorRef.current.zoomBy(zoomFactorFromWheel(event.deltaY));
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("dragover", swallowDrop);
    window.addEventListener("drop", swallowDrop);
    window.addEventListener("wheel", swallowZoom, { passive: false });
    for (const name of ["gesturestart", "gesturechange", "gestureend"]) {
      window.addEventListener(name, swallowGesture, { passive: false });
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("dragover", swallowDrop);
      window.removeEventListener("drop", swallowDrop);
      window.removeEventListener("wheel", swallowZoom);
      for (const name of ["gesturestart", "gesturechange", "gestureend"]) {
        window.removeEventListener(name, swallowGesture);
      }
    };
  }, []);
}

/**
 * Bật/tắt cờ "đang kéo" trên thẻ gốc.
 *
 * CSS ở `index.css` đọc cờ này để tắt bôi đen và giữ con trỏ nắm trên CẢ trang
 * — chuột đi ra ngoài dải lúc kéo thì vẫn không quét chọn chữ ở chỗ khác.
 */
export function setPageDragging(dragging: boolean) {
  if (dragging) document.documentElement.dataset.dragging = "1";
  else delete document.documentElement.dataset.dragging;
}
