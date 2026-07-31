import { useRef } from "react";
import { UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

import { MusicLibraryBrowser } from "@/routes/editor/music-library-browser";
import { useMusicLibrary } from "@/routes/editor/use-music-library";

/**
 * THƯ VIỆN NHẠC — cùng kho mà bàn dựng đang dùng, chỉ khác chỗ đứng.
 *
 * Dùng chung đúng một component với tab ở bàn dựng: hai bản riêng thì một bên
 * thêm bộ lọc, bên kia quên, và người dùng gặp hai cái kho khác nhau cho cùng
 * một đống tệp.
 *
 * Hook gọi Ở ĐÂY rồi truyền xuống, không để component tự gọi: nút tải lên nằm ở
 * dòng tiêu đề thẻ — cùng chỗ với màn Dự án và màn Tư liệu — nên nó và danh sách
 * bên dưới phải dùng chung một trạng thái. Hai lần gọi hook là hai kho riêng, tải
 * xong ở nút này thì danh sách kia không thấy gì.
 */
export function MusicPage() {
  const kho = useMusicLibrary(true);
  const chonTep = useRef<HTMLInputElement>(null);

  return (
    <Card className="h-full min-h-0">
      <CardHeader>
        <CardTitle>Thư viện nhạc</CardTitle>
        <CardAction>
          <Button
            disabled={kho.dangTai}
            onClick={() => chonTep.current?.click()}
          >
            {kho.dangTai ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <UploadIcon data-icon="inline-start" />
            )}
            Thêm nhạc
          </Button>
          <input
            ref={chonTep}
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac"
            hidden
            onChange={(event) => {
              const tep = event.target.files?.[0];
              // Xoá giá trị NGAY: chọn lại đúng tệp vừa chọn thì `change` không
              // nổ lần nữa, và người dùng tưởng nút hỏng.
              event.target.value = "";
              if (tep) {
                void kho.taiLenKho(tep, tep.name.replace(/\.[^.]+$/, ""), "");
              }
            }}
          />
        </CardAction>
      </CardHeader>
      {/* `grid-rows-[minmax(0,1fr)]` chứ không để hàng mặc định: hàng `auto` cao
          bằng nội dung, nên danh sách 58 bài kéo khung cao hơn cả cửa sổ và không
          còn gì cuộn tới được. */}
      <CardContent className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
        <MusicLibraryBrowser kho={kho} showUpload={false} />
      </CardContent>
    </Card>
  );
}
