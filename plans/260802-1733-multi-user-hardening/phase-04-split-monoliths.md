# Chặng 04 — Tách hai tệp khổng lồ

**Ưu tiên:** P1 · **Trạng thái:** ⬜ chưa làm — **cố ý dừng** · **Phụ thuộc:** chặng 01 (cần CI)

> ## Vì sao dừng
>
> Đây là chặng duy nhất mà công cụ kiểm hiện có KHÔNG đủ. `typecheck` chỉ chứng
> minh mã biên dịch được, không chứng minh route còn nguyên hành vi; `check:ownership`
> và `check:style-pack` không chạm tới route nào. Xác nhận thật đòi mở bàn dựng
> bấm hết một luồng — mà đó là việc cần ứng dụng chạy và người nhìn.
>
> Thử một lượt cắt tự động: script cắt theo mẫu dòng `});` bỏ sót **6 trên 53**
> route trong im lặng — đúng rủi ro "route bị bỏ sót lúc chuyển" ghi ở bảng dưới.
> Bản cắt theo cân ngoặc sau đó bắt đủ 53, nhưng phần khó không nằm ở đó (xem
> Groundwork).
>
> Refactor 1961 + 3170 dòng trên một ứng dụng ĐANG phục vụ nhiều người, không có
> test hành vi, làm vội thì tệ hơn để nguyên. Làm nó trong một phiên riêng, có
> ứng dụng chạy.

## Groundwork đã có (2026-08-02)

Bản đồ miền, đo trên `main.ts` 1961 dòng — 53 route, 1506 dòng thân route:

| Miền | Route | Dòng |
|---|---|---|
| projects | 12 | 542 |
| elements | 5 | 288 |
| files | 4 | 195 |
| music | 5 | 106 |
| transcript | 3 | 105 |
| settings | 2 | 95 |
| library | 4 | 81 |
| segments | 6 | 63 |
| jobs | 4 | 59 |
| media | 2 | 38 |

**Phần khó không phải cắt, mà là import.** `tsconfig` bật `noUnusedLocals` nên
không chép nguyên khối import sang từng tệp được; phải giải đúng tên nào tệp nào
cần. Đường đi được: sinh tệp với đủ import, chạy `tsc`, rồi gỡ theo danh sách
TS6133 nó trả về — lặp tới khi sạch.

**Trạng thái cấp module mà route dùng chung** — ít, và mỗi thứ thuộc đúng một miền:

- `VIDEO` / `IMAGE` / `AUDIO` (`main.ts:210-212`) — files, library, music
- `seedDefaultCaptionStyle`, `mergeDismissedUnsureIssues` — projects
- `MIN_TEXT_LENGTH` — elements
- `startJob` — jobs; giờ chỉ còn một dòng bọc `enqueue`, bỏ hẳn được

**Bẫy đã phát hiện:** `main.ts:211` khai `IMAGE = /\.(jpe?g|png|webp|heic)$/i`,
còn `asset-library.ts:25` khai `IMAGE = /\.(jpe?g|png|webp|heic|gif)$/i` — **khác
nhau ở `gif`**. Nghĩa là `.gif` vào được kho chung nhưng KHÔNG vào được thẳng một
dự án. Trỏ tệp route mới sang bản export sẵn của `asset-library` là lặng lẽ đổi
hành vi upload. Phải dựng `server/routes/media-formats.ts` giữ đúng giá trị của
`main.ts`, rồi xử lý chuyện lệch này thành một việc RIÊNG — nó là một lỗi nhỏ có
thật, không phải phần của cú refactor.

`server/main.ts` 1863 dòng / ~55 route và `src/routes/editor/use-editor.ts` 3164
dòng. Tách theo miền, **không đổi một hành vi nào**.

## Bối cảnh

- Báo cáo mục 7 · `CLAUDE.md` (quy tắc 200 dòng)

## Nhận định then chốt

**`use-editor.ts` nặng hơn `main.ts`.** Dòng 488 mở `useEditor` và hàm đó chạy tới
hết tệp — **2676 dòng trong một hook**, với 79 lượt gọi `useState`/`useEffect`/`useCallback`.
Mọi lần chạm vào bàn dựng đều phải đọc lại nó. Đây là tệp đáng tách trước.

**`main.ts` tách dễ hơn nhiều** vì phân quyền không nằm trong route. `authGuard`
(`main.ts:132`) chặn theo tiền tố đường dẫn ở tầng `onRequest`, nên chuyển một
route sang tệp khác **không** làm nó mất phép kiểm. Đó chính là món quà mà thiết
kế "một cổng" ở `server/ownership.ts` để lại — tách file ở đây rẻ bất thường.

**Không có test hành vi.** Lưới an toàn duy nhất là `typecheck` + `check:ownership`
+ `check:style-pack` (chặng 01). Nên nguyên tắc là **chỉ di chuyển, không sửa**:
mỗi lần đưa một nhóm route sang tệp mới thì nội dung handler phải giống hệt, khác
đúng phần `import`.

## Yêu cầu

1. Không đổi đường dẫn, mã trạng thái, hình dạng dữ liệu trả về của bất kỳ route nào.
2. `authGuard` vẫn đăng ký ở một chỗ, trước `fastifyStatic` — thứ tự này là điều kiện an toàn, không phải sở thích (`main.ts:128-138`).
3. Mỗi tệp mới dưới 250 dòng.
4. `useEditor` giữ nguyên chữ ký và hình dạng giá trị trả về, để các component dùng nó không phải sửa.

