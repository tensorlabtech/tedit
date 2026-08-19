import { useEffect, useRef, useState } from "react";
import { FilmIcon, PauseIcon, PlayIcon } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  GradeFilterDefs,
  gradeFilterId,
  gradeStyle,
} from "@/dev/overlays/grade-filter";
import { revealCss, shapeBox, type BandId } from "@/dev/overlays/overlay-model";
import {
  ContentRect,
  graphicUrl,
  OverlayTextBlock,
} from "@/dev/overlays/overlay-render";
import { StyleSweep } from "@/dev/overlays/style-sweep";
import { ScenePage } from "@/dev/overlays/scene-page";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { cssColor, packForElement } from "../../../server/style-pack";
import { applyFontStyle, findStylePack } from "../../../server/style-pack-catalog";

import { formatTime } from "./editor-data";
import { findJunction } from "../../../server/junction-kinds";
import { BehindTextPreview } from "./behind-text-preview";
import { PreviewMusic } from "./preview-music";
import { SubjectCutout } from "./subject-cutout";
import { StyleSwitchDialog } from "./style-switch-dialog";
import type { EditorState } from "./use-editor";
import { activeScene, sceneCells } from "./scene-layout-geometry";

/**
 * Khung xem trước CHẠY hiệu ứng hiện chữ theo vạch thời gian.
 *
 * Trước đây nó bày thẳng trạng thái cuối vì bản in ra cũng chưa có hiệu ứng. Giờ
 * bản in đã hiện theo từng tiếng, nên bày trạng thái cuối sẽ thành nói dối: người
 * dùng canh chữ ở khung xem rồi xuất ra mới thấy nhịp khác hẳn.
 */

/**
 * Đổi vibe sống ở bước BÀN DỰNG (`studio-step.tsx`), không phải màn Soát lời này.
 * Giữ cờ tắt ở đây để không bày nút đổi phong cách giữa lúc soát chữ.
 */
const SHOW_STYLE_SWITCH = false;

/**
 * Góc NGHIÊNG ô như ảnh dán tay lệch — cùng chuỗi góc bản xuất (`layout-render.ts`
 * `tiltRad = [-4,3.5,-2.5,3][at%4]`). Xoay vòng theo thứ tự z của ô để hai ô cạnh
 * nhau lệch ngược chiều, ra cảm giác dán tay chứ không thẳng hàng máy.
 */
const TILT_DEG = [-4, 3.5, -2.5, 3];

