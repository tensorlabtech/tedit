# teddit-v2

Nền tảng UI dựng lại từ đầu: React 19 + Vite + Tailwind 4 + shadcn/ui (Base UI, preset **Nova**).

## Chạy

```bash
npm install
npm run dev     # http://localhost:5173 → tự chuyển sang /_dev/design-system
npm run build   # tsc + vite build
npm run lint
```

## Cấu trúc

```
src/
├── components/ui/          # 60 component shadcn — cài bằng CLI, chưa tuỳ biến
├── hooks/use-mobile.ts
├── lib/utils.ts
├── dev/design-system/      # trang tra cứu component
│   ├── design-system-page.tsx
│   ├── section-registry.ts     # gom các nhóm component
│   ├── section-showcase.tsx    # khung trình bày một component
│   ├── showcase-types.ts
│   └── sections/               # demo theo nhóm: buttons, form, overlay, menu...
└── main.tsx                # router + Toaster + TooltipProvider
```

## Design system

`/_dev/design-system` liệt kê đủ 60 component, mỗi component có nhiều trường hợp: variant,
size, trạng thái (disabled / invalid / loading), hướng hiển thị, nội dung dài. Nút chuyển
sáng/tối nằm ở thẻ Danh mục.

Bố cục là lưới bento phủ hết bề ngang: mọi khối đều là `Card` — thẻ tiêu đề trang, thẻ danh
mục (dính mép trái khi cuộn), thẻ nhãn nhóm và từng thẻ component. Mỗi nhóm có lưới riêng nên
ô của nhóm này không lọt sang nhóm khác. Bề rộng ô khai báo trong `section-spans.ts` (1–3 cột);
ô càng rộng thì các trường hợp bên trong càng tự chia nhiều cột nhờ container query.

Quy tắc UI của dự án nằm ở `CLAUDE.md` — đọc trước khi dựng màn mới.

## Quy ước đã tuỳ biến so với bản shadcn gốc

**Nút chỉ có icon tự có tooltip** — `Button` với `size="icon*"` và `aria-label` sẽ tự dựng
tooltip từ chính nhãn đó, nên nhãn và tooltip không bao giờ lệch nhau. Đừng bọc `Tooltip` tay ở
nơi gọi; nếu buộc phải bọc thì truyền `tooltip={false}` để khỏi lồng hai tooltip.

**Bề rộng Slider đặt được ở chỗ gọi** — bản gốc để `data-horizontal:w-full`, mà lớp có
điều kiện luôn thắng lớp thường nên `className="w-24"` ở chỗ gọi không có tác dụng và mọi
thanh trượt đều kéo hết bề ngang. Nay bề rộng nằm ở lớp thường, hướng dọc tự cởi bằng
`data-vertical:w-auto`.

**Mép mờ chỉ hiện khi thật sự còn nội dung** — `scroll-fade-b` là `mask-image`
thuần CSS nên bản gốc che mờ 1.5rem cuối kể cả khi nội dung vừa đủ chỗ, và dòng
cuối bị làm nhạt như một lỗi vẽ. `ScrollArea` tự đo bằng `ResizeObserver` rồi đặt
`data-overflowing`; không tràn thì `mask-image: none`.

**Hướng cuộn của ScrollArea** — `orientation="vertical" | "horizontal" | "both"` (mặc định
dọc). Bản gốc chỉ vẽ thanh cuộn dọc, nên vùng cuộn ngang — dải cảnh ở `/upload` chẳng hạn —
trôi đi mà không có gì báo là còn nữa.

**Màu các tầng của dải thời gian** — `--lane-text` / `--lane-insert` / `--lane-music`
(kèm `-foreground`; `--lane-word` giữ lại cho dải từ đã gỡ) khai trong `src/index.css` cho cả sáng lẫn tối. Bàn dựng chỉ gọi
`bg-lane-*`, không tự pha màu tại chỗ. Lý do chọn từng màu: `docs/editor-interaction-spec.md` §12.

**Con trỏ** — mọi thứ bấm được là `cursor: pointer`, thứ bị khoá là `cursor: not-allowed`,
khai báo một lần trong `@layer base` của `src/index.css`.

**Đổi giao diện** — `ThemeToggle` (Sáng / Tối / Hệ thống) ở thẻ tiêu đề trang; lựa chọn lưu vào
`localStorage`, để "Hệ thống" thì bám theo cài đặt máy và đổi ngay khi máy đổi.
Lớp `dark` do `ThemeProvider` ở `main.tsx` đặt, không do cái nút đặt: trước đây
`useTheme` chỉ chạy trong `ThemeToggle` — mà nút đó chỉ có ở trang design system —
nên mọi trang thật đều đứng nguyên màu sáng kể cả khi máy để chế độ tối.


**Thang chiều cao control** — `xs 28 · sm 32 · default 40 · lg 44` (px). Mọi thứ đứng cùng
hàng với nút đều theo thang này: Input, Textarea, Select, Native Select, Input Group, Command,
Combobox, Toggle, Tabs, Menubar, Navigation Menu, Sidebar, Input OTP, Pagination. Ô ngày của
Calendar 32px, hàng tiêu đề Table 48px. Cỡ chữ giữ nguyên — chỉ khoảng thở tăng lên.

