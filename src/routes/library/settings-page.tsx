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
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { api, type ApiSettings } from "@/lib/api";
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
              ten="Máy nghe và sửa lời"
              y="Thứ ảnh hưởng tới bản chép lời, trước khi có bất cứ hình ảnh nào."
            >
              <Field>
                <FieldLabel htmlFor="profile">Lời dặn chung</FieldLabel>
                <Textarea
                  id="profile"
                  className="min-h-24 resize-none"
                  spellCheck={false}
                  // Dựng lại khi cài đặt từ máy chủ về — `defaultValue` đọc
                  // một lần lúc dựng, mà lúc ấy ô còn rỗng.
                  key={settings.profile}
                  defaultValue={settings.profile}
                  placeholder="Tên riêng máy hay nghe sai — cứ viết vào: mình lập công ty TensorLab, làm Golang với Redis"
                  onBlur={(event) => {
                    const clean = event.target.value.trim();
                    if (clean !== settings.profile) doi({ profile: clean });
                  }}
                />
                <FieldDescription>
                  Nối vào trước lời dặn của từng dự án. Máy nghe đọc nó làm mồi
                  từ vựng, chặng sửa lời tin nó hơn mọi suy đoán — nên tên công
                  ty hay tên sản phẩm viết một lần ở đây là đủ cho mọi video.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>
                  Tự rút quãng lặng dài hơn{" "}
                  {settings.minSilence === 0
                    ? "— đang tắt"
                    : `${settings.minSilence.toFixed(1)} giây`}
                </FieldLabel>
                <Slider
                  min={0}
                  max={3}
                  step={0.1}
                  value={[settings.minSilence]}
                  onValueChange={(value) =>
                    setSettings((cur) =>
                      cur
                        ? {
                            ...cur,
                            minSilence: Array.isArray(value)
                              ? value[0]!
                              : value,
                          }
                        : cur,
                    )
                  }
                  onValueCommitted={(value) =>
                    doi({
                      minSilence: Array.isArray(value) ? value[0]! : value,
                    })
                  }
                />
                <FieldDescription>
                  Người kể chuyện chậm nên để cao, video hướng dẫn nhanh thì hạ
                  xuống. Đặt 0 là đừng tự rút gì cả.
                </FieldDescription>
              </Field>
            </Nhom>

            <Nhom
              ten="Nhịp dựng"
              y="Máy nhắm tới những con số này, rồi tự bỏ chỗ nào đặt vào sẽ hỏng nhịp."
            >
              <Field>
                <FieldLabel>
                  Nhấn ở chỗ nối: mỗi {Math.round(settings.secondsPerEffect)}{" "}
                  giây một lần
                </FieldLabel>
                <Slider
                  min={3}
                  max={60}
                  step={1}
                  value={[settings.secondsPerEffect]}
                  onValueChange={(value) =>
                    setSettings((cur) =>
                      cur
                        ? {
                            ...cur,
                            secondsPerEffect: Array.isArray(value)
                              ? value[0]!
                              : value,
                          }
                        : cur,
                    )
                  }
                  onValueCommitted={(value) =>
                    doi({
                      secondsPerEffect: Array.isArray(value)
                        ? value[0]!
                        : value,
                    })
                  }
                />
                <FieldDescription>
                  Số này là mục tiêu, không phải mệnh lệnh: máy vẫn bỏ những chỗ
                  nối quá sát nhau, vì hai cú nhấn cách nhau dưới 2,5 giây đọc
                  ra là giật chứ không phải nhịp.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>
                  Tư liệu chèn:{" "}
                  {settings.placesPerMinute === 0
                    ? "đừng tự chèn"
                    : `${Math.round(settings.placesPerMinute)} lần mỗi phút`}
                </FieldLabel>
                <Slider
                  min={0}
                  max={12}
                  step={1}
                  value={[settings.placesPerMinute]}
                  onValueChange={(value) =>
                    setSettings((cur) =>
                      cur
                        ? {
                            ...cur,
                            placesPerMinute: Array.isArray(value)
                              ? value[0]!
                              : value,
                          }
                        : cur,
                    )
                  }
                  onValueCommitted={(value) =>
                    doi({
                      placesPerMinute: Array.isArray(value) ? value[0]! : value,
                    })
                  }
                />
                <FieldDescription>
                  Chỉ đặt được những tư liệu ĐÃ CÓ MÔ TẢ — máy đọc mô tả để biết
                  hình vẽ gì. Đặt 0 thì máy không tự chèn, bạn tự đặt tay ở bàn
                  dựng.
                </FieldDescription>
              </Field>

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

              <Field>
                <FieldLabel>
                  Nhạc nền to nhất {Math.round(settings.musicVolume * 100)}%
                </FieldLabel>
                <Slider
                  min={2}
                  max={40}
                  step={1}
                  value={[Math.round(settings.musicVolume * 100)]}
                  onValueChange={(value) =>
                    setSettings((cur) =>
                      cur
                        ? {
                            ...cur,
                            musicVolume:
                              (Array.isArray(value) ? value[0]! : value) / 100,
                          }
                        : cur,
                    )
                  }
                  onValueCommitted={(value) =>
                    doi({
                      musicVolume:
                        (Array.isArray(value) ? value[0]! : value) / 100,
                    })
                  }
                />
                <FieldDescription>
                  Đây là TRẦN, không phải mức cố định: máy vẫn hạ thấp hơn ở
                  đoạn lời dày. Trên 22% thì nhạc bắt đầu át tiếng người, nên đó
                  cũng là mức cao nhất máy tự đặt.
                </FieldDescription>
              </Field>

              <Field orientation="horizontal">
                <FieldLabel htmlFor="auto-grade">Tự chỉnh sáng và màu</FieldLabel>
                <Switch
                  id="auto-grade"
                  checked={settings.autoGrade}
                  onCheckedChange={(on) => doi({ autoGrade: Boolean(on) })}
                />
              </Field>
              <FieldDescription>
                Máy đo hình trước khi dựng: tối thì nâng sáng, bạc màu thì nâng
                màu, thiếu sáng thì lọc bớt hạt nhiễu. Video quay đủ sáng thì nó
                không đụng gì. Tắt nếu bạn đã tự nắn màu ở nơi khác.
              </FieldDescription>

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
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
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
