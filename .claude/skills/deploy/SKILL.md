---
name: deploy
description: Deploy Tedit lên production (tedit.tensorlab.tech). CHỈ chạy khi user nói "deploy" rõ ràng. Đẩy mã lên server bằng git archive rồi build + restart container, sau đó verify.
---

# deploy — Tedit production

Đưa Tedit lên <https://tedit.tensorlab.tech>. **CHỈ thực hiện khi user yêu cầu deploy rõ ràng.**

## Hạ tầng

- Server: `root@154.26.136.134` (SSH key auth), dùng chung với vas-printing, tensorlab, tax-desk, museum, cad-auto, tensortourism.
- **Một nhánh duy nhất: `main`.** Không nhánh feature — nhiều người cùng làm thì
  nhánh song song là chỗ đầu tiên sinh rối. Prod luôn chạy đúng `main`.
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

2. **Đẩy mã** (từ máy phát triển, ở gốc repo, đang đứng trên `main`):
   ```bash
   git archive --format=tar HEAD | ssh root@154.26.136.134 'cd /root/projects/tedit \
     && find . -mindepth 1 -maxdepth 1 ! -name ".env" ! -name ".env.bak.*" -exec rm -rf {} + \
     && tar x -C /root/projects/tedit'
   ```
   **Phải dọn trước khi giải nén.** `tar x` chỉ ghi đè, không xoá tệp đã biến mất
   khỏi commit — bỏ bước `find … rm` thì tệp đã gỡ vẫn sống mãi trên server. Đã
   dính đúng lỗi này: gỡ emoji xong deploy, mà `assets/emoji/` và
   `server/emoji-*.ts` vẫn còn, prod vẫn hiện emoji.

   Giữ lại `.env` và các bản `.env.bak.*` — dữ liệu người dùng nằm trong Docker
   volume nên không bị ảnh hưởng.

   Chạy MỘT MÌNH, đừng nối `&&` với lệnh khác ở phía máy local — luồng tar bị
   tranh chấp stdin và ra `tar: This does not look like a tar archive`.

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

## Chạy thử trọn luồng trên bản đã deploy

Không đăng nhập Google bằng máy được (Google chối trình duyệt tự động), và nút
"Vào bằng tài khoản dev chung" bị `import.meta.env.DEV` **xoá hẳn khỏi bản dựng
production** — không bật lại bằng biến môi trường được.

Cách chạy được: dựng một container thứ hai từ CÙNG ảnh, dữ liệu riêng, cửa dev
mở; rồi đăng nhập qua API thay vì bấm nút.

```bash
# 1. Container thử — không nối edge, chỉ nghe loopback của server
ssh root@154.26.136.134 'docker run -d --name tedit_test -p 127.0.0.1:5199:5190 \
  -e NODE_ENV=development -e TEDDIT_DEV_LOGIN=1 -e HOST=0.0.0.0 -e PORT=5190 \
  -e TEDDIT_DATA_ROOT=/data -e HF_HOME=/model-cache -e BETTER_AUTH_URL=http://localhost:5199 \
  --env-file /root/projects/tedit/.env \
  -v tedit_test_data:/data -v tedit_tedit_model:/model-cache tedit:latest'

# 2. Đường hầm
ssh -f -N -L 5199:127.0.0.1:5199 root@154.26.136.134

# 3. Chạy luồng (script ở scratchpad phiên trước, hoặc viết lại theo mẫu dưới)
python3 thu-server.py 5199 <video.mp4> <thư-mục-ảnh>

# 4. DỌN — dữ liệu thử không được để lại
ssh root@154.26.136.134 'docker rm -f tedit_test; docker volume rm tedit_test_data'
```

Đăng nhập bằng API: `POST /api/auth/sign-in/email` với
`dev@teddit.local` / `dev-only-password-2026` (xem `src/routes/landing/dev-sign-in.tsx`),
lấy cookie từ header `Set-Cookie` rồi nạp vào Playwright context. Đừng cố tự ký
cookie bằng `BETTER_AUTH_SECRET` — tốn thời gian và tôi đã thử, không ra.

**Tại sao đáng làm:** lượt chạy thử đầu tiên bắt được một lỗi chỉ có trên máy
chủ — `ebur128=…:framelog=quiet` không hợp lệ trên ffmpeg 5.1, bộ lọc không chạy
một cách im lặng, số đo ra 0,0 LUFS và mọi video bị hạ tiếng 6 dB vô cớ. Máy phát
triển dùng ffmpeg mới hơn nên không bao giờ lộ ra. Sau mỗi lần đụng vào ffmpeg
filter, chạy lại phép thử này.

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
- **Tệp đã gỡ vẫn sống trên server** nếu quên bước dọn ở mục 2. Kiểm nhanh sau
  mỗi lần deploy có xoá tệp:
  ```bash
  ssh root@154.26.136.134 'docker exec tedit_app ls <đường-dẫn-đã-gỡ>'
  ```

## Cần để mắt

Đo lại 02/08/2026 (`nproc`, `free -h`, `df -h`, `docker stats`):

- **4 core · 7,8 GB RAM · 145 GB đĩa · 30 container.** Không phải bảy dự án như
  ghi ở trên — đếm thật ra tedit, tensorlab, taxdesk, museum, cad-auto,
  chatbot/langfuse, tensorship, vas-printing.
- **Đĩa 42%** (85 GB trống) — con số 80%/30 GB ở bản trước đã cũ, ai đó đã dọn.
  Vẫn ĐỪNG `docker system prune -a`: các stack khác giữ ảnh `:rollback` trong đó.
- **RAM 4,7 GB khả dụng, mà swap ĐÃ ăn 1,5 GB.** Máy vốn đã chật chứ không rộng.
  Mô hình nghe chiếm ~2 GB lúc chép lời. Container bị OOM-kill giữa lượt chép thì
  đây là chỗ nhìn đầu tiên.
- **Chỉ `tedit_app` có trần tài nguyên** (`cpus: 2.0`, `mem_limit: 2500m` trong
  `deploy/docker-compose.yml`); hai mươi chín container kia không có trần nào.
  Nên trần ấy không phải để tedit khỏi bị thiệt — nó là để tedit đừng thành thứ
  kích hoạt OOM killer, vì lúc đó nhân chọn nạn nhân theo dung lượng chứ không
  theo "ai vừa gây ra chuyện".
- **Ảnh 2,7 GB.** Mỗi lượt deploy giữ thêm một ảnh `:rollback`.
- **ffmpeg 5.1.9** (Debian 12). Máy phát triển dùng bản mới hơn — mọi filter mới
  phải thử trên server, xem mục "Chạy thử trọn luồng" ở trên.

## Việc phải làm tay một lần (nếu đăng nhập Google hỏng)

Google Cloud Console → OAuth client → Authorized redirect URIs, phải có:
```
https://tedit.tensorlab.tech/api/auth/callback/google
```
