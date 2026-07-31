import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StyleStrip } from "@/routes/upload/style-strip";


import type { UploadState } from "./use-upload";

/**
 * Chữ vẽ trong ô mẫu khi chưa có lời chép.
 *
 * Bốn tiếng có dấu đủ loại — mũ, móc, thanh nặng — vì đó mới là chỗ một bộ dáng
 * lộ ra nó đặt dấu khéo hay vụng.
 */
const SAMPLE_TEXT = "Mình muốn kể";

/**
 * Khối KHAI BÁO DỰ ÁN: tên, ngưỡng rút lặng, lời dặn cho máy nghe.
 *
 * Chiều cao BẤT BIẾN — đó là luật của thẻ này. Nó nằm ở hàng `auto` đầu cột nội
 * dung, nên cao thêm một dòng là hai dải ô bên dưới bị bóp đúng chừng ấy. Từng có
 * hàng soát, thanh tiến độ và bốn bước chép lời ở đây: thả tệp vào là cả layout xô
 * lệch một nhịp. Chúng đã sang card "Tiếp theo", nơi có cái nút chúng đang nói về.
 *
 * KHÔNG bày số liệu về dự án. Từng có một dòng "2:23 · 9 cảnh nối lại" to đùng ở
 * đây, và nó nói dối hai lần: người đọc tưởng đó là khung xem video đã ghép, còn
 * con số thì chưa cắt gì nên chẳng phải độ dài thành phẩm.
 */
export function SetupCard({
  upload,
  className,
}: {
  upload: UploadState;
  className?: string;
}) {
  // Khung hình thật của cảnh chính đầu tiên — có ngay sau khi tệp tải xong, tức
  // là trước cả lời chép. Đó là thứ làm ô mẫu đọc ra "phong cách video".
  const poster =
    upload.mainFiles.find((file) => file.thumbnail)?.thumbnail ?? null;
  // KHÔNG còn ẩn thẻ này nữa. Nó từng ẩn khi chưa có gì để nói, vì lúc đó nó chỉ
  // chứa một câu trạng thái trùng với thứ thẻ Mạch chính đã nói. Giờ nó là khối
  // KHAI BÁO DỰ ÁN — tên và cài đặt luôn có nghĩa, kể cả trước khi thả tệp đầu
  // tiên, và ẩn nó đi là làm cột nội dung nhảy một nấc ngay lần thả đầu.

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Dự án</CardTitle>
      </CardHeader>

      {/* `overflow-hidden`: màn thấp thì phần trên tràn ra ngoài ô của mình và
          đè lên thứ bên dưới — xén trong ô thì cùng lắm mất một dòng nhắc.

          `pb-1` là chỗ thở cho VÒNG FOCUS, không phải khoảng cách trang trí. Ô mô
          tả bên dưới là `flex-1` nên đáy nó trùng KHÍT đáy ô này (đo được: hở 0px),
          mà `overflow-hidden` xén ở mép padding — nên cả vòng `ring-3` phía dưới bị
          cắt sạch, ô đang focus mà nhìn ra như không. Bốn điểm ảnh đủ cho vòng ba
          điểm ảnh, và vì ô này `flex-1` nên thẻ KHÔNG cao thêm chút nào. */}
      <CardContent className="flex min-h-0 flex-col gap-3 overflow-hidden pb-1 lg:flex-1">
        {/* HAI cột: bên trái khai báo và cài đặt (từng dòng một, ngắn), bên phải
            ô mô tả (cao, cần chỗ để đọc lại cả câu vừa gõ).

            Xếp dọc hết thì khối này cao gấp đôi và ăn thẳng vào hai dải ô bên dưới
            — đo được: dải tư liệu tụt còn 56px, ô cao 0. */}
        <div className="grid min-h-0 flex-1 gap-3 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            {/* Máy nghe ĐỌC cái tên: `asr-bias` đẩy nó vào đoạn mồi thành câu
                "Video tên là …", nên đặt tên "Sinh nhật 30" là đã mồi hai từ máy
                hay nghe chệch — và phải đặt TRƯỚC khi chép lời mới kịp. */}
            <Field>
              <FieldLabel htmlFor="project-name">Tên dự án</FieldLabel>
              <Input
                id="project-name"
                spellCheck={false}
                // Điền SẴN tên gợi ý, không để trống chờ gõ: ai không muốn nghĩ tên
                // thì bỏ qua ô này, mà danh sách dự án vẫn phân biệt được nhau.
                defaultValue={upload.title}
                onBlur={(event) => {
                  const clean = event.target.value.trim();
                  if (clean && clean !== upload.title) {
                    void upload.saveTitle(clean);
                  }
                }}
              />
            </Field>

            {/* LỜI DẶN — thứ ĐỔI ĐƯỢC MỘT QUYẾT ĐỊNH rõ nhất ở màn này.
              Máy nghe lấy nó làm mồi từ vựng, chặng sửa lời tin nó hơn mọi suy đoán.
              Đo khi ô này còn rỗng: "TensorLab" chép ra "Tensolab" — không ngữ cảnh
              nào cho máy đoán ra tên một công ty chưa ai nghe.

              Ô mô tả TỪNG tư liệu chèn không còn ở đây: nó đã sang khung Xem trước,
              nơi tấm hình đang hiện ngay trên nó. Ở đây thì người dùng phải nhớ mình
              đang mô tả tư liệu nào.

              Hiện NGAY, không đợi có cảnh nào: ô này phải điền TRƯỚC khi chép lời
              mới kịp làm mồi từ vựng, mà người ta hay gõ nó lúc đang chờ tệp tải lên.
              Ẩn tới khi có cảnh đầu tiên là bỏ mất đúng quãng thời gian rảnh đó.

              Ghi lúc RỜI Ô, không ghi từng phím: người ta gõ liền một câu dài. */}
            <Field className="min-h-0 flex-1">
              <FieldLabel htmlFor="project-brief">Video nói về gì</FieldLabel>
            <Textarea
              id="project-brief"
              // Không ép `text-sm`: design system để `text-base md:text-sm` là có
              // lý do — dưới 16px thì Safari trên iPhone tự phóng cả trang lúc chạm
              // vào ô, và người dùng phải chụm tay thu lại mới gõ tiếp được.
              className="min-h-0 flex-1 resize-none"
              // Tên riêng là mục đích của ô này, mà bộ soát chính tả gạch đỏ đúng
              // những từ ấy — thành ra ô nào gõ đúng ý nhất lại trông sai nhất.
              spellCheck={false}
              placeholder="Tên riêng máy hay nghe sai — cứ viết vào: mình lập công ty TensorLab, làm Golang với Redis"
              defaultValue={upload.profile}
              onBlur={(event) => {
                const clean = event.target.value.trim();
                if (clean !== upload.profile) {
                  void upload.saveProfile(clean);
                }
              }}
            />
            </Field>
          </div>

          <StyleStrip
            value={upload.stylePack}
            onChange={(next) => void upload.saveStylePack(next)}
            sampleText={SAMPLE_TEXT}
            posterUrl={poster}
          />
        </div>
      </CardContent>
    </Card>
  );
}
