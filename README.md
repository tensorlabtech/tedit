# teddit-v2

Nền tảng UI dựng lại từ đầu: React 19 + Vite + Tailwind 4 + shadcn/ui (Base UI, preset **Nova**).

## Chạy

```bash
npm install
npm run dev:all          # web (5173) + API (5190)
npm run build            # tsc + vite build
npm run lint
npm run check:ownership  # kiểm luật phân quyền trên CSDL tạm
npm run check:style-pack # kiểm bất biến của bộ dáng chữ trên CSDL tạm
npm run check:upload     # tải lên cắt mảnh: ghép đúng, đứt rồi tải tiếp được
npm run check:fonts      # kiểm mọi font trong assets/fonts/ đủ dấu Việt
npm run check:layout     # quét 260 tổ hợp bố cục: chữ không bao giờ tràn khung
npm run check:graphics   # kho hình đồ hoạ: manifest, tệp dựng, kênh trong suốt
npm run check:all        # cả bảy lệnh trên — đúng thứ CI chạy
```

## Tải tệp lên

Tệp đi lên theo **giao thức tus**: cắt mảnh 8 MB, đứt ở đâu tải tiếp từ đó, và
mốc dở dang sống qua cả lần tải lại trang (`tus-js-client` ghi dấu vào
`localStorage`). Máy chủ ở `server/routes/upload-routes.ts`, màn nạp tệp gọi qua
`api.uploadFiles` như cũ — chữ ký không đổi.

**Cloudflare chối mọi thân request quá 100 MB.** Đo thật ngày 03/08/2026 trên
`tedit.tensorlab.tech`: 100 MB qua, 105 MB trả `413` sau khi mới nuốt ~2 MB. Gói
Free là vậy, và trang đang nấp sau Cloudflare nên đó là trần thật của mọi lượt
tải. Trước khi cắt mảnh thì một video quay bằng điện thoại — thường vài trăm MB —
không có đường nào lên tới máy chủ, mà triệu chứng còn tệ hơn cả một lỗi: XHR
không bắn `load` cũng không bắn `error`, nên thanh tiến độ đứng im ở vài phần
trăm cho tới khi người dùng bỏ cuộc. Mảnh 8 MB thì không bao giờ chạm trần đó.

Đường tải lên nằm dưới `/api/projects/<mã>/uploads/...` **có chủ đích**: luật
phân quyền theo đường dẫn ở `server/ownership.ts` phủ theo tiền tố nên nó tự
được canh. Mặc định của tus là `/api/uploads/<mã mảnh>` — một đường không khớp
mẫu nào, tức chỉ còn kiểm "đã đăng nhập chưa", và ai trong danh sách cho phép
cũng ghi đè được lượt tải của người khác.

Đường multipart cũ (`POST /api/projects/:id/files`) **giữ nguyên** cho công cụ
ngoài và tệp nhỏ. Cả hai đi chung `server/media-intake.ts` nên luật "tệp thế nào
thì bị chối" chỉ có một bản.

Mảnh của lượt bỏ ngang nằm ở `server/data/uploads/`, tự dọn sau 24 giờ.

## Kho hình đồ hoạ

```
assets/graphics/
├── src/            # SVG nguồn — nét TRẮNG, sinh từ scripts/graphics/make-shapes.mjs
├── png/            # PNG đã dựng — ĐI THEO GIT, xem lý do dưới
└── manifest.json   # loại hình, luật loại trừ
```

Ba tầng: **SVG (nguồn) → PNG (bản dựng) → tô màu lúc chạy**. Màu tách khỏi hình
nên MỘT hình dùng cho cả mười bộ dáng, mỗi bộ chỉ khai một mã màu — đó là thứ giữ
cho việc thêm một bộ dáng vẫn là sửa một bảng số, không thành thuê người vẽ.

```bash
npm run graphics:svg   # sinh lại SVG từ tham số
npm run graphics:png   # SVG → PNG, cần `brew install librsvg`
```