export function PreviewPanel({
  editor,
  playing,
  onTogglePlay,
  proofread,
}: {
  editor: EditorState;
  playing: boolean;
  onTogglePlay: () => void;
  /**
   * Bước Soát lời: thay caption karaoke-từng-tiếng (theo style pack) bằng một
   * caption PHẲNG — cả cụm hiện một lúc, chữ thường dễ đọc, gạch chấm chỗ máy
   * nghi ngờ. Soát chữ là đọc CẢ DÒNG rồi đối chiếu tai; karaoke một-chữ-to giấu
   * mất phần còn lại của câu, mà style thì chưa chốt ở bước này.
   */
  proofread?: boolean;
}) {
  const [styleOpen, setStyleOpen] = useState(false);
  // Bộ dáng của dự án, ĐÃ áp phong cách chữ mặc định. `applyFontStyle` chỉ đổi
  // trục CHỮ nên mọi thứ khác (nắn màu, trang, nhịp) đọc từ đây vẫn nguyên; cụm
  // nào tự đặt phong cách chữ riêng thì `packForElement` đè tiếp ở dưới.
  const projectPack = applyFontStyle(
    findStylePack(editor.stylePack),
    editor.fontStyle,
  );
  // Lọc theo MỐC của chính phần tử, không tra ngược ra hai đầu từ.
  //
  // Bản trước tra `wordsById` rồi lấy mốc của từ. Chữ TỰ DO neo theo giờ nên hai
  // mã từ để rỗng, phép tra trả về rỗng, và `if (!from || !to) return false` vứt
  // nó đi — gõ xong một cái tiêu đề mà khung xem trống trơn, không báo gì.
  //
  // `element.start/end` đã đúng cho CẢ HAI kiểu neo (dựng ở `shape()`), nên bỏ
  // hẳn phép tra là vừa sửa lỗi vừa bớt một đường vòng.
  // Mép `end` LOẠI (`< end`), không bao gồm: đúng mốc chuyển cụm (end A = start B)
  // mà bao gồm cả hai thì hai cụm hiện chồng một khung. Khớp `runningRowId` và
  // `active` của hàng bản chép (đều `< end`), nên khung xem và danh sách sáng CÙNG
  // một dòng.
  const visible = editor.textElements.filter(
    (element) => editor.time >= element.start && editor.time < element.end,
  );

  const insert = editor.inserts.find(
    (item) => editor.time >= item.start && editor.time <= item.end,
  );

  // Thẻ video giữ ở `useEditor` chứ không ở đây: vòng phát cần đọc `currentTime`
  // của nó để làm đồng hồ. Xem chú thích ở `use-editor.ts`.
  const videoRef = editor.videoRef;
  const insertRef = useRef<HTMLVideoElement>(null);
  // Video b-roll trong Ô bố cục — mỗi ô một thẻ, tua theo đồng hồ DẢI như lớp
  // insert fallback, không phát đồng hồ riêng (autoPlay/loop trước đây làm nó
  // chạy lệch, không dừng theo dải).
  const cellVideos = useRef(new Map<number, HTMLVideoElement>());
  const boxRef = useRef<HTMLDivElement>(null);

  /**
   * Tua video chỉ khi NGƯỜI DÙNG nhảy chỗ, không phải để bám theo đồng hồ.
   *
   * Lúc đang phát thì `editor.time` giờ ĐI RA TỪ chính `video.currentTime`
   * (`use-preview-playback.ts`), nên hai bên lệch nhau nhiều nhất là một nhịp đẩy state —
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
      zoom: 0,
      sang: 0,
      bhoa: 0,
      xoay: 0,
      dichX: 0,
      dichY: 0,
      nhoe: 0,
      vien: 0,
      sac: 0,
      tuongPhan: 0,
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

  /*
   * Mốc cắt cho VỆT QUÉT — cùng nguồn với bản xuất: `effects` (bỏ `none`), mốc
   * `outPeak` trên dải đã cắt. `render.ts` truyền đúng danh sách này vào `sweepSteps`.
   */
  const sweepMarks = editor.effects
    .filter((item) => item.kind !== "none")
    .map((item) => item.outPeak);
  const sweepAt = editor.toOutput(editor.time);

  /*
   * BỐ CỤC CẢNH — server xếp lịch màn, màn hình vẽ video vào ô trên nền trang.
   *
   * Chỉ bộ dáng có nền trang (`pack.page`) mới bẻ khung thành ô; bộ phủ kín giữ
   * nguyên video object-cover như cũ. `cell` là ô CHÍNH tại vạch hiện tại; `null`
   * nghĩa là giữ khung phủ kín.
   */
  const sceneLayout = editor.sceneLayout;
  const pageOn = Boolean(
    projectPack.page && sceneLayout && sceneLayout.schedule.length > 0,
  );
  const cells =
    pageOn && sceneLayout
      ? sceneCells(
          sceneLayout.schedule,
          sceneLayout.sourceAspect,
          sweepAt,
          sceneLayout.inserts,
          projectPack.scenePush?.ratePerSecond ?? 0,
        )
      : null;
  const cell = cells?.main ?? null;
  // CẢNH CÓ NỀN TRANG đang chạy tại vạch: có ít nhất một ô (người HOẶC b-roll).
  // Cảnh `broll-don` KHÔNG có ô người (`main` null) nhưng vẫn là cảnh nền trang —
  // phải vẽ nền + ô b-roll, và KHÔNG để video người phủ kín phía sau. Khe giữa
  // các màn (không ô nào) thì `pageScene` false → khung phủ kín như cũ.
  const pageScene =
    pageOn && cells != null && (cells.main != null || cells.inserts.length > 0);
  // Look Ô của CẢNH tại vạch — nền + viền theo CHÍNH cảnh đó (mỗi b-roll nền/viền
  // riêng), không phải một nền chung của bộ dáng. Khớp bản xuất dựng nền per-scene
  // (`layout-render.ts`). Thiếu block (dữ liệu cũ) → về look bộ dáng.
  const frameNow =
    (pageScene && sceneLayout
      ? activeScene(sceneLayout.schedule, sweepAt)?.frameBlock
      : null) ?? null;
  // Look đi THEO block: cảnh có `frameNow` thì đọc thẳng field của nó — viền `null`
  // (Nhịp đen) phải ra KHÔNG viền, không mượn lại viền vàng của preset gốc dự án.
  // Chỉ cảnh THIẾU block (dữ liệu cũ) mới về look bộ dáng.
  const pageNow = frameNow ? frameNow.page : projectPack.page;
  const edgeNow = frameNow ? frameNow.subjectEdge : projectPack.subjectEdge;
  // CẢNH B-ROLL SOLO tại vạch — để vẽ DOODLE vàng quanh ảnh như bản xuất. Xoay
  // vòng cặp góc + id theo THỨ TỰ cảnh b-roll (khớp `k` của `doodleSteps`).
  const brollDon =
    pageScene && !cell && sceneLayout
      ? (activeScene(sceneLayout.schedule, sweepAt)?.layout === "broll-don"
          ? activeScene(sceneLayout.schedule, sweepAt)
          : null)
      : null;
  const brollDoodleK = brollDon
    ? (sceneLayout?.schedule.filter((s) => s.layout === "broll-don") ?? []).indexOf(
        brollDon,
      )
    : -1;

  /*
   * Thiết bị dựa vào TÁCH NỀN NGƯỜI (chữ sau người, viền người) chưa vẽ ở màn
   * hình: cần mặt nạ người theo thời gian mà khung xem chưa dựng. Thay vì vẽ sai,
   * gắn nhãn trung thực ở đúng những màn có thiết bị ấy — người dùng biết nó CÓ,
   * chỉ là xem ở bản xuất.
   */
  const heroNow =
    pageOn && sceneLayout
      ? (activeScene(sceneLayout.schedule, sweepAt)?.hero ?? null)
      : null;
  const subjectDeviceLabel =
    heroNow === "chu-sau-nguoi"
      ? "Chữ sau người — hiện ở bản xuất"
      : heroNow === "vien-nguoi"
        ? "Viền người — hiện ở bản xuất"
        : null;

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

  // Ô B-ROLL theo bố cục: tua mỗi thẻ video theo mốc DẢI. B-roll bắt đầu từ giây
  // 0 của chính nó tại lúc màn b-roll mở, nên trừ mốc bắt đầu màn (trục đã cắt).
  useEffect(() => {
    const videos = cellVideos.current;
    const scene =
      pageOn && sceneLayout ? activeScene(sceneLayout.schedule, sweepAt) : null;
    const start = scene && scene.insert !== undefined ? scene.start : null;
    if (start === null) {
      videos.forEach((video) => video.pause());
      return;
    }
    const want = Math.max(0, sweepAt - start);
    videos.forEach((video) => {
      if (Math.abs(video.currentTime - want) > 0.3) video.currentTime = want;
      if (playing) void video.play().catch(() => {});
      else video.pause();
    });
  }, [sweepAt, playing, sceneLayout, pageOn]);

  // Cụm đang hiện tại vạch — thứ Dialog đổi dáng vẽ trong khung xem lớn của nó,
  // để ngữ cảnh đi theo người dùng thay vì bắt họ nhớ mình đang đứng ở đâu.
  //
  // Vạch ở chỗ chưa có chữ thì lấy CỤM ĐẦU của dự án: vẫn là chữ thật của người
  // dùng, chỉ không phải chữ ngay dưới vạch. Trống hẳn mới là thứ đọc ra như lỗi.
  const atPlayhead =
    visible[0] ?? [...editor.textElements].sort((a, b) => a.start - b.start)[0];

  // Tua theo vị trí chuột trên thanh: phần trăm trên TRỤC ĐÃ CẮT (giống đồng hồ),
  // rồi ánh xạ ngược về giây GỐC để `seek` — `editor.time` chạy theo giây gốc.
  const seekAtClientX = (clientX: number, track: HTMLElement) => {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0 || editor.outputDuration <= 0) return;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    editor.seek(editor.toSource(frac * editor.outputDuration));
  };

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
    <Card className="min-h-80 min-w-0 lg:min-h-0">
      {SHOW_STYLE_SWITCH && (
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
      )}
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
            {/* VÙNG HÌNH bọc video, tư liệu chèn, tiêu đề và chữ — mọi thứ sẽ
                có trong bản xuất. Nút phát và đồng hồ nằm NGOÀI: chúng là
                giao diện của bàn dựng, không phải nội dung khung hình. */}
            <ContentRect pack={projectPack}>
              {/* NỀN TRANG đứng dưới cùng — video-vào-ô để lộ nó ra quanh mép. CHỈ
                vẽ khi đang có MÀN (`cell`): lịch thưa để trống chỗ mặc định, mà ở
                chỗ ấy khung phải là video phủ kín, không phải nền trang trơ. */}
              {pageScene && <ScenePage page={pageNow} />}
              {editor.projectId && editor.duration > 0 && !(pageScene && !cell) && (
                // Ô video: phủ kín khung khi không có màn (`cell` rỗng — khoảng
                // trống hoặc bộ phủ kín); thu vào ô khi đang có màn. CẢNH b-roll
                // solo (nền trang, không ô người) thì KHÔNG vẽ video người —
                // `!(pageScene && !cell)` bỏ nó đi, chỉ còn nền + ô b-roll.
                // Bo góc bằng `rounded-[3cqw]` như tư liệu chèn — cùng lối làm tròn
                // ở màn hình, phép kiểm parity soi hình học ô chứ không soi góc.
                // Ô người trong bố cục NHIỀU ô cũng nghiêng+rung như bản xuất (ô
                // người ở z thấp nhất → at=0 → góc TILT_DEG[0]). Phủ kín (không mask)
                // thì KHÔNG nghiêng. Nghiêng ở thẻ ngoài, rung ở thẻ trong (animation
                // ghi đè transform).
                <div
                  className={cell?.masked ? "absolute" : "absolute inset-0"}
                  style={
                    cell
                      ? {
                          left: `${cell.left}%`,
                          top: `${cell.top}%`,
                          width: `${cell.width}%`,
                          height: `${cell.height}%`,
                          transform:
                            cell.masked && pageScene
                              ? `rotate(${TILT_DEG[0]}deg)`
                              : undefined,
                        }
                      : undefined
                  }
                >
                <div
                  className={
                    cell?.masked
                      ? `size-full overflow-hidden rounded-[3cqw]${
                          pageScene && playing ? " broll-boil" : ""
                        }`
                      : "size-full"
                  }
                >
                  <video
                    ref={videoRef}
                    src={api.baseVideoUrl(editor.projectId)}
                    className="size-full object-cover"
                    // Nhấn zoom chỉ phóng HÌNH GỐC: chữ và tư liệu vẽ sau nên giữ
                    // nguyên cỡ, đúng như bản in ra.
                    //
                    // NẮN MÀU của phong cách đứng TRƯỚC hiệu ứng chỗ nối — cùng thứ
                    // tự với chuỗi lọc ffmpeg, nơi nắn màu là bộ lọc đầu tiên.
                    style={junctionStyle}
                    muted={false}
                    playsInline
                    preload="auto"
                  />
                </div>
                </div>
              )}
              {/* CHỮ-NỀN sau người + TÁCH NGƯỜI. Chỉ bộ dáng có `behindText` (Phấn),
                  đúng cửa sổ mở màn. Thứ tự khớp bản xuất: chữ ĐÈ lên video, rồi
                  người-CẮT đè lên chữ → chữ hở ra quanh người. Thiếu mặt nạ thì bỏ
                  người-cắt (chữ vẫn hiện dưới video, chấp nhận). */}
              {projectPack.behindText &&
                sceneLayout?.behindLine &&
                editor.time < projectPack.behindText.seconds + 0.35 && (
                  <>
                    <BehindTextPreview
                      pack={projectPack}
                      line={sceneLayout.behindLine}
                      band={sceneLayout.behindBand ?? 0}
                      seconds={editor.time}
                    />
                    {sceneLayout.hasSubject && editor.projectId && (
                      <SubjectCutout
                        projectId={editor.projectId}
                        time={editor.time}
                        playing={playing}
                        className="absolute inset-0 size-full object-cover"
                      />
                    )}
                  </>
                )}
              {/* Ô B-ROLL vẽ SAU ô người → ĐÈ LÊN người. Chỗ đè là thân/vai, không
                phải mặt; b-roll nguyên vẹn, không bị người cắt. Cùng thứ tự z bản
                xuất (`phu` khai z cao hơn `chinh`). */}
              {cells?.inserts.map(({ box, media }, index) => (
                // NGHIÊNG như ảnh dán tay: thẻ NGOÀI chỉ định vị + xoay (khớp góc
                // bản xuất `[-4,3.5,-2.5,3]` theo thứ tự z — ô người ở z thấp nên
                // đứng at=0, b-roll đứng sau). Thẻ TRONG lo mask/viền/rung: nghiêng
                // + rung phải TÁCH thẻ vì animation ghi đè `transform` của nghiêng.
                <div
                  key={index}
                  className="absolute"
                  style={{
                    left: `${box.left}%`,
                    top: `${box.top}%`,
                    width: `${box.width}%`,
                    height: `${box.height}%`,
                    transform:
                      box.masked && pageScene
                        ? `rotate(${TILT_DEG[(index + (cell ? 1 : 0)) % 4]}deg)`
                        : undefined,
                  }}
                >
                <div
                  className={
                    box.masked
                      ? `size-full overflow-hidden rounded-[3cqw]${
                          pageScene && playing ? " broll-boil" : ""
                        }`
                      : "size-full overflow-hidden"
                  }
                  style={{
                    // Mỗi ô lệch pha rung để không giật ĐỒNG BỘ (khớp `at` của bản
                    // xuất). Delay ÂM nên ô vào giữa chu kỳ ngay, không đợi.
                    animationDelay: `-${(index * 0.37).toFixed(2)}s`,
                    // Viền vàng quanh ô b-roll (`phu`) — xấp xỉ viền GIẤY XÉ vàng
                    // của bản xuất. CSS không dựng được mép xé thật, viền vàng bo
                    // nhẹ là mức parity hình-học+xấp-xỉ của cả hệ. CHỈ ô b-roll;
                    // ô người (`main`) không có.
                    ...(edgeNow
                      ? {
                          border: `0.8cqw solid ${cssColor(edgeNow.tone)}`,
                        }
                      : null),
                  }}
                >
                  {media === null ? (
                    // PLACEHOLDER: khung 2 ô chưa gắn tư liệu — ô trống để thấy cấu
                    // trúc, chưa có nội dung.
                    <div className="grid size-full place-items-center gap-1 bg-neutral-700/60 text-center text-white/70">
                      <FilmIcon className="size-[6cqw]" />
                      <span className="text-[3.5cqw] leading-none">
                        Chưa có tư liệu
                      </span>
                    </div>
                  ) : media.isVideo ? (
                    <video
                      ref={(node) => {
                        if (node) cellVideos.current.set(index, node);
                        else cellVideos.current.delete(index);
                      }}
                      src={api.mediaUrl(media.id)}
                      className="size-full object-cover"
                      style={gradeStyle(projectPack)}
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={api.mediaUrl(media.id)}
                      alt=""
                      className="size-full object-cover"
                      style={gradeStyle(projectPack)}
                    />
                  )}
                </div>
                </div>
              ))}

              {/* DOODLE vàng quanh ảnh b-roll solo — HAI nét ở góc đối nhau, xoay
                  vòng cặp góc + id theo thứ tự cảnh, khớp `doodleSteps` bản xuất.
                  Tô màu bằng `mask-image` + `background-color` (đúng `alphamerge`
                  của server). Hộp 0,14 khung; `contain` để nét không méo. */}
              {projectPack.doodles &&
                brollDon &&
                brollDoodleK >= 0 &&
                (() => {
                  const doodles = projectPack.doodles!;
                  // Cặp góc: [trên-phải, dưới-trái] / [trên-trái, dưới-phải].
                  const cornerPairs = [
                    [
                      { x: 0.74, y: 0.04 },
                      { x: 0.05, y: 0.6 },
                    ],
                    [
                      { x: 0.05, y: 0.05 },
                      { x: 0.74, y: 0.58 },
                    ],
                  ];
                  const pair = cornerPairs[brollDoodleK % cornerPairs.length];
                  return pair.map((spot, j) => {
                    const id =
                      doodles.ids[(brollDoodleK * 2 + j) % doodles.ids.length];
                    const url = graphicUrl(id);
                    if (!url) return null;
                    return (
                      <div
                        key={`doodle-${j}`}
                        className="pointer-events-none absolute"
                        style={{
                          left: `${spot.x * 100}%`,
                          top: `${spot.y * 100}%`,
                          // Hộp 0,14W × 0,14H như bản xuất (`dh = dw·H/W`).
                          width: `${doodles.sizeShare * 100}%`,
                          height: `${doodles.sizeShare * 100}%`,
                          maskImage: `url(${url})`,
                          WebkitMaskImage: `url(${url})`,
                          maskSize: "contain",
                          WebkitMaskSize: "contain",
                          maskRepeat: "no-repeat",
                          WebkitMaskRepeat: "no-repeat",
                          backgroundColor: cssColor(doodles.tone),
                          zIndex: 2,
                        }}
                      />
                    );
                  });
                })()}
              {/* Khung gạch-đứt = vùng an-toàn đặt caption. Ẩn ở Soát lời: bước
                  này chỉ ĐỌC/soát chữ, không đặt caption — khung này chỉ làm nhiễu. */}
              {!proofread && (
                <div className="absolute inset-x-[5%] top-[10%] bottom-[20%] rounded-md border border-dashed border-muted-foreground/25" />
              )}

              {/* B-roll vẽ đè CHỈ khi không có bố cục ô. Bộ có bố cục thì b-roll đã
                hiện trong ô phụ của màn — vẽ thêm lớp đè nữa là hiện đôi. */}
              {insert &&
                !pageOn &&
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

              {/* Vệt quét đứng TRÊN video/tư liệu, DƯỚI chữ — cùng thứ tự lớp với
                `render.ts` (sweep sau graphics, trước chữ và tiêu đề). */}
              <StyleSweep
                pack={projectPack}
                cutMarks={sweepMarks}
                seconds={sweepAt}
              />

              {!inSkipped &&
                !proofread &&
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
                    pack={packForElement(
                      projectPack,
                      element,
                      element.keywords,
                      // Look chữ của cụm — khung xem đọc thẳng block của cụm.
                      element.captionBlock,
                    )}
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
                                ? element.keywords.filter(
                                    (item) => item !== text,
                                  )
                                : [...element.keywords, text],
                            });
                          }
                        : undefined
                    }
                  />
                ))}

              {/* CAPTION PHẲNG của bước Soát lời — cả cụm một lúc, chữ thường,
                  gạch chấm chỗ máy nghi ngờ (cùng dấu với hàng bản chép). Đặt ở
                  hạ phần ba như phụ đề thường, KHÔNG theo band/emphasis của style
                  pack: ở đây đọc để soát, không phải xem thành phẩm. Chỉ lời NÓI
                  (`!byTime`); tiêu đề tự do đã có `Headline` lo. */}
              {!inSkipped &&
                proofread &&
                visible
                  .filter((element) => !element.byTime)
                  .map((element) => {
                    const words = editor.captionWords(element);
                    return (
                      <div
                        key={element.id}
                        className="pointer-events-none absolute inset-x-[6%] bottom-[16%] flex justify-center"
                      >
                        <p className="rounded-md bg-black/45 px-[3cqw] py-[1.5cqw] text-center text-[5cqw] font-semibold leading-tight text-balance text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.55)]">
                          {words
                            ? words.map((word) => (
                                <span
                                  key={word.id}
                                  className={cn(
                                    word.unsure &&
                                      "underline decoration-dotted decoration-white/70 underline-offset-4",
                                  )}
                                >
                                  {word.text}{" "}
                                </span>
                              ))
                            : element.content}
                        </p>
                      </div>
                    );
                  })}

              {subjectDeviceLabel && !inSkipped && (
                // Nhãn nhỏ, không che khung: chỉ báo có một thiết bị dựa tách nền
                // đang chạy màn này mà khung xem chưa dựng được.
                <div className="pointer-events-none absolute inset-x-0 bottom-[8%] flex justify-center">
                  <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
                    {subjectDeviceLabel}
                  </span>
                </div>
              )}

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
            </ContentRect>

            {/* Nút phát và đồng hồ nằm ĐÈ lên đáy khung, không đứng dưới nó:
                một hàng riêng bên ngoài lấy mất mấy chục điểm ảnh chiều cao, mà
                chiều cao ở đây quy thẳng ra bề rộng video vì khung khoá tỉ lệ
                9:16. Đáy khung là chỗ an toàn — vùng đặt chữ dừng ở 80% chiều
                cao, còn dải này bắt đầu sau đó.

                `z-20` để còn bấm phát được cả khi đang đứng trong đoạn đã bỏ —
                lớp phủ báo "đoạn này đã bỏ" nằm ở `z-10`. */}
            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8">
              {/* THANH TUA — chỉ ở Soát lời. Màn này KHÔNG có dòng thời gian như
                  bàn dựng, mà kéo tới một chỗ ngờ để nghe lại là thao tác CHÍNH của
                  bước soát. Bàn dựng/editor đã có Timeline riêng nên không cần. */}
              {proofread && editor.duration > 0 ? (
                <div
                  role="slider"
                  aria-label="Tua video"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(editor.outputDuration)}
                  aria-valuenow={Math.round(editor.toOutput(editor.time))}
                  className="relative flex h-3 cursor-pointer items-center"
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    seekAtClientX(event.clientX, event.currentTarget);
                  }}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                      seekAtClientX(event.clientX, event.currentTarget);
                  }}
                >
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/25">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{
                        // Chặn chia-cho-0 (video bị bỏ TOÀN BỘ → outputDuration=0):
                        // không chặn thì bề rộng ra `NaN%`.
                        width: `${
                          editor.outputDuration > 0
                            ? Math.min(
                                100,
                                (editor.toOutput(editor.time) /
                                  editor.outputDuration) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label={playing ? "Tạm dừng" : "Phát từ đây"}
                  // Không có video thì không có gì để phát — khoá lại thay vì để
                  // bấm vào một cái không nhúc nhích.
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
