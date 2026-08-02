# Chặng 06 — Dọn vặt & nhất quán

**Ưu tiên:** P2 · **Trạng thái:** ⬜ chưa làm · **Phụ thuộc:** không (làm xen kẽ lúc nào cũng được)

Tên định danh tiếng Việt, escape drawtext, sao lưu trước migration, và mấy chỗ
phòng thủ chiều sâu. Mỗi mục độc lập — làm được cái nào hay cái đó.

## Bối cảnh

- Báo cáo mục 10, 13, 14, 15, 16, 18, 19

## 6.1 — Tên định danh tiếng Việt

`CLAUDE.md` của dự án: *"Dùng full Tiếng Anh nhé (tên hàm, biến, đường dẫn, ... tất
cả mọi thứ), chỉ có cái text hiện lên UI là tiếng Việt thôi"*. Chỗ đang lệch:

| Vị trí | Hiện tại | Đổi thành |
|---|---|---|
| `server/style-pack-catalog.ts:114` | `GOC` | `BASE_PACK` |
| `server/render.ts:307` | `dai` | `duration` |
| `server/main.ts:890` | `trung` | `duplicates` |
| `server/auto-audio.ts:69,71` | `tomTat`, `nhan` | `summary`, `label` |
| `server/auto-grade.ts:124` | `dai` | `range` |
| `server/pipeline.ts:600,632,712` | `duLieuChuyenCanh`, `tongDaCat`, `cheoTai`, `canh`, `tuCan`, `canHinh`, `doHinh` | tên tiếng Anh tương ứng |
| `server/asset-library.ts:204`, `server/music-library.ts:182` | `thu` | `candidate` |
| `src/components/media-picker-dialog.tsx:193` | `chinh` | `primary` |
| `server/asr/transcribe.py:113` | `so_luong` | `thread_count` (chặng 02 đã chạm dòng này) |
| `scripts/` | `kiem-chuyen-canh.ts`, `kiem-junction.ts`, `kiem-junction-spans.ts`, `thu-boi-canh.ts`, `thu-can-hinh.ts`, `thu-can-tieng.ts`, `thu-cuoi-cung.ts` | `check-*.ts`, `try-*.ts` |

`GOC` đáng làm trước: nó được **export** và dùng ở nhiều tệp, nên càng để lâu càng
lan.

**Chỉ đổi tên, không đổi logic.** Đổi tên tệp trong `scripts/` nhớ tìm cả chỗ tham
chiếu trong tài liệu (`docs/`, `README.md`, `plans/`).

**Không đụng chú thích tiếng Việt** — chúng đúng quy tắc và là tài sản của dự án.

## 6.2 — Escape drawtext đang sửa nội dung người dùng

`server/render.ts:99` — `.replace(/'/g, "’")`. Caption `don't` in ra thành `don’t`.
Với tiếng Việt hiếm gặp nên chưa ai kêu, nhưng đây là im lặng đổi chữ người dùng
gõ.

Đường sạch hơn: dùng `textfile=` thay cho `text=` của `drawtext`. Nội dung đi qua
tệp thì **không còn bài toán escape nào** — bỏ được cả bốn phép `replace` ở
`render.ts:96-101`.

Ràng buộc: mỗi tiếng là một lệnh `drawtext` riêng (`render.ts:994`), nên sẽ thành
nhiều tệp tạm. Đặt dưới `workDir(projectId)` và dọn cùng lúc dọn thư mục `work/`.
**Đo lại một lượt xuất video và so từng khung với bản cũ** trước khi nhận — đây là
đường vẽ chính của sản phẩm.

Nếu số tệp tạm quá lớn thì giữ nguyên cách hiện tại nhưng escape `'` cho đúng thay
vì thay ký tự. Ghi rõ lý do vào chú thích.

## 6.3 — Sao lưu trước migration phá huỷ

