import { useEffect, useMemo, useRef, useState } from "react";
import { ImagesIcon, UploadIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { MediaPickerToolbar } from "@/components/media-picker-toolbar";
import type { PickerItem } from "@/components/media-picker-item";
import type { Loc, Tab } from "@/components/media-picker-toolbar";
import { MediaPickerPreview } from "@/components/media-picker-preview";
import { MediaPickerTile } from "@/components/media-picker-tile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useFileDrop } from "@/lib/use-file-drop";
import { cn } from "@/lib/utils";

/**
 * Hộp chọn tư liệu — MỘT cái, dùng ở màn nạp tệp lẫn bàn dựng.
 *
 * Trước có hai hộp riêng cho hai nguồn: "Chèn tư liệu" ở bàn dựng chỉ thấy tệp
 * của dự án, còn "Kho tư liệu" chỉ thấy kho dùng chung. Hai hộp cùng trả lời một
 * câu hỏi — "cái nào là cảnh tôi cần" — mà bày ra hai kiểu, hai bố cục, hai cách
 * chọn. Người dùng phải nhớ mở cửa nào mới thấy tệp mình đang tìm.
 *
 * Gộp thành HAI TAB trong một hộp: cùng lưới, cùng cột xem trước, cùng chỗ đặt
 * nút. Đổi tab chỉ đổi thứ nằm trong lưới, khung ngoài đứng yên.
 *
 * Cột xem trước RỘNG CỐ ĐỊNH: khung xem là 9:16, cho nó co theo bảng thì mỗi lần
 * đổi bề rộng cửa sổ là chiều cao cả bảng nhảy theo.
 */
export function MediaPickerDialog({
  open,
  onOpenChange,
  title,
  projectItems,
  alreadyIn = [],
  onUse,
  useLabel,
  onTake,
  takeLabel = "Thêm vào dự án",
  onUpload,
  uploading = false,
  defaultTab = "project",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Tư liệu chèn đã có trong dự án — nội dung tab thứ nhất */
  projectItems: PickerItem[];
  /**
   * Tên tệp KHO đã có trong dự án — ô của chúng mang nhãn "đã có".
   *
   * Nơi gọi tự tính chứ không suy từ `projectItems`: hai màn giữ tệp dự án ở hai
   * dạng khác nhau, mà cột "lấy từ kho tên gì" chỉ có ở dạng của máy chủ.
   */
  alreadyIn?: string[];
  /**
   * Việc chính khi đang ở tab dự án — ở bàn dựng là chèn vào vạch.
   *
   * Bỏ trống ở màn nạp tệp: ở đó chưa có vạch nào để chèn vào, tab dự án chỉ để
   * xem lại mình đã có gì trước khi đi lấy thêm.
   */
  onUse?: (fileId: string) => Promise<void> | void;
  useLabel?: string;
  /**
   * Lấy tệp từ KHO về dự án. Trả về mã các tệp mới để hộp chọn sẵn cái cuối.
   */
  onTake: (files: string[]) => Promise<string[] | void>;
  takeLabel?: string;
  /** Lấy tệp từ MÁY — có nó thì lưới tab dự án mọc thêm ô tải lên và nhận thả tệp */
  onUpload?: (files: File[]) => void;
  uploading?: boolean;
  defaultTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [tim, setTim] = useState("");
  const [loc, setLoc] = useState<Loc>("all");
  const [chonDuAn, setChonDuAn] = useState<string | null>(null);
  const [chonKho, setChonKho] = useState<string[]>([]);
  const [kho, setKho] = useState<PickerItem[] | null>(null);
  const [dangLam, setDangLam] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Thả tệp thẳng vào bảng. Bắt ở cả bảng chứ không chỉ ở ô "Lấy tệp": người kéo
  // tệp từ Finder sang thì cả bảng là đích họ nhắm tới, không phải một ô nhỏ.
  const { over: dragging, dropProps } = useFileDrop((files) => {
    setTab("project");
    onUpload?.(files);
  });

  // Dựng lại từ đầu mỗi lần mở: giữ chữ đang tìm và ô đang chọn của lần trước
  // thì mở ra thấy một lưới đã lọc mà không nhớ vì sao.
  useEffect(() => {
    if (!open) return;
    setTab(defaultTab);
    setTim("");
    setLoc("all");
    setChonKho([]);
  }, [open, defaultTab]);

  // Kho chỉ nạp khi NGƯỜI DÙNG sang tab ấy: kho có thể hàng trăm tệp, mà phần
  // lớn lượt chèn là lấy tệp đã có sẵn trong dự án.
  useEffect(() => {
    if (!open || tab !== "library" || kho !== null) return;
    void api
      .listAssets()
      .then((rows) =>
        setKho(
          rows.map((asset) => ({
            key: asset.file,
            thumbUrl: `/files/assets/${encodeURIComponent(asset.file)}`,
            thumbKind: asset.kind,
            previewUrl: `/files/assets/${encodeURIComponent(asset.file)}`,
            name: asset.title,
            isVideo: asset.kind === "video",
            seconds: asset.seconds,
            starred: asset.starred,
            note: !asset.description ? ("no-description" as const) : undefined,
            search: `${asset.title} ${asset.description}`.toLowerCase(),
          })),
        ),
      )
      .catch(() => setKho([]));
  }, [open, tab, kho]);

  // Nạp lại danh mục kho mỗi lần MỞ hộp, không giữ bản của lần trước: người dùng
  // hay thêm tệp ở mục Tư liệu rồi quay lại đây, mà danh mục cũ thì mấy tệp vừa
  // thêm không có mặt và trông như đã mất.
  useEffect(() => {
    if (!open) setKho(null);
  }, [open]);

  const daCo = useMemo(() => new Set(alreadyIn), [alreadyIn]);

  const duAn = projectItems;

  const nguon = tab === "project" ? duAn : (kho ?? []);
  const tu = tim.trim().toLowerCase();
  const hien = nguon.filter((item) => {
    if (loc === "starred" && !item.starred) return false;
    if (loc === "image" && item.isVideo) return false;
    if (loc === "video" && !item.isVideo) return false;
    return !tu || item.search.includes(tu);
  });

  const dangXem =
    tab === "project"
      ? (duAn.find((item) => item.key === chonDuAn) ?? null)
      : ((kho ?? []).find((item) => item.key === chonKho.at(-1)) ?? null);

  const dungTepDuAn = async () => {
    if (!chonDuAn || !onUse) return;
    setDangLam(true);
    try {
      await onUse(chonDuAn);
      onOpenChange(false);
    } finally {
      setDangLam(false);
    }
  };

  const layTuKho = async () => {
    if (chonKho.length === 0) return;
    setDangLam(true);
    try {
      const ids = await onTake(chonKho);
      // Ở LẠI trong hộp, chuyển sang tab dự án: tệp vừa lấy về giờ nằm trong dự
      // án, mà việc tiếp theo (chèn vào vạch) làm ở tab ấy. Đóng hộp đi là bắt
      // người dùng mở lại và tự tìm lại tệp mình vừa lấy.
      //
      // Và CHỌN SẴN cái cuối: người ta vào kho là để dùng nó, không phải để nhìn
      // nó nằm thêm một chỗ nữa.
      if (Array.isArray(ids) && ids.length > 0)
        setChonDuAn(ids[ids.length - 1]!);
      setChonKho([]);
      setTab("project");
      setTim("");
      setLoc("all");
    } finally {
      setDangLam(false);
    }
  };

  const chinh =
    tab === "project"
      ? onUse && {
          nhan: useLabel ?? "Dùng tệp này",
          tat: !chonDuAn,
          lam: dungTepDuAn,
        }
      : { nhan: takeLabel, tat: chonKho.length === 0, lam: layTuKho };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" {...(onUpload ? dropProps : {})}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {onUpload && (
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="video/*,image/*"
            hidden
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (picked.length > 0) onUpload(picked);
            }}
          />
        )}

        <MediaPickerToolbar
          tab={tab}
          onTabChange={setTab}
          search={tim}
          onSearchChange={setTim}
          filter={loc}
          onFilterChange={setLoc}
        />

        {/* Chiều cao SÀN bằng đúng trần của vùng cuộn: thiếu nó thì lọc ra ít ô là
            cả hộp co lại, lọc ra rỗng thì co thêm lần nữa — đổi bộ lọc mà hộp nhảy
            hai nhịp dưới con trỏ. Chỗ trống thừa khi kho còn ít tệp đỡ hơn nhiều. */}
        <div className="grid min-h-[27rem] gap-4 sm:grid-cols-[1fr_13rem]">
          {tab === "library" && kho === null ? (
            <div className="grid h-64 place-items-center">
              <Spinner />
            </div>
          ) : hien.length === 0 && !(tab === "project" && onUpload) ? (
            <EmptyState
              icon={<ImagesIcon />}
              title={
                nguon.length === 0
                  ? tab === "project"
                    ? "Dự án chưa có tư liệu nào"
                    : "Kho tư liệu chưa có gì"
                  : "Không có tư liệu nào khớp"
              }
              description={
                nguon.length === 0
                  ? tab === "project"
                    ? "Lấy từ kho tư liệu, hoặc tải ảnh và video lên."
                    : "Thêm ảnh và video vào mục Tư liệu, rồi dùng lại được ở mọi dự án."
                  : // Lựa chọn KHÔNG mất khi bộ lọc giấu nó đi — nói ra, không thì
                    // lưới trống mà nút "Thêm" vẫn sáng đọc ra như một lỗi.
                    chonKho.length > 0
                    ? `Thử một từ khác, hoặc bỏ bớt bộ lọc. ${chonKho.length} tư liệu đã chọn vẫn còn, chỉ đang bị lọc giấu.`
                    : "Thử một từ khác, hoặc bỏ bớt bộ lọc."
              }
            />
          ) : (
            // Không `scroll-fade-b` ở đây: nó che mờ 1.5rem cuối vùng cuộn — đúng
            // chỗ đó là hàng ảnh dưới cùng, nên trông như ảnh bị lẹm mất một dải.
            // Che mờ chỉ hợp khi mép cắt ngang thân CHỮ.
            <ScrollArea className="max-h-[27rem] min-h-0">
              <div className="grid grid-cols-3 gap-2 pr-3 sm:grid-cols-4">
                {hien.map((item) => (
                  <MediaPickerTile
                    key={item.key}
                    item={{
                      ...item,
                      note:
                        item.note ??
                        (daCo.has(item.key) ? "already" : undefined),
                    }}
                    active={
                      tab === "project"
                        ? item.key === chonDuAn
                        : chonKho.includes(item.key)
                    }
                    onSelect={() => {
                      if (tab === "project") setChonDuAn(item.key);
                      else
                        setChonKho((cur) =>
                          cur.includes(item.key)
                            ? cur.filter((key) => key !== item.key)
                            : [...cur, item.key],
                        );
                    }}
                    onUseNow={
                      tab === "project" && onUse
                        ? () => {
                            void (async () => {
                              await onUse(item.key);
                              onOpenChange(false);
                            })();
                          }
                        : undefined
                    }
                  />
                ))}

                {tab === "project" && onUpload && (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className={cn(
                      "flex aspect-[9/16] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground",
                      "hover:border-primary/50 hover:bg-accent/50",
                      dragging &&
                        "border-primary bg-primary/10 text-foreground",
                    )}
                  >
                    {uploading ? (
                      <Spinner />
                    ) : (
                      <UploadIcon className="size-4" />
                    )}
                    {uploading ? "Đang tải…" : "Lấy tệp"}
                  </button>
                )}
              </div>
            </ScrollArea>
          )}

          <MediaPickerPreview item={dangXem} />
        </div>

        <DialogFooter className="sm:justify-between">
          {/* Số đã chọn nói ra bằng CHỮ, không chỉ nằm trong nút: lưới cuộn được,
              nên tệp vừa chọn có thể đã trôi khỏi tầm nhìn. */}
          <span className="self-center text-sm text-muted-foreground">
            {tab === "library" && chonKho.length > 0
              ? `Đã chọn ${chonKho.length}`
              : `${hien.length} tư liệu`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={dangLam}
            >
              Đóng
            </Button>
            {chinh && (
              <Button onClick={chinh.lam} disabled={chinh.tat || dangLam}>
                {dangLam ? <Spinner data-icon="inline-start" /> : null}
                {chinh.nhan}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
