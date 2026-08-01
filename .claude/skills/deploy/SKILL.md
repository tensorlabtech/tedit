---
name: deploy
description: Deploy Tedit lên production (tedit.tensorlab.tech). CHỈ chạy khi user nói "deploy" rõ ràng. Đẩy mã lên server bằng git archive rồi build + restart container, sau đó verify.
---

# deploy — Tedit production

Đưa Tedit lên <https://tedit.tensorlab.tech>. **CHỈ thực hiện khi user yêu cầu deploy rõ ràng.**

## Hạ tầng

- Server: `root@154.26.136.134` (SSH key auth), dùng chung với vas-printing, tensorlab, tax-desk, museum, cad-auto, tensortourism.
- Mã trên server: `/root/projects/tedit` (KHÔNG phải git clone — xem dưới).
- Stack: `deploy/docker-compose.yml`, tên stack `tedit`, một container `tedit_app`.
- Edge Caddy `vas-printing-edge-1` reverse_proxy `tedit.tensorlab.tech` → `tedit_app:5190`.
  Khối cấu hình nằm ở `/root/projects/vas-printing/deploy/Caddyfile`.
- Cloudflare lo SSL (origin HTTP).

### Vì sao đẩy mã bằng `git archive`, không phải `git pull`

Repo `tensorlabtech/tedit` là private, mà tổ chức đó **tắt deploy keys**
(`Deploy keys are disabled for this repository`). Cách còn lại là đặt token quyền
`repo` lên máy chủ — nhưng máy chủ này dùng chung cho bảy dự án, nên một token
đọc-được-mọi-repo nằm ở đó là cái giá không đáng.

`git archive HEAD | ssh … tar x` gửi đúng nội dung một commit, không cần
credential nào trên server. Đổi lại: server không có lịch sử git, nên muốn biết
đang chạy bản nào thì xem `docker images tedit --format "{{.CreatedAt}}"` hoặc
hỏi lại máy đã deploy.

Nếu sau này bật được deploy key, đổi sang `git pull` cho tiện.

## Quy trình

1. **Kiểm cây làm việc.** Nếu còn thay đổi chưa commit, hỏi user trước — đừng tự
   commit hộ. Deploy đẩy nội dung của `HEAD`, nên thay đổi chưa commit sẽ KHÔNG
   lên server, và điều đó cần nói rõ chứ không im lặng.

2. **Đẩy mã** (từ máy phát triển, ở gốc repo):
   ```bash
   git archive --format=tar HEAD | ssh root@154.26.136.134 'tar x -C /root/projects/tedit'
   ```
   Chạy MỘT MÌNH, đừng nối `&&` với lệnh khác — luồng tar bị tranh chấp stdin và
   ra `tar: This does not look like a tar archive`.

3. **Dựng và khởi động** (chạy nền, build mất 3–8 phút):
   ```bash
   ssh root@154.26.136.134 'cd /root/projects/tedit && nohup bash deploy/deploy.sh > /tmp/tedit-deploy.log 2>&1 &'
   ```
   Rồi chờ tới khi log có `Deploy hoàn tất` hoặc lỗi:
   ```bash
   ssh root@154.26.136.134 'for i in $(seq 1 100); do
     grep -qE "Deploy hoàn tất|did not complete successfully|failed to solve|npm error|✗ " /tmp/tedit-deploy.log && break
     sleep 6
   done; tail -12 /tmp/tedit-deploy.log'
   ```

