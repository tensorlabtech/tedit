import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader } from "@/components/ui/card";

import { EditorTitle } from "./editor-title";
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
  const dungTaiRef = useRef<number | null>(null);

  // Phát giả lập: nhích mốc thời gian theo đồng hồ thật, để thử được vòng lặp
  // "sửa → xem lại ngay" mà không cần tệp video.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const raw = timeRef.current + (now - last) / 1000;
      last = now;
      // Nhảy qua chỗ đã bỏ: xem trước phải giống hệt video sẽ xuất ra.
      const next = skipRef.current(raw);
      if (dungTaiRef.current != null && next >= dungTaiRef.current) {
        setPlaying(false);
        seek(dungTaiRef.current);
        dungTaiRef.current = null;
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
      dungTaiRef.current = null;
      setPlaying((current) => !current);
    },
  });

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
          <EditorTitle
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
              <Button
                render={<a href={api.exportUrl(editor.projectId!)} download />}
              >
                Tải video về
              </Button>
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
          onPreview={(at, denKhi) => {
            dungTaiRef.current = denKhi ?? null;
            seek(Math.max(0, at));
            setPlaying(true);
          }}
        />
      </div>

      {/* Kéo dải trong lúc đang phát thì dừng phát — ca kiểm T4 của đặc tả. */}
      <div onPointerDown={() => setPlaying(false)}>
        <Timeline editor={editor} />
      </div>
    </div>
  );
}
