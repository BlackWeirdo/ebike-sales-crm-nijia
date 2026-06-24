# Kiến trúc hệ thống — Web CRM xe đạp điện

## Tổng quan

Ứng dụng single-page chạy hoàn toàn local, không cần internet sau khi cài. Một monorepo duy nhất, chia làm 3 phần: `client/`, `server/`, `shared/`.

```
Trình duyệt  ──HTTP──▶  Express (port 3001)  ──SQL──▶  SQLite (data/crm.db)
   React SPA               REST API                       node:sqlite built-in
```

**Dev mode:** Vite dev server (port 5173) proxy `/api/*` sang Express (port 3001).
**Production:** Vite build ra `dist/`, Express serve static từ `dist/` + `/api/*` trên cùng port 3001.

---

## Backend (`server/`)

### Khởi động

`server/index.ts` gọi `createApp()` từ `server/app.ts`, gắn static serving, sau đó `attachErrorHandler()`, rồi lắng nghe port.

### Cấu trúc lớp

```
index.ts          entry point (listen + static)
app.ts            createApp() — mount routes; attachErrorHandler()
db.ts             mở kết nối SQLite, khởi tạo schema, helper transaction
schema.sql        DDL: bảng products (có cột category TEXT DEFAULT 'bike'), product_units, customers, sales, sale_items, debt_payments
lib/http.ts       validateBody(zodSchema, body) · errorHandler middleware · HttpError
routes/           một Router per resource → mount vào /api/<resource>
repos/            truy vấn SQL thuần, ném Error thường → middleware bắt → HTTP 400
```

### Luồng xử lý request

```
Request → Route handler
  → validateBody(zodSchema, req.body)   [nếu có body]
  → repo.someMethod(...)                [truy vấn SQLite]
  → res.json(result)
  → (nếu lỗi) errorHandler middleware  [HttpError → status; Error → 400]
```

