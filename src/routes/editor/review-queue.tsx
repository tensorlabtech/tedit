import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  EarIcon,
  MicIcon,
  TriangleAlertIcon,
  EyeOffIcon,
  FilmIcon,
  LayersIcon,
  PauseIcon,
  ClapperboardIcon,
  SquarePenIcon,
  SparklesIcon,
  TypeIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";

import { findStylePack } from "../../../server/style-pack-catalog";
import { OpeningHookPane } from "./opening-hook-pane";
import { api } from "@/lib/api";

import { formatTime } from "./editor-data";
import type { EditorState, Selection } from "./use-editor";

/** Ngưỡng chốt ở đặc tả §9: chỉ báo khoảng lặng RẤT dài, không báo nhịp nghỉ. */
const LONG_SILENCE = 4;
/** Số dòng tối đa đọc kịp trong lúc xem video ngắn. */
/** Trần dòng của bản in ra — máy chủ chặn cứng ở đây (xem `server/text-layout.ts`). */
const MAX_LINES = 3;

/**
 * Loại lời nhắc — quyết định biểu tượng và sắc màu của dòng.
 *
 * Trước đây mọi dòng đều một biểu tượng cảnh báo tròn và một sắc xám: bốn loại
 * việc khác hẳn nhau (nghe nhầm / chữ tràn khung / lặng quá lâu / tư liệu rơi
 * vào chỗ chuyển cảnh) mà nhìn ra một khối chữ đồng nhất, phải đọc hết tiêu đề
 * mới biết đang nhắc chuyện gì.
 */
type IssueKind =
  | "unsure"
  | "caption"
  | "silence"
  | "insert"
  | "overlap"
  | "mismatch"
  | "style-changed"
  | "opening";

type Issue = {
  id: string;
  kind: IssueKind;
  title: string;
  detail: string;
  time: number;
  selection: Selection;
  /**
   * Việc CẦN LÀM ở dòng này, nếu có một việc rõ ràng.
   *
   * Hàng soát báo "lặng 2,4 giây" mà không có nút nào bỏ nó thì người dùng phải tự
   * tìm sang dải, tự tách hai đầu, tự bỏ đoạn giữa — báo mà không giúp làm.
   */
  fix?: { label: string; icon: React.ReactNode; run: () => void };
  /**
   * Từ trong lời chép mà lời nhắc này nói về — có nó thì hàng soát cho sửa
   * NGAY TẠI CHỖ, không phải sang bảng sửa chữ.
   *
   * Vì sao cần: sửa ở bảng sửa là sửa cả CỤM, mà máy chủ chỉ ghi ngược vào lời
   * chép khi số tiếng còn khớp. Gõ "TensorLab" thay cho "Tenso Lab" là 5 tiếng
   * cho 6 từ — lời chép giữ nguyên hai từ cũ, nên lời nhắc "nghe không chắc"
   * còn nguyên và người dùng chỉ còn cách bấm "chữ này đúng" cho một chữ mà máy
   * nghe SAI thật.
   */
  word?: { id: string; text: string };
};

type Measured = { lines: number; truncated: boolean; needsSplit: boolean };

/**
 * Tiếng LẤP hay gặp ở đầu video tiếng Việt.
 *
 * Danh sách ngắn và chỉ soi ba tiếng đầu: dài ra thì nó bắt cả những câu mở
 * bình thường, và một lời nhắc hiện với mọi video là một lời nhắc không ai đọc.
 */
const FILLER_OPENERS = ["ừm", "à", "ờ", "ừ", "thì", "kiểu", "ok", "okay"];

/**
 * Quãng im trước tiếng nói đầu tiên, từ mức này trở lên mới tính là RÀO ĐÓN.
 *
 * 1,2 giây chứ không phải 0,35: gần như video nào cũng có vài phần mười giây
 * hít vào trước khi nói, nên ngưỡng thấp làm dòng nhắc hiện với MỌI video — và
 * một lời nhắc hiện với mọi video là một lời nhắc không ai đọc nữa. Trên một
 * giây thì người xem đã kịp thấy màn hình đứng im, đó mới là thứ đáng bỏ.
 *
 * Vẫn thấp hơn `LONG_SILENCE` (4 giây) rất nhiều: quãng im GIỮA video có thể là
 * nhịp nghỉ có chủ ý, còn quãng im ở NGAY ĐẦU thì không bao giờ là.
 */