**Mục trong danh sách nổi cao 36px** — mục của Dropdown / Context Menu / Menubar / Select /
Combobox / Command / Navigation Menu đều `py-2 px-3`, popup đệm `p-2`. Đệm nằm ở
**vỏ popup**, không ở nhóm bên trong — trước đây `Select` đặt ở `SelectGroup` nên
dùng `SelectContent > SelectItem` trực tiếp thì chữ dính sát mép.

**Đệm ngang control** — nút `xs 10 · sm 12 · default 16 · lg 20` (px), ô nhập và select 12px,
ô bảng 12px. Đủ thở hai bên chữ thay vì dính sát mép.

**Đệm khối chứa nội dung** — Card 20px (bản `sm` 16px, đổi qua `--card-spacing`), Dialog /
Alert Dialog / Sheet / Drawer 20px, Popover / Hover Card 16px, Alert 16×12px, vùng preview
trong trang design system 20px. Cùng một thang nên các khối lồng nhau không lệch mép.

**Màu chủ đạo tím mận** — `--primary`, `--ring`, `--sidebar-primary` và dải `--chart-*` trong
`src/index.css`, khai báo riêng cho nền sáng và nền tối. Đổi tông khác chỉ cần sửa các token
này, không đụng tới component.

**Phân cấp nền: một bậc màu, còn lại là viền** — nền trang → card lệch nhẹ; từ trong card trở đi
là card đè card, tách bằng viền nhạt chứ không đổi mảng màu. Chi tiết ở `CLAUDE.md`.

**Không bày thanh cuộn** — vùng cuộn nội bộ (danh mục, vùng preview, bảng tràn ngang) dùng
`no-scrollbar`; chỉ Scroll Area và Message Scroller giữ thanh vì cuộn là chính công năng của
chúng.

**Chữ không đậm ở thành phần tương tác** — nút, tab, toggle, badge, nhãn form, nhãn menu,
mục sidebar, tiêu đề dòng trong danh sách đều dùng `font-normal`. Chỉ tiêu đề khối giữ
`font-medium`: `CardTitle`, `DialogTitle`, `AlertDialogTitle`, `SheetTitle`, `DrawerTitle`,
`EmptyTitle`, `PopoverTitle`, `AlertTitle`, `ToastTitle` — để còn phân cấp thị giác.

Chạy lại `shadcn add` cho một component sẽ ghi đè hai quy ước này, nhớ kiểm diff trước khi nhận.

## Thêm component

```bash
npx shadcn@latest add <tên>
```

Cấu hình nằm ở `components.json` (`style: base-nova`, `baseColor: neutral`, icon `lucide`).
Thêm component mới thì thêm demo tương ứng vào `src/dev/design-system/sections/` và khai báo
trong `section-registry.ts`.

Token màu, bán kính, font nằm trong `src/index.css` (do `shadcn init` sinh ra).

## Chạy sản phẩm

```bash
npm run dev:all     # web 5180 + API 5190
```

Lần đầu cần cài môi trường nhận dạng giọng nói (chạy cục bộ, không cần khoá API):

```bash
cd server/asr && uv pip install --target pylibs mlx-whisper
```

Cần sẵn `ffmpeg`, `ffprobe`, `magick` trong PATH.

## Kiến trúc

```
server/            API Fastify + SQLite
├── main.ts        định tuyến HTTP
├── db.ts          lược đồ và vá cột dần
├── pipeline.ts    chép lời và xuất video, chạy nền, báo qua bảng jobs
├── render.ts      ffmpeg: ghép · cắt · in chữ · chèn tư liệu · trộn nhạc
├── text-layout.ts bẻ dòng và thu cỡ chữ cho vừa dải an toàn
├── transcribe.ts  gọi mlx-whisper, vá mốc từ bị dồn cục
└── asr/           mlx-whisper cục bộ (model whisper-large-v3-turbo)

src/routes/
├── projects/      danh sách dự án
├── upload/        nhận tệp, phân vai trò, sắp thứ tự, tiến độ
└── editor/        bản chép lời · xem trước · dải thời gian · bảng sửa
```

Dữ liệu nằm ở `server/data/`: `teddit.db` và `projects/<id>/{media,thumbs,work,out}`.
Tiếng nói của người dùng không rời khỏi máy.

## Quyết định đáng nhớ

- **Phần tử gắn vào KHOẢNG TỪ, không gắn vào giây.** Bỏ một câu phía trước thì
  mọi thứ phía sau vẫn dính đúng chỗ, không phải tính lại mốc.
- **Cắt = toàn bộ trừ phần bị bỏ**, không phải hợp của phần giữ lại. Lấy hợp thì
  mọi quãng nghỉ giữa câu cũng bị cắt và người xem nghe ra một tràng dồn dập.
- **`amix` phải có `normalize=0`.** Mặc định nó chia đều biên độ cho số luồng nên
  thêm nhạc nền lại làm giọng nói nhỏ đi 6dB.
- **`trim`/`atrim` + `concat`, không dùng `select`/`aselect`.** Đo thật thấy
  `aselect` với biểu thức nhiều khoảng bỏ khung hình đúng nhưng không cắt tiếng.
- **Ảnh tĩnh chèn phải `-loop 1` và dịch mốc**, không thì chỉ hiện một khung ở giây 0.
- **Đo bề rộng chữ bằng ImageMagick với đúng tệp font sẽ in**, không ước lượng
  theo số ký tự — "IIIII" và "mmmmm" cùng 5 ký tự nhưng rộng gấp đôi nhau.
