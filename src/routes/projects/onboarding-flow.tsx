import { useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * ONBOARDING lần đầu — PHỦ FULL MÀN, theo BƯỚC, CHỌN là chính.
 *
 * Vì sao không phải một modal ba ô trống: bắt gõ tay cả ba là ai cũng bấm Bỏ qua.
 * Các sản phẩm tốt (Figma, Notion, Canva) hỏi 2-4 câu mà phần lớn là BẤM CHỌN —
 * completion rớt hơn nửa nếu quá 5 bước. Nên:
 * · Bước 1 (ngành) & 2 (kiểu video): bấm chip, không gõ.
 * · Bước 3: hai ô CHÚ THÍCH cho AI — giới thiệu kênh (dựng sát ý hơn) và từ
 *   chuyên ngành/tên riêng (chép đúng). Cả hai để trống cũng được.
 *
 * KHÔNG nói "tên riêng hay bị nghe sai": người mới chưa dựng video nào thì chưa
 * gặp lỗi nghe sai bao giờ — hỏi thế là hỏi thứ họ chưa có. Nói thẳng cái LỢI:
 * ghi vào để AI chép đúng.
 *
 * Phủ full màn (không nằm trong khung có thanh bên): đây là việc MỘT lần, đáng
 * một khoảng riêng để nhìn; không thích thì Bỏ qua ở góc, luôn có.
 */

const NICHES = [
  "Lập trình / Công nghệ",
  "Kinh doanh / Khởi nghiệp",
  "Tài chính / Đầu tư",
  "Marketing",
  "Giáo dục / Kỹ năng",
  "Nấu ăn",
  "Làm đẹp / Thời trang",
  "Sức khoẻ / Tập luyện",
  "Game",
  "Du lịch",
  "Đời sống / Tâm sự",
  "Giải trí",
];

const KINDS = [
  "Hướng dẫn",
  "Chia sẻ / Tâm sự",
  "Review",
  "Vlog",
  "Kể chuyện",
  "Tin tức / Phân tích",
];

export type OnboardDraft = {
  trade: string;
  names: string;
  videoKind: string;
  profile: string;
};

export function OnboardingFlow({
  onDone,
}: {
  onDone: (patch: OnboardDraft) => void;
}) {
  const [step, setStep] = useState(0);
  const [niches, setNiches] = useState<Set<string>>(new Set());
  const [nicheOther, setNicheOther] = useState("");
  const [kinds, setKinds] = useState<Set<string>>(new Set());
  const [intro, setIntro] = useState("");
  const [terms, setTerms] = useState("");

  const compose = (): OnboardDraft => ({
    trade: [...niches, nicheOther.trim()].filter(Boolean).join(", "),
    videoKind: [...kinds].join(", "),
    names: terms.trim(),
    profile: intro.trim(),
  });

  const steps = [
    {
      title: "Kênh của bạn về gì?",
      hint: "Chọn một hay vài mảng — để máy nhấn đúng từ, chọn đúng tư liệu.",
      body: (
        <div className="grid gap-3">
          <ChipGroup
            options={NICHES}
            selected={niches}
            onToggle={(v) => setNiches((prev) => toggle(prev, v))}
          />
          <Input
            value={nicheOther}
            onChange={(e) => setNicheOther(e.target.value)}
            placeholder="Mảng khác — gõ vào nếu chưa có ở trên"
          />
        </div>
      ),
    },
    {
      title: "Thường làm kiểu video nào?",
      hint: "Chọn kiểu hay làm nhất — máy dựng theo đúng nhịp của kiểu đó.",
      body: (
        <ChipGroup
          options={KINDS}
          selected={kinds}
          onToggle={(v) => setKinds((prev) => toggle(prev, v))}
        />
      ),
    },
    {
      title: "Kể máy nghe đôi lời — để AI dựng sát ý bạn hơn",
      hint: "Cả hai đều tuỳ. Bỏ trống cũng bắt đầu được ngay.",
      body: (
        <div className="grid gap-5">
          <Field>
            <FieldLabel htmlFor="ob-intro">
              Giới thiệu ngắn về bạn / kênh
            </FieldLabel>
            <Textarea
              id="ob-intro"
              className="min-h-24 resize-none"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="vd: Mình là dev frontend 5 năm, kênh chia sẻ nghề và mẹo làm việc. Hay nói nhanh, xưng “mình”."
            />
            <FieldDescription>
              AI đọc để hiểu bạn là ai, giọng thế nào — sửa lời và dựng bám ý
              hơn.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="ob-terms">
              Từ chuyên ngành, tên riêng
            </FieldLabel>
            <Textarea
              id="ob-terms"
              className="min-h-20 resize-none"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="vd: TensorLab, Golang, Redis, K8s, tên bạn"
            />
            <FieldDescription>
              Không có ngữ cảnh thì máy dễ chép sai tên lạ — liệt kê ở đây là nó
              chép đúng ngay từ video đầu.
            </FieldDescription>
          </Field>
        </div>
      ),
    },
  ];

  const last = step === steps.length - 1;
  const current = steps[step]!;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      {/* Bỏ qua LUÔN CÓ ở góc: onboarding là tuỳ, không được nhốt người ta trong
          đó. Bấm là lưu những gì đã chọn tới lúc này rồi vào thẳng. */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-5 right-5 text-muted-foreground"
        onClick={() => onDone(compose())}
      >
        Bỏ qua
      </Button>

      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-10 px-6 py-16">
        {/* Đầu màn căn GIỮA — logo, vạch bước, câu hỏi. Neo cả khoảng trống phía
            trên cho đỡ chông chênh, và cân với "Bỏ qua" bên phải. */}
        <div className="flex flex-col items-center gap-7">
          <img
            src="/logo.svg"
            alt=""
            aria-hidden
            className="size-12 shrink-0"
          />
          <div className="flex w-full items-center gap-2">
            {steps.map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  index <= step ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>
          <div className="grid gap-2 text-center">
            <h2 className="font-heading text-xl font-medium">
              {current.title}
            </h2>
            <p className="text-sm text-muted-foreground">{current.hint}</p>
          </div>
        </div>

        {current.body}

        <div className="flex items-center justify-between gap-2">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeftIcon data-icon="inline-start" />
              Quay lại
            </Button>
          ) : (
            <span />
          )}
          <Button
            size="lg"
            onClick={() => (last ? onDone(compose()) : setStep(step + 1))}
          >
            {last ? (
              <>
                <CheckIcon data-icon="inline-start" />
                Xong, bắt đầu
              </>
            ) : (
              <>
                Tiếp
                <ArrowRightIcon data-icon="inline-end" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function toggle(set: Set<string>, value: string) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Lưới chip bấm-chọn. Chọn/bỏ bằng cách bấm; nhiều cái cùng lúc cũng được. */
function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = selected.has(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(option)}
            className={cn(
              "cursor-pointer rounded-full px-3.5 py-2 text-sm transition-colors",
              on
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/70",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
