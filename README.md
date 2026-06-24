# Quản lý cửa hàng xe đạp điện (Web CRM)

App web quản lý bán xe đạp điện cho 1 cửa hàng, chạy trên trình duyệt tại máy của bạn.
5 module: **Tổng quan · Tồn kho · Bán hàng · Khách hàng · Công nợ**.

## Công nghệ

- **Frontend:** React 18 + Vite + TypeScript + Mantine UI 7 + TanStack Query + Recharts
- **Backend:** Node 22+ + Express + TypeScript, REST API
- **CSDL:** SQLite (dùng `node:sqlite` built-in — không cần cài thêm gì)
- **Test:** Vitest + Supertest, SQLite in-memory, 33 test cases
- Tiền tệ: số nguyên VND. Ngày: `YYYY-MM-DD`.

## Yêu cầu

- **Node.js 22.5+** (khuyến nghị 24+). Kiểm tra: `node --version`

## Chạy app

### Lần đầu
```bash
npm install
```

### Chạy nhanh (Windows) — double-click file
```
start-app.bat
```
Tự build và mở trình duyệt tại **http://localhost:3001**.

### Chế độ production (1 cổng duy nhất)
```bash
npm run build
npm start
```
Mở trình duyệt: **http://localhost:3001**

### Chế độ phát triển (tự reload)
```bash
npm run dev
```
Mở trình duyệt: **http://localhost:5173**
(API chạy ở cổng 3001, giao diện ở 5173 và tự gọi API qua proxy.)

### Kiểm tra kiểu dữ liệu
```bash
npm run typecheck
```

### Chạy test
```bash
npm test           # chạy 1 lần
npm run test:watch # chạy liên tục khi sửa file
```

## Dữ liệu

- Lưu tại `data/crm.db` (tự tạo khi chạy lần đầu). **Sao lưu = copy file này.**
- Xóa file `data/crm.db` để bắt đầu lại từ đầu (dữ liệu trống).

## Cấu trúc thư mục

```
server/
  app.ts          # tạo Express app (createApp)
  index.ts        # entry point, khởi động server
  db.ts           # kết nối SQLite + transaction helper
  schema.sql      # định nghĩa bảng
  lib/
    http.ts       # validateBody, errorHandler middleware
  repos/          # truy vấn từng bảng (+ file .test.ts)
  routes/         # REST endpoints (dashboard, products, sales, customers, debts)
  test/           # helpers và api integration tests

client/src/
  App.tsx         # router + layout, lazy-load mọi trang
  main.tsx        # Mantine theme (primary teal, dark/light mode)
  pages/          # 5 trang: Dashboard, Products, Sales, Customers, Debts
  components/     # component dùng chung (xem bên dưới)
  lib/            # tiện ích dùng chung (xem bên dưới)
  styles.css      # hiệu ứng hover, motion

shared/
  types.ts        # kiểu dữ liệu dùng chung server + client
```

### Components dùng chung (`client/src/components/`)

| Component | Vai trò |
|---|---|
| `SaleForm` | Form tạo/sửa đơn bán hàng |
| `SaleDetailModal` | Modal xem chi tiết + quản lý thanh toán |
| `ImportModal` | Modal nhập Excel tồn kho |
| `UnitsModal` | Modal quản lý serial xe |
| `CustomerDetailModal` | Modal xem lịch sử khách hàng |
| `DashboardCustomerCharts` | 4 biểu đồ phân tích khách hàng |
| `DashboardProductCharts` | 4 biểu đồ phân tích sản phẩm |
| `ListTable` | Bảng danh sách (header adaptive + skeleton + dòng rỗng) |
| `ChartCard` | Khung biểu đồ dashboard |
| `LoadingBlock` | Trạng thái đang tải căn giữa |
| `ColorSchemeToggle` | Nút chuyển dark/light mode |

### Thư viện dùng chung (`client/src/lib/`)