`server/db.ts:534-543` — `DROP TABLE elements` rồi `RENAME`. Có transaction nên an
toàn về mặt CSDL, nhưng logic dựng cột sai thì dữ liệu cũ đã đi. `docker-compose.yml`
tự ghi chú: mất volume này là mất tất cả, không tái tạo lại được.

Thêm vào đầu khối rebuild: chép `DB_PATH` sang `teddit.db.bak-<epoch>` bằng
`copyFileSync`, giữ 3 bản gần nhất. Ba dòng, và nó bảo hiểm cho thứ không mua lại
được.

## 6.4 — Phòng thủ chiều sâu ở lớp phân quyền

**Kiểm `..` trên đường dẫn chưa giải mã** — `server/ownership.ts:139`:
`if (path.includes(".."))`. `path` là `request.url.split("?")[0]`, còn nguyên
percent-encoding, nên `%2e%2e%2f` lọt qua phép kiểm này.

`@fastify/static` gần như chắc chắn chặn sau khi giải mã (thư viện `send` có
`UP_PATH_REGEXP`), nên **chưa chứng minh được đây là lỗ**. Nhưng phép kiểm đang
dựa vào hành vi thư viện thay vì tự đứng vững — mà cả tệp `ownership.ts` được viết
theo tinh thần ngược lại.

Sửa: giải mã (trong try/catch) rồi mới kiểm `..`.

**`decodeURIComponent` không bọc try** — `ownership.ts:84` và `:150`. `%` lạc ném
`URIError` → 500 thay vì 400. Bọc rồi ném `AccessError(404)` cho đồng nhất.

**Kiểm thử kèm theo:** thêm hai trường hợp vào `server/ownership-check.ts` —
`%2e%2e%2f` và `%zz`. Script đó đã có sẵn và chạy trong CI từ chặng 01, nên chỗ
này sẽ được canh mãi về sau.

## 6.5 — Tệp dở dang khi upload vỡ

`server/main.ts:668` — `await pipeline(part.file, createWriteStream(target))` không
nằm trong `try`. `@fastify/multipart` vượt `fileSize` sẽ ném, và tệp đã ghi một
phần nằm lại trong `media/` không ai dọn. Cũng không ai kiểm `part.file.truncated`.

Sửa: bọc `try`, `unlink(target).catch(() => {})` ở nhánh lỗi — đúng cách mà
`main.ts:691` và `:704` đang làm cho hai nhánh lỗi khác. Kiểm `part.file.truncated`
sau khi ghi xong, coi như tệp hỏng.

## 6.6 — Tài liệu

- `docs/` thiếu `codebase-summary.md`, `system-architecture.md`, `deployment-guide.md`
  theo cấu trúc đã khai trong `CLAUDE.md`. Phần lớn nội dung đã nằm trong `README.md`
  — nên là **tách ra và trỏ tới**, không viết lại từ đầu.
- `docs/example.webp` 485 KB: nén hoặc đưa ra ngoài repo (chặng 01 đã có todo này).

## Todo

- [x] 6.1 `GOC` → `BASE_PACK` (20 chỗ, 7 tệp)
- [x] 6.1 Định danh còn lại: `dai`→`duration`/`spread`, `trung`→`duplicates`,
      `tomTat`→`summary`, `nhan`→`label`, `thu`→`candidate`, `canh`→`graded`,
      `tuCan`→`autoGradeWanted`, `tongDaCat`→`keptTotal`, `cheoTai`→`crossFadedAudio`,
      `duLieuChuyenCanh`→`buildCrossAt`, `canhTieng`→`gradedAudio`, `noi`→`joins`,
      `bien`→`bounds`, `so_luong`→`thread_count`
- [x] 6.1 **Thêm ngoài plan** — hàm được export: `canHinh`→`gradeImage`,
      `doHinh`→`measureImage`, `canTieng`→`levelAudio`, `doTieng`→`measureAudio`
