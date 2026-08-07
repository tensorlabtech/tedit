import {
  CaptionsIcon,
  FilmIcon,
  LanguagesIcon,
  MusicIcon,
  PencilIcon,
  ScissorsIcon,
  TypeIcon,
  UploadCloudIcon,
} from "lucide-react";

/**
 * Dải năng lực tự trượt (marquee) ngay dưới hero — thay cho hàng logo/khách hàng
 * mà các trang khác hay bày. CỐ Ý không bịa số liệu hay lời khen: chỉ nêu những
 * điều máy làm được, đều là sự thật kiểm chứng được trong sản phẩm.
 *
 * Chuyển động: nội dung nhân đôi, dịch trái đúng một nửa nên vòng lặp liền mạch;
 * dừng khi rê chuột; đứng yên nếu máy bật "giảm chuyển động".
 */
const CAPABILITIES = [
  { icon: LanguagesIcon, text: "Tiếng Việt chuẩn dấu" },
  { icon: CaptionsIcon, text: "Chữ chạy theo tiếng" },
  { icon: ScissorsIcon, text: "Cắt quãng lặng tự động" },
  { icon: UploadCloudIcon, text: "Tải mảnh, đứt tải tiếp" },
  { icon: FilmIcon, text: "Chèn tư liệu đúng chỗ" },
  { icon: MusicIcon, text: "Nhạc nền từ kho" },
  { icon: TypeIcon, text: "Nhiều bộ dáng chữ" },
  { icon: PencilIcon, text: "Sửa chữ ngay trên bản chép" },
];

function Item({ icon: Icon, text }: { icon: typeof FilmIcon; text: string }) {
  return (
    <span className="flex shrink-0 items-center gap-2 px-6 text-sm text-muted-foreground">
      <Icon className="size-4 text-primary" />
      {text}
    </span>
  );
}

export function TrustStrip() {
  return (
    <section className="border-y border-border bg-muted/20 py-5">
      {/* `group` để rê chuột vào đâu trong dải cũng dừng cả băng. Hai mép mờ dần
          để chữ trôi vào/ra êm, không cụt ngang. */}
      <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="flex w-max animate-[landing-marquee_36s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          {/* Nhân đôi: bản thứ hai lấp chỗ trống lúc bản đầu trôi khuất. */}
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
              {CAPABILITIES.map((item) => (
                <Item key={item.text} icon={item.icon} text={item.text} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
