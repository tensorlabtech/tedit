import { PlayIcon, Undo2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { formatTime } from "./editor-data";
import { demElement, type EditorState } from "./use-editor";

/**
 * Dấu ở mỗi CHỖ NỐI — nơi duy nhất nhìn thấy được thứ đã bị cắt.
 *
 * Vì sao là một DẤU bề rộng cố định chứ không phải một khối đỏ trải dài: dải vẽ
 * theo giờ XUẤT RA, mà trên giờ xuất ra một quãng đã bỏ có bề rộng đúng bằng 0 —
 * nó là một ĐIỂM, chỗ hai mảnh dán vào nhau. Vẽ nó thành khối có bề rộng là bịa
 * ra một quãng thời gian không tồn tại trong video, và mọi thứ đo trên dải sẽ nói
 * sai theo. Các trình dựng khác vẽ được bóng mờ phần đã cắt vì dải của chúng theo
 * giờ NGUỒN của từng khối; dải này thì không.
 *
 * Đây là đường duy nhất tới CHỖ GỌT. Đoạn bị bỏ ít nhất còn hiện trong bản chép
 * lời với nút "Giữ lại", còn chỗ gọt thì không thuộc đoạn nào nên không dòng nào
 * nói về nó — trước đây gọt xong chỉ còn cách hoàn tác hoặc kéo mép lại bằng mắt.
 */

/** Bề rộng phần VẼ. Cố định, không theo độ dài quãng đã bỏ — xem chú thích trên. */
const MARK_WIDTH = 3;
/** Bề rộng phần BẮT CHUỘT, nới đều hai bên phần vẽ cho đủ tầm ngón tay. */
const HIT_WIDTH = 24;
/**
 * Hai dấu gần nhau dưới chừng này pixel thì gộp thành một.
 *
 * Cắt lặng luôn chừa 0,45 giây giữa hai chỗ rút liền nhau, nên ở thang nhỏ nhất
 * (60px/giây) hai dấu còn cách 27px — quá thưa để phải gộp. Chỉ có mẩu giữ lại
 * rất ngắn giữa hai cú cắt mới dồn chúng lại, và lúc ấy hai vùng bắt chuột đè lên
 * nhau nên cái sau không bấm được.
 */
const MERGE_PX = 12;

type Cut = EditorState["cuts"][number];
type Group = { at: number; x: number; spans: Cut[] };

/** Gộp các dấu quá gần nhau, giữ nguyên thứ tự theo mốc. */
function groupMarks(cuts: Cut[], toOutput: (at: number) => number, px: number) {
  const groups: Group[] = [];
  for (const span of [...cuts].sort((a, b) => a.start - b.start)) {
    const at = toOutput(span.start);
    const x = at * px;
    const last = groups[groups.length - 1];
    if (last && x - last.x <= MERGE_PX) {
      last.spans.push(span);
      continue;
    }
    groups.push({ at, x, spans: [span] });
  }
  return groups;
}

/** Tổng thời lượng một nhóm đang giữ lại được. */
const groupSeconds = (group: Group) =>
  group.spans.reduce((total, span) => total + (span.end - span.start), 0);

export function SeamMarks({
  editor,
  pxPerSecond,
  onAudit,
}: {
  editor: EditorState;
  pxPerSecond: number;
  onAudit: (span: { start: number; end: number }) => void;
}) {
  const groups = groupMarks(editor.cuts, editor.toOutput, pxPerSecond);
  if (groups.length === 0) return null;

  return (
    // `pointer-events-none` ở lớp phủ, bật lại ở từng dấu: lớp này trải kín dải
    // nên để nó bắt chuột là chặn hết mọi cú bấm vào khối phim bên dưới.
    <div className="pointer-events-none absolute inset-0 z-20">
      {groups.map((group) => (
        <SeamMark
          key={group.spans.map((span) => span.id).join("+")}
          group={group}
          editor={editor}
          onAudit={onAudit}
        />
      ))}
    </div>
  );
}

function SeamMark({
  group,
  editor,
  onAudit,
}: {
  group: Group;
  editor: EditorState;
  onAudit: (span: { start: number; end: number }) => void;
}) {
  const seconds = groupSeconds(group);
  // Chữ và tư liệu đang bị GIAM trong các quãng này — chúng còn nguyên trong kho,
  // chỉ là lúc dựng không còn chỗ nào để hiện nên bị bỏ im lặng.
  const held = group.spans.reduce(
    (total, span) => total + demElement(editor, span.start, span.end),
    0,
  );
  // Hiệu ứng ĐẶT TAY vắt qua chỗ nối này. Nó tồn tại VÌ có cú nối — trả lại quãng
  // là cú nối biến mất, còn hiệu ứng nằm lại giữa một dòng nói liền mạch. Không
  // có lỗi nào báo ra, vì một cú zoom giữa câu vẫn là kết quả hợp lệ.
  const orphans = editor.effects.filter(
    (item) =>
      item.custom &&
      item.kind !== "none" &&
      item.outStart <= group.at + 0.01 &&
      item.outEnd >= group.at - 0.01,
  );

  const label =
    group.spans.length > 1
      ? `${group.spans.length} chỗ cắt`
      : group.spans[0].kind === "gap"
        ? "Mép đã gọt"
        : group.spans[0].label;

  const restore = async (dropEffects: boolean) => {
    if (dropEffects) {
      // Tắt chứ không xoá hàng: "không hiệu ứng" vốn là một KIỂU (`none`), nên đi
      // qua cùng một đường ghi và cùng một vết hoàn tác như mọi lần đổi kiểu.
      for (const item of orphans) await editor.setEffectKind(item.id, "none");
    }
    // Từ cuối lên đầu: trả lại một quãng làm mốc của các quãng sau xê dịch.
    for (const span of [...group.spans].sort((a, b) => b.start - a.start)) {
      await editor.removeCut(span.id);
    }
  };

  // Đỏ chỉ khi bên trong đang GIAM thứ gì. Cắt lặng là việc bình thường và đúng;
  // tô đỏ cả mười lăm chỗ thì bàn dựng trông như đang hỏng, và mắt chai với đỏ rồi
  // thì chỗ đáng chú ý thật cũng chìm theo.
  const tone = held > 0 ? "bg-destructive" : "bg-foreground/40";

  return (
    <Popover>
      {/* VẠCH và VÙNG BẤM tách làm hai vật, vì chúng cần hai chiều cao khác nhau:
          vạch chạy suốt dải cho dễ thấy, còn vùng bấm phải NÉ hai lớp đã có chủ —
          dải chữ chiếm 16px trên cùng (bấm vào là chọn cụm chữ), và tay nắm gọt mép
          chiếm 14px quanh mép của đoạn đang chọn suốt chiều cao. Khoảng ngay dưới
          dải chữ là chỗ duy nhất không tranh với ai. */}
      <span
        className={cn(
          "pointer-events-none absolute inset-y-0 rounded-full",
          tone,
        )}
        style={{ left: group.x - MARK_WIDTH / 2, width: MARK_WIDTH }}
      />
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`${label} · ${seconds.toFixed(1).replace(".", ",")}s`}
            // Vùng cuộn của dải bắt `pointerdown` để kéo-chạy-dải. Không chặn ở
            // đây thì bấm một dấu vừa mở bảng vừa kéo dải, và cú kéo ấy đặt
            // `drag.moved` nên lượt bấm sau bị coi là kéo chứ không phải bấm.
            onPointerDown={(event) => event.stopPropagation()}
            className="pointer-events-auto absolute top-4 grid h-4 cursor-pointer place-items-center"
            style={{ left: group.x - HIT_WIDTH / 2, width: HIT_WIDTH }}
          >
            {/* Núm phình ra ở giữa vạch — đủ để đọc ra "chỗ này bấm được", mà không
                to thành một khối trông như một mẩu phim có thật. */}
            <span
              className={cn("size-2 rounded-full ring-2 ring-card", tone)}
            />
          </button>
        }
      />
      <PopoverContent align="center" side="top" className="gap-2">
        <div className="grid gap-0.5">
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            {formatTime(group.at)} · đã cắt{" "}
            {seconds.toFixed(1).replace(".", ",")}s
            {held > 0 && ` · đang giam ${held} chữ/tư liệu`}
          </p>
        </div>

        {orphans.length > 0 && (
          <p className="text-xs text-destructive">
            Chỗ nối này có {orphans.length} hiệu ứng. Trả lại thì nó không còn
            chỗ nối nào để nhấn.
          </p>
        )}

        <div className="grid gap-1">
          <Button size="sm" onClick={() => void restore(orphans.length > 0)}>
            <Undo2Icon data-icon="inline-start" />
            {group.spans.length > 1
              ? `Trả lại cả ${group.spans.length} chỗ`
              : group.spans[0].kind === "gap"
                ? "Trả lại cho đoạn trước"
                : "Giữ lại đoạn này"}
            {orphans.length > 0 && " và tắt hiệu ứng"}
          </Button>
          {orphans.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void restore(false)}
            >
              Chỉ trả lại, giữ hiệu ứng
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onAudit({
                start: group.spans[0].start,
                end: group.spans[group.spans.length - 1].end,
              })
            }
          >
            <PlayIcon data-icon="inline-start" />
            Nghe thử phần đã cắt
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
