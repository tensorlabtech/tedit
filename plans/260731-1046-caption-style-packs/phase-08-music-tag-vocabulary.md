---
phase: 8
title: "Music Tag Vocabulary"
status: pending
priority: P3
effort: "0.5d + 1 buổi gán nhãn 55 bài"
dependencies: [5]
---

# Phase 8: Music Tag Vocabulary

## Overview

Chốt một tập nhãn **đóng** cho kho nhạc, gán lại nhãn cho các bài đang có, rồi lọc
theo nhãn trước khi đưa danh sách cho LLM chọn.

Việc dữ liệu nhiều hơn việc code.

## Key Insights

**Đây không phải vấn đề config, là vấn đề vốn từ.** `library_tracks` đã có cột
`tags`, và `ai-music.ts:123` đã đưa cả danh sách `id|tên|tags` cho LLM. Hạ tầng có
rồi. Nhưng `tags` là **chuỗi tự do** — bài này gắn `energetic, upbeat`, bài kia gắn
`sôi động, mạnh`. Bộ dáng không khai được "thiên về nhạc sôi nổi" khi hai bên không
nói cùng một ngôn ngữ.

**Quy mô đã đo: 57 tệp trong `server/data/music/`, 55 tệp `.mp3`.** Gán nhãn tay
một buổi là xong — phase này không bị cắt vì lý do quy mô.

**Bảng `library_tracks` đang có 0 hàng.** Không phải lỗi: `db.ts:58` ghi rõ
*"THƯ MỤC MỚI LÀ NGUỒN SỰ THẬT. Bảng này chỉ…"* — bảng là lớp bổ sung, bài chưa ai
gắn gì thì không có hàng. Nghĩa là **mọi truy vấn nhãn phải chịu được việc không
tìm thấy hàng**, và danh sách bài luôn dựng từ thư mục chứ không từ bảng.

**Nhạc thuộc loại B — AI đặt hộ.** Đổi bộ dáng **không** được tự đổi nhạc: bài
nhạc là một đoạn nằm trên dải (§37), người dùng nhìn thấy và có thể đã chỉnh mốc,
chỉnh âm lượng. Bộ dáng chỉ đặt **thiên lệch cho lượt chọn tiếp theo**.

**Ít nhãn thôi.** Ba trục là đủ để ghép với bộ dáng. Nhiều hơn thì gán nhãn thành
việc nặng mà không đổi được quyết định nào — đúng phép thử của §45.

## Requirements

**Functional**
- Tập nhãn đóng, ba trục
- Cả 55 bài trong kho có đủ ba nhãn
- `ai-music.ts` lọc theo thiên lệch của bộ dáng trước khi hỏi LLM
- Bộ dáng khai được thiên lệch nhạc

**Non-functional**
- Bài chưa gán nhãn không được biến mất khỏi kho — vẫn chọn tay được
- Lọc xong mà rỗng thì rơi về cả kho, đừng trả về không có nhạc

## Architecture

Ba trục, giá trị đóng:

| Trục | Giá trị |
|---|---|
| năng lượng | `manh` · `vua` · `em` |
| độ dày | `day` · `thua` |
| lời | `co-loi` · `khong-loi` |

Bộ dáng khai thiên lệch bằng chính ba trục đó, ví dụ *"ưu tiên `manh` + `day` +
`khong-loi`"*.

```
projects.style_pack ─→ musicBias ─→ lọc library_tracks ─→ LLM chọn trong tập đã lọc
```

LLM vẫn chọn — nó biết nội dung video, còn nhãn thì không. Nhưng nó chọn trong tập
đã lọc, nên kết quả bám theo bộ dáng.

## Related Code Files

- Modify: `server/music-library.ts` — cột nhãn có kiểm soát (giữ `tags` tự do cho
  phần mô tả, thêm ba cột nhãn hoặc một cột nhãn chuẩn hoá)
- Modify: `server/ai-music.ts:100-123` — lọc trước khi dựng lời nhắc
- Modify: `server/style-pack.ts` — thêm `musicBias`
- Modify: `server/db.ts` — vá cột cho `library_tracks`
- Modify: `src/routes/editor/music-library-browser.tsx` — hiện nhãn, lọc theo nhãn

## Implementation Steps

1. **Chốt tập nhãn** — ba trục ở trên. Đóng, không cho thêm giá trị lạ
2. **Vá cột** cho `library_tracks` theo lối vá dần của `db.ts`. Đã chốt ghi nhãn
   vào bảng này chứ không vào một tệp JSON cạnh thư mục nhạc — giữ đúng lối đang
   có (thư mục là nguồn, bảng là lớp bổ sung), không đẻ ra nguồn sự thật thứ ba
3. **Gán nhãn cho 55 bài** — nghe và gán. Không có đường tắt đáng tin nào ở bước
   này. Gán xong thì `library_tracks` mới có hàng — đó là lần đầu bảng có dữ liệu
5. **Bộ dáng khai `musicBias`** — mỗi bộ ưu tiên một tổ hợp
6. **Lọc trong `ai-music.ts`** — lọc theo bias, lọc xong rỗng thì rơi về cả kho
7. **Kho nhạc hiện nhãn** — người dùng lọc tay được theo cùng ba trục đó

## Todo List

- [ ] Chốt ba trục nhãn
- [ ] Vá cột `library_tracks`
- [ ] Gán nhãn cho 55 bài
- [ ] `musicBias` trong bộ dáng
- [ ] Lọc trong `ai-music.ts` + luật rơi về cả kho
- [ ] Hiện và lọc theo nhãn ở kho nhạc

## Success Criteria

- [ ] Cả 55 bài có đủ ba nhãn
- [ ] Bài chưa có hàng trong `library_tracks` vẫn hiện trong kho, không biến mất
- [ ] Hai bộ dáng khác nhau → AI chọn ra nhạc khác nhau trên **cùng một** video
- [ ] Lọc rỗng → rơi về cả kho, không phải "không có nhạc"
- [ ] Đổi bộ dáng **không** đổi bài nhạc đã đặt trên dải
- [ ] Lọc tay ở kho nhạc chạy đúng

## Risk Assessment

| Rủi ro | Mức | Cách xử |
|---|---|---|
| Kho quá lớn, gán nhãn tay không xuể | ~~cao~~ **đã loại** | Đo rồi: 55 bài. Một buổi là xong |
| Truy vấn nhãn giả định bảng có hàng | vừa | Bảng đang rỗng và sẽ còn rỗng cho bài mới thả vào thư mục. Mọi truy vấn phải `LEFT JOIN` từ thư mục, không `SELECT` từ bảng |
| Nhãn gán theo cảm tính, không nhất quán | vừa | Một người gán hết trong một lượt. Nhiều người nhiều lượt là ba trục thành ba mươi cách hiểu |
| Lọc quá chặt → luôn ra một bài | vừa | Luật rơi về cả kho, và kiểm bằng nhiều video khác nhau |
| Đổi bộ dáng làm mất nhạc đã đặt | **cao** | Bất biến của loại B: không tự đặt lại. Kiểm rõ ở tiêu chí |

## Next Steps

Độc lập. Không chặn phase nào.
