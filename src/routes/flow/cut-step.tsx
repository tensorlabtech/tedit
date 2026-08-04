import { PlayIcon, RotateCcwIcon, ScissorsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/format-duration";

/**
 * BƯỚC CẮT ĐOẠN LỖI — bản chép là mặt chính, không phải dòng thời gian.
 *
 * ══ VÌ SAO ĐỌC CHỮ CHỨ KHÔNG KÉO THANH ══
 *
 * Với video một người nói, bản chép CHÍNH LÀ dòng thời gian. Bỏ một câu là bỏ
 * đoạn video của câu ấy. Đó là cách duy nhất tôi biết để người không chuyên cắt
 * được mà không phải hiểu timeline — không thanh kéo, không vệt sóng, không lằn
 * cắt. Ba thứ ấy đúng là những gì làm bàn dựng cũ không dùng nổi.
 *
 * ══ VÌ SAO ĐƠN VỊ LÀ CÂU, KHÔNG PHẢI TỪ ══
 *
 * Đo 472 cặp từ liền nhau trong một bản thật: **432 cặp (91,5%) hở ≤ 0 giây** —
 * dính hẳn hoặc chồng lên nhau. Whisper nội suy bên trong một hơi nói liền; nó
 * chia chữ cho mình đọc, chứ trong tiếng thì không có chỗ nào để cắt.
 *
 * Chỉ 32 cặp (6,8%) hở từ 200ms trở lên — đó mới là chỗ nghỉ thật. Nên cắt ở
 * mép từ ra tiếng cụt, còn cắt ở mép CÂU thì rơi đúng vào chỗ nghỉ.
 *
 * ══ NGHE THỬ MỐI NỐI ══
 *
 * Đọc bản chép KHÔNG cho biết cắt có gợn không, mà đó lại là thứ người ta sợ
 * nhất. Nút nghe phát 1,5 giây trước và 1,5 giây sau chỗ nối — ba giây, một cái
 * bấm, trả lời xong câu hỏi duy nhất đang treo. Không phải xem lại cả video.
 */

const SEAM = 1.5;

export type CutSentence = {
  id: string;
  text: string;
  start: number;
  end: number;
  removed: boolean;
};

export function CutStep({
  sentences,
  previewUrl,
  onToggle,
}: {
  sentences: CutSentence[];
  /** Bản xem trước để nghe thử mối nối. `null` là chưa dựng xong. */
  previewUrl: string | null;
  onToggle: (id: string, removed: boolean) => void;
}) {
  const bo = sentences.filter((item) => item.removed);
  const giay = bo.reduce((sum, item) => sum + (item.end - item.start), 0);

  const ngheMoiNoi = (at: number) => {
    if (!previewUrl) return;
    const audio = new Audio(previewUrl);
    audio.currentTime = Math.max(0, at - SEAM);
    void audio.play();
    // Dừng đúng sau mối nối. Không dừng thì nó chạy tiếp hết video, và người
    // dùng phải tự tìm nút tắt — trong khi câu hỏi đã trả lời xong từ lâu.
    window.setTimeout(() => audio.pause(), SEAM * 2 * 1000);
  };

  return (
    <Card className="lg:h-full lg:min-h-0">
      <CardHeader>
        <CardTitle>
          Máy định bỏ {bo.length} đoạn · {formatDuration(giay)}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto">
        {sentences.length === 0 ? (
          <p className="text-muted-foreground">
            Chưa có lời nào để soát. Máy chưa nghe xong, hoặc video này không có
            tiếng nói.
          </p>
        ) : null}
        {sentences.map((item) => (
          <div
            key={item.id}
            data-state={item.removed ? "cut" : "keep"}
            className="group flex items-baseline gap-3 rounded-lg border border-border px-3 py-2 data-[state=cut]:opacity-50"
          >
            <span className="text-muted-foreground shrink-0 tabular-nums text-xs">
              {formatDuration(item.start)}
            </span>
            {/* Đoạn bị bỏ gạch NGANG chứ không ẩn đi: ẩn thì người dùng không
                soát được thứ họ được mời soát, và không có đường lấy lại. */}
            <span
              className={
                "flex-1 " + (item.removed ? "line-through" : "")
              }
            >
              {item.text}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Nghe thử chỗ nối"
                disabled={!previewUrl}
                onClick={() => ngheMoiNoi(item.removed ? item.start : item.end)}
              >
                <PlayIcon />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggle(item.id, !item.removed)}
              >
                {item.removed ? (
                  <>
                    <RotateCcwIcon />
                    Giữ lại
                  </>
                ) : (
                  <>
                    <ScissorsIcon />
                    Bỏ
                  </>
                )}
              </Button>
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