**PNG đi theo git, và SVG→PNG chỉ chạy lúc phát triển.** Đo được trên máy: cùng
một tệp SVG, `rsvg-convert` dựng đúng còn `magick` ra ảnh **đục 100%** — vẫn có
kênh trong suốt, vẫn đúng khổ, nên nó qua mọi phép kiểm hình thức mà video xuất ra
thì bị một khối màu phủ kín. Một phụ thuộc render âm thầm sai còn tệ hơn một phụ
thuộc thiếu hẳn, nên `graphics:png` **dừng hẳn** khi không có `rsvg-convert` thay
vì rơi về `magick`. Đổi lại: máy chủ không cần thêm phụ thuộc nào.

`check:layout` chạy `placeWords` thật trên 260 tổ hợp
`{độ dài câu} × {dải} × {căn} × {nhấn} × {vai chữ} × {10 bộ dáng}` rồi khẳng định
hai điều **cứng**: không tiếng nào ra ngoài dải an toàn, và không cụm nào quá trần
dòng. Ngoài ra nó so với `scripts/layout-guard/baseline.json` — lệch không tự nó
là sai, nhưng nó phải là thứ bạn chủ ý đổi. Đổi có chủ đích thì chạy
`npx tsx scripts/layout-guard/check-layout.ts --update` rồi commit tệp baseline
cùng lượt sửa.

`check:fonts` cần `python3` kèm `fontTools` (`pip install fonttools`) — cùng lớp
phụ thuộc với `ffmpeg`/`ffprobe`/`magick`, và CI phải có nó thì `check:all` mới
chạy được. Nó đọc bảng `cmap` của từng tệp `.ttf` chứ không nhìn ảnh: ffmpeg in ô
vuông rỗng khi thiếu glyph, mà ô vuông rỗng thu nhỏ trông y hệt một chữ đậm. Nó
cũng chặn font **biến thiên** chưa đông cứng — thứ mà mọi phép kiểm khác đều xanh
còn bản xuất thì ra chữ mảnh dính.

Mở `http://localhost:5173`. Chưa đăng nhập thì mọi đường dẫn đều chuyển về
`/login`.

## Đăng nhập

Đăng nhập bằng Google, phiên lưu trong cookie `httpOnly`. Chỉ email có trong
`TEDDIT_ALLOWED_EMAILS` vào được — **để rỗng là khoá sạch, không phải mở sạch**:
mỗi lượt dựng đều tiêu tiền thật nên hướng mặc định phải là đóng.

Chép `.env.example` sang `.env` rồi làm ba việc:

1. Sinh khoá ký phiên: `openssl rand -base64 32` → `BETTER_AUTH_SECRET`
2. Google Cloud Console → *APIs & Services* → *Credentials* → *Create
   credentials* → *OAuth client ID* → **Web application**. Trong
   **Authorized redirect URIs** khai đúng chuỗi này:

   ```
   http://localhost:5173/api/auth/callback/google
   ```

   Lấy client ID + secret về đặt vào `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
3. Thêm email của mình vào `TEDDIT_ALLOWED_EMAILS`.

Thiếu biến nào thì máy chủ **dừng ngay lúc khởi động** kèm tên biến còn thiếu —
cố ý như vậy: chạy tiếp với khoá phiên rỗng thì cookie ai cũng làm giả được, mà
nhìn bên ngoài máy chủ vẫn như đang chạy tốt.

Cổng `5173` chứ không phải `5190`: trình duyệt đứng ở Vite rồi Vite chuyển tiếp
`/api` và `/files` sang Fastify (`vite.config.ts`). Cookie phiên chỉ được gửi khi
trang và API **cùng một gốc**, và thẻ `<img>`/`<video>` thì không gắn được tiêu đề
nào — chúng chỉ mang cookie.

### Lúc chạy thật

Có `dist/` thì Fastify trả luôn bản build, nên trang và API cùng một gốc mà không
cần chuyển tiếp gì. Đường dẫn lạ trả `index.html` để React Router tự xử — trừ
`/api/` và `/files/` vẫn trả 404 thật, vì trả HTML cho một lời gọi API chỉ biến
"không có dữ liệu" thành lỗi phân tích JSON ở chỗ chẳng liên quan.

```bash
npm run build
BETTER_AUTH_URL=https://ten-mien-cua-ban node --import tsx server/main.ts
```

Fastify chỉ nghe `127.0.0.1:5190`; đặt Caddy/nginx trước để cắt HTTPS rồi chuyển
tiếp vào cổng đó. Đừng mở `0.0.0.0` — cookie phiên đi qua đường chưa mã hoá thì
ai chặn được đường truyền cũng đọc được.

`BETTER_AUTH_URL` dùng `https://` thì cookie tự bật cờ `secure`
(`USE_SECURE_COOKIES` ở `server/env.ts`) — suy từ địa chỉ công khai chứ không từ
giao thức của request, vì sau lớp chuyển tiếp thì Fastify chỉ thấy `http`.