## Kiến trúc

### Máy chủ

```
server/
├── main.ts                 khởi tạo Fastify, đăng ký hook + plugin, listen   (~120 dòng)
└── routes/
    ├── projects-routes.ts    projects, opening-lines, dismissed, effects, zoom-punch
    ├── files-routes.ts       upload, raw, patch, delete
    ├── library-routes.ts     kho tư liệu + kho nhạc dùng chung
    ├── music-routes.ts       nhạc trong một dự án
    ├── transcript-routes.ts  words, sentences, layout
    ├── segments-routes.ts    segments, skipped
    ├── elements-routes.ts    elements, captions
    ├── media-routes.ts       envelope, filmstrip
    ├── jobs-routes.ts        transcribe, retry, export, jobs/:kind
    └── settings-routes.ts    settings
```

Mỗi tệp xuất một plugin Fastify `export default async function (app: FastifyInstance)`.
`main.ts` `await app.register(...)` từng cái, **sau** `authGuard`.

### Bàn dựng

```
src/routes/editor/
├── use-editor.ts            gom các hook con, trả về đúng hình dạng cũ   (~200 dòng)
├── use-editor-transcript.ts bản chép lời, sửa từ, sửa câu
├── use-editor-timeline.ts   dải thời gian, thu phóng, kéo thả
├── use-editor-elements.ts   phần tử chữ, tư liệu chèn, hiệu ứng
├── use-editor-jobs.ts       hai vòng hỏi tiến độ (`:2308`, `:2796`)
└── use-editor-music.ts      nhạc nền
```

Trạng thái dùng chung (`data`, `projectId`, `reload`) nằm ở `use-editor.ts` và
truyền xuống làm tham số — **không** dựng Context mới. Context sẽ đổi ranh giới
render và đó là đổi hành vi, đúng thứ chặng này cấm.

## Các bước

1. **Máy chủ trước** — dễ hơn và tách bạch hơn. Mỗi lần **một** tệp: cắt nhóm
   route sang, `register`, chạy `npm run check:all`, commit. Mười lần commit nhỏ,
   không phải một lần lớn.
2. Bắt đầu bằng `settings-routes.ts` (2 route) để định hình khuôn, rồi tới
   `jobs-routes.ts` (4 route, đã chạm ở chặng 02 nên còn nhớ rõ).
3. Để `projects-routes.ts` sau cùng — nó lớn nhất và đan xen nhiều nhất.
4. **Bàn dựng sau.** Cũng từng hook một: `use-editor-jobs.ts` trước (nhỏ, ranh giới
   rõ, vừa sửa ở chặng 02), rồi `use-editor-music.ts`, `use-editor-timeline.ts`,
   `use-editor-elements.ts`, `use-editor-transcript.ts`.
5. Sau mỗi lần tách: `npm run build` và **mở bàn dựng bấm thử** — chép lời, sửa
   một từ, kéo một phần tử, xuất video. Typecheck không bắt được lỗi thứ tự hook.

## Todo

- [ ] `server/routes/settings-routes.ts` (khuôn mẫu)
- [ ] `jobs-routes.ts`
- [ ] `media-routes.ts`
- [ ] `transcript-routes.ts`
- [ ] `segments-routes.ts`
- [ ] `elements-routes.ts`
- [ ] `music-routes.ts`
- [ ] `library-routes.ts`
- [ ] `files-routes.ts`
- [ ] `projects-routes.ts`
- [ ] `main.ts` còn lại chỉ khởi tạo + đăng ký + listen
- [ ] `use-editor-jobs.ts`
- [ ] `use-editor-music.ts`
- [ ] `use-editor-timeline.ts`
- [ ] `use-editor-elements.ts`
- [ ] `use-editor-transcript.ts`
- [ ] `use-editor.ts` chỉ còn gom hook

## Xong khi

- `wc -l server/*.ts server/routes/*.ts src/routes/editor/*.ts` — không tệp nào vượt 250 dòng (trừ `render.ts`, `pipeline.ts`, `db.ts` ngoài phạm vi chặng này).
- `npm run check:all` và `npm run build` xanh.
- Đi hết một luồng thật trên bản build: tải video → chép lời → sửa từ → thêm phần tử → xuất video.

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Tách hook làm đổi thứ tự gọi hook → React vỡ trạng thái | Tách theo **nhóm state độc lập**, không tách giữa chừng một chuỗi phụ thuộc. `react/rules-of-hooks` đã bật trong `.oxlintrc.json` |
| Route bị bỏ sót lúc chuyển | Đếm route trước và sau: `grep -c 'app\.\(get\|post\|put\|patch\|delete\)'` phải bằng nhau |
| Đăng ký plugin sai thứ tự → mất `authGuard` | `authGuard` là `onRequest` hook trên **instance gốc**, các plugin đăng ký sau đều thừa hưởng. Vẫn phải thử: gọi một route bất kỳ khi chưa đăng nhập, phải là 401 |
| Commit lớn khó lần ngược | Mỗi tệp một commit, mỗi commit `check:all` xanh |

## Tiếp theo

Chặng 05 — [Chia nhỏ bundle](phase-05-bundle-splitting.md). Ranh giới route sau
khi tách sẽ chỉ luôn chỗ đặt `React.lazy`.