### API Endpoints

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/health` | health check |
| GET | `/api/dashboard/summary` | KPI tổng quan theo khoảng ngày |
| GET | `/api/dashboard/revenue-series` | chuỗi doanh thu theo ngày |
| GET | `/api/dashboard/customer-analytics` | 4 nhóm phân tích khách hàng |
| GET | `/api/dashboard/product-analytics` | 4 nhóm phân tích sản phẩm |
| GET/POST | `/api/products` | danh sách / tạo sản phẩm |
| GET/PUT/DELETE | `/api/products/:id` | chi tiết / sửa / xóa |
| GET/POST | `/api/products/:id/units` | serial xe của SP |
| DELETE | `/api/products/:id/units/:serial` | xóa serial |
| GET/POST | `/api/customers` | danh sách / tạo khách hàng |
| GET/PUT/DELETE | `/api/customers/:id` | chi tiết / sửa / xóa |
| GET | `/api/customers/:id/sales` | lịch sử mua hàng |
| GET/POST | `/api/sales` | danh sách / tạo đơn |
| GET | `/api/sales/:id` | chi tiết đơn |
| PUT | `/api/sales/:id` | sửa đơn (reverse-and-reapply nguyên tử) |
| POST | `/api/sales/:id/payments` | thêm lần trả nợ |
| PUT/DELETE | `/api/sales/:id/payments/:pid` | sửa / xóa lần trả |
| GET | `/api/debts` | danh sách công nợ + phân tích tuổi nợ |
| POST | `/api/products/import` | nhập Excel hàng loạt |

Query params `?from=YYYY-MM-DD&to=YYYY-MM-DD` dùng chung cho tất cả endpoint dashboard (mặc định: tháng hiện tại).

### Test

- Framework: Vitest + Supertest
- DB test: SQLite in-memory (`CRM_DB_PATH=:memory:`)
- File test: `server/repos/*.test.ts` (unit repos) + `server/test/api.test.ts` (integration)
- Tổng: 33 test cases, chạy `npm test`

---

## Frontend (`client/src/`)

### Cấu trúc

```
main.tsx          MantineProvider (theme teal, dark/light auto) + QueryClientProvider + router
App.tsx           AppShell layout, React.lazy() cho 5 trang → Suspense fallback
pages/            5 trang (Dashboard, Products, Sales, Customers, Debts)
components/       component tái sử dụng (xem bảng dưới)
lib/              tiện ích (api, format, notify, confirm, labels, shopConfig, ...)
styles.css        CSS toàn cục: hover, transition, prefers-reduced-motion
```

### Lazy loading

Tất cả 5 trang dùng `React.lazy()` + `Suspense` — Vite tự tách thành các chunk riêng. Bundle ban đầu nhẹ hơn ~70%.

### Quản lý state

- **Server state:** TanStack Query (`useQuery` / `useMutation`) — cache, refetch, loading/error tự động
- **UI state:** `useState` / `useDisclosure` local trong component

### Dark/Light mode

- `defaultColorScheme="auto"` — lấy từ OS preference
- Nhớ lựa chọn người dùng qua `localStorageColorSchemeManager` (key `crm-color-scheme`)
- Script chống FOUC trong `client/index.html`
- Nút toggle: `ColorSchemeToggle` góc trên phải Header

### Components tái sử dụng

| Component | Dùng ở |
|---|---|
| `SaleForm` | SalesPage — tạo/sửa đơn |
| `SaleDetailModal` | SalesPage — xem chi tiết + thanh toán |
| `ImportModal` | ProductsPage — nhập Excel |
| `UnitsModal` | ProductsPage — quản lý serial |
| `CustomerDetailModal` | CustomersPage — lịch sử KH |
| `DashboardCustomerCharts` | DashboardPage — 4 biểu đồ KH |
| `DashboardProductCharts` | DashboardPage — 4 biểu đồ SP |
| `ListTable` | mọi trang — bảng danh sách |
| `ChartCard` | DashboardPage — khung biểu đồ |
| `LoadingBlock` | mọi trang — trạng thái tải |
| `ColorSchemeToggle` | App.tsx Header |

---

## Shared (`shared/types.ts`)

Chứa toàn bộ TypeScript interface/type dùng chung giữa server và client. Không có logic, chỉ là type definitions.

Hai phân biệt quan trọng trong `Product`:

| Field | Giá trị | Ý nghĩa |
|---|---|---|
| `type` | `SERIALIZED` / `QUANTITY` | Cách theo dõi tồn kho (serial hay số lượng) |
| `category` | `bike` / `accessory` | Phân loại kinh doanh (`Xe` / `Phụ kiện`) |

`type` và `category` độc lập nhau — xe có thể theo dõi bằng số lượng, phụ kiện có thể dùng serial. `category` dùng để nhóm doanh thu trên Dashboard ("Doanh thu theo loại SP").

---

## Luồng dữ liệu quan trọng

### Tạo đơn bán hàng

```
SaleForm (client)
  → POST /api/sales
  → salesRepo.create()  [transaction]
      → INSERT sales
      → INSERT sale_items (trừ tồn kho)
      → nếu còn_nợ > 0: INSERT debt_payments (ghi nhận nợ)
  → TanStack Query invalidate ['sales', 'debts', 'dashboard']
```

### Sửa đơn bán hàng (reverse-and-reapply)

```
SaleForm (client, editId prop)
  → PUT /api/sales/:id
  → salesRepo.update()  [transaction]
      → guard: paidVnd >= min(collected, total) — ném lỗi nếu vi phạm
      → restoreInventory()    — hoàn tồn kho từ đơn cũ
      → dropDebtsAndItems()   — xóa debt_payments, debts, sale_items cũ
      → UPDATE sales          — cập nhật thông tin đơn
      → writeItems()          — ghi sale_items mới (trừ tồn kho lại)
      → createDebtIfUnderpaid() — tạo nợ nếu vẫn còn thiếu
  → TanStack Query invalidate ['sales', 'debts', 'dashboard']
```

Lịch sử trả từng đợt bị xóa khi sửa; giá trị "Khách trả" trong form đại diện tổng số tiền đã thu thực tế.

### Thu nợ

```
SaleDetailModal (client)
  → POST /api/sales/:id/payments
  → salesRepo.addPayment()
      → INSERT debt_payments
      → cập nhật trạng thái sale nếu đã đủ
  → TanStack Query invalidate → UI cập nhật khắp nơi
```

### Nhập Excel

```
ImportModal (client)
  → parse .xlsx (lib/excel.ts) → validate từng dòng
  → nếu có lỗi: hiển thị danh sách lỗi, KHÔNG gọi API
  → nếu OK: POST /api/products/import
  → server validate lại bằng Zod → transaction insert tất cả
```

---

## Ghi chú vận hành

- **Sao lưu:** copy file `data/crm.db`
- **Reset data:** xóa `data/crm.db` (tự tạo lại khi khởi động)
- **Logs:** server in ra stdout; lỗi API in thêm stack trace vào `console.error`
- **Không có auth:** app thiết kế cho 1 người dùng, không cần đăng nhập
