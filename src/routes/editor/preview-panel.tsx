import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

import { api } from "@/lib/api";
import {
  GradeFilterDefs,
  gradeFilterId,
  gradeStyle,
} from "@/dev/overlays/grade-filter";
import { revealCss, shapeBox, type BandId } from "@/dev/overlays/overlay-model";
import { OverlayTextBlock } from "@/dev/overlays/overlay-render";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { packForElement } from "../../../server/style-pack";
import { findStylePack } from "../../../server/style-pack-catalog";

import { formatTime } from "./editor-data";
import { findJunction } from "../../../server/junction-kinds";
import { PreviewMusic } from "./preview-music";
import { StyleSwitchDialog } from "./style-switch-dialog";
import type { EditorState } from "./use-editor";

/**
 * Khung xem trước CHẠY hiệu ứng hiện chữ theo vạch thời gian.
 *
 * Trước đây nó bày thẳng trạng thái cuối vì bản in ra cũng chưa có hiệu ứng. Giờ
 * bản in đã hiện theo từng tiếng, nên bày trạng thái cuối sẽ thành nói dối: người
 * dùng canh chữ ở khung xem rồi xuất ra mới thấy nhịp khác hẳn.
 */

export function PreviewPanel({
  editor,
  playing,
  onTogglePlay,
}: {
  editor: EditorState;
  playing: boolean;
  onTogglePlay: () => void;
}) {
  const [styleOpen, setStyleOpen] = useState(false);
  const projectPack = findStylePack(editor.stylePack);
  // Lọc theo MỐC của chính phần tử, không tra ngược ra hai đầu từ.
  //
  // Bản trước tra `wordsById` rồi lấy mốc của từ. Chữ TỰ DO neo theo giờ nên hai
  // mã từ để rỗng, phép tra trả về rỗng, và `if (!from || !to) return false` vứt
  // nó đi — gõ xong một cái tiêu đề mà khung xem trống trơn, không báo gì.
  //
  // `element.start/end` đã đúng cho CẢ HAI kiểu neo (dựng ở `shape()`), nên bỏ
  // hẳn phép tra là vừa sửa lỗi vừa bớt một đường vòng.
  const visible = editor.textElements.filter(
    (element) => editor.time >= element.start && editor.time <= element.end,
  );

  const insert = editor.inserts.find(
    (item) => editor.time >= item.start && editor.time <= item.end,
  );

  // Thẻ video giữ ở `useEditor` chứ không ở đây: vòng phát cần đọc `currentTime`
  // của nó để làm đồng hồ. Xem chú thích ở `use-editor.ts`.
  const videoRef = editor.videoRef;
  const insertRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  /**
   * Tua video chỉ khi NGƯỜI DÙNG nhảy chỗ, không phải để bám theo đồng hồ.
   *
   * Lúc đang phát thì `editor.time` giờ ĐI RA TỪ chính `video.currentTime`
   * (`editor-page.tsx`), nên hai bên lệch nhau nhiều nhất là một nhịp đẩy state —
   * dưới 0,05 giây. Chạm ngưỡng dưới đây nghĩa là có người kéo vạch hoặc bấm vào
   * dải, tức một cú nhảy có chủ ý.
   *
   * Bản trước đặt 0,3 và tua để ép video khớp đồng hồ tường. Mạng khựng một cái
   * là video tụt quá ngưỡng, bị tua, nạp lại từ chỗ mới rồi tụt tiếp — đo trên
   * máy người dùng thật: 38 lượt tua và 38 lượt chờ nạp trong 15 giây, trong khi
   * FPS vẫn 60 và không có tác vụ dài nào. Cái giật nằm ở đó, không ở chỗ vẽ.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - editor.time) > 0.5) {
      video.currentTime = editor.time;
    }
  }, [editor.time, videoRef]);

  // Đứng ngay trong một quãng đã bỏ thì báo rõ, đừng để người dùng tưởng video
  // vẫn còn đoạn này.
  /**
   * Trạng thái hiệu ứng tại vạch: mức phóng và mức sáng.
   *
   * Đọc `editor.effects` — mỗi hiệu ứng mang KIỂU và QUÃNG của riêng nó, không
   * phải một cờ chung của dự án. So theo thời gian ĐÃ CẮT, vì quãng cũng đo
   * bằng thời gian đã cắt; so bằng giây gốc thì chỗ nối nào cũng lệch đúng bằng
   * phần bị bỏ ngay tại đó.
   */
  const junction = (() => {
    /*
     * Cộng dồn theo TỪNG BIẾN HÌNH, không phải theo từng kiểu.
     *
     * Bản trước chỉ biết hai biến — phóng và sáng — nên mọi kiểu không thuộc hai
     * trục ấy đều vẽ ra y hệt nhau ở khung xem. Nay mỗi kiểu khai nó lái những
     * biến nào (`server/junction-kinds.ts`), và chỗ này chỉ việc cộng lại.
     *
     * Cộng chứ không lấy `max`: hai chỗ nối gần nhau thì tác dụng chồng lên
     * nhau, đúng như chuỗi lọc ffmpeg — ở đó mỗi bộ lọc cũng nối tiếp bộ trước.
     */
    const acc = {
      zoom: 0, sang: 0, bhoa: 0, xoay: 0,
      dichX: 0, dichY: 0, nhoe: 0, vien: 0, sac: 0, tuongPhan: 0,
    };
    const now = editor.toOutput(editor.time);
    for (const item of editor.effects) {
      if (item.kind === "none") continue;
      const da = now - item.outPeak;
      const before = Math.max(0.04, item.outPeak - item.outStart);
      const after = Math.max(0.04, item.outEnd - item.outPeak);
      const value =
        da < 0
          ? da >= -before
            ? 1 - -da / before
            : 0
          : da <= after
            ? 1 - da / after
            : 0;
      if (value <= 0) continue;
      const drive = findJunction(item.kind).drive;
      for (const key of Object.keys(acc) as Array<keyof typeof acc>) {
        acc[key] += (drive[key] ?? 0) * value;
      }
    }
    return acc;
  })();

  /** Chuỗi `transform` và `filter` dựng từ các biến vừa cộng. */
  const junctionStyle = (() => {
    const punch = projectPack.intensity.punchScale;
    const flash = projectPack.intensity.flashAmount;
    const transform = [
      `scale(${(1 + punch * junction.zoom).toFixed(4)})`,
      junction.dichX || junction.dichY
        ? `translate(${junction.dichX.toFixed(2)}%, ${junction.dichY.toFixed(2)}%)`
        : null,
      junction.xoay ? `rotate(${junction.xoay.toFixed(2)}deg)` : null,
    ]
      .filter(Boolean)
      .join(" ");
    const filter = [
      projectPack.grade ? `url(#${gradeFilterId(projectPack)})` : null,
      `brightness(${(1 + flash * junction.sang).toFixed(3)})`,
      junction.tuongPhan
        ? `contrast(${(1 + junction.tuongPhan * 0.6).toFixed(3)})`
        : null,
      junction.bhoa ? `saturate(${(1 + junction.bhoa).toFixed(3)})` : null,
      junction.sac ? `hue-rotate(${junction.sac.toFixed(1)}deg)` : null,
      junction.nhoe ? `blur(${junction.nhoe.toFixed(2)}px)` : null,
    ]
      .filter(Boolean)
      .join(" ");
    return { transform, filter };
  })();

  /**
   * Vạch đang đứng trong một quãng đã bỏ — khung này sẽ không có trong video.
   *
   * Trừ lúc NGHE THỬ chính quãng đó: cả việc nghe thử là để xem phần đã cắt ra
   * sao, mà lớp phủ "đoạn này đã bỏ" thì che kín đúng thứ người dùng vừa xin xem.
   */
  const auditing =
    editor.auditSpan != null &&
    editor.time >= editor.auditSpan.start &&
    editor.time < editor.auditSpan.end;
  const inSkipped =
    !auditing &&
    editor.skipRanges.some(
      (span) => editor.time >= span.start && editor.time < span.end,
    );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) void video.play().catch(() => {});
    else video.pause();
  }, [playing, videoRef]);

  // Tư liệu video phải tua theo mốc của DẢI, không phát theo đồng hồ riêng: nó
  // bắt đầu từ giây 0 của chính nó nên phải trừ đi mốc bắt đầu của lần chèn.
  useEffect(() => {
    const video = insertRef.current;
    if (!video || !insert) return;
    const want = Math.max(0, editor.time - insert.start);
    if (Math.abs(video.currentTime - want) > 0.3) video.currentTime = want;
    if (playing) void video.play().catch(() => {});
    else video.pause();
  }, [editor.time, insert, playing]);

  // Cụm đang hiện tại vạch — thứ Dialog đổi dáng vẽ trong khung xem lớn của nó,
  // để ngữ cảnh đi theo người dùng thay vì bắt họ nhớ mình đang đứng ở đâu.
  //
  // Vạch ở chỗ chưa có chữ thì lấy CỤM ĐẦU của dự án: vẫn là chữ thật của người
  // dùng, chỉ không phải chữ ngay dưới vạch. Trống hẳn mới là thứ đọc ra như lỗi.
  const atPlayhead =
    visible[0] ??
    [...editor.textElements].sort((a, b) => a.start - b.start)[0];

  return (
    /*
     * Thẻ này TỪNG không có tiêu đề — "khung hình tự nói nó là khung hình, mà
     * mỗi dòng chữ thêm vào là một dòng chiều cao lấy đi của chính cái video".
     *
     * Nay có, vì bộ dáng chữ cần một chỗ đứng và không chỗ nào khác đúng: nó là
     * chuyện cấp DỰ ÁN nên không thuộc Inspector (nơi sửa vật đang chọn), và ba
     * tab ở cột phải đã đủ tải. `CardHeader` tự thành lưới hai cột khi có
     * `CardAction`, nên thẻ chỉ cao thêm đúng một hàng tiêu đề.
     */
    <Card className="min-h-80 lg:min-h-0">
      <CardHeader>
        <CardTitle>Xem trước</CardTitle>
        <CardAction>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setStyleOpen(true)}
          >
            Phong cách video
          </Button>
        </CardAction>
      </CardHeader>
      <StyleSwitchDialog
        open={styleOpen}
        onOpenChange={setStyleOpen}
        value={editor.stylePack}
        onAccept={(next) => void editor.setStylePack(next)}
        // Khung hình thật làm nền ô mẫu — cùng thứ màn nạp tệp dùng. Thiếu nó
        // thì hộp này bày mười ô nền đen trơn, và trục MÀU HÌNH của phong cách
        // thành vô hình đúng ở chỗ để chọn nó.
        poster={editor.posterUrl}
        preview={
          atPlayhead
            ? {
                text: atPlayhead.content,
                align: atPlayhead.align,
                emphasis: atPlayhead.emphasis,
                band: atPlayhead.position as BandId,
                keywords: atPlayhead.keywords,
              }
            : null
        }
      />
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <AspectRatio ratio={9 / 16} className="mx-auto min-h-0 flex-1">
          <div
            ref={boxRef}
            // `@container` là BẮT BUỘC: cỡ chữ đo bằng `cqw` (phần trăm bề rộng
            // thẻ chứa). Thiếu nó thì `cqw` mất mốc và rơi về khung nhìn — chữ
            // phóng to gấp mấy lần khung, mà không có lỗi nào báo ra.
            className="@container relative size-full overflow-hidden rounded-lg bg-muted"
          >
            {/* Chưa có video thì nói ra, đừng bày một ô xám có nút phát.
                Ô xám im lặng đọc ra là "hỏng"; một dòng chữ đọc ra là "chưa
                tới lượt". Hai trạng thái khác hẳn nhau mà nhìn giống nhau thì
                người dùng đoán nhầm cái tệ hơn. */}
            {editor.duration === 0 && (
              <div className="absolute inset-0 z-10 grid place-items-center p-6">
                <p className="text-center text-xs text-muted-foreground">
                  Chưa có video — tải lên rồi chép lời thì khung này sẽ chạy
                </p>
              </div>
            )}
            {/* Bộ lọc NẮN MÀU khai một lần cho cả khung. Nó chỉ là khai báo,
                không chiếm chỗ trong bố cục. */}
            <GradeFilterDefs pack={projectPack} />
            {editor.projectId && editor.duration > 0 && (
              <video
                ref={videoRef}
                src={api.baseVideoUrl(editor.projectId)}
                className="absolute inset-0 size-full object-cover"
                // Nhấn zoom chỉ phóng HÌNH GỐC: chữ và tư liệu vẽ sau nên giữ
                // nguyên cỡ, đúng như bản in ra.
                // Độ mạnh lấy từ BỘ DÁNG, không phải hằng dùng chung: bộ
                // "nhanh" và bộ "êm" chọn kiểu chuyển cảnh khác nhau mà cú zoom
                // vẫn đẩy bằng nhau thì xem video thật vẫn hao hao.
                //
                // NẮN MÀU của phong cách đứng TRƯỚC hiệu ứng chỗ nối — cùng thứ
                // tự với chuỗi lọc ffmpeg, nơi nắn màu là bộ lọc đầu tiên.
                style={junctionStyle}
                muted={false}
                playsInline
                preload="auto"
              />
            )}
            <div className="absolute inset-x-[5%] top-[10%] bottom-[20%] rounded-md border border-dashed border-muted-foreground/25" />

            {insert &&
              (() => {
                const box = shapeBox(insert.shape);
                // Hiệu ứng chạy theo VẠCH, không theo vòng lặp: người dùng tua tới
                // đâu thì thấy đúng trạng thái ở đó, giống lúc xem video thật.
                //
                // `translateY` theo % tính trên chiều cao CỦA HỘP, còn máy chủ
                // trượt theo % chiều cao KHUNG — `revealCss` nhận `box.h` để
                // chia lại, không thì hộp nhỏ trượt ít hơn bản in ra.
                const effectStyle = revealCss(
                  insert.reveal,
                  editor.time - insert.start,
                  box.h,
                );
                return (
                  <div
                    // Bo góc: bản in ra khoét góc bằng biểu thức trong luồng tư
                    // liệu, nên hai bên khớp nhau. Dáng "đè kín" không bo.
                    className={
                      insert.shape === "full"
                        ? "absolute overflow-hidden"
                        : "absolute overflow-hidden rounded-[3cqw]"
                    }
                    style={{
                      left: `${box.x * 100}%`,
                      top: `${box.y * 100}%`,
                      width: `${box.w * 100}%`,
                      height: `${box.h * 100}%`,
                      ...effectStyle,
                    }}
                  >
                    {insert.url ? (
                      // Tư liệu THẬT, không phải ô màu có tên: ô màu không cho biết
                      // nó có che mặt người nói hay không.
                      // Nắn màu ĐÈ luôn lên tư liệu chèn, đúng như bản in ra:
                      // chèn một mảnh chưa nắn vào giữa dải đã nắn thì mỗi lần
                      // chèn là một lần màu nhảy.
                      insert.isVideo ? (
                        <video
                          key={insert.id}
                          ref={insertRef}
                          src={insert.url}
                          className="size-full object-cover"
                          style={gradeStyle(projectPack)}
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          key={insert.id}
                          src={insert.url}
                          alt=""
                          className="size-full object-cover"
                          style={gradeStyle(projectPack)}
                        />
                      )
                    ) : (
                      <div className="flex size-full items-center justify-center bg-secondary">
                        <span className="text-xs text-secondary-foreground">
                          {insert.label}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

            {!inSkipped &&
              visible.map((element) => (
                <OverlayTextBlock
                  key={element.id}
                  config={{
                    text: element.content,
                    align: element.align,
                    emphasis: element.emphasis,
                    band: element.position as BandId,
                    keywords: element.keywords,
                    insert: { kind: "none", shape: "wide" },
                  }}
                  // Bộ dáng HIỆU LỰC của riêng cụm này: bộ của dự án, cộng phần
                  // cụm tự đè. Thiếu dòng này thì khung xem vẽ bằng bộ gốc
                  // trong khi video xuất ra vẽ bằng bộ đã chọn — đúng lỗi "xem
                  // một đằng xuất một nẻo" mà cả hệ này chống.
                  pack={packForElement(projectPack, element)}
                  // Đang CHỌN cụm này mà không phát: hiện chữ ĐỦ, không theo
                  // nhịp từng tiếng.
                  //
                  // Bấm một dòng thì vạch nhảy tới `đầu cụm + 0,05s` — đúng
                  // khoảnh khắc chữ mới bật tiếng đầu. Nên chọn một cụm 14
                  // tiếng để sửa mà khung xem hiện đúng chữ "Ngày": sửa chữ mà
                  // không thấy chữ. Nhịp thật vẫn xem được bằng cách bấm phát,
                  // và mọi cụm KHÔNG chọn vẫn chạy đúng nhịp.
                  seconds={
                    !playing &&
                    editor.selection?.kind === "text" &&
                    editor.selection.id === element.id
                      ? element.end - element.start
                      : editor.time - element.start
                  }
                  // Nhịp nói thật, đúng luật của máy chủ: chỉ dùng khi chữ còn
                  // y nguyên lời của khoảng từ nó neo vào (xem `nhipNoi` ở
                  // `server/pipeline.ts`). Thiếu chỗ này thì khung xem bật cả
                  // cụm một lúc trong khi bản in ra chạy theo tiếng.
                  //
                  // Trừ đi mốc đầu cụm: `OverlayTextBlock` đếm giây TỪ ĐẦU CỤM,
                  // còn máy chủ nhận mốc tuyệt đối. Quên trừ là chữ đứng im tới
                  // tận cuối video mới hiện.
                  wordStarts={editor
                    .wordStarts(element)
                    ?.map((at) => at - element.start)}
                  // Chữ đã viết lại thì không còn mốc thật; rải đều số tiếng
                  // trong ĐÚNG khoảng của cụm. Nhịp cố định 0,07 giây/tiếng
                  // chạy hết trong nửa giây rồi đứng im, không liên quan gì tới
                  // chỗ đó nói nhanh hay chậm.
                  span={element.end - element.start}
                  ring={
                    editor.selection?.kind === "text" &&
                    editor.selection.id === element.id
                  }
                  // Bấm tiếng để đánh dấu từ khoá — CHỈ trên chữ đang chọn.
                  //
                  // Bật cho mọi chữ thì mỗi lần bấm vào khung xem để chạy/dừng
                  // là đánh dấu nhầm một tiếng của cụm đang hiện, mà người dùng
                  // không hề định sửa nó.
                  //
                  // Đây là hàng thẻ tiếng ở bảng bên phải, dời về đúng chỗ nó
                  // tác động: điều khiển nên là thứ gần nhất về không gian với
                  // nội dung nó chi phối. Hàng thẻ vẫn còn trong "Tinh chỉnh"
                  // cho lúc tua ra ngoài khoảng của chữ — lúc ấy không còn tiếng
                  // nào trên màn để mà bấm.
                  // Chỉ hai dáng dùng tới từ khoá (xem `dungTuKhoa` ở bảng sửa
                  // chữ). Ở hai dáng kia, bấm một tiếng sẽ ghi một dấu không đổi
                  // được gì trên bản in ra — im lặng làm một việc vô nghĩa còn
                  // tệ hơn không cho bấm.
                  onPickWord={
                    editor.selection?.kind === "text" &&
                    editor.selection.id === element.id &&
                    (element.emphasis === "keyword-large" ||
                      element.emphasis === "mixed-size")
                      ? (text) => {
                          const has = element.keywords.includes(text);
                          editor.updateTextElement(element.id, {
                            keywords: has
                              ? element.keywords.filter((item) => item !== text)
                              : [...element.keywords, text],
                          });
                        }
                      : undefined
                  }
                />
              ))}

            {inSkipped && (
              // Nằm TRÊN mọi lớp khác: khung này sẽ không có trong video, nên
              // không được để chữ hay tư liệu nào hiện lên cùng lúc — thấy chữ ở
              // đây là tưởng nó sẽ có trong bản in ra.
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/85">
                <span className="text-xs text-muted-foreground">
                  Đoạn này đã bỏ, sẽ không có trong video
                </span>
              </div>
            )}

            {/* Nút phát và đồng hồ nằm ĐÈ lên đáy khung, không đứng dưới nó:
                một hàng riêng bên ngoài lấy mất mấy chục điểm ảnh chiều cao, mà
                chiều cao ở đây quy thẳng ra bề rộng video vì khung khoá tỉ lệ
                9:16. Đáy khung là chỗ an toàn — vùng đặt chữ dừng ở 80% chiều
                cao, còn dải này bắt đầu sau đó.

                `z-20` để còn bấm phát được cả khi đang đứng trong đoạn đã bỏ —
                lớp phủ báo "đoạn này đã bỏ" nằm ở `z-10`. */}
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8">
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label={playing ? "Tạm dừng" : "Phát từ đây"}
                // Không có video thì không có gì để phát — khoá lại thay vì để bấm
                // vào một cái không nhúc nhích.
                disabled={editor.duration === 0}
                onClick={onTogglePlay}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </Button>
              {/* Màu trắng cứng chứ không phải `text-foreground`: nền là khung
                  hình của người dùng, không phải nền của giao diện — ở chế độ
                  sáng thì `text-foreground` là chữ đen trên nền tối. */}
              <span className="text-xs text-white tabular-nums">
                {formatTime(editor.toOutput(editor.time))} /{" "}
                {formatTime(editor.outputDuration)}
              </span>
            </div>
          </div>
        </AspectRatio>
        {/* Nhạc nền nghe được ngay ở đây — nằm ngoài khung hình vì nó không có
            gì để nhìn, nhưng phải có mặt để chỉnh âm lượng không phải chỉnh mù. */}
        <PreviewMusic
          tracks={editor.music}
          time={editor.time}
          playing={playing && !auditing}
          keptSpan={editor.keptSpan}
        />
      </CardContent>
    </Card>
  );
}
