import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

import { ProjectTitle } from "@/components/project-title";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader } from "@/components/ui/card";

import { PreviewPanel } from "./preview-panel";
import { RightPanel } from "./right-panel";
import { Timeline } from "./timeline";
import { TranscriptPanel } from "./transcript-panel";
import { useEditor } from "./use-editor";
import { useEditorGuards } from "./use-editor-guards";

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  /*
   * Cổng nào đang mở — `null` là mạch đã chạy hết và đây là bàn dựng thường.
   *
   * Bấm xong thì QUAY VỀ màn chờ: pha sau mất vài phút (chốt lát cắt phải cắt
   * lại tệp và chép lời một lượt nữa), mà ngồi trong bàn dựng nhìn dữ liệu cũ
   * biến đổi dưới chân là cách chắc chắn để tưởng nó hỏng.
   */
  const navigate = useNavigate();
  const editor = useEditor(projectId);
  /*
   * Cổng nào đang mở — `null` là mạch đã chạy hết và đây là bàn dựng thường.
   *
   * Bấm xong thì QUAY VỀ màn chờ: pha sau mất vài phút (chốt lát cắt phải cắt
   * lại tệp rồi chép lời một lượt nữa), mà ngồi trong bàn dựng nhìn dữ liệu cũ
   * biến đổi dưới chân là cách chắc chắn để tưởng nó hỏng.
   */
  const gate = editor.pipeline?.awaiting ?? null;
  const [passing, setPassing] = useState(false);
  const passGate = async () => {
    if (!gate || !projectId) return;
    setPassing(true);
    try {
      await fetch(`/api/projects/${projectId}/${gate}/xong`, {
        method: "POST",
        credentials: "include",
      });
      navigate(`/pipeline/${projectId}`);
    } finally {
      setPassing(false);
    }
  };
  const [playing, setPlaying] = useState(false);
  const { seek, duration } = editor;
  const timeRef = useRef(editor.time);
  timeRef.current = editor.time;
  const skipRef = useRef(editor.nextKeptTime);
  skipRef.current = editor.nextKeptTime;
  /**
   * Mốc DỪNG của lần phát hiện tại, tính bằng giây gốc; `null` là chạy tới hết.
   *
   * Xem thử một hiệu ứng thì chỉ cần xem đúng nó — hiệu ứng dài 0,65 giây mà cứ
   * để chạy tiếp thì người dùng phải tự bấm dừng, hoặc ngồi xem cả đoạn sau.
   */
  const stopAtRef = useRef<number | null>(null);
  /**
   * Quãng đang nghe thử, đọc được NGAY trong lượt vẽ đặt nó.
   *
   * `editor.startAudit` là một lần đặt state, nên `editor.nextKeptTime` chỉ biết
   * về quãng ấy từ lượt vẽ sau. Mà vòng lặp phát khởi động ngay trong lượt này
   * và dùng `skipRef` cũ — hàm nhảy-qua-chỗ-đã-bỏ ấy vọt thẳng qua đúng cái
   * quãng ta vừa bảo nó hãy phát, rơi ra sau mốc dừng, và tắt phát ở khung hình
   * đầu tiên.
   *
   * Đo được: `play @63.54` → `seeking @39.90` → `pause` — nút "Nghe thử" bấm
   * vào không kêu, dù video phát thật được một nhịp.
   */
  const auditRef = useRef<{ start: number; end: number } | null>(null);
  /**
   * Kết thúc lượt nghe thử phần đã bỏ.
   *
   * Qua ref vì vòng lặp phát chỉ dựng lại khi `playing` đổi — cho `startAudit` vào
   * danh sách phụ thuộc thì mỗi lượt nghe thử là một vòng lặp mới chồng lên cái cũ.
   */
  const endAudit = useRef(() => editor.startAudit(null));
  endAudit.current = () => editor.startAudit(null);

  // Phát giả lập: nhích mốc thời gian theo đồng hồ thật, để thử được vòng lặp
  // "sửa → xem lại ngay" mà không cần tệp video.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    /*
     * Đồng hồ chạy 60 lần/giây, nhưng chỉ ĐẨY VÀO STATE 20 lần.
     *
     * `setTime` sinh ra một object `editor` mới, mà hai mươi component của bàn
     * dựng đều nhận nguyên object ấy và không cái nào được memo hoá — nên mỗi
     * lượt đẩy là dựng lại 6.600 dòng component, kèm cả danh sách hàng trăm từ
     * của bản chép lời. Sáu mươi lần một giây thì máy không theo kịp, và người
     * dùng thấy đúng cái đó: kéo thanh thời gian thì giật.
     *
     * Hai mươi lần/giây là đủ cho MẮT nhìn vạch chạy — video thì tự nó phát ở
     * nhịp riêng, `preview-panel` chỉ tua khi lệch quá 0,3 giây. Vẫn tính mốc ở
     * 60fps để không tích luỹ sai số.
     *
     * Sửa tận gốc là tách `time` ra khỏi object `editor` để chỉ thứ nào thật sự
     * đọc nó mới phải dựng lại. Đó là việc trong `use-editor.ts`, để riêng.
     */
    const PUSH_EVERY_MS = 50;
    /** Mốc đã tính nhưng chưa đẩy vào state. */
    let carried: number | null = null;
    /** Mốc lần cuối đã đẩy — để nhận ra có người tua chen ngang hay không. */
    let pushed: number | null = null;
    let lastPush = 0;
    const tick = (now: number) => {
      // Đang nghe thử mà con trỏ còn nằm ngoài quãng thì kéo về đầu quãng.
      // `seek` đặt state, nên trong một hai lượt vẽ đầu `timeRef` vẫn giữ vị
      // trí cũ — và vị trí cũ ấy thường đã quá mốc dừng, làm vòng lặp tắt phát
      // ngay ở khung hình đầu tiên.
      const audit = auditRef.current;
      const video = editor.videoRef.current;
      /*
       * ĐỒNG HỒ LÀ VIDEO, không phải đồng hồ tường.
       *
       * Bản trước tính mốc bằng thời gian thật rồi để khung xem trước tua video
       * cho khớp. Mạng khựng một cái là video tụt lại quá ngưỡng, bị tua, nạp lại
       * từ chỗ mới rồi tụt tiếp — một vòng tự nuôi nhau. Đo trên máy người dùng
       * thật: 38 lượt tua và 38 lượt chờ nạp trong 15 giây, trong khi FPS vẫn 60
       * và không có tác vụ dài nào. Cái giật nằm ở đó.
       *
       * Lấy `currentTime` của chính video thì mạng khựng chỉ làm vạch chạy chậm
       * lại theo — không ai tua ai, và thứ người dùng thấy luôn khớp thứ đang
       * nghe.
       *
       * Rơi về đồng hồ tường khi: chưa có video, video đang dừng hoặc đang tua
       * dở, hoặc đang nghe thử một quãng (lúc đó mốc do quãng đó chỉ huy).
       */
      const videoLeads =
        !!video && !video.paused && !video.seeking && !audit && !video.ended;
      /*
       * `timeRef` lệch khỏi mốc ta vừa đẩy nghĩa là CÓ NGƯỜI TUA chen ngang —
       * lúc đó phải theo họ. Bằng nhau thì không ai đụng vào, dùng mốc đang tích
       * luỹ ở đây (state có thể còn chưa kịp cập nhật giữa hai lượt đẩy).
       */
      const seeked =
        pushed === null || Math.abs(timeRef.current - pushed) > 0.001;
      const current = seeked ? timeRef.current : (carried ?? timeRef.current);
      const base =
        audit && (current < audit.start || current >= audit.end)
          ? audit.start
          : current;
      const raw = videoLeads ? video.currentTime : base + (now - last) / 1000;
      last = now;
      // Nhảy qua chỗ đã bỏ: xem trước phải giống hệt video sẽ xuất ra.
      const next = auditRef.current ? raw : skipRef.current(raw);
      /*
       * Vào một quãng ĐÃ BỎ thì phải tua video tới chỗ tiếp theo — tua CÓ CHỦ Ý,
       * khác hẳn tua để đuổi theo đồng hồ. Nó xảy ra đúng một lần ở mỗi chỗ cắt,
       * không phải mỗi khung hình.
       *
       * Không làm thì video cứ phát tiếp qua đoạn người dùng đã gạch, còn vạch
       * thì đã nhảy sang bên kia — hình một đằng, mốc một nẻo.
       */
      if (videoLeads && next - raw > 0.05) video.currentTime = next;
      if (stopAtRef.current != null && next >= stopAtRef.current) {
        setPlaying(false);
        // Hạ cờ nghe thử NGAY tại mốc dừng: còn treo thì vạch đứng lại bên trong
        // quãng đã bỏ, và khung xem hiện một khung hình không có trong video.
        auditRef.current = null;
        endAudit.current();
        seek(stopAtRef.current);
        stopAtRef.current = null;
        return;
      }
      if (next >= duration) {
        setPlaying(false);
        seek(duration);
        return;
      }
      if (now - lastPush >= PUSH_EVERY_MS) {
        lastPush = now;
        pushed = next;
        carried = null;
        seek(next);
      } else {
        carried = next;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, seek, duration, editor.videoRef]);

  // Phím tắt và mọi thứ phải chặn của trình duyệt gom về một chỗ — xem
  // `use-editor-guards.ts` để biết đã chặn những gì và vì sao.
  useEditorGuards({
    editor,
    onTogglePlay: () => {
      // Bấm phát bằng tay thì bỏ mốc dừng — không thì lần phát sau bị cắt ngang
      // ở chỗ hiệu ứng vừa xem thử, mà chẳng có gì giải thích.
      stopAtRef.current = null;
      // Và hạ cờ nghe thử: lượt phát bằng tay phải cho ra ĐÚNG video sẽ xuất, chứ
      // không mang theo một quãng đã bỏ từ lượt nghe thử trước.
      endAudit.current();
      setPlaying((current) => !current);
    },
  });

  /**
   * Máy chưa buông tay thì đẩy về màn chờ.
   *
   * Cổng nằm ở CẢ HAI đầu: nút "Mở trình sửa" tắt là chưa đủ, vì mã dự án nằm
   * trên đường dẫn nên người dùng gõ thẳng hoặc mở lại thẻ cũ là vào được. Vào
   * lúc này thì thấy ba cột rỗng, mà tệ hơn là sửa được — đúng cái tranh chấp
   * mà lối chạy tuần tự sinh ra để tránh.
   *
   * Dự án CŨ không có chặng nào (dựng xong từ trước khi có bảng này) nên
   * `steps.length === 0` phải cho qua, không thì chúng bị nhốt vĩnh viễn.
   */
  const pipeline = editor.pipeline;
  useEffect(() => {
    if (!projectId || !pipeline) return;
    if (pipeline.steps.length > 0 && !pipeline.settled) {
      navigate(`/pipeline/${projectId}`, { replace: true });
    }
  }, [projectId, pipeline, navigate]);

  if (editor.loading || editor.error) {
    return (
      <div className="grid h-svh place-items-center bg-background p-2 text-foreground">
        <Empty>
          {editor.error ? null : <Spinner />}
          <EmptyTitle>
            {editor.error ? "Không mở được dự án" : "Đang mở dự án…"}
          </EmptyTitle>
          <EmptyDescription>
            {editor.error ?? "Đang lấy bản chép lời từ máy chủ"}
          </EmptyDescription>
          {/* Hỏng thì phải có đường ra. Không có nút này thì màn hình lỗi là ngõ
              cụt — cách duy nhất thoát là sửa thanh địa chỉ. */}
          {editor.error && (
            <Button
              variant="secondary"
              onClick={() => navigate("/")}
              className="mt-1"
            >
              Về danh sách dự án
            </Button>
          )}
        </Empty>
      </div>
    );
  }

  return (
    <div className="grid min-h-svh gap-2 bg-background p-2 text-foreground lg:h-svh lg:grid-rows-[auto_1fr_auto] lg:overflow-hidden">
      <Card>
        <CardHeader>
          <ProjectTitle
            title={editor.title}
            onRename={(next) => void editor.renameProject(next)}
          />
          <CardAction>
            {/* Đường ra, đặt đúng chỗ nó đứng ở `/upload` — cùng một ứng dụng
                thì cùng một chỗ. Không có nút này thì bàn dựng là ngõ cụt: lối
                về danh sách duy nhất là nút lùi của trình duyệt, mà đi qua vài
                màn rồi thì nút đó chẳng đưa ai về đâu. */}
            <Button variant="ghost" onClick={() => navigate("/")}>
              Trở về
            </Button>
            {/*
              ── CỔNG CHỜ NGƯỜI ──

              Mạch dựng dừng hai lần trước khi tới phần làm đẹp: soát chỗ cắt,
              rồi soát chính tả. Lúc ấy bàn dựng mở ra để SỬA, nên nút ở đây
              không phải "Xuất video" — chưa tới lúc — mà là "xong việc này,
              chạy tiếp".

              Đặt nút TẠI ĐÂY chứ không trên màn chờ: bản đầu bày một bảng
              chỉ-đọc ngoài kia, và một danh sách không sửa được thì người dùng
              chỉ có hai lựa chọn là tin hoặc không tin. Soát là việc phải nhìn
              video, nghe tiếng, đọc lời trong ngữ cảnh — tức là ở đây.
            */}
            {gate ? (
              <Button disabled={passing} onClick={passGate}>
                {gate === "soat-cat"
                  ? "Xong — chốt chỗ cắt"
                  : "Xong — chốt chính tả"}
              </Button>
            ) : editor.exportJob?.status === "done" ? (
              <Button
                render={<a href={api.exportUrl(editor.projectId!)} download />}
              >
                Tải video về
              </Button>
            ) : (
              <Button
                // Chưa có lời thì không có gì để cắt, và máy chủ sẽ lỗi ngay.
                //
                // Chưa dựng xong bản chất lượng thì cũng chưa xuất được: nó dựng
                // NỀN sau lượt chép lời, nên có một quãng bàn dựng đã mở mà tệp
                // nguồn để cắt thì chưa có. Nói thẳng lý do trên chính cái nút,
                // đừng cho bấm rồi im lặng bắt chờ.
                disabled={
                  editor.exportJob?.status === "running" ||
                  editor.sentences.length === 0 ||
                  !editor.masterReady
                }
                onClick={() => void editor.startExport()}
              >
                {editor.exportJob?.status === "running"
                  ? (editor.exportJob.message ?? "Đang xuất…")
                  : !editor.masterReady
                    ? "Đang chuẩn bị bản dựng…"
                    : "Xuất video"}
              </Button>
            )}
          </CardAction>
        </CardHeader>
      </Card>

      {/* Ba cột BẰNG NHAU. Chia 3/3/6 thì cột phải rộng gần gấp đôi mà nội dung
          của nó là những hàng nút ngắn — thừa chỗ ở nơi không cần, trong khi cả
          ba đều phải cao bằng nhau và kín màn. */}
      <div className="grid gap-2 lg:min-h-0 lg:grid-cols-3">
        <TranscriptPanel editor={editor} />
        <PreviewPanel
          editor={editor}
          playing={playing}
          onTogglePlay={() => setPlaying((current) => !current)}
        />
        {/* Cột phải KHÔNG cuộn cả cột nữa: từ khi hàng soát và khung sửa gộp làm
            một thẻ có tab thì chỉ còn MỘT thứ trong cột, và nó tự cuộn phần thân
            của mình. Thêm một thanh cuộn ở ngoài chỉ tạo ra hai chỗ để cuộn cho
            cùng một nội dung. */}
        <RightPanel
          editor={editor}
          // Xem thử một khoảng: đưa vạch về trước nó một nhịp rồi cho chạy.
          //
          // Cờ phát nằm ở đây chứ không ở `useEditor` (vòng lặp phát dùng đồng
          // hồ thật, gắn với màn chứ không với dữ liệu), nên phải truyền xuống.
          // Một tầng trung gian thì chấp nhận được; dời cả vòng lặp vào
          // `useEditor` chỉ để bớt một prop là đổi một thứ đang chạy đúng lấy
          // một thứ gọn hơn trên giấy.
          onPreview={(at, until) => {
            stopAtRef.current = until ?? null;
            const from = Math.max(0, at);
            seek(from);
            // Cùng lý do với `onAudit` bên dưới: vòng lặp đọc `timeRef` ngay
            // trong lượt vẽ này, mà `seek` thì phải đợi lượt sau.
            timeRef.current = from;
            setPlaying(true);
          }}
        />
      </div>

      {/* Kéo dải trong lúc đang phát thì dừng phát — ca kiểm T4 của đặc tả. */}
      <div
        onPointerDown={(event) => {
          // Chỉ cú bấm THẬT SỰ nằm trong dải mới dừng phát. Thứ dựng qua portal
          // — popover chỗ nối, menu chuột phải — không nằm trong khối này về
          // mặt DOM, nhưng React vẫn cho sự kiện của chúng nổi bọt tới đây.
          if (!event.currentTarget.contains(event.target as Node)) return;
          setPlaying(false);
        }}
      >
        <Timeline
          editor={editor}
          // Nghe thử một quãng ĐÃ BỎ: treo phép nhảy qua nó, đưa vạch về đầu quãng
          // rồi chạy tới hết quãng. Khung xem vốn phát tệp gốc nên không cần dựng
          // gì — xem `auditSpan` trong `use-editor.ts`.
          onAudit={(span) => {
            editor.startAudit(span);
            stopAtRef.current = span.end;
            seek(span.start);
            // `timeRef` phải nhích NGAY, không đợi lượt vẽ sau.
            //
            // `seek` là một lần đặt state, nên `timeRef.current` vẫn giữ vị trí
            // CŨ cho tới lượt vẽ kế. Mà vòng lặp phát khởi động ngay trong lượt
            // này và đọc đúng cái ref ấy: nó lấy vị trí cũ đem so với mốc dừng
            // MỚI, thấy đã quá mốc nên tắt phát ở khung hình đầu tiên.
            //
            // Đo được: nhật ký video ra `play @63.54` rồi `seeking @39.90` rồi
            // `pause` — phát thật, tua về đầu quãng, rồi chết. Người dùng thấy
            // một nút "Nghe thử" bấm vào không kêu.
            auditRef.current = span;
            setPlaying(true);
          }}
        />
      </div>
    </div>
  );
}
