# Kiến trúc hệ thống

Cập nhật 02/08/2026.

`README.md` nói **cách chạy** và **lý do** của từng quyết định. Tệp này nói **các
mảnh nối vào nhau ra sao** — thứ không đọc ra được từ một tệp đơn lẻ nào.

## Đường đi của một request

```
trình duyệt
   │  https://tedit.tensorlab.tech
   ▼
Cloudflare ──► edge Caddy (vas-printing-edge-1)
                    │  http://tedit_app:5190  (mạng Docker nội bộ)
                    ▼
              Fastify (tedit_app)
                    │
       ┌────────────┴────────────┐
       │  onRequest: authGuard   │  chặn theo TIỀN TỐ đường dẫn
       └────────────┬────────────┘
                    │
   ┌────────────────┼────────────────┬──────────────┐
   ▼                ▼                ▼              ▼
/api/auth/*    /api/health      /api/**        /files/**
Better Auth    không cần phiên   10 plugin      ổ đĩa, đã lọc
                                 theo miền      theo chủ dự án
```

Container **không** publish cổng ra host. Đường vào duy nhất là edge Caddy.

## Ba lớp khoá, mỗi lớp trả lời một câu khác nhau

| Lớp | Ở đâu | Trả lời |
|---|---|---|
| Danh sách cho phép | `auth.ts` + `auth-guard.ts` | ai được vào hệ thống |
| Chủ sở hữu | `ownership.ts` | hàng này có phải của người đang gọi |
| Cùng dự án | `assertInProject` | thứ nhắc trong THÂN request có thuộc dự án đang sửa |

Lớp hai chặn theo mẫu đường dẫn ở **một** cổng, nên route thêm về sau mặc định đã
bị khoá. Lớp ba phải gọi tay ở những route nhận mã trong thân — `/api/layout` là
ví dụ có ghi chú tại chỗ.

Mọi lượt chối đều trả **404**, không phải 403: 403 là câu trả lời đủ để người
ngoài dò xem mã nào tồn tại.

## Việc nặng đi qua đâu

```
POST /api/projects/:id/export
        │
        ▼
   enqueue()  ──► trùng?  → 409
        │       ──► đầy?  → xếp hàng, trạng thái `queued`
        ▼
   Map việc đang chạy  (trần TEDDIT_MAX_JOBS, mặc định 1)
        │
        ├── nhịp tim 30s ──► chạm updated_at của bảng jobs
        │
        ▼
   runExport ──► ffmpeg ──► out/final.mp4
        │
        └── xong ──► dọn work/cut.mp4
```

**Nguồn sự thật là `Map` trong bộ nhớ, không phải bảng `jobs`.** Bảng chỉ để màn
hình hỏi tiến độ. Suy "việc còn sống không" từ mốc thời gian là cách cũ và nó đẻ
ra hai ffmpeg trên cùng một dự án, vì lượt xuất đi một mạch rất lâu mà không báo
gì ở giữa.

Khởi động lại thì `reapOrphans()` đánh hỏng mọi hàng còn `running` — lúc đó `Map`
rỗng nên chúng chắc chắn thuộc tiến trình đã chết.

## Dữ liệu nằm đâu

```
volume tedit_data (/data)
├── teddit.db                    SQLite, WAL, foreign_keys ON
└── projects/<id>/
    ├── media/                   tệp người dùng tải lên
    ├── thumbs/                  ảnh nhỏ + dải ảnh
    ├── work/  base.mp4          ghép từ media — dải ảnh ĐỌC nó
    │          audio.wav         tách tiếng — đường bao tiếng ĐỌC nó
    │          cut.mp4           trung gian, xoá sau khi xuất xong
    └── out/   final.mp4         thành phẩm

volume tedit_model (/model-cache)  mô hình nghe ~1,5 GB, tải lại được
```

Mất `tedit_data` là mất tất cả. `base.mp4` và `audio.wav` **không** phải tệp tạm
dù nằm trong `work/` — hai route của bàn dựng đọc thẳng chúng mỗi lần mở dự án.

## Hai đường vẽ phải khớp nhau

Cùng một bộ dáng chữ được vẽ hai lần: một lần trên trình duyệt để xem trước, một
lần bằng `drawtext` của ffmpeg để xuất video.

Giữ chúng khớp bằng ba luật:

1. **Một khai báo cho mỗi con số** — `server/style-pack.ts`, cả hai bên cùng
   import. Chép sang là có bản thứ hai để lệch.
2. **Cùng một tệp font** — `assets/fonts/`, đóng gói theo repo. Không mượn font
   hệ thống, không dùng bản woff2 của Google Fonts.
3. **Bề rộng chữ đo bằng ImageMagick với đúng tệp font sẽ in** — không ước lượng
   theo số ký tự.

`scripts/overlay-parity/` bắt được lệch giữa hai đường mà không cần đăng nhập.

## Máy nghe đổi theo nền tảng

`server/asr/transcribe.py` tự chọn: mlx-whisper trên Apple Silicon, faster-whisper
trên x86. Cùng mô hình `large-v3-turbo`, cùng hình dạng dữ liệu trả về. Tiếng nói
không rời khỏi máy chủ.

Trên máy chủ nó chạy CPU nên chậm hơn đáng kể — đó là cái giá của việc không gửi
tiếng người dùng đi đâu.

Số luồng lấy từ `TEDDIT_WORKER_THREADS`, **không** từ `os.cpu_count()`: trong
container hàm đó trả về số core của máy chủ chứ không đọc hạn mức cgroup.

## Máy chủ dùng chung

30 container của tám dự án trên 4 core và 7,8 GB. Chỉ `tedit_app` có trần tài
nguyên — không phải để nó khỏi bị thiệt, mà để nó đừng thành thứ kích hoạt OOM
killer, vì lúc ấy nhân chọn nạn nhân theo dung lượng chứ không theo ai gây ra
chuyện.

Chi tiết vận hành và các bẫy đã gặp: `.claude/skills/deploy/SKILL.md`.