4. **Verify** — bốn tuyến, mỗi tuyến trả lời một câu hỏi khác nhau:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://tedit.tensorlab.tech/            # 200 — trang tới được
   curl -s -o /dev/null -w "%{http_code}\n" https://tedit.tensorlab.tech/upload      # 200 — SPA routing chạy
   curl -s -o /dev/null -w "%{http_code}\n" https://tedit.tensorlab.tech/api/projects # 401 — API sống VÀ đang chặn
   curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" \
     -d '{"provider":"google","callbackURL":"/"}' \
     https://tedit.tensorlab.tech/api/auth/sign-in/social                            # 200 — đăng nhập nối được
   ```
   `/api/projects` phải là **401**, không phải 200: 401 nghĩa là máy chủ sống và
   cửa vẫn khoá. 200 ở đó là dấu hiệu phân quyền hỏng.

   Công cụ dựng video nằm trong container, kiểm riêng vì chúng chỉ gãy giữa lượt
   dựng chứ không gãy lúc khởi động — container vẫn báo khoẻ:
   ```bash
   ssh root@154.26.136.134 'docker exec tedit_app sh -c "magick -version | head -1; ffmpeg -version | head -1"'
   ```

5. **Báo lại**: trạng thái container, và nhắc Cloudflare cache HTML (Purge
   Everything nếu cần thấy ngay).

## Rollback

```bash
ssh root@154.26.136.134 'cd /root/projects/tedit && bash deploy/rollback.sh'
```
Chỉ đổi ảnh về `tedit:rollback`, KHÔNG đụng volume — dữ liệu người dùng không
thuộc về bản dựng nào cả.

## Sửa cấu hình Caddy (thêm/đổi tên miền)

Caddyfile nằm TRONG image `vas-printing-edge:latest`, không mount từ host. Nên
phải làm hai bước, thiếu bước nào cũng hỏng theo kiểu riêng:

```bash
# 1. Sửa nguồn — để lần rebuild edge sau vẫn còn
ssh root@154.26.136.134 'vi /root/projects/vas-printing/deploy/Caddyfile'   # nhớ cp .bak trước

# 2. Nạp vào container đang chạy
ssh root@154.26.136.134 'docker cp /root/projects/vas-printing/deploy/Caddyfile vas-printing-edge-1:/etc/caddy/Caddyfile
  docker exec vas-printing-edge-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  docker restart vas-printing-edge-1'
```

**`caddy reload` KHÔNG dùng được** — admin API trả `403: client is not allowed to
access from origin`, vì khối `admin { origins * }` trong Caddyfile không phải
wildcard hợp lệ. Phải `docker restart`, và nó làm **cả 18 site trên server** gián
đoạn vài giây. Luôn `caddy validate` trước: cấu hình sai mà restart là chết toàn
bộ, không riêng Tedit.

## Bẫy đã gặp — đừng sửa lại

- **Tên stack.** `deploy/docker-compose.yml` có `name: tedit`. Bỏ dòng đó thì
  Docker lấy tên thư mục (`deploy`), mạng thành `deploy_default`, và edge nối vào
  `tedit_default` sẽ không thấy gì — trang trả 502 mà log deploy vẫn xanh.
- **`HOST=0.0.0.0` trong compose.** `server/main.ts` mặc định nghe `127.0.0.1`,
  đúng cho máy thường. Trong container thì Caddy ở container khác nên không ai với
  tới được. Cổng vẫn kín vì compose không `ports:`.
- **`magick` → `convert`.** Debian 12 đóng gói ImageMagick 6. Dockerfile có
  symlink. Chú thích phải để NGOÀI khối `RUN`: một dòng `#` chen giữa các dòng nối
  `\` làm shell nuốt luôn lệnh sau nó.
- **Máy nghe.** mlx-whisper chỉ chạy trên Apple Silicon;
  `server/asr/transcribe.py` tự đổi sang faster-whisper trên x86. Đừng ép
  `TEDDIT_ASR` trên server.
- **DNS Docker sau `network connect`** cần vài giây. `deploy.sh` đã thử lại trong
  30 giây.

## Cần để mắt

- **Đĩa server 80%** (30 GB trống). `docker system df` cho thấy ~72 GB image có
  thể thu hồi, nhưng ĐỪNG `docker system prune -a` — các stack khác giữ ảnh
  `:rollback` trong đó. Muốn dọn thì xoá đích danh.
- **RAM 4 GB khả dụng, swap 2 GB.** Mô hình nghe chiếm ~2 GB lúc chép lời. Nếu
  container bị OOM-kill giữa lượt chép, đó là chỗ đầu tiên cần nhìn.
- **Ảnh 2,7 GB.** Mỗi lượt deploy giữ thêm một ảnh `:rollback`.

## Việc phải làm tay một lần (nếu đăng nhập Google hỏng)

Google Cloud Console → OAuth client → Authorized redirect URIs, phải có:
```
https://tedit.tensorlab.tech/api/auth/callback/google
```