Trong Google Console khai **cả hai** đường quay về, một cho máy mình một cho tên
miền — Google cho phép nhiều dòng:

```
http://localhost:5173/api/auth/callback/google
https://ten-mien-cua-ban/api/auth/callback/google
```

### Phân quyền

Dữ liệu chia theo `projects.owner_id`; mọi bảng khác đều có `project_id` nên suy
ra chủ của bất cứ hàng nào chỉ mất một join. Luật nằm gọn trong
`server/ownership.ts` và được áp ở **một** cổng (`server/auth-guard.ts`) theo dạng
đường dẫn, không rắc vào từng route — route thêm về sau mặc định đã bị khoá.

Dự án dựng trước khi có đăng nhập có `owner_id` rỗng nên **không hiện với ai**;
dữ liệu vẫn nằm trong CSDL.

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

## Đưa lên máy chủ

Chạy thật ở <https://tedit.tensorlab.tech> — Docker trên Ubuntu, edge Caddy
(`vas-printing-edge-1`) đứng trước và dùng chung VPS với stack khác.

Quy trình đầy đủ ở `.claude/skills/deploy/SKILL.md`. Tóm tắt hai bước:

```bash
# 1. Đẩy mã — từ MÁY PHÁT TRIỂN, đứng ở gốc repo, trên `main`.
#    Chạy một mình, đừng nối `&&` với lệnh khác ở phía máy local.
git archive --format=tar HEAD | ssh root@154.26.136.134 'cd /root/projects/tedit \
  && find . -mindepth 1 -maxdepth 1 ! -name ".env" ! -name ".env.bak.*" -exec rm -rf {} + \
  && tar x -C /root/projects/tedit'

# 2. Dựng và khởi động — TRÊN máy chủ, mất 3–8 phút
ssh root@154.26.136.134 'cd /root/projects/tedit && bash deploy/deploy.sh'

# bản mới hỏng thì lùi về ảnh của lượt trước
ssh root@154.26.136.134 'cd /root/projects/tedit && bash deploy/rollback.sh'
```

**`git archive` chứ không `git pull`, và máy chủ KHÔNG có `.git`.** Repo là private
mà tổ chức tắt deploy key, nên đường còn lại là đặt token lên máy chủ — máy này
dùng chung cho bảy dự án nên một token đọc-được-mọi-repo nằm ở đó không đáng.
`git archive` gửi đúng nội dung một commit, không cần credential nào trên server.
Đổi lại: muốn biết server đang chạy bản nào thì xem
`docker images tedit --format "{{.CreatedAt}}"`, không hỏi git được.

**Phải dọn trước khi giải nén.** `tar x` chỉ ghi đè chứ không xoá tệp đã biến mất
khỏi commit. Bỏ bước `find … rm` thì tệp đã gỡ vẫn sống trên server — đã dính
đúng lỗi này một lần.