| File | Vai trò |
|---|---|
| `api.ts` | API client (fetch wrapper) |
| `notify.ts` | Toast `toastOk` / `toastError` |
| `confirm.ts` | `confirmDelete` — dialog xác nhận |
| `labels.ts` | Nhãn + màu loại KH/SP |
| `format.ts` | Định dạng tiền / ngày |
| `shopConfig.ts` | Thông tin cửa hàng + logo cho hóa đơn |
| `printInvoice.ts` | In hóa đơn |
| `excel.ts` | Xử lý nhập Excel |

## Tính năng chính

### Tổng quan (Dashboard)
- KPI: doanh thu, số đơn, tiền thu, công nợ
- Biểu đồ doanh thu theo thời gian + top sản phẩm bán chạy
- **8 biểu đồ phân tích** (donut/bar/composite):
  - Phân tích khách hàng: doanh thu theo loại KH, top KH, KH mới theo tháng, phân bố giá trị đơn hàng
  - Phân tích sản phẩm: doanh thu theo danh mục (`Xe` / `Phụ kiện`), top SP, phân bố loại SP, tồn kho theo danh mục
- Chọn khoảng thời gian linh hoạt

### Tồn kho
- Mỗi sản phẩm có **danh mục** (`Xe` / `Phụ kiện`) — phân loại kinh doanh, độc lập với cách theo dõi tồn kho
- Theo dõi tồn kho theo **loại lưu trữ**: `SERIALIZED` (mỗi chiếc 1 serial) hoặc `QUANTITY` (đếm số lượng) — xe có thể dùng serial hoặc số lượng, phụ kiện tương tự
- Mỗi SP có màu sắc, ngưỡng tồn cảnh báo
- **Nhập Excel số lượng lớn:** tải file mẫu (.xlsx) — 2 sheet `SanPham` (cột `DanhMục`) + `SerialXe`; kiểm tra toàn bộ trước khi lưu

### Bán hàng
- Tạo đơn → trừ tồn kho tự động → nếu trả thiếu tự sinh công nợ
- **Sửa đơn đã tạo:** nút bút chì trên danh sách đơn → mở lại form, áp dụng thay đổi nguyên tử (hoàn tồn → xóa nợ cũ → cập nhật đơn → ghi lại tồn + nợ mới); dùng cho chiết khấu hồi tố
- Lịch sử trả từng đợt gộp vào "Khách trả" khi sửa; server chặn giảm tiền khách trả xuống dưới số đã thu thực tế
- Xem chi tiết đơn → quản lý thanh toán: thêm/sửa/xóa lần trả (ngày giờ, số tiền, hình thức)
- "Đã trả" và "Còn nợ" tự cập nhật khớp mọi nơi

### Hóa đơn in
- Thông tin cửa hàng + logo góc trên phải
- Chỉnh sửa tại `client/src/lib/shopConfig.ts`
- Thêm logo: đặt ảnh vào `client/public/logo.png`, đặt `logoUrl: '/logo.png'`, chạy lại `npm run build`

### Khách hàng
- 2 loại: **Cá nhân** và **Đại lý** (tên công ty, người liên hệ, mã số thuế)
- Lọc theo loại, tìm theo tên/SĐT/MST/người liên hệ
- Xem lịch sử mua hàng từng khách

### Công nợ
- Ghi nhận thu nợ nhiều lần
- Phân tích **tuổi nợ**: trong hạn / 1–30 / 31–60 / 61–90 / 90+ ngày

## Giao diện

- **Dark/Light mode:** tự động theo OS, nhớ lựa chọn (localStorage), nút toggle góc trên phải
- **Responsive:** Header + Burger menu thu gọn trên mobile
- **Toast + dialog xác nhận:** không dùng `alert()`/`confirm()` native
- **Loading skeleton:** tải dữ liệu mượt mà
- **Lazy-load route:** bundle nhẹ hơn ~70%, trang tải nhanh hơn
- **Accessibility:** điều hướng bàn phím, aria-label, focus ring

## Tài liệu

- [docs/design-guidelines.md](docs/design-guidelines.md) — quy tắc UI/UX, màu sắc, component
- [docs/architecture.md](docs/architecture.md) — kiến trúc hệ thống và luồng dữ liệu
