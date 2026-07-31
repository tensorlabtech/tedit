import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

import { ProjectTitle } from "@/components/project-title";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader } from "@/components/ui/card";

import { PostCopyDialog } from "./post-copy-dialog";
import { PreviewPanel } from "./preview-panel";
import { RightPanel } from "./right-panel";
import { Timeline } from "./timeline";
import { TranscriptPanel } from "./transcript-panel";
import { useEditor } from "./use-editor";
import { useEditorGuards } from "./use-editor-guards";

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const editor = useEditor(projectId);
  const [playing, setPlaying] = useState(false);
  /**
   * Hộp thoại lời đăng bài — chỉ mở được sau khi đã xuất xong video.
   *
   * Khai ở ĐÂY chứ không ngay trên chỗ dùng: bên dưới có một nhánh thoát sớm cho
   * lúc đang tải, mà hook đặt sau nhánh ấy thì số hook đổi giữa hai lượt vẽ và
   * React làm trắng cả bàn dựng. Bàn dựng thì luôn đi qua lúc đang tải.
   */
  const [moLoiDang, setMoLoiDang] = useState(false);
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
    const tick = (now: number) => {
      // Đang nghe thử mà con trỏ còn nằm ngoài quãng thì kéo về đầu quãng.
      // `seek` đặt state, nên trong một hai lượt vẽ đầu `timeRef` vẫn giữ vị
      // trí cũ — và vị trí cũ ấy thường đã quá mốc dừng, làm vòng lặp tắt phát
      // ngay ở khung hình đầu tiên.
      const audit = auditRef.current;
      const base =
        audit && (timeRef.current < audit.start || timeRef.current >= audit.end)
          ? audit.start
          : timeRef.current;
      const raw = base + (now - last) / 1000;
      last = now;
      // Nhảy qua chỗ đã bỏ: xem trước phải giống hệt video sẽ xuất ra.
      const next = auditRef.current ? raw : skipRef.current(raw);
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
      seek(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, seek, duration]);

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
      {editor.projectId && (
        <PostCopyDialog
          projectId={editor.projectId}
          open={moLoiDang}
          onOpenChange={setMoLoiDang}
        />
      )}
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
            {editor.exportJob?.status === "done" ? (
              <>
                {/* Đặt TRƯỚC nút tải: đăng bài là việc tiếp theo sau khi tải,
                    nhưng đọc từ trái sang thì nút chính phải đứng cuối. */}
                <Button variant="ghost" onClick={() => setMoLoiDang(true)}>
                  Lời đăng bài
                </Button>
                <Button
                  render={<a href={api.exportUrl(editor.projectId!)} download />}
                >
                  Tải video về
                </Button>
              </>
            ) : (
              <Button
                // Chưa có lời thì không có gì để cắt, và máy chủ sẽ lỗi ngay.
                disabled={
                  editor.exportJob?.status === "running" ||
                  editor.sentences.length === 0
                }
                onClick={() => void editor.startExport()}
              >
                {editor.exportJob?.status === "running"
                  ? (editor.exportJob.message ?? "Đang xuất…")
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