`deploy.sh` gắn thẻ `tedit:rollback` cho ảnh đang chạy **trước** khi dựng ảnh mới,
`docker compose build && up -d`, nối container vào mạng của edge Caddy rồi chờ
`/api/health` trả 200 mới báo xong. Lượt đầu chờ lâu vì phải tải mô hình nghe
(~1,5 GB).

`rollback.sh` chỉ đổi ảnh, **không đụng volume** — dữ liệu người dùng không thuộc
về bản dựng nào cả.

Lượt đầu trên một máy mới phải làm tay: cài Docker, tạo `/root/projects/tedit`,
chép `.env.example` sang `.env` rồi điền (xem mục **Đăng nhập**), trỏ bản ghi A,
và khai đường quay về cho Google OAuth.

Hai chỗ đáng biết trong `deploy/docker-compose.yml`:

- **Tên stack khai tường minh là `tedit`.** Bỏ trống thì Docker lấy tên thư mục
  (`deploy`), mạng thành `deploy_default`, và edge Caddy nối vào `tedit_default`
  sẽ không tìm thấy gì — lỗi ấy chỉ lộ ra ở bước cuối khi trang trả 502.
- **Không có `ports:`.** Cổng 5190 chỉ mạng Docker nội bộ thấy; đường vào duy nhất
  là qua edge Caddy.

### Máy chủ còn sống không

```bash
curl -s https://tedit.tensorlab.tech/api/health
```

Không đòi đăng nhập, và kiểm ba thứ mà `/` không kiểm được: CSDL mở được, có đủ
`ffmpeg`/`ffprobe`/`magick`, và thư mục dữ liệu ghi được. Hỏng cái nào thì trả
`503` kèm tên phép kiểm — healthcheck của Docker dùng chính đường này.

`diskUsedPercent` và `diskLow` là **số để nhìn**, không kéo `ok` xuống: đĩa 90% thì
máy chủ vẫn chép lời và vẫn xuất video được, nên đánh nó thành hỏng chỉ tổ mời
người khác khởi động lại một máy đang khoẻ. Cảnh báo đi đường nhật ký.

**Máy chủ nghe bằng thư viện khác máy Mac.** mlx-whisper tính trên chip Metal của
Apple nên không cài được trên x86; `server/asr/transcribe.py` tự nhận ra và đổi
sang faster-whisper, cùng mô hình `large-v3-turbo`, cùng hình dạng dữ liệu trả
về. Tiếng nói vẫn không rời khỏi máy chủ. Đổi lại nó chạy trên CPU nên chậm hơn
đáng kể so với lúc thử ở máy — đó là cái giá của việc không gửi tiếng người dùng
đi đâu.

Sao lưu: mọi thứ nằm trong `server/data/` — `teddit.db` và các thư mục dự án.
Chép thư mục đó là chép được tất cả; không có trạng thái nào nằm ngoài nó.

## Kiến trúc