const DEAD_LEAD_IN = 1.2;

function buildIssues(
  editor: EditorState,
  measurements: Record<string, Measured>,
): Issue[] {
  const issues: Issue[] = [];

  // MỘT DÒNG cho MỖI từ, không gộp: gộp lại thì bấm "Xem" chỉ tới cái đầu, còn
  // những cái sau không có đường nào tới được.
  //
  // Bấm "Xem" mở thẳng CỤM CHỮ chứa từ đó — nơi duy nhất sửa chữ. Trước đây nó
  // chọn riêng một "từ" và mở một khung sửa thứ hai chỉ để sửa đúng một chữ:
  // hai đường sửa cho cùng một việc, và người dùng phải nhớ đường nào ở đâu.
  for (const word of editor.words.filter((item) => item.unsure)) {
    const sentence = editor.sentences.find(
      (item) => item.id === word.sentenceId,
    );
    const group = editor.textElements.find(
      (item) => word.start >= item.start - 0.01 && word.end <= item.end + 0.01,
    );
    issues.push({
      id: `unsure-${word.id}`,
      kind: "unsure",
      title: `Nghe không chắc: “${word.text}”`,
      // Việc cần làm ở đây là TRẢ LỜI, không phải "bỏ qua".
      //
      // Máy nghe sai thì sửa ở bản chép lời — sửa xong cờ ngờ vực tự hạ. Máy
      // nghe đúng thì trước đây không có đường nào nói với nó điều đó: "Bỏ qua"
      // chỉ giấu dòng nhắc, còn gạch chấm dưới chữ nằm lại vĩnh viễn và lần mở
      // sau nó nhắc lại y nguyên. Hai chỗ nói hai điều khác nhau về một chữ.
      fix: {
        label: "Chữ này đúng — máy nghe không sai",
        icon: <CheckIcon />,
        run: () => void editor.confirmWord(word.id),
      },
      // Trích NGẮN và bỏ mấy chữ nối ("trong câu", cặp ngoặc kép): dòng phụ chỉ
      // để định vị, mà nó xuống hai dòng thì cả hàng soát đọc ra một khối chữ.
      detail: sentence
        ? `${formatTime(word.start)} · ${sentence.text.slice(0, 30)}…`
        : formatTime(word.start),
      time: word.start,
      word: { id: word.id, text: word.text },
      selection: group ? { kind: "text", id: group.id } : null,
    });
  }

  // Chữ tràn khung: lấy KẾT QUẢ ĐO của máy chủ, không đoán theo số ký tự. Máy
  // chủ đo bằng đúng tệp font sẽ in, còn đếm ký tự thì "IIIII" và "mmmmm" cùng
  // 5 ký tự nhưng rộng gấp đôi nhau.
  for (const element of editor.textElements) {
    const measured = measurements[element.id];
    if (!measured) continue;
    const from = editor.wordsById.get(element.fromWordId);
    // Máy chủ chặn cứng ở 3 dòng, nên "quá dài" chỉ còn một dạng: dài hơn mức
    // ba dòng chứa được. Cách sửa là TÁCH thành hai chữ ngắn, không phải co chữ —
    // nói luôn việc cần làm, đừng chỉ báo là có vấn đề.
    if (measured.needsSplit || measured.truncated) {
      issues.push({
        id: `overflow-${element.id}`,
        kind: "caption",
        title: `Dài hơn ${MAX_LINES} dòng — nên tách thành hai chữ`,
        detail: element.content,
        time: from?.start ?? 0,
        selection: { kind: "text", id: element.id },
      });
    }
  }

  // Bản chép lời chạy DÀI HƠN video — nghĩa là nó được chép trên một bản ghép
  // khác với bản đang có.
  //
  // Xảy ra khi tệp video đổi sau lúc chép lời (thêm, bớt, hoặc dựng lại bản
  // ghép). Mọi thứ neo vào từ đều lệch theo, và bản xuất ra sai mà không chỗ nào
  // báo. Đây là lời nhắc DUY NHẤT không sửa được bằng tay — phải chép lại.
  const sentenceEnd = editor.sentences.at(-1)?.end ?? 0;
  if (editor.duration > 0 && sentenceEnd > editor.duration + 1) {
    issues.push({
      id: "lech-loi",
      kind: "mismatch",
      title: "Bản chép lời không khớp video",
      detail: `lời chạy tới ${formatTime(sentenceEnd)} trong khi video chỉ dài ${formatTime(editor.duration)}`,
      time: editor.duration,
      selection: null,
      fix: {
        label: "Chép lời lại — mọi thứ neo vào lời sẽ được đặt lại theo",
        icon: <MicIcon />,
        run: () => void editor.startTranscribe(),
      },
    });
  }

  // Chữ ĐÈ chữ trên khung hình. Khung sửa đã cảnh báo ngay dưới nút "Chỗ đặt";
  // dòng này là để bắt lại lúc SOÁT CUỐI — lúc đó người dùng không còn nhớ mình
  // đã dời cái nào xuống đâu.
  const reported = new Set<string>();
  for (const element of editor.textElements) {
    for (const other of editor.deLenNhau(element)) {
      const keyword = [element.id, other.id].sort().join("|");
      if (reported.has(keyword)) continue;
      reported.add(keyword);
      issues.push({
        id: `overlap-${keyword}`,
        kind: "overlap",
        title: "Chữ đè lên chữ",
        detail: `${formatTime(element.start)} · “${element.content || "chữ trống"}” và “${other.content || "chữ trống"}”`,
        time: element.start,
        selection: { kind: "text", id: element.id },
      });
    }
  }

  const ordered = [...editor.sentences].sort((a, b) => a.start - b.start);
  ordered.forEach((sentence, index) => {
    const next = ordered[index + 1];
    if (!next) return;
    const gap = next.start - sentence.end;
    if (gap < LONG_SILENCE) return;
    issues.push({
      id: `silence-${sentence.id}`,
      kind: "silence",
      title: `Lặng ${gap.toFixed(1)} giây`,
      detail: `sau câu ${formatTime(sentence.start)}`,
      time: sentence.end,
      selection: null,
      // Bỏ quãng lặng = tách đoạn ở hai đầu rồi bỏ đoạn giữa. Vẫn là ĐOẠN, nên
      // trả lại được ở ngay khung "Sẽ không vào video".
      fix: {
        label: "Bỏ quãng lặng này khỏi video",
        icon: <EyeOffIcon />,
        run: () => void editor.cutRange(sentence.end, next.start),
      },
    });
  });

  for (const [index, insert] of editor.inserts.entries()) {
    const onCut = editor.clips.some(
      (clip) => Math.abs(clip.start - insert.start) < 0.4,
    );
    if (!onCut) continue;
    issues.push({
      id: `insert-${insert.id}`,
      kind: "insert",
      title: "Tư liệu rơi đúng chỗ chuyển cảnh",
      // Kèm số thứ tự: hai tư liệu khác nhau cùng giờ và cùng loại thì nhãn rút
      // gọn ra giống hệt nhau ("Video · 0:00"), và hàng soát đọc ra như bị lặp.
      detail: `${insert.label} #${index + 1} · ${formatTime(insert.start)}`,
      time: insert.start,
      selection: { kind: "insert", id: insert.id },
    });
  }

  // BA GIÂY ĐẦU.
  //
  // Chỉ hiện khi ba giây đầu CÓ DẤU HIỆU RÀO ĐÓN — quãng im trước lời thật, hoặc
  // mở bằng một tiếng lấp. Video mở đầu gọn mà vẫn bị nhắc thì hàng soát thành
  // chỗ nhắc cho đủ, và người dùng học được cách không đọc nó nữa.
  //
  // Không chấm điểm: hook hay hay không thì máy không đo được, mà một con số bịa
  // ở đây làm hỏng lòng tin vào mọi con số khác đang bày ra.
  const opening = editor.words.filter((word) => word.start < 3);
  const firstWord = editor.words[0];
  const hedging =
    firstWord &&
    (firstWord.start >= DEAD_LEAD_IN ||
      FILLER_OPENERS.some((filler) =>
        opening
          .slice(0, 3)
          .some((word) => word.text.toLowerCase().replace(/[.,…]/g, "") === filler),
      ));
  if (firstWord && hedging) {
    issues.push({
      id: "opening-hook",
      kind: "opening",
      title: "3 giây đầu",
      detail: opening.map((word) => word.text).join(" ") || "…",
      time: 0,
      selection: null,
    });
  }

  // Đổi bộ dáng SAU khi máy đã đặt hiệu ứng.
  //
  // Không tự đặt lại — hiệu ứng và tư liệu chèn là những vật nằm trên dải, người
  // dùng nhìn thấy chúng và có thể đã sắp lại bằng tay. Chỉ mời, và lời mời có
  // đúng MỘT câu trả lời: bấm là đặt lại, bỏ qua là dòng biến mất hẳn.
  //
  // Chỉ hiện khi ĐÃ có hiệu ứng: chưa có gì thì không có gì để đặt lại, và một
  // lời nhắc về việc không tồn tại là nhiễu.
  if (
    editor.effectsStylePack &&
    editor.effectsStylePack !== editor.stylePack &&
    editor.manualEffects.length + editor.inserts.length > 0
  ) {
    const pack = findStylePack(editor.stylePack);
    issues.push({
      id: `style-changed-${editor.stylePack}`,
      kind: "style-changed",
      title: `Dáng mới thiên về nhịp khác`,
      detail: `“${pack.label}” · ${Math.round(pack.rhythm.junctionShare * 100)}% chỗ nối · b-roll ${pack.rhythm.brollEverySec}s một lần`,
      time: 0,
      selection: null,
      fix: {
        label: "Đặt lại hiệu ứng theo dáng mới",
        icon: <SparklesIcon />,
        run: () => void editor.redoEffects(),
      },
    });
  }

  // Xếp theo MỨC NẶNG trước, rồi mới theo thời gian.
  //
  // Xếp thuần theo thời gian thì "bản chép lời không khớp video" — thứ làm hỏng
  // cả bản xuất — nằm lẫn dưới năm chục dòng "nghe không chắc" và không ai thấy.
  // Lời nhắc mà không nhắc được thì bằng không có.
  const severity: Record<IssueKind, number> = {
    mismatch: 0,
    overlap: 1,
    // Lời mời đặt lại hiệu ứng đứng TRÊN mấy lời nhắc lặt vặt: nó nói về cả
    // video chứ không về một cụm, và nó chỉ sống tới khi người dùng trả lời.
    // "3 giây đầu" đứng gần đầu: nó nói về thứ quyết định người xem có ở lại
    // hay không, mà mọi lời nhắc khác đều nói về một cụm ở giữa video.
    opening: 2,
    "style-changed": 3,
    caption: 4,
    insert: 5,
    silence: 6,
    unsure: 7,
  };
  return issues.sort(
    (a, b) => severity[a.kind] - severity[b.kind] || a.time - b.time,
  );
}

