---
status: pending
created: 2026-08-02
source: plans/reports/260802-1725-project-improvement-review.md
---

# Vững cho nhiều người dùng

Tedit đã chạy thật ở <https://tedit.tensorlab.tech> bằng Docker, phục vụ **nhiều
người**, trên VPS **dùng chung** với stack khác (`vas-printing-edge-1`). Mã tốt;
chỗ yếu nằm ở vận hành và ở vài luật chia sẻ chưa được áp.

## Mô hình quyền đã chốt (kho tư liệu & kho nhạc)

| Việc | Ai được |
|---|---|
| Xem danh mục, nghe/xem thử, chép vào dự án | Mọi người đã đăng nhập — danh mục là **chung** |
| Đánh dấu sao | Riêng từng người (đã đúng) |
| Sửa tiêu đề / thẻ / mô tả | **Chỉ người đã tải tệp đó lên** |
| Tệp thả tay vào thư mục (`uploaded_by` NULL) | Không ai sửa được qua API — sửa bằng CSDL |

Cờ `mine` đã có sẵn trong mã nhưng tính sai; xem [phase-03](phase-03-fair-sharing-rules.md).

## Các chặng

| # | Chặng | Trạng thái | Vì sao ở đây |
|---|---|---|---|
| 01 | [Quan sát được + CI + README](phase-01-observability-and-ci.md) | ✅ **xong** 02/08 | Không đụng logic. Xong chặng này thì mọi chặng sau đều chẩn đoán được và có lưới an toàn |
| 02 | [Chịu tải nhiều người](phase-02-load-resilience.md) | ✅ **xong** 02/08 (còn đo trên máy chủ) | Hàng đợi + nhịp tim + trần tài nguyên là ba mặt của một vấn đề |
| 03 | [Luật chia sẻ công bằng](phase-03-fair-sharing-rules.md) | ✅ **xong** 02/08 | Hạn ngạch đĩa, hạn mức chi phí, quyền sửa kho chung |
| 04 | [Tách hai tệp khổng lồ](phase-04-split-monoliths.md) | ✅ **xong** 02/08 · main.ts 1961→346 · use-editor 3170→2375 | Nợ kỹ thuật. Làm SAU khi có CI để có lưới |
| 05 | [Chia nhỏ bundle](phase-05-bundle-splitting.md) | ✅ **xong** 02/08 · 1.744 KB → 567 KB | 1,74 MB một mảnh, kèm cả trang dev |
| 06 | [Dọn vặt & nhất quán](phase-06-consistency-cleanup.md) | 🟡 11/12 — còn 6.2, cần đường dựng thật | Tên tiếng Việt, escape drawtext, sao lưu trước migration |

## Phụ thuộc

```
01 ──> 02 ──> 03
 └────> 04 ──> 05
        06 (độc lập, làm xen kẽ lúc nào cũng được)
```

- **01 trước hết**: sửa `bodyLimit` và bật nhật ký xong thì chặng 02 mới đo được
  là hàng đợi có chạy đúng không.
- **02 trước 03**: hạn ngạch và hạn mức chỉ có nghĩa khi việc nặng đã xếp hàng;
  làm ngược lại thì vẫn chết máy trước khi chạm hạn mức.
- **04 sau 01**: tách 1863 + 3164 dòng mà không có CI là đánh cược.
- **05 sau 04**: tách route xong thì ranh giới lazy-load tự lộ ra.

## Nguyên tắc xuyên suốt

- **Không đổi hành vi nhìn thấy được** ở chặng 01, 04, 05, 06. Ba chặng đó là
  hạ tầng và dọn dẹp; người dùng không được nhận ra gì.
- **Đóng là mặc định.** Mọi luật mới đều chối trước rồi mới cho qua — cùng lập
  trường với `server/ownership.ts` và `server/auth-guard.ts` đang có.
- **Không đảo quyết định đã chốt.** Mô hình kho chung ở bảng trên là quyết định
  của chủ dự án; chặng 03 chỉ áp đúng nó chứ không siết thêm.
- Mọi tệp mã mới đặt tên kebab-case, định danh **tiếng Anh** (`CLAUDE.md`).

## Kiểm chung khi xong mỗi chặng

```bash
npm run typecheck && npm run lint
npm run check:ownership && npm run check:style-pack
npm run build
```

## Quyết định của chủ dự án (2026-08-02)

- **Máy chủ**: Contabo VPS 10 — 4 core, 8 GB RAM, 150 GB SSD, dùng chung với stack
  `vas-printing`. Đây là môi trường dev/thử; đổi máy xịn hơn nếu dự án đi xa.
  → Chặng 02 chốt `cpus: 2.5`, `mem_limit: 5g`, `TEDDIT_MAX_JOBS: 1`.
- **Hạn ngạch đĩa và hạn mức chi phí AI theo người: hoãn.** Whitelist email đã đủ
  ở giai đoạn này. → Chặng 03 giữ thiết kế ở mục 3.3 nhưng không cài; thay bằng
  phần "đĩa nhìn thấy được" (mục 3.2), vì whitelist không trả lời được câu hỏi
  "đĩa còn bao nhiêu".
