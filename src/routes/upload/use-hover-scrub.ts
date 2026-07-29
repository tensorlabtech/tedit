import { useEffect, useRef, useState } from "react";

/**
 * Rê chuột ngang qua ô là tua qua video.
 *
 * Ảnh đầu cảnh một mình không đủ để nhận ra cảnh: quay bằng điện thoại thì mấy
 * giây đầu hay là cảnh đang giơ máy lên, và bốn cảnh liền nhau ra bốn ảnh gần
 * như y hệt. Tua bằng chuột trả lời trong nửa giây mà không phải mở gì.
 *
 * Video chỉ dựng lên khi chuột vào tới ô: dựng sẵn cho cả dải là hai chục thẻ
 * `<video>` cùng giữ một tệp vài trăm MB trong bộ nhớ.
 *
 * @param source Tệp gốc; bỏ trống thì không tua được (ảnh, hoặc tệp đã bị gỡ).
 * @param remoteUrl Đường phát trên máy chủ, dùng khi tệp gốc không còn trong
 * bộ nhớ trình duyệt — mở lại một dự án dở thì mọi `File` đã mất theo phiên cũ.
 */
export function useHoverScrub(
  source: File | undefined,
  enabled: boolean,
  remoteUrl?: string,
) {
  const [url, setUrl] = useState<string | null>(null);
  /** Chỗ đang đứng trong cảnh, 0–1 — dùng vẽ vạch báo dưới ô */
  const [at, setAt] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Thu hồi cả khi ô biến mất giữa chừng (gỡ tệp lúc đang rê) — `onMouseLeave`
  // không bao giờ bắn trong trường hợp đó. Chỉ thu hồi thứ mình tự tạo: đường
  // của máy chủ không phải `blob:` nên gọi `revoke` lên nó là vô nghĩa.
  useEffect(() => {
    return () => {
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [url]);

  const areaProps = {
    onMouseEnter: () => {
      if (!enabled || url) return;
      if (source) setUrl(URL.createObjectURL(source));
      else if (remoteUrl) setUrl(remoteUrl);
    },
    onMouseLeave: () => {
      setUrl(null);
      setAt(0);
    },
    onMouseMove: (event: React.MouseEvent) => {
      const video = videoRef.current;
      if (!video?.duration) return;
      const box = event.currentTarget.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (event.clientX - box.left) / box.width),
      );
      video.currentTime = ratio * video.duration;
      setAt(ratio);
    },
  };

  return { url, at, videoRef, areaProps };
}