const KIND_ICON: Record<IssueKind, React.ReactNode> = {
  unsure: <EarIcon />,
  caption: <TypeIcon />,
  silence: <PauseIcon />,
  overlap: <LayersIcon />,
  mismatch: <TriangleAlertIcon />,
  insert: <FilmIcon />,
  "style-changed": <SparklesIcon />,
  opening: <ClapperboardIcon />,
};

/**
 * Danh sách việc cần soát, và cách bỏ qua một việc.
 *
 * Tách khỏi phần dựng hình vì cột phải cần biết CÓ BAO NHIÊU việc trước khi
 * quyết định dựng tab hay không — mà đếm bằng cách dựng ra rồi đọc thì đã muộn.
 */
export function useReviewIssues(editor: EditorState) {
  const [measurements, setMeasurements] = useState<Record<string, Measured>>(
    {},
  );

  /**
   * Chỉ đo những chữ CHƯA đo, không đo lại cả danh sách.
   *
   * Mỗi phép đo là một lượt gọi máy chủ chạy ImageMagick bằng đúng tệp font sẽ
   * in. Hồi chữ chỉ do người dùng đặt tay thì đo lại tất cả cũng chỉ là dăm bảy
   * lượt. Từ khi lời nói sinh thẳng ra chữ thì một video một phút đã có sáu bảy
   * chục chữ — sửa một chữ mà bắn đi sáu chục lượt đo là máy chủ đứng hình.
   */
  const measuredRef = useRef(new Set<string>());
  const wanted = editor.textElements
    .map(
      (element) =>
        `${element.id}|${element.position}|${element.content}|${editor.stylePack}`,
    )
    .join("§");

  useEffect(() => {
    let alive = true;
    for (const element of editor.textElements) {
      // Bộ dáng nằm trong khoá nhớ: đổi bộ dáng là cỡ chữ và chỗ bẻ dòng đổi
      // theo, nên số đo cũ không còn đúng nữa.
      const key = `${element.id}|${element.position}|${element.content}|${editor.stylePack}`;
      if (measuredRef.current.has(key)) continue;
      measuredRef.current.add(key);
      void api
        .layoutText(element.content, element.position, editor.projectId)
        .then((layout) => {
          if (!alive) return;
          setMeasurements((current) => ({
            ...current,
            [element.id]: {
              lines: layout.lines.length,
              truncated: layout.truncated,
              needsSplit: layout.needsSplit,
            },
          }));
        })
        .catch(() => {
          // Đo hỏng thì bỏ khỏi sổ để lần sau còn thử lại.
          measuredRef.current.delete(key);
        });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  // Danh sách đã bỏ qua nằm ở MÁY CHỦ (`editor.dismissed`), không ở đây: hàng
  // soát dựng lại từ dữ liệu mỗi lần mở dự án, nên nhớ trong bộ nhớ màn hình thì
  // tải lại là lời nhắc mọc lại y nguyên.
  const daBo = editor.dismissed;
  const issues = useMemo(
    () =>
      buildIssues(editor, measurements).filter(
        (issue) => !daBo.includes(issue.id),
      ),
    [editor, measurements, daBo],
  );

  return { issues, boQua: (id: string) => void editor.boQuaIssue(id) };
}

export function ReviewQueue({
  editor,
  issues,
  onBoQua,
  onPreview,
}: {
  editor: EditorState;
  issues: Issue[];
  onBoQua: (id: string) => void;
  /** Nghe thử một quãng — dùng lại đúng đường mà bảng sửa đang dùng. */
  onPreview: (at: number, until?: number) => void;
}) {
  /** Mã từ đang mở ô sửa — mỗi lúc chỉ một, như mọi ô sửa khác của bàn dựng. */
  const [editingWord, setEditingWord] = useState<string | null>(null);
  // Ba đường xử lý của "3 giây đầu" cần diện tích và cần xem thử được, nên
  // chúng nằm trong một Dialog chứ không nhét vào một dòng cao 36px.
  const [openingOpen, setOpeningOpen] = useState(false);
  return (
    <Card className="h-full min-h-0">
      <OpeningHookPane
        open={openingOpen}
        onOpenChange={setOpeningOpen}
        editor={editor}
        onPreview={onPreview}
        onDone={() => onBoQua("opening-hook")}
      />
      <CardHeader>
        <CardTitle>Cần bạn xem</CardTitle>
        <CardAction>
          <Badge variant="secondary">{issues.length}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        {issues.length === 0 ? (
          // Một dòng chữ thay vì khối trạng thái rỗng: ở màn thấp thẻ này chỉ
          // được chia chừng 100px, khối rỗng cao hơn thế là tràn ra ngoài.
          <p className="text-xs text-muted-foreground">
            {editor.sentences.length === 0
              ? "Chưa có gì để soát — chép lời xong máy mới đo được"
              : "Máy đã đo và không thấy chỗ nào cần xem lại"}
          </p>
        ) : (
          <ScrollArea className="h-full" viewportClassName="scroll-fade-b">
            <ItemGroup className="pr-3">
              {issues.map((issue) => (
                // CẢ HÀNG là nút "Xem" — đó là việc người ta muốn làm ở mọi
                // dòng: nhảy tới chỗ đó và mở nó ra để sửa. Trước đây nó là một
                // nút chữ riêng đứng cạnh nút "Bỏ qua", nên mỗi dòng có hai
                // đích bấm nhỏ và bốn chữ thừa, còn thân dòng thì không bấm được
                // dù nó chiếm chín phần mười bề ngang.
                <Item
                  key={issue.id}
                  size="sm"
                  className="cursor-pointer hover:bg-accent/60"
                  render={
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (issue.kind === "opening") {
                          setOpeningOpen(true);
                          return;
                        }
                        editor.seek(issue.time);
                        editor.setSelection(issue.selection);
                      }}
                    />
                  }
                >
                  {/* Biểu tượng RIÊNG cho từng loại — bốn loại việc khác nhau
                      thì phải nhìn ra khác nhau trước khi đọc chữ. HÌNH nói
                      loại, không phải màu: hồi thử tô mỗi loại một ô màu pastel
                      thì ba dòng cùng loại thành ba viên kẹo xếp hàng, mà cột
                      này vốn là chỗ báo việc chứ không phải chỗ trang trí. */}
                  <ItemMedia variant="icon" className="text-muted-foreground">
                    {KIND_ICON[issue.kind]}
                  </ItemMedia>
                  <ItemContent>
                    {/* Đang sửa thì ô nhập THAY CHO tiêu đề, không mọc thêm một
                        dòng: hàng soát vốn đã dày, thêm dòng là cả cột nhảy. */}
                    {issue.word && editingWord === issue.word.id ? (
                      <WordInput
                        defaultValue={issue.word.text}
                        onDone={(text) => {
                          setEditingWord(null);
                          const clean = text.trim();
                          if (clean && clean !== issue.word?.text) {
                            void editor.updateWord(issue.word!.id, clean);
                          }
                        }}
                      />
                    ) : (
                      <ItemTitle className="truncate">{issue.title}</ItemTitle>
                    )}
                    {/* MỘT dòng, cắt cụt. Cho nó xuống dòng thì ba lời nhắc đã
                        đủ dựng thành một bức tường chữ. */}
                    <ItemDescription className="truncate">
                      {issue.detail}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {/* Sửa THẲNG từ trong lời chép — câu trả lời còn lại cho
                        "máy nghe sai". Sửa xong thì cờ ngờ vực tự hạ và lời nhắc
                        biến mất, không phải bấm "chữ này đúng" cho một chữ sai. */}
                    {issue.word && editingWord !== issue.word.id && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        tooltip="Sửa chữ này trong bản chép lời"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingWord(issue.word!.id);
                        }}
                      >
                        <SquarePenIcon />
                      </Button>
                    )}
                    {/* Việc cần làm cũng là một BIỂU TƯỢNG có chú thích, như
                        nút bỏ qua bên cạnh. Một nút chữ đứng giữa hàng thì mỗi
                        dòng lại rộng hẹp một kiểu tuỳ câu chữ dài ngắn, và cột
                        hành động không còn thẳng hàng để mắt lướt. Câu chữ vào
                        chú thích thì nói được dài hơn mà không tốn chỗ. */}
                    {issue.fix && (
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        tooltip={issue.fix.label}
                        onClick={(event) => {
                          event.stopPropagation();
                          issue.fix?.run();
                        }}
                      >
                        {issue.fix.icon}
                      </Button>
                    )}
                    {/* Loại "nghe không chắc" KHÔNG có nút bỏ qua: nút "Chữ
                        này đúng" đã là câu trả lời, và nó hạ hẳn cờ ngờ vực chứ
                        không chỉ giấu dòng nhắc. Bày cả hai thì thành hai nút
                        gần giống nhau mà kết quả khác hẳn. */}
                    {issue.kind !== "unsure" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        tooltip="Bỏ qua lời nhắc này"
                        onClick={(event) => {
                          event.stopPropagation();
                          onBoQua(issue.id);
                        }}
                      >
                        <XIcon />
                      </Button>
                    )}
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Ô sửa một TỪ, nằm ngay trong hàng soát.
 *
 * Ô trần như ô sửa cụm chữ ở bảng Lời: cùng cỡ chữ, cùng dòng, không viền —
 * chuyển sang sửa thì hàng không nhúc nhích một pixel nào.
 */
function WordInput({
  defaultValue,
  onDone,
}: {
  defaultValue: string;
  onDone: (text: string) => void;
}) {
  const [draft, setDraft] = useState(defaultValue);
  return (
    <input
      autoFocus
      type="text"
      value={draft}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onDone(draft)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") onDone(draft);
        // Esc là BỎ: trả lại đúng chữ cũ, không ghi gì.
        if (event.key === "Escape") onDone(defaultValue);
      }}
      className="w-full border-0 bg-transparent p-0 text-sm leading-snug outline-none"
    />
  );
}
