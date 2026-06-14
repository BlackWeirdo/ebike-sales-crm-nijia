# Deploy lên Fly.io (chạy 24/7, truy cập mọi nơi)

App chạy 24/7 trên Fly.io, bảo vệ bằng 1 mật khẩu. Dữ liệu SQLite nằm trên volume bền `/data`.

## Chuẩn bị 1 lần
1. **Cài flyctl** (PowerShell):
   ```powershell
   pwsh -c "iwr https://fly.io/install.ps1 -useb | iex"
   ```
   Mở terminal mới sau khi cài.
2. **Đăng ký + đăng nhập** (mở trình duyệt, cần thẻ tín dụng để xác minh — máy nhỏ gần như miễn phí):
   ```bash
   fly auth signup   # hoặc: fly auth login (nếu đã có tài khoản)
   ```

## Deploy (chạy trong thư mục dự án)
```bash
cd "c:/Project web app CRM"

# 1) Tạo app + volume (chỉ làm LẦN ĐẦU). App name đã đặt trong fly.toml.
fly apps create ebike-sales-crm-nijia        # nếu trùng tên, đổi "app" trong fly.toml
fly volumes create crm_data --region sin --size 1   # 1GB volume cho SQLite

# 2) Đặt bí mật (KHÔNG commit vào git):
#    - APP_PASSWORD: mật khẩu bạn dùng để đăng nhập app
#    - SESSION_SECRET: chuỗi ngẫu nhiên dài (ký phiên đăng nhập)
fly secrets set APP_PASSWORD="MatKhauCuaBan" SESSION_SECRET="$(openssl rand -hex 32)"
#    (Windows không có openssl thì thay bằng 1 chuỗi ngẫu nhiên >=32 ký tự tự gõ)

# 3) Deploy
fly deploy

# 4) Mở app
fly open
```

## Sau khi deploy
- URL dạng `https://ebike-sales-crm-nijia.fly.dev` — mở trên ĐIỆN THOẠI/máy nào cũng được.
- Nhập mật khẩu (APP_PASSWORD) để vào. Phiên nhớ 30 ngày trên thiết bị đó.
- Cập nhật code mới: `git push` (lưu trữ) rồi `fly deploy` (đẩy bản chạy).

## Lệnh hữu ích
| Việc | Lệnh |
|---|---|
| Xem log | `fly logs` |
| Đổi mật khẩu | `fly secrets set APP_PASSWORD="MoiHon"` (tự deploy lại) |
| Trạng thái máy | `fly status` |
| Backup DB | `fly ssh console -C "cat /data/crm.db" > backup.db` |
| Mở SSH | `fly ssh console` |

## Lưu ý
- `min_machines_running = 0`: máy ngủ khi không dùng → request đầu tiên chờ ~2-5s khởi động (tiết kiệm tiền). Muốn luôn sẵn sàng: đổi thành `1` trong fly.toml.
- Dữ liệu chỉ ở trên volume Fly — **nên backup định kỳ** (lệnh ở trên).
- App vẫn chạy local bình thường: `npm start` (không set APP_PASSWORD → không cần đăng nhập).