```
server/                   API Fastify + SQLite
├── main.ts               định tuyến HTTP
├── db.ts                 lược đồ và vá cột dần
├── pipeline.ts           chép lời và xuất video, chạy nền, báo qua bảng jobs
├── render.ts             ffmpeg: ghép · cắt · in chữ · chèn tư liệu · trộn nhạc
├── text-layout.ts        bẻ dòng và thu cỡ chữ cho vừa dải an toàn
├── style-pack.ts         KIỂU của một bộ dáng chữ + hàm dùng chung
├── style-pack-catalog.ts NĂM bộ dáng — dữ liệu, không phải logic
├── style-pack-store.ts   đọc bộ dáng của một dự án, rơi về bộ gốc
├── music-tags.ts         vốn từ ĐÓNG cho kho nhạc (ba trục)
├── insert-reveal.ts      cách tư liệu chèn hiện ra, dùng chung hai đường vẽ
├── junction-kinds.ts     vốn từ ĐÓNG cho chỗ nối — 18 kiểu, dùng chung ffmpeg và CSS
├── auto-grade.ts         đo hình rồi tự cân sáng/màu/nhiễu, biết khi nào nên im
├── auto-audio.ts         đo tiếng rồi tự cân độ to về -14 LUFS
├── ai-context.ts         bối cảnh dự án nối vào lời nhắc của các chặng AI
├── transcribe.ts         gọi máy nghe cục bộ, vá mốc từ bị dồn cục
└── asr/                  máy nghe cục bộ — mlx-whisper trên Mac,
                          faster-whisper trên máy chủ (whisper-large-v3-turbo)

assets/fonts/             font đóng gói theo repo (SIL OFL / Apache), KHÔNG lấy
                          font hệ thống — máy chủ Linux không có chúng

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
- **Tệp lên theo MẢNH, và mỗi lượt tải phải tự chết được.** Một request mang cả
  tệp có hai đường hỏng mà không đường nào báo: Cloudflare cắt ở 100 MB, và mạng
  rớt thì mất trắng phần đã gửi. Cả hai đều hiện ra y hệt nhau — thanh tiến độ
  đứng im, không lỗi, không hết giờ. Nên ngoài việc cắt mảnh còn có đồng hồ canh:
  90 giây không nhích byte nào là bỏ cuộc và nói ra. Thà báo sai một lần còn hơn
  để người dùng ngồi đợi mười lăm phút một thứ đã chết.
- **Tệp tải lên đi một lượt MỘT TỆP.** Năm lượt song song chia nhau cùng một
  đường lên nên cả năm cùng bò; tuần tự thì ô đầu xong sớm và người dùng thấy
  ngay là mọi thứ đang tiến. Thứ tự cảnh không dựa vào hàng đợi này — mỗi lượt
  vẫn gửi kèm `order` của nó, vì "truyền trước" và "đứng trước trong phim" là hai
  chuyện khác nhau.
- **Cắt = toàn bộ trừ phần bị bỏ**, không phải hợp của phần giữ lại. Lấy hợp thì
  mọi quãng nghỉ giữa câu cũng bị cắt và người xem nghe ra một tràng dồn dập.
- **`amix` phải có `normalize=0`.** Mặc định nó chia đều biên độ cho số luồng nên
  thêm nhạc nền lại làm giọng nói nhỏ đi 6dB.
- **`trim`/`atrim` + `concat`, không dùng `select`/`aselect`.** Đo thật thấy
  `aselect` với biểu thức nhiều khoảng bỏ khung hình đúng nhưng không cắt tiếng.
- **Ảnh tĩnh chèn phải `-loop 1` và dịch mốc**, không thì chỉ hiện một khung ở giây 0.
- **Đo bề rộng chữ bằng ImageMagick với đúng tệp font sẽ in**, không ước lượng
  theo số ký tự — "IIIII" và "mmmmm" cùng 5 ký tự nhưng rộng gấp đôi nhau.
- **Bộ dáng chữ nằm trong MỘT cột trên `projects`, không nằm trong `elements`.**
  Nhờ vậy đổi bộ dáng chỉ đổi phần VẼ: nội dung và bố cục người dùng đã chỉnh
  tay không bị đụng, nên không cần dialog xác nhận và không cần luật giữ/đè.
  Giữ được điều đó là nhờ cả năm bộ dáng khai `defaults` giống hệt nhau —
  `npm run check:style-pack` canh đúng chỗ ấy.
- **Chỉ có MỘT khai báo cho mỗi con số dáng chữ**, ở `server/style-pack.ts`, và
  cả máy chủ lẫn trang xem cùng import nó. Chép sang là có bản thứ hai để lệch,
  mà lệch giữa hai đường vẽ là lỗi "xem một đằng xuất một nẻo" —
  `scripts/overlay-parity/` bắt được nó mà không cần đăng nhập.