- [x] 6.1 `chinh` → `primary` trong `media-picker-dialog.tsx`
- [x] 6.1 Đổi tên 7 tệp `scripts/kiem-*`, `scripts/thu-*` + sửa chỗ tham chiếu
- [ ] 6.2 **CHƯA LÀM** — `textfile=` (xem dưới)
- [x] 6.3 Sao lưu CSDL trước khối rebuild `elements`
- [x] 6.4 Giải mã trước khi kiểm `..`; bọc `decodeURIComponent`
- [x] 6.4 Thêm **ba** trường hợp vào `ownership-check.ts` (24 → 27 đạt)
- [x] 6.5 Dọn tệp dở dang + kiểm `truncated`
- [x] 6.6 `docs/codebase-summary.md` + `docs/system-architecture.md` — viết phần BỔ SUNG cho README (bản đồ tệp, luồng request, ba lớp khoá, vòng đời việc nặng), không chép lại lý do đã có ở README
- [x] 6.6 ~~Nén `docs/example.webp`~~ — bỏ, xem chặng 01

### 6.2 vì sao chưa làm — kèm ba thứ đo được

Đã thử dựng phép so bằng ffmpeg trên máy. Kết quả:

1. **`textfile=` vẽ ra khung Y HỆT `text=`** với cùng nội dung — SSIM `1.000000`,
   `inf`. Nên bản thân cú đổi không làm lệch hình.
2. **`textfile=` KHÔNG gỡ được chuyện `%`.** Cả hai biến thể đều cảnh báo
   `Stray % near …`: `drawtext` khai triển `%{...}` trên nội dung bất kể nội dung
   đến từ đâu. Muốn hết escape thì phải `textfile=` **kèm `expansion=none`** — chi
   tiết mà plan ban đầu bỏ sót.
3. **Bộ thử tổng hợp KHÔNG tái hiện được đường thật.** Biến thể dựng bằng đúng
   `escapeDrawText` hiện tại lại ra một khung TRỐNG (983 byte so với 16.912 byte).
   Production vẽ chữ bình thường, nên sai là ở bộ thử, không phải ở mã: chuỗi
   filter thật đi qua tệp kịch bản (`render.ts:342`), mà luật escape trong tệp
   kịch bản khác luật trên dòng lệnh.

`server/dev-render-frame.ts` không dùng được làm chứng: nó tự dựng chuỗi
`drawtext` riêng chứ không đi qua `burnElements`.

**Kết luận:** cú đổi này chỉ nhận được sau khi chạy `burnElements` thật rồi so
khung — tức là qua `tedit_test` trong skill deploy. Không làm mù.

### 6.3 lệch so với plan

Dùng `VACUUM INTO` chứ không `copyFileSync`. Ở chế độ WAL, một phần dữ liệu mới
nằm trong tệp `-wal` chưa nhập vào tệp chính, nên chép tệp ra một bản **thiếu
đúng những thay đổi gần nhất** — bản sao lưu trông ổn mà lại cũ hơn hiện tại, thứ
chỉ lộ ra đúng lúc cần dùng tới nó.

### 6.4 lệch so với plan

Soi `..` trên **cả hai** dạng — thô và đã giải mã — chứ không chỉ dạng đã giải mã.
Phép kiểm mới có ý nghĩa thật: không có bản vá thì
`/files/projects/<id>/%2e%2e/%2e%2e/teddit.db` đi lọt.

## Xong khi

- `grep` không còn định danh tiếng Việt trong `server/` và `src/`.
- `npm run check:ownership` xanh **kèm** hai trường hợp mới.
- Xuất một video có caption chứa `'` → in ra đúng dấu người dùng gõ (nếu làm 6.2).
- Video xuất ra sau 6.2 giống video trước 6.2 từng khung một.

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Đổi tên `GOC` sót một chỗ | `typecheck` bắt hết — đây là món mà TypeScript làm tốt nhất |
| 6.2 làm đổi bản in ra | So từng khung trước khi nhận. Không chắc thì giữ nguyên và chỉ sửa phép escape |
| Đổi tên tệp `scripts/` làm hỏng tài liệu | `grep -rn "kiem-\|thu-" --include=*.md .` sau khi đổi |
