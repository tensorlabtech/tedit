import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { api } from "@/lib/api";

import { formatTime } from "./editor-data";
import { ClipLane } from "./timeline-clip-lane";
import { FreeTextLane, TextLane } from "./timeline-element-lanes";
import { TimelineContextMenu } from "./timeline-context-menu";
import { EffectLane } from "./timeline-effect-lane";
import { LayoutLane } from "./timeline-layout-lane";
import { TimelineRuler } from "./timeline-ruler";
import { TimelinePlayheadButtons } from "./timeline-playhead-buttons";
import { SeamMarks } from "./timeline-seam-marks";
import { TimelineSideRail } from "./timeline-side-rail";
import { ZOOM_STEP } from "./timeline-zoom";
import { MusicLane } from "./timeline-music-lane";
import { TrimHandles } from "./timeline-trim-handle";
import { useInsertFilmstrips } from "./use-insert-filmstrips";
import { useTimelineDrag } from "./use-timeline-drag";
import { useTimelineView } from "./timeline-view";
import { type EditorState, type Selection } from "./use-editor";

export function Timeline({
  editor,
  onAudit,
  /**
   * Bàn dựng: dải chỉ để DỰNG, không cắt. Ẩn dấu chỗ cắt + tay nắm gọt mép đoạn
   * + nút ✂; dải phim giữ lại làm nền định vị nhưng bấm không chọn được đoạn.
   */
  studio,
}: {
  editor: EditorState;
  /** Nghe thử một quãng đã bỏ — vòng lặp phát nằm ở màn, nên phải nhờ lên trên */
  onAudit: (span: { start: number; end: number }) => void;
  studio?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /** Đang có tệp lơ lửng trên dải — chỉ để vẽ viền báo "thả được vào đây". */
  const [dropping, setDropping] = useState(false);

  const center = width / 2;
  const { time, pxPerSecond, selection, seek } = editor;
  const { toOutput, toSource } = editor;

  /**
   * Dải vẽ theo mốc VIDEO SẼ XUẤT RA, không theo mốc bản gốc.
   *
   * Bỏ một quãng thì quãng đó biến mất khỏi dải và mọi thứ phía sau dồn lên —
   * cái nhìn thấy đúng bằng cái sẽ tải về. Còn mốc lưu trong dữ liệu vẫn là mốc
   * gốc, chỉ quy đổi ở đây lúc vẽ.
   */
  const junctionView = toOutput(time);
  const offset = center - junctionView * pxPerSecond;
  const { visibleSegments, toVisible, snapToSegments } =
    useTimelineView(editor);

  /** Khung nhìn, tính bằng mốc XUẤT RA. */
  const range = useMemo(
    () => ({
      from: Math.max(0, junctionView - center / pxPerSecond),
      to: junctionView + center / pxPerSecond,
    }),
    [junctionView, center, pxPerSecond],
  );

  /** Bấm vào dải ra mốc XUẤT RA; đổi ngược về mốc gốc để mọi thứ khác dùng. */
  const timeAtClientX = useCallback(
    (clientX: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return time;
      return toSource((clientX - rect.left - offset) / pxPerSecond);
    },
    [offset, pxPerSecond, time, toSource],
  );

  const { drag, dragging, setTrimming, startScrub, startMove } = useTimelineDrag({
    // `EditorState` đã đủ mười thành viên của `TimelineController`.
    ctrl: editor,
    viewportRef,
    timeAtClientX,
  });

  // Dải ảnh của từng clip b-roll — nền của khối trên dải bố cục (cắt đoạn tại chỗ).
  const insertStrips = useInsertFilmstrips(editor.inserts);

  const selectedClip =
    selection?.kind === "clip"
      ? editor.segments.find((clip) => clip.id === selection.id)
      : undefined;
  const selectedInsert =
    selection?.kind === "insert"
      ? editor.inserts.find((item) => item.id === selection.id)
      : undefined;
  const selectedMusic =
    selection?.kind === "music"
      ? editor.music.find((track) => track.id === selection.id)
      : undefined;
  // Chỉ chữ TỰ DO mới có tay nắm: khoảng của chữ chép lời là khoảng của cụm lời,
  // kéo nó ra khỏi cụm thì chữ không còn khớp tiếng nào.
  const selectedText =
    selection?.kind === "text"
      ? editor.textElements.find(
          (item) => item.id === selection.id && item.byTime,
        )
      : undefined;
  const selectedEffect =
    selection?.kind === "junction"
      ? editor.effects.find((item) => item.id === selection.id)
      : undefined;
  // Ô NGƯỜI đọc từ lịch màn, không phải từ `editor.segments`/`inserts` — cùng
  // nguồn với `LayoutLane`. Lọc thêm `insert === undefined` để không lẫn màn
  // b-roll (nó cũng có `elementId` nhưng đã có tay nắm riêng ở trên).
  const selectedScene =
    selection?.kind === "scene"
      ? editor.sceneLayout?.schedule.find(
          (item) => item.elementId === selection.id && item.insert === undefined,
        )
      : undefined;
  // Đang kéo đúng ô này thì vẽ theo mốc tạm, không thì vẽ mốc thật của lịch màn.
  const scenePreviewForSelected =
    editor.scenePreview?.elementId === selectedScene?.elementId
      ? editor.scenePreview
      : null;
  /** Có khối nào đang chọn không — vạch giữa mờ đi lúc đó (xem chú thích dưới). */
  const selected =
    selectedClip ?? selectedMusic ?? selectedInsert ?? selectedScene;

  /** Khối vừa bị bấm chuột phải — bảng chọn đọc nó để biết bày mục gì. */
  const [nhamVao, setNhamVao] = useState<Selection>(null as Selection);

  const select = (kind: "clip" | "insert" | "text" | "music", id: string) => {
    if (drag.current.moved) return;
    editor.setSelection({ kind, id } as never);
  };

  return (
    <TimelineContextMenu editor={editor} target={nhamVao}>
      <Card>
        {/* `flex` chứ không `grid gap-2` xếp dọc nữa: hàng thanh công cụ đã bỏ,
          ba nút còn lại đứng thành CỘT bên phải — lấy bề ngang đang thừa thay vì
          bề cao đang thiếu. */}
        <CardContent className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            {/* `+` ở đầu TRÊN vạch, kéo cắt ở đầu DƯỚI. Cả hai nằm ngoài vùng
              cuộn vì vùng đó `overflow: hidden` sẽ xén mất phần thò ra. */}
            <TimelinePlayheadButtons editor={editor} studio={studio} />
            <div
              ref={viewportRef}
              data-timeline
              // `select-none` và `touch-action:none` là bắt buộc, không phải trang
              // trí: thiếu cái đầu thì kéo dải biến thành bôi đen chữ, thiếu cái sau
              // thì trên máy cảm ứng vuốt dải thành cuộn trang và chụm hai ngón
              // thành phóng cả trang.
              className={cn(
                "relative cursor-grab touch-none overflow-hidden rounded-lg bg-muted/40 select-none active:cursor-grabbing",
                // Thả tệp vào: viền sáng lên cho biết dải NHẬN được, chứ không để
                // người dùng thả vào chỗ trống rồi tự hỏi vì sao không có gì xảy ra.
                dropping && "inset-ring-2 inset-ring-primary",
              )}
              onPointerDown={startScrub}
              /*
               * KÉO TỆP TỪ MÁY THẢ THẲNG VÀO DẢI.
               *
               * Trước đây thêm tư liệu phải đi qua nút chọn ở bảng bên phải, tức
               * người dùng đang nhìn vào ĐÚNG chỗ họ muốn đặt hình lại phải rời mắt
               * sang chỗ khác rồi quay lại tìm. Thả tại chỗ bỏ hẳn quãng đường đó.
               *
               * `preventDefault` ở `dragover` là bắt buộc — thiếu nó thì trình duyệt
               * giữ hành vi mặc định (mở tệp trong tab mới) và cú thả không bao giờ
               * tới được `drop`.
               */
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes("Files")) return;
                event.preventDefault();
                setDropping(true);
              }}
              onDragLeave={() => setDropping(false)}
              onDrop={(event) => {
                if (!event.dataTransfer.types.includes("Files")) return;
                event.preventDefault();
                setDropping(false);
                const files = [...event.dataTransfer.files];
                if (files.length > 0) void editor.addMedia(files);
              }}
              // Chuột phải mở bảng chọn của RIÊNG dải, không phải bảng của trình
              // duyệt. Ghi lại khối bị nhắm để bảng biết bày mục gì; bấm ra chỗ
              // trống thì `closest` trả rỗng và bảng nói câu hướng dẫn.
              onContextMenu={(event) => {
                const block = (
                  event.target as HTMLElement
                ).closest<HTMLElement>("[data-block][data-kind]");
                const rawKind = block?.dataset.kind;
                const id = block?.dataset.blockId;
                // Khối bố cục (b-roll VÀ ô người) đều phát `data-kind='layout'` —
                // mà không nhánh menu nào tên 'layout' nên bảng ra RỖNG. Quy về
                // đúng loại Selection: có trong `inserts` → b-roll ('insert', có
                // mục "Gỡ tư liệu này"); còn lại là ô người, không có mục riêng →
                // coi như chỗ trống (bảng chỉ hướng dẫn), KHÔNG bày menu rỗng.
                let kind = rawKind;
                if (rawKind === "layout" && id) {
                  kind = editor.inserts.some((i) => i.id === id)
                    ? "insert"
                    : undefined;
                }
                // Bàn dựng: đoạn phim KHÔNG phải mục chuột phải — mục duy nhất
                // của nó là "Bỏ đoạn" (cắt), mà việc cắt đã ở bước riêng. Coi
                // như bấm chỗ trống để bảng chỉ hiện câu hướng dẫn.
                setNhamVao(
                  kind && id && !(studio && kind === "clip")
                    ? ({ kind, id } as unknown as Selection)
                    : null,
                );
              }}
              // Vùng này `overflow-hidden` nên không ai thấy nó cuộn, nhưng trình
              // duyệt vẫn cuộn ngầm khi một khối ngoài tầm nhìn nhận focus — và cả
              // dải lệch đi một đoạn không ai giải thích được.
              onScroll={(event) => {
                event.currentTarget.scrollLeft = 0;
                event.currentTarget.scrollTop = 0;
              }}
              onClick={(event) => {
                if (drag.current.moved) return;
                // Bấm ra CHỖ TRỐNG là bỏ chọn. Trước đây muốn bỏ chọn một đoạn thì
                // phải chọn đoạn khác — không có đường nào về trạng thái "không
                // chọn gì", trong khi đó mới là trạng thái để nhìn tổng thể.
                // Bấm TRÚNG MỘT KHỐI thì chỉ chọn, KHÔNG dời vạch.
                //
                // Trước đây bấm đâu cũng dời vạch. Mà vạch ghim cứng ở giữa màn,
                // nên dời vạch là cả dải trượt ngang một đoạn — bấm một khối để
                // xem nó là màn hình nhảy, mất luôn chỗ mắt đang nhìn.
                //
                // Hai ý định khác nhau thì hai kết quả khác nhau:
                // · bấm một khối  = "cho tôi xem/sửa cái này"  → chọn
                // · bấm chỗ trống = "đưa tôi tới đây"          → dời vạch
                //
                // Muốn vừa chọn vừa tới thì bấm thước hoặc kéo dải — hai việc đó
                // vốn đã là "đưa tôi tới đây".
                const block = (event.target as HTMLElement).closest(
                  "[data-block]",
                );
                if (block) return;
                editor.setSelection(null);
                seek(timeAtClientX(event.clientX));
              }}
            >
              <div
                className="relative grid gap-1.5 p-2"
                style={{
                  transform: `translateX(${offset}px)`,
                  width: "max-content",
                }}
              >
                <TimelineRuler pxPerSecond={pxPerSecond} range={range} />
                {/* DẢI BỐ CỤC — cấu trúc khung hình, đặt trên cùng. MỘT dải liền
                    mạch: khung người và b-roll chung hàng, không còn dải b-roll
                    riêng với một cái "lỗ" chừa sẵn ở đây. Chỉ hiện với bộ dáng có
                    bố cục; bấm một khối để chọn (khung người → bảng bố cục màn,
                    b-roll → bảng b-roll). */}
                {editor.sceneLayout &&
                  editor.sceneLayout.schedule.length > 0 && (
                    <div className="relative">
                      <LayoutLane
                        schedule={editor.sceneLayout.schedule}
                        inserts={toVisible(editor.inserts)}
                        strips={insertStrips}
                        pxPerSecond={pxPerSecond}
                        selection={selection}
                        scenePreview={editor.scenePreview}
                        onSelectScene={(elementId) =>
                          editor.setSelection({ kind: "scene", id: elementId })
                        }
                        onSelectInsert={(id) => select("insert", id)}
                        // KÉO DỜI b-roll: buộc mốc NGUỒN (editor.inserts) vì
                        // `timeAtClientX` làm việc ở giờ nguồn, còn khối vẽ ở giờ
                        // xuất ra. `startMove` snap theo TỪ, giữ nguyên số tiếng.
                        onMoveInsert={(id) => {
                          const src = editor.inserts.find(
                            (item) => item.id === id,
                          );
                          return src
                            ? startMove("insert", id, src.start)
                            : undefined;
                        }}
                        // KÉO DỜI khung NGƯỜI: lịch màn vẽ giờ XUẤT → mốc nguồn qua
                        // toSource. Snap theo TỪ, giữ nguyên số tiếng.
                        onMoveScene={(elementId) => {
                          const sc = editor.sceneLayout?.schedule.find(
                            (item) => item.elementId === elementId,
                          );
                          return sc
                            ? startMove("scene", elementId, toSource(sc.start))
                            : undefined;
                        }}
                      />
                      {/* Tay nắm gọt mép b-roll đứng trên CHÍNH dải bố cục — cùng
                          hàng với khối b-roll nó đang gọt. */}
                      {selectedInsert && (
                        <TrimHandles
                          start={toOutput(selectedInsert.start) * pxPerSecond}
                          end={toOutput(selectedInsert.end) * pxPerSecond}
                          onGrab={(edge) => {
                            drag.current.moved = true;
                            setTrimming({
                              kind: "insert",
                              id: selectedInsert.id,
                              edge,
                            });
                          }}
                        />
                      )}
                      {/* Tay nắm gọt mép Ô NGƯỜI — cùng hàng, cùng cơ chế với
                          b-roll ở trên. Mốc lấy từ lịch màn (đã là mốc XUẤT RA,
                          không cần `toOutput` như insert — xem `use-scene-layout`),
                          ưu tiên bản xem trước lúc đang chính nó bị kéo. */}
                      {selectedScene && (
                        <TrimHandles
                          start={
                            (scenePreviewForSelected?.start ??
                              selectedScene.start) * pxPerSecond
                          }
                          end={
                            (scenePreviewForSelected?.end ??
                              selectedScene.end) * pxPerSecond
                          }
                          onGrab={(edge) => {
                            drag.current.moved = true;
                            setTrimming({
                              kind: "scene",
                              id: selectedScene.elementId!,
                              edge,
                            });
                          }}
                        />
                      )}
                    </div>
                  )}
                {/* Chữ TỰ DO trên cùng — nó là lớp trên cùng của khung hình, và
                  nó phải có hàng riêng vì có thể trùng giờ với chữ chép lời. */}
                <div className="relative">
                  <FreeTextLane
                    elements={toVisible(
                      editor.textElements.filter((item) => item.byTime),
                    )}
                    pxPerSecond={pxPerSecond}
                    selection={selection}
                    onSelect={(id) => select("text", id)}
                    onMove={(id) => {
                      const src = editor.textElements.find(
                        (item) => item.id === id,
                      );
                      return src
                        ? startMove("text", id, src.start)
                        : undefined;
                    }}
                  />
                  {selectedText && (
                    <TrimHandles
                      start={toOutput(selectedText.start) * pxPerSecond}
                      end={toOutput(selectedText.end) * pxPerSecond}
                      onGrab={(edge) => {
                        drag.current.moved = true;
                        setTrimming({
                          kind: "text",
                          id: selectedText.id,
                          edge,
                        });
                      }}
                    />
                  )}
                </div>
                {/* Hiệu ứng có HÀNG RIÊNG ngay trên dải phim.
                  Từng vẽ đè lên mép khối phim cho "sát mối nối" — nhưng mép khối
                  cũng đúng là chỗ tay nắm gọt mép đứng, nên đoạn nào có chuyển
                  cảnh là không co dãn được nữa. Hàng riêng, cùng toạ độ ngang,
                  vẫn đọc ra thuộc mối nào mà không tranh một pixel nào. */}
                <div className="relative">
                  <EffectLane
                    effects={editor.effects}
                    pxPerSecond={pxPerSecond}
                    selection={selection}
                    onSelect={(id) =>
                      !drag.current.moved &&
                      editor.setSelection({ kind: "junction", id })
                    }
                    onMove={(id) => {
                      const eff = editor.effects.find((item) => item.id === id);
                      // Chỗ nối vẽ ở giờ XUẤT RA; `startMove` cần mốc NGUỒN.
                      return eff
                        ? startMove("effect", id, toSource(eff.outStart))
                        : undefined;
                    }}
                  />
                  {selectedEffect && (
                    <TrimHandles
                      start={selectedEffect.outStart * pxPerSecond}
                      end={selectedEffect.outEnd * pxPerSecond}
                      onGrab={(edge) => {
                        drag.current.moved = true;
                        setTrimming({
                          kind: "effect",
                          id: selectedEffect.id,
                          edge,
                        });
                      }}
                    />
                  )}
                </div>
                <div className="relative">
                  {/* Chữ vẽ ĐÈ lên dải phim, không phải một dải song song.
                  Đo được: không có hai chữ nào chồng thời gian nhau, nên một
                  dải chứa hết — chữ ứng đúng một đoạn thì nằm gọn trên khối đó,
                  chữ trải ba đoạn thì thành một băng vắt qua ba khối. Không cần
                  luật riêng cho loại nào cả. */}
                  {/* Lùi 1px mỗi bên cho TRÙNG KHÍT mép khối phim (khối cũng lùi
                  1px). Lệch một pixel thì hai đường bo góc nằm cạnh nhau và mắt
                  đọc ra một cái viền đôi — đúng thứ trông như lỗi vẽ. */}
                  <div className="pointer-events-none absolute top-0 right-px left-px z-20 h-4">
                    <div className="pointer-events-auto h-full">
                      <TextLane
                        // Hít mép về mép đoạn: chữ chạy theo lời thì nó THUỘC khúc
                        // phim ấy, mà mép đoạn đã nới ra khỏi mốc từ nên hai hàng
                        // khối so le nhau ở đúng những cụm đứng trước quãng lặng.
                        // Chữ TỰ DO không hít — nó neo theo giây, người dùng đặt
                        // tay từng cái, hít là dời chỗ họ vừa chọn.
                        elements={snapToSegments(
                          toVisible(
                            editor.textElements.filter((item) => !item.byTime),
                          ),
                        )}
                        pxPerSecond={pxPerSecond}
                        selection={selection}
                        onSelect={(id) => select("text", id)}
                        overlay
                      />
                    </div>
                  </div>
                  <ClipLane
                    clips={visibleSegments}
                    pxPerSecond={pxPerSecond}
                    range={range}
                    selection={selection}
                    // Bàn dựng: dải phim chỉ làm nền định vị, bấm không chọn đoạn
                    // (chọn đoạn mở khung "Bỏ đoạn" — việc cắt đã ở bước riêng).
                    onSelect={studio ? () => {} : (id) => select("clip", id)}
                    stripUrl={
                      editor.projectId
                        ? api.filmstripUrl(
                            editor.projectId,
                            editor.stripVersion,
                          )
                        : undefined
                    }
                    stripSeconds={editor.stripSeconds}
                    nativeSecondWidth={editor.stripNativeSecondWidth}
                    envelope={editor.envelope}
                  />
                  {/* Dấu chỗ nối nằm TRÊN dải phim nhưng DƯỚI tay nắm gọt mép —
                    xem chú thích trong `timeline-seam-marks.tsx` về việc chia nửa
                    trên / nửa dưới để hai thứ không tranh cú bấm.
                    Bàn dựng: bỏ hẳn — chúng thuần là công cụ soát/cắt. */}
                  {!studio && (
                    <SeamMarks
                      editor={editor}
                      pxPerSecond={pxPerSecond}
                      onAudit={onAudit}
                    />
                  )}
                  {!studio && selectedClip && (
                    <TrimHandles
                      start={toOutput(selectedClip.start) * pxPerSecond}
                      end={toOutput(selectedClip.end) * pxPerSecond}
                      onGrab={(edge) => {
                        drag.current.moved = true;
                        setTrimming({
                          kind: "clip",
                          id: selectedClip.id,
                          edge,
                        });
                      }}
                      // Nhấp đúp mép = trả lại TRỌN chỗ vừa gọt ở mép đó. Kéo tay
                      // thì phải canh bằng mắt; nhấp đúp thì về đúng mốc cũ.
                      onRestore={(edge) => {
                        const at =
                          edge === "start"
                            ? selectedClip.start
                            : selectedClip.end;
                        const gap = editor.trimmedEdgeAt(at);
                        if (gap) void editor.removeCut(gap.id);
                      }}
                    />
                  )}
                </div>
                {/* Nhạc nằm DƯỚI CÙNG: nó trải suốt video và không có hình, nên
                đặt nó xen giữa các lớp có hình là chen ngang mạch đọc. */}
                <div className="relative">
                  <MusicLane
                    tracks={toVisible(editor.music)}
                    pxPerSecond={pxPerSecond}
                    selection={selection}
                    onSelect={(id) => select("music", id)}
                    onMove={(id) => {
                      const src = editor.music.find((item) => item.id === id);
                      return src
                        ? startMove("music", id, src.start)
                        : undefined;
                    }}
                  />
                  {selectedMusic && (
                    <TrimHandles
                      start={toOutput(selectedMusic.start) * pxPerSecond}
                      end={toOutput(selectedMusic.end) * pxPerSecond}
                      onGrab={(edge) => {
                        drag.current.moved = true;
                        setTrimming({
                          kind: "music",
                          id: selectedMusic.id,
                          edge,
                        });
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Vạch giữa mờ đi khi đang chọn khối — chỗ Captions để tay nắm sát
              vạch 1.5px gây hoang mang, ta tránh bằng cách hạ nổi bật của vạch.

              KHÔNG còn chóp hình thoi ở đầu vạch. Chóp ấy từng để mắt bắt được
              mốc giữa mấy trăm ô chữ — nhưng giờ nút `+` (một vòng tròn đặc
              32px) nằm đúng chỗ đó và làm việc ấy tốt hơn, nên chóp luôn bị che.
              Chỉ lộ ra đúng lúc rê chuột vào `+`: nền nút lúc ấy chỉ đặc 80%,
              đủ để cái hình thoi phía sau nhô lên như một lỗi vẽ.

              · GIÂY hiện ngay dưới chóp lúc đang kéo: đang kéo thì mắt ở vạch,
                nhìn lên thanh công cụ đọc số là rời mắt khỏi chỗ đang làm.
              · VIỀN sáng hai bên vạch để nó nổi trên cả nền tối lẫn nền sáng —
                dải ảnh phim đổi màu liên tục nên một màu đơn không đủ. */}
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2 transition-opacity",
                  selected ? "opacity-20" : "opacity-100",
                )}
              >
                <div className="relative h-full w-0.5 bg-foreground shadow-[0_0_0_1px_var(--color-background)]">
                  {dragging && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 text-[10px] leading-none font-medium text-background tabular-nums">
                      {formatTime(junctionView)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <TimelineSideRail
            pxPerSecond={pxPerSecond}
            canZoomIn={editor.canZoomIn}
            canZoomOut={editor.canZoomOut}
            onZoom={(direction) =>
              editor.zoomBy(direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP)
            }
            undoLabel={editor.undoLabel}
            onUndo={() => void editor.undo()}
          />
        </CardContent>
      </Card>
    </TimelineContextMenu>
  );
}
