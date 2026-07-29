import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";

import { formatTime, type TextElement } from "./editor-data";
import { SentenceGroup } from "./transcript-sentence-group";
import { SilenceRow } from "./transcript-silence-row";
import type { EditorState } from "./use-editor";

/**
 * Bản chép lời — VÀ là chỗ duy nhất sửa chữ hiện trên màn.
 *
 * Trước đây đây là danh sách CÂU, còn chữ trên màn là một lớp riêng nằm chỗ
 * khác. Cùng một câu chữ hiện ở năm nơi (câu, chip cụm, dải từ, dải chữ, ô nội
 * dung ở khung sửa) mà sửa mỗi nơi lại ra một kết quả khác — không ai đoán được
 * phải sửa ở đâu.
 *
 * Giờ mỗi dòng là một CỤM: đúng cái sẽ hiện lên khung hình ở giây đó. Câu chỉ
 * còn là cách nhóm các dòng, vì bỏ nội dung thì bỏ theo câu.
 */
export function TranscriptPanel({ editor }: { editor: EditorState }) {
  /**
   * Cuộn tới dòng đang chọn khi cú chọn đến TỪ NƠI KHÁC.
   *
   * Chọn một chữ trên dải, hay bấm "Xem" ở hàng soát, thì khung sửa mở ra ngay
   * — nhưng bảng này vẫn đứng nguyên chỗ cũ. Người dùng đang sửa một dòng mà
   * không nhìn thấy nó nằm ở đâu trong mạch lời, trong khi cả điểm mạnh của
   * cách dựng theo lời là "thấy câu trước câu sau".
   *
   * Đưa dòng lên khoảng MỘT PHẦN BA từ trên xuống, không phải sát mép. Sát mép
   * thì chỉ đọc được một phía: dính đỉnh là mất câu dẫn phía trước, dính đáy là
   * mất câu tiếp theo. Một phần ba cho thấy cả hai, mà vẫn nghiêng về phía sau —
   * chỗ người ta sắp đọc tới.
   *
   * Chỉ cuộn khi dòng đang NẰM NGOÀI vùng đọc thoải mái. Bấm ngay trong bảng
   * này mà lần nào cũng kéo về một phần ba thì danh sách giật dưới tay, trong
   * khi người dùng đang nhìn đúng chỗ mình vừa bấm.
   */
  const vungCuon = useRef<HTMLDivElement>(null);
  const chonId = editor.selection?.kind === "text" ? editor.selection.id : null;

  /**
   * Lần cuối người dùng tự tay cuộn bảng này.
   *
   * Bắt bằng `wheel` và `pointerdown` chứ không bằng `scroll`: `scrollTo` ở dưới
   * cũng phát ra `scroll`, nên nghe `scroll` thì mỗi lần tự cuộn lại tự nhận là
   * người dùng vừa cuộn, và cuộn theo tắt vĩnh viễn ngay sau lần đầu.
   */
  const chamTay = useRef(0);
  useEffect(() => {
    const khung = vungCuon.current?.closest<HTMLElement>(
      "[data-slot=scroll-area-viewport]",
    );
    if (!khung) return;
    const ghi = () => (chamTay.current = Date.now());
    khung.addEventListener("wheel", ghi, { passive: true });
    khung.addEventListener("pointerdown", ghi);
    return () => {
      khung.removeEventListener("wheel", ghi);
      khung.removeEventListener("pointerdown", ghi);
    };
  }, []);

  /**
   * Dòng ứng với chỗ vạch đang đứng — thứ đang được tô sáng lúc tua.
   *
   * Tính lại mỗi lượt vẽ chứ không nhớ: `editor.time` đổi từng khung hình lúc
   * phát, mà bảng này vốn đã vẽ lại theo nó rồi (`activeTime` truyền xuống).
   *
   * Bỏ chữ TỰ DO ra: bảng này chỉ có dòng LỜI NÓI, chữ tự do không có mặt nên
   * lấy trúng nó thì `querySelector` không tìm ra hàng nào và cuộn theo im luôn.
   */
  const dongDangChay =
    editor.textElements.find(
      (row) =>
        !row.theoGio && editor.time >= row.start && editor.time < row.end,
    )?.id ?? null;

  /**
   * Kéo dòng đang quan tâm vào tầm mắt.
   *
   * Hai lối vào, một luật:
   * · CHỌN một dòng (bấm chữ trên dải, bấm "Xem" ở hàng soát) — khung sửa mở ra
   *   ngay, mà bảng này đứng nguyên chỗ cũ thì người dùng đang sửa một dòng
   *   không nhìn thấy nó nằm đâu trong mạch lời.
   * · TUA vạch chạy. Dòng ứng với vạch vẫn được tô sáng, nhưng tô sáng một dòng
   *   nằm ngoài tầm nhìn thì chẳng nói với ai điều gì. Trước đây chỗ này không
   *   nối vào — không phải một quyết định, chỉ là cuộn theo được viết cho lối
   *   vào thứ nhất rồi dừng ở đó.
   *
   * Đưa dòng lên khoảng MỘT PHẦN BA từ trên xuống, không phải sát mép. Sát mép
   * thì chỉ đọc được một phía: dính đỉnh là mất câu dẫn phía trước, dính đáy là
   * mất câu tiếp theo. Một phần ba cho thấy cả hai, mà vẫn nghiêng về phía sau —
   * chỗ người ta sắp đọc tới.
   *
   * Chỉ cuộn khi dòng đang NẰM NGOÀI vùng đọc thoải mái. Bấm ngay trong bảng
   * này mà lần nào cũng kéo về một phần ba thì danh sách giật dưới tay, trong
   * khi người dùng đang nhìn đúng chỗ mình vừa bấm.
   *
   * Chọn tay thì LUÔN thắng: đó là một việc người dùng vừa làm có chủ ý. Còn
   * bám theo vạch thì nhường — vừa tự cuộn tay xong mà cứ hai giây bị giật về
   * một lần là không đọc trước được đoạn nào.
   */
  const mucTieu = chonId ?? dongDangChay;
  const theoVach = !chonId;
  useEffect(() => {
    if (!mucTieu) return;
    if (theoVach && Date.now() - chamTay.current < 2000) return;
    const khung = vungCuon.current?.closest<HTMLElement>(
      "[data-slot=scroll-area-viewport]",
    );
    const dong = vungCuon.current?.querySelector<HTMLElement>(
      `[data-row="${mucTieu}"]`,
    );
    if (!khung || !dong) return;

    const khungBox = khung.getBoundingClientRect();
    const dongBox = dong.getBoundingClientRect();
    const tren = dongBox.top - khungBox.top;
    // Vùng đọc thoải mái: chừa 10% trên và 25% dưới. Dòng nằm trong đó thì để yên.
    if (tren >= khungBox.height * 0.1 && tren <= khungBox.height * 0.75) return;

    khung.scrollTo({
      top: khung.scrollTop + tren - khungBox.height / 3,
      behavior: "smooth",
    });
  }, [mucTieu, theoVach]);

  /**
   * Chọn NHIỀU DÒNG để cắn một miếng to hơn một cụm.
   *
   * Đây là thứ thay cho nút "Bỏ cả câu" vừa gỡ: nút đó nổi lên cùng lúc với nút
   * bỏ của từng dòng nên hay bấm nhầm, mà nó lại bó cứng vào ranh giới câu.
   * Chọn dải thì cắn được đúng miếng mình muốn — nửa câu, hai câu, hay cả đoạn.
   *
   * Giữ ở ĐÂY chứ không nhét vào `selection` chung: đây là trạng thái tạm của
   * riêng bảng này, còn `selection` là "đang sửa cái gì" cho cả màn.
   */
  const [neo, setNeo] = useState<string | null>(null);
  const [den, setDen] = useState<string | null>(null);
  // Gom chữ về câu chứa từ neo của nó. Chữ do người dùng tự thêm cũng vào đây —
  // nó cũng neo vào một khoảng từ, nên cũng thuộc một câu.
  const rowsBySentence = useMemo(() => {
    const map = new Map<string, TextElement[]>();
    for (const element of editor.textElements) {
      // Chữ TỰ DO không có mặt ở đây: một dòng = một cụm LỜI NÓI, mà tiêu đề
      // thì không chép lời ai. Nhét vào là lại phải bịa ra chỗ đặt ("dưới dòng
      // nào?") rồi dán đuôi "phủ mấy dòng" để chống chế — đúng vết xe của b-roll
      // vừa gỡ. Câu hỏi "tiêu đề nằm ở đâu" là câu hỏi về THỜI GIAN; dải trả lời.
      if (element.theoGio) continue;
      const sentenceId = editor.wordsById.get(element.fromWordId)?.sentenceId;
      if (!sentenceId) continue;
      const list = map.get(sentenceId);
      if (list) list.push(element);
      else map.set(sentenceId, [element]);
    }
    for (const list of map.values()) list.sort((a, b) => a.start - b.start);
    return map;
  }, [editor.textElements, editor.wordsById]);

  // Thứ tự đọc của các dòng — dải chọn tính theo thứ tự này, không theo id.
  const thuTu = useMemo(
    () =>
      editor.textElements
        .filter((item) => !item.theoGio)
        .sort((a, b) => a.start - b.start),
    [editor.textElements],
  );

  const dai = useMemo(() => {
    if (!neo || !den) return new Set<string>();
    const i = thuTu.findIndex((item) => item.id === neo);
    const j = thuTu.findIndex((item) => item.id === den);
    if (i === -1 || j === -1) return new Set<string>();
    return new Set(
      thuTu.slice(Math.min(i, j), Math.max(i, j) + 1).map((item) => item.id),
    );
  }, [neo, den, thuTu]);

  const chonDuoc = thuTu.filter((item) => dai.has(item.id));
  const boDai = async () => {
    if (chonDuoc.length === 0) return;
    const from = chonDuoc[0].start;
    const to = chonDuoc[chonDuoc.length - 1].end;
    setNeo(null);
    setDen(null);
    await editor.cutRange(from, to);
  };

  return (
    <Card className="min-h-80 lg:min-h-0">
      <CardHeader>
        <CardTitle>Bản chép lời</CardTitle>
        <CardAction>
          <Badge variant="secondary">{editor.words.length} từ</Badge>
        </CardAction>
      </CardHeader>
      {chonDuoc.length > 1 && (
        // Chỉ hiện khi thật sự có DẢI. Một dòng thì nút bỏ ngay trên dòng đó đã
        // đủ, thêm một thanh nữa chỉ là thêm một chỗ để phân vân.
        <div className="mx-4 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs">
          <span className="font-medium">
            Đã chọn {chonDuoc.length} dòng · {formatTime(chonDuoc[0].start)} →{" "}
            {formatTime(chonDuoc[chonDuoc.length - 1].end)}
          </span>
          <Button
            variant="secondary"
            size="xs"
            className="ml-auto"
            onClick={() => void boDai()}
          >
            Bỏ cả dải
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setNeo(null);
              setDen(null);
            }}
          >
            Thôi
          </Button>
        </div>
      )}
      <CardContent className="min-h-0 flex-1">
        {editor.sentences.length === 0 ? (
          <Empty>
            <EmptyTitle>Chưa có lời nào</EmptyTitle>
            <EmptyDescription>
              Dự án này chưa chép lời — bấm để máy nghe và ghi lại.
            </EmptyDescription>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              disabled={editor.transcribeJob?.status === "running"}
              onClick={() => void editor.startTranscribe()}
            >
              {editor.transcribeJob?.status === "running"
                ? (editor.transcribeJob.message ?? "Đang chép lời…")
                : "Chép lời"}
            </Button>
          </Empty>
        ) : (
          // Không thanh cuộn: mép dưới đã mờ dần để nói "còn nữa", mà danh sách
          // này thì lúc nào cũng dài hơn khung — nên thanh cuộn gần như luôn hiện
          // và thành một vạch xám đứng cạnh chữ suốt buổi dựng. Bỏ nó đi thì
          // cũng bỏ được luôn `pr-3` chừa chỗ cho nó, dòng rộng thêm 12px.
          <ScrollArea
            className="h-full"
            scrollbar={false}
            viewportClassName="scroll-fade-b"
          >
            <div ref={vungCuon} className="grid gap-1.5">
              {editor.sentences.map((sentence, index) => {
                // Khoảng lặng TRƯỚC câu này. Dưới một giây là nhịp thở, hiện ra
                // chỉ làm loãng danh sách; ngưỡng 4 giây ở hàng "Cần bạn xem"
                // giữ nguyên vì nó trả lời câu khác — "chỗ này dài bất thường".
                const truoc = editor.sentences[index - 1];
                const hoTruoc = truoc ? sentence.start - truoc.end : 0;
                return (
                  <div key={sentence.id} className="grid gap-1.5">
                    {hoTruoc >= 1 && truoc && (
                      <SilenceRow
                        start={truoc.end}
                        end={sentence.start}
                        editor={editor}
                      />
                    )}
                    {(() => (
                      <SentenceGroup
                        sentence={sentence}
                        rows={rowsBySentence.get(sentence.id) ?? []}
                        editor={editor}
                        activeTime={editor.time}
                        chonNhieu={dai}
                        onPick={(row, noiDai) => {
                          if (noiDai && neo) {
                            setDen(row.id);
                            return;
                          }
                          setNeo(row.id);
                          setDen(null);
                        }}
                      />
                    ))()}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
