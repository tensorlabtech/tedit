import { useEffect, useRef, useState } from "react";
import { ImagesIcon, PlugZapIcon, UploadIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { AssetDialog } from "./asset-dialog";
import { AssetTile } from "./asset-tile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { api, type ApiLibraryAsset } from "@/lib/api";

/**
 * KHO TƯ LIỆU — ảnh và video chèn dùng chung cho mọi dự án.
 *
 * Kho chứ không phải thư mục của một dự án: thứ ở đây chưa thuộc video nào, và
 * dự án nào cũng chọn ra dùng được. Mô tả viết một lần ở đây thì mọi dự án về sau
 * đều thừa hưởng — chặng ghép tư liệu đọc đúng cột đó để biết hình vẽ cái gì.
 */
export function AssetsPage() {
  const [assets, setAssets] = useState<ApiLibraryAsset[] | null>(null);
  const [error, setError] = useState("");
  const [tim, setTim] = useState("");
  const [dangTai, setDangTai] = useState(false);
  /** Tư liệu đang mở trong hộp xem — `null` là chưa mở cái nào */
  const [dangXem, setDangXem] = useState<string | null>(null);
  const chonTep = useRef<HTMLInputElement>(null);

  const nap = () =>
    api
      .listAssets()
      .then((rows) => {
        setAssets(rows);
        setError("");
      })
      .catch((loi: Error) => setError(loi.message || "Không mở được kho"));

  useEffect(() => {
    void nap();
  }, []);

  const taiLen = async (files: File[]) => {
    setDangTai(true);
    try {
      const ket = await api.uploadAssets(files);
      setAssets(ket.assets);
      // Nói RÕ bao nhiêu cái bị bỏ vì trùng. Thả mười tệp mà chỉ thấy bảy cái mới
      // hiện ra, không ai giải thích, thì người dùng tưởng máy nuốt mất.
      if (ket.duplicates.length > 0) {
        toast.add({
          title: `Bỏ qua ${ket.duplicates.length} tệp đã có sẵn trong kho`,
          description: ket.duplicates
            .map(
              (item) =>
                `${item.name} → ${item.sameAs || "không nhận định dạng"}`,
            )
            .join("\n"),
          type: "info",
        });
      }
      if (ket.added > 0) {
        toast.add({ title: `Đã thêm ${ket.added} tư liệu`, type: "success" });
      }
    } catch (loi) {
      toast.add({
        title: loi instanceof Error ? loi.message : "Không tải lên được",
        type: "error",
      });
    } finally {
      setDangTai(false);
    }
  };

  const danhDau = async (file: string, on: boolean) => {
    setAssets((cur) =>
      cur ? cur.map((a) => (a.file === file ? { ...a, starred: on } : a)) : cur,
    );
    await api.starAsset(file, on).catch(() => void nap());
  };

  const luuMoTa = async (file: string, title: string, description: string) => {
    setAssets((cur) =>
      cur
        ? cur.map((a) => (a.file === file ? { ...a, title, description } : a))
        : cur,
    );
    await api.updateAsset(file, { title, description }).catch(() => void nap());
  };

  const tu = tim.trim().toLowerCase();
  const hien = (assets ?? []).filter(
    (a) =>
      !tu ||
      a.title.toLowerCase().includes(tu) ||
      a.description.toLowerCase().includes(tu) ||
      a.tags.some((the) => the.toLowerCase().includes(tu)),
  );

  return (
    <Card className="h-full min-h-0">
      <CardHeader>
        <CardTitle>Tư liệu</CardTitle>
        <CardAction>
          <Button disabled={dangTai} onClick={() => chonTep.current?.click()}>
            {dangTai ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <UploadIcon data-icon="inline-start" />
            )}
            Thêm tư liệu
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-3">
        <Input
          className="min-w-0"
          value={tim}
          onChange={(event) => setTim(event.target.value)}
          placeholder="Tìm theo tên, mô tả hoặc thẻ"
          spellCheck={false}
        />
        <input
          ref={chonTep}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(event) => {
            // CHÉP danh sách tệp ra mảng TRƯỚC khi xoá `value`.
            //
            // `event.target.files` là một `FileList` SỐNG, không phải bản chụp:
            // gán `value = ""` để chọn lại được đúng tệp vừa chọn cũng xoá luôn
            // danh sách mà biến này đang trỏ tới. Giữ tham chiếu rồi mới xoá thì
            // tới lúc đọc `files.length` nó đã bằng 0 — nút tải lên im lặng không
            // làm gì, không lỗi, không thông báo. Đo thật: chọn tệp xong kho vẫn
            // rỗng.
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) void taiLen(files);
          }}
        />

        {error ? (
          <EmptyState
            icon={<PlugZapIcon />}
            title="Không mở được kho tư liệu"
            description={error}
            action={
              <Button variant="secondary" onClick={() => void nap()}>
                Thử lại
              </Button>
            }
          />
        ) : assets === null ? (
          <EmptyState loading title="Đang mở kho tư liệu" />
        ) : hien.length === 0 ? (
          <EmptyState
            icon={<ImagesIcon />}
            title={
              assets.length === 0
                ? "Chưa có tư liệu nào"
                : "Không có tư liệu nào khớp"
            }
            description={
              assets.length === 0
                ? "Ảnh và video chèn để đè lên lời nói. Thêm vào đây một lần là mọi dự án đều chọn được."
                : "Thử bỏ bớt chữ trong ô tìm."
            }
            action={
              assets.length === 0 ? (
                <Button onClick={() => chonTep.current?.click()}>
                  <UploadIcon data-icon="inline-start" />
                  Thêm tư liệu
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ScrollArea className="min-h-0" viewportClassName="scroll-fade-b">
            {/* Đệm 3px chừa chỗ cho vòng tiêu điểm: nó vẽ RA NGOÀI hộp thẻ nên
                sát mép vùng cuộn là bị cắt cụt — cùng lý do với lưới Dự án. */}
            <div className="grid grid-cols-2 gap-2 p-[3px] md:grid-cols-3 xl:grid-cols-4">
              {hien.map((asset) => (
                <AssetTile
                  key={asset.file}
                  asset={asset}
                  onOpen={() => setDangXem(asset.file)}
                  onStar={(on) => void danhDau(asset.file, on)}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        <AssetDialog
          asset={hien.find((item) => item.file === dangXem) ?? null}
          open={dangXem !== null}
          onOpenChange={(mo) => !mo && setDangXem(null)}
          onSave={(file, patch) =>
            void luuMoTa(file, patch.title, patch.description)
          }
          onStar={(file, on) => void danhDau(file, on)}
        />
      </CardContent>
    </Card>
  );
}
