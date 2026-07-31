import { useRef } from "react";
import {
  Music2Icon,
  PauseIcon,
  PlayIcon,
  PlugZapIcon,
  PlusIcon,
  StarIcon,
  UploadIcon,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describeMusicTags } from "../../../server/music-tags";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { useMusicLibrary } from "./use-music-library";

/**
 * DUYỆT KHO NHẠC — nghe thử, đánh dấu, tìm, tải thêm, và (nếu có dự án) đặt vào dải.
 *
 * Dùng chung cho tab ở bàn dựng và trang Thư viện nhạc: hai bản riêng thì một bên
 * thêm bộ lọc, bên kia quên, và người dùng gặp hai cái kho khác nhau cho cùng một
 * đống tệp.
 *
 * Kho dùng CHUNG cho mọi dự án, nên "thêm vào kho" khác hẳn "đặt vào dự án": bài
 * thêm vào kho thì mọi lượt dựng về sau đều chọn được, kể cả chặng tự chọn nhạc.
 * Còn dấu sao thì riêng từng người — kho chung mà dấu chung thì người này bỏ dấu
 * là người kia mất.
 */

/** Giây thành "2:14" cho nhãn thời lượng bài. */
function phut(giay: number) {
  const tron = Math.max(0, Math.round(giay));
  return `${Math.floor(tron / 60)}:${String(tron % 60).padStart(2, "0")}`;
}

