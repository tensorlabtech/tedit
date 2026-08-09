import { useEffect, useState } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ProfileFields } from "@/components/profile-fields";
import { api, type ApiSettings, type ApiStorage } from "@/lib/api";
import { INSERT_SOURCE_LABELS } from "@/lib/insert-source-options";

/**
 * CÀI ĐẶT — mặc định cho mọi dự án tạo về sau.
 *
 * Mỗi nút ở đây phải nối vào một chỗ máy THẬT SỰ đọc, và mô tả của nó nói rõ chỗ
 * ấy. Một trang cài đặt có nút không làm gì còn tệ hơn không có trang nào: người
 * dùng chỉnh, thấy chẳng đổi gì, rồi thôi không tin cả những nút có tác dụng thật.
 *
 * KHÔNG áp ngược lên dự án đã dựng. Đổi một con số ở đây mà bản dựng hôm qua tự
 * đổi theo thì công sửa cả buổi của người dùng bay mất, không ai hỏi han gì.
 */
export function SettingsPage() {
  const [settings, setSettings] = useState<ApiSettings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getSettings()
      .then(setSettings)
      .catch((loi: Error) => setError(loi.message || "Không đọc được cài đặt"));
  }, []);

  /**
   * Ghi NGAY khi đổi, không có nút Lưu.
   *
   * Cả trang chỉ có bảy giá trị độc lập; một nút Lưu chỉ thêm một bước để quên,
   * mà quên thì người dùng rời trang và tưởng mình đã đặt xong.
   */
  const doi = (patch: Partial<ApiSettings>) => {
    setSettings((cur) => (cur ? { ...cur, ...patch } : cur));
    void api.saveSettings(patch).catch(() => {
      toast.add({ title: "Không lưu được cài đặt", type: "error" });
      void api.getSettings().then(setSettings);
    });
  };

  if (error) {
    return (
      <Card className="h-full min-h-0">
        <CardHeader>
          <CardTitle>Cài đặt</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1">
          <Empty>
            <EmptyDescription>{error}</EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card className="h-full min-h-0">
        <CardHeader>
          <CardTitle>Cài đặt</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1">
          <Empty>
            <Spinner />
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full min-h-0">
      <CardHeader>
        <CardTitle>Cài đặt</CardTitle>
        <CardAction>
          <span className="text-sm text-muted-foreground">
            Áp cho dự án tạo về sau
          </span>
        </CardAction>
      </CardHeader>

      <CardContent className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)]">
        <ScrollArea className="min-h-0" viewportClassName="scroll-fade-b">
          <div className="mx-auto grid w-full max-w-2xl gap-6 pb-4">
            <Nhom
              ten="Hồ sơ của bạn"
              y="Máy đọc để chép đúng tên riêng và hiểu video nói về mảng gì — điền một lần, mọi dự án sau tự có."
            >
              <ProfileFields
                value={{
                  trade: settings.trade,
                  names: settings.names,
                  videoKind: settings.videoKind,
                }}
                onCommit={doi}
              />

              <Field>
                <FieldLabel htmlFor="profile">Thêm gì nữa (tuỳ)</FieldLabel>
                <Textarea
                  id="profile"
                  className="min-h-20 resize-none"
                  spellCheck={false}
                  // Dựng lại khi cài đặt từ máy chủ về — `defaultValue` đọc một
                  // lần lúc dựng, mà lúc ấy ô còn rỗng.
                  key={settings.profile}
                  defaultValue={settings.profile}
                  placeholder="Dặn thêm cho máy nghe và sửa lời, nếu ba ô trên chưa đủ"
                  onBlur={(event) => {
                    const clean = event.target.value.trim();
                    if (clean !== settings.profile) doi({ profile: clean });
                  }}
                />
              </Field>
            </Nhom>

            <Nhom
              ten="Máy tự làm"
              y="Những việc máy tự lo khi dựng. Nhịp cắt, mật độ tư liệu và độ to nhạc giờ đi theo PHONG CÁCH của dự án, không chỉnh ở đây nữa."
            >
              <Field>
                <FieldLabel>Máy được lấy tư liệu ở đâu</FieldLabel>
                <Select
                  items={INSERT_SOURCE_LABELS}
                  value={settings.insertSource}
                  onValueChange={(value) =>
                    doi({ insertSource: value as ApiSettings["insertSource"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INSERT_SOURCE_LABELS).map(
                      ([value, nhan]) => (
                        <SelectItem key={value} value={value}>
                          {nhan}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Mấy clip dùng đi dùng lại — cảnh bàn phím, góc văn phòng — thì
                  đánh dấu sao một lần, mọi dự án sau tự có. Chọn cả kho khi kho
                  còn ít và mô tả đã viết kỹ.
                </FieldDescription>
              </Field>

              <Field orientation="horizontal">
                <FieldLabel htmlFor="want-captions">
                  Tự sinh chữ từ lời
                </FieldLabel>
                <Switch
                  id="want-captions"
                  checked={settings.wantCaptions}
                  onCheckedChange={(on) => doi({ wantCaptions: Boolean(on) })}
                />
              </Field>

              <Field orientation="horizontal">
                <FieldLabel htmlFor="want-music">Tự chọn nhạc nền</FieldLabel>
                <Switch
                  id="want-music"
                  checked={settings.wantMusic}
                  onCheckedChange={(on) => doi({ wantMusic: Boolean(on) })}
                />
              </Field>
            </Nhom>

            <Nhom
              ten="Chỗ chứa"
              y="Máy chủ dùng chung. Video gốc, bản dựng và cơ sở dữ liệu nằm cùng một ổ."
            >
              <StorageLine />
            </Nhom>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

const GB = 1024 ** 3;
const gb = (bytes: number) => `${(bytes / GB).toFixed(1)} GB`;

/**
 * Ổ của máy chủ còn bao nhiêu.
 *
 * Là con số để BIẾT LÚC NÀO PHẢI DỌN, không phải hạn mức — không ai bị chặn vì
 * dòng này. Cần nói ra vì cơ sở dữ liệu nằm cùng ổ với video: ổ đầy không hiện
 * ra thành "hết chỗ tải thêm" mà thành một lỗi ghi ở giữa lượt dựng của người
 * khác, ở chỗ chẳng liên quan gì tới nguyên nhân.
 *
 * Đo không được thì KHÔNG hiện gì. Bịa ra số 0 tệ hơn im lặng.
 */
function StorageLine() {
  const [storage, setStorage] = useState<ApiStorage | null>(null);

  useEffect(() => {
    api
      .getStorage()
      .then(setStorage)
      .catch(() => setStorage(null));
  }, []);

  if (!storage || "unavailable" in storage) return null;

  const usedRatio = storage.totalBytes > 0
    ? storage.usedBytes / storage.totalBytes
    : 0;

  return (
    <Field>
      <FieldLabel>
        Đã dùng {gb(storage.usedBytes)} / {gb(storage.totalBytes)}
      </FieldLabel>
      <Progress value={Math.round(usedRatio * 100)} />
      <FieldDescription>
        Còn trống {gb(storage.freeBytes)}. Mỗi dự án giữ lại khoảng ba tới bốn
        lần dung lượng video gốc — xoá dự án đã xong là cách dọn nhanh nhất.
      </FieldDescription>
    </Field>
  );
}

/**
 * Một nhóm cài đặt: tên nhóm, một câu nói nhóm này ăn vào đâu, rồi tới các ô.
 *
 * Bảy ô xếp thành một cột dài thì không ai đọc ra cái nào ảnh hưởng tới chặng nào
 * — mà đó chính là thứ người dùng cần biết trước khi kéo một thanh trượt.
 */
function Nhom({
  ten,
  y,
  children,
}: {
  ten: string;
  y?: string;
  children: React.ReactNode;
}) {
  return (
    // Nhóm KHÔNG được cấp mảng nền, cũng không viền: nền chỉ dành cho thứ bấm
    // được, nên tô nền một nhóm chỉ-để-gom là đưa mảng ấy đi nói dối — người
    // dùng rê chuột vào rồi chẳng có gì xảy ra.
    //
    // Ranh giới do kẻ ngang chạy hết bề ngang thẻ lo, âm lề đúng bằng đệm thẻ
    // rồi trả lại bằng `px` nên chữ vẫn thụt đều. Nhóm đầu không kẻ.
    <section className="-mx-(--card-spacing) grid gap-4 px-(--card-spacing) py-5 not-first:border-t not-first:border-border">
      <div className="grid gap-0.5">
        <h2 className="font-heading text-sm font-medium">{ten}</h2>
        {y && <p className="text-xs text-muted-foreground">{y}</p>}
      </div>
      {children}
    </section>
  );
}
