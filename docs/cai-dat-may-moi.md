# Cài app lên một máy tính khác (chạy local, dữ liệu lưu trên máy đó)

App chạy hoàn toàn trên máy tính, dữ liệu nằm trong file `data/crm.db` ngay trên máy đó.
Làm theo 3 bước dưới đây trên **máy mới**.

## Bước 1 — Cài Node.js (chỉ làm 1 lần)
- Vào https://nodejs.org → tải **phiên bản 24 (LTS)** → cài như phần mềm bình thường (Next → Next → Finish).
- ⚠️ Bắt buộc Node ≥ 22 (app dùng SQLite tích hợp của Node). Nên cài bản 24 cho chắc.

## Bước 2 — Lấy mã nguồn về máy mới (chọn 1 cách)

**Cách A — Tải từ GitHub (gọn nhất, khuyến nghị):**
- Cài Git (https://git-scm.com) rồi mở PowerShell, chạy:
  ```bash
  cd %USERPROFILE%\Desktop
  git clone https://github.com/BlackWeirdo/ebike-sales-crm-nijia.git
  ```
- Hoặc không cần Git: vào trang repo trên GitHub → nút **Code → Download ZIP** → giải nén ra Desktop.

**Cách B — Chép qua USB:**
- Chép cả thư mục dự án sang máy mới, **NHƯNG bỏ qua** các thư mục nặng/không cần: `node_modules`, `dist` (máy mới sẽ tự tạo lại).

## Bước 3 — Chạy app
- Mở thư mục dự án trên máy mới → **double-click `start-app.bat`**.
- Lần đầu: tự cài thư viện + dựng giao diện (đợi vài phút), rồi tự mở trình duyệt tại `http://localhost:3001`.
- Các lần sau: mở nhanh hơn (chỉ khởi động server).
- Tạo shortcut `start-app.bat` ra Desktop cho tiện double-click hằng ngày.

## (Tùy chọn) Mang dữ liệu hiện tại sang máy mới
Mặc định máy mới bắt đầu với **dữ liệu rỗng**. Nếu muốn mang dữ liệu đang có:
1. Trên máy CŨ: copy file `data/crm.db`.
2. Trên máy MỚI: dán vào thư mục `data/` của dự án (tạo thư mục `data` nếu chưa có), **trước khi** chạy app.
3. Dữ liệu test mặc định hiện tại không quan trọng → thường nên bắt đầu rỗng và nhập liệu thật.

## Lưu ý
- Dữ liệu chỉ nằm trên máy đang chạy → **nên backup** file `data/crm.db` định kỳ (copy ra USB/ổ khác).
- Mỗi lần dùng phải mở `start-app.bat` (giữ cửa sổ đen mở khi đang dùng; đóng = tắt app).
- Muốn cập nhật code mới từ GitHub: `git pull` rồi **xóa thư mục `dist`** và chạy lại `start-app.bat` (để dựng lại giao diện mới).