export function MusicLibraryBrowser({
  kho,
  onPick,
  showUpload = true,
}: {
  kho: ReturnType<typeof useMusicLibrary>;
  /**
   * Đặt bài này vào dải. Bỏ trống thì nút đặt không hiện — dùng ở trang Thư viện
   * nhạc, nơi không có dự án nào để mà đặt vào.
   */
  onPick?: (file: string) => void;
  /**
   * Vẽ nút tải lên trong hàng công cụ. Tắt khi chỗ gọi đã đặt nút ấy ở dòng tiêu
   * đề thẻ — hai cái nút cùng việc trên một màn thì người dùng phải đoán cái nào
   * làm gì.
   */
  showUpload?: boolean;
}) {
  const chonTep = useRef<HTMLInputElement>(null);

  return (
    // `grid-cols-[minmax(0,1fr)]` mới là thứ chữa được, không phải `min-w-0`.
    //
    // Cột của một lưới mặc định là `auto`, tức rộng bằng NỘI DUNG RỘNG NHẤT — ở
    // đây là tên bài dài nhất trong danh sách. Đo thật: lưới rộng đúng 376px mà
    // cột của nó 655,9px, nên hàng công cụ ở trên giãn theo và hai cái nút bên
    // phải nằm hẳn ngoài màn. `minmax(0,1fr)` cho cột co lại bằng khung, rồi
    // `truncate` ở từng dòng lo phần tên dài.
    <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_1fr] gap-2">
      {/* `min-w-0` trên ô tìm là BẮT BUỘC, không phải trang trí: mặc định của một
          input trong flex là không co dưới bề rộng nội dung, nên nó đẩy hai cái nút
          bên phải ra ngoài thẻ và chúng bị cắt mất. Đo thật ở cột rộng 420px: nút
          sao và nút tải lên biến mất hoàn toàn. */}
      <div className="flex min-w-0 gap-2">
        <Input
          className="min-w-0 flex-1"
          value={kho.tim}
          onChange={(event) => kho.setTim(event.target.value)}
          placeholder="Tìm theo tên hoặc tông nhạc"
          spellCheck={false}
        />
        <Button
          variant={kho.chiSao ? "default" : "outline"}
          size="icon"
          aria-label={
            kho.chiSao ? "Đang lọc bài đã đánh dấu" : "Chỉ xem bài đã đánh dấu"
          }
          tooltip={kho.chiSao ? "Bỏ lọc" : "Chỉ bài đã đánh dấu"}
          onClick={() => kho.setChiSao(!kho.chiSao)}
        >
          <StarIcon className={cn(kho.chiSao && "fill-current")} />
        </Button>
        {showUpload && (
          <Button
            variant="outline"
            size="icon"
            aria-label="Thêm nhạc vào kho"
            tooltip="Thêm nhạc của bạn vào kho dùng chung"
            disabled={kho.dangTai}
            onClick={() => chonTep.current?.click()}
          >
            {kho.dangTai ? <Spinner /> : <UploadIcon />}
          </Button>
        )}
        <input
          ref={chonTep}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac"
          hidden
          onChange={(event) => {
            const tep = event.target.files?.[0];
            // Xoá giá trị NGAY: chọn lại đúng tệp vừa chọn thì `change` không nổ
            // lần nữa, và người dùng tưởng nút hỏng.
            event.target.value = "";
            if (tep)
              void kho.taiLenKho(tep, tep.name.replace(/\.[^.]+$/, ""), "");
          }}
        />
      </div>

      {/* Hàng thẻ để lọc nhanh — bấm một cái là điền vào ô tìm. Không dựng thêm
          một trạng thái lọc riêng: hai đường lọc cho cùng một việc thì người dùng
          phải nhớ mình đang lọc bằng đường nào. */}
      <ScrollArea orientation="horizontal" scrollbar={false}>
        <div className="flex gap-1">
          {kho.moiThe.map((the) => (
            <Badge
              key={the}
              variant={kho.tim === the ? "default" : "secondary"}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => kho.setTim(kho.tim === the ? "" : the)}
            >
              {the}
            </Badge>
          ))}
        </div>
      </ScrollArea>

      {kho.error ? (
        <EmptyState
          icon={<PlugZapIcon />}
          title="Không mở được kho nhạc"
          description={kho.error}
          action={
            <Button variant="secondary" onClick={() => void kho.nap()}>
              Thử lại
            </Button>
          }
        />
      ) : kho.tracks === null ? (
        <EmptyState loading title="Đang mở kho nhạc" />
      ) : kho.hien.length === 0 ? (
        <EmptyState
          icon={<Music2Icon />}
          title={
            kho.tracks.length === 0
              ? "Kho chưa có bài nào"
              : "Không có bài nào khớp"
          }
          description={
            kho.tracks.length === 0
              ? "Thêm nhạc vào đây một lần là mọi dự án đều chọn được, kể cả chặng tự chọn nhạc."
              : "Thử bỏ bớt chữ trong ô tìm, hoặc bỏ lọc dấu sao."
          }
          action={
            kho.tracks.length === 0 && showUpload ? (
              <Button onClick={() => chonTep.current?.click()}>
                <UploadIcon data-icon="inline-start" />
                Thêm nhạc
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ScrollArea
          // `min-h-0` là BẮT BUỘC: mặc định của ScrollArea là `min-height:auto`
          // nên là con của lưới nó không chịu co dưới chiều cao nội dung — 58 bài
          // kéo nó cao 3416px trong một ô 473px, mà vỏ ngoài `overflow-hidden`
          // nên hơn năm mươi bài nằm ngoài màn và không cuộn tới được.
          className="min-h-0"
          viewportClassName="scroll-fade-b"
        >
          <ItemGroup className="has-data-[size=sm]:gap-0">
            {kho.hien.map((track) => {
              const dangNghe = kho.dangNghe === track.file;
              return (
                <Item key={track.file} size="sm">
                  <ItemMedia>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={dangNghe ? "Dừng nghe thử" : "Nghe thử"}
                      tooltip={dangNghe ? "Dừng" : "Nghe thử"}
                      onClick={() => kho.ngheThu(track.file)}
                    >
                      {dangNghe ? <PauseIcon /> : <PlayIcon />}
                    </Button>
                  </ItemMedia>

                  <ItemContent className="min-w-0 gap-0.5">
                    <ItemTitle className="truncate">{track.title}</ItemTitle>
                    <ItemDescription className="truncate text-xs">
                      {[
                        track.seconds > 0 ? phut(track.seconds) : null,
                        // Ba trục nhãn TRƯỚC thẻ tự do: chúng là thứ quyết
                        // định bài này có lọt vào lượt AI chọn nhạc hay không,
                        // còn thẻ tự do chỉ để đọc.
                        describeMusicTags(track.labels) || null,
                        track.tags.slice(0, 2).join(" · ") || null,
                        track.mine ? "bạn tải lên" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </ItemDescription>
                  </ItemContent>

                  <ItemActions>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={
                        track.starred ? "Bỏ đánh dấu" : "Đánh dấu bài này"
                      }
                      tooltip={track.starred ? "Bỏ đánh dấu" : "Đánh dấu"}
                      onClick={() =>
                        void kho.danhDau(track.file, !track.starred)
                      }
                    >
                      <StarIcon
                        className={cn(
                          track.starred && "fill-current text-primary",
                        )}
                      />
                    </Button>
                    {onPick && (
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        aria-label="Đặt bài này vào dải, tại vạch"
                        tooltip="Đặt vào dải tại vạch"
                        onClick={() => onPick(track.file)}
                      >
                        <PlusIcon />
                      </Button>
                    )}
                  </ItemActions>
                </Item>
              );
            })}
          </ItemGroup>
        </ScrollArea>
      )}
    </div>
  );
}
