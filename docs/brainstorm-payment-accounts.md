# Brainstorm: Chia tài khoản nhận tiền trên đơn bán

> Trạng thái: ĐÃ CHỐT phương án (brainstorm) — chờ user duyệt để chuyển sang implement (/fix:hard).
> Ngày: 2026-06-26

## 1. Problem statement

Một đơn bán, tiền khách chuyển bị **chia ra nhiều tài khoản nhận** (VD 60tr → TK công ty, 30tr → TK cá nhân NV kinh doanh). Cần:
- Khi tạo/sửa đơn: chọn tài khoản nhận + nhập số tiền cho từng TK (nhiều dòng).
- In các dòng đó lên phiếu bán hàng (chỉ dẫn chuyển khoản cho khách).

## 2. Quyết định (locked với user)

| Vấn đề | Chốt |
|---|---|
| Vai trò số tiền | **Hướng A** — chỉ để in, KHÔNG ảnh hưởng Khách trả / Còn nợ / công nợ / dashboard |
| Ý nghĩa | **Chỉ dẫn khách sẽ chuyển** (in cả khi đơn còn nợ / chưa nhận tiền) |
| Nguồn tài khoản | **Màn quản lý tài khoản (CRUD)** riêng |
| Báo cáo theo TK/NV | **Chưa cần** |

Hệ quả: tiền chia theo TK **độc lập** với hệ thống kế toán. Không validation cứng tổng = X. Có thể thêm **cảnh báo mềm** (non-blocking) nếu tổng chia ≠ Tổng cộng đơn.

## 3. Phương án kỹ thuật

### 3.1 Lưu trữ — lai (hybrid)
- **`bank_accounts`** (bảng mới, có CRUD): danh mục tài khoản dùng lại.
  - `id, label, bank_name, account_number, account_holder, active, created_at`
  - `label` = tên gợi nhớ (vd "Công ty - VCB", "NV Ngọc - MB").
- **`sales.payment_accounts`** (cột TEXT/JSON mới): **snapshot** các dòng chia của đơn đó.
  - Mảng `{ accountId, bankName, accountNumber, accountHolder, label, amountVnd }`.
  - **Snapshot** (copy thông tin TK vào đơn) → sửa/xóa TK trong danh mục về sau KHÔNG làm sai phiếu cũ.
  - JSON thay vì bảng con vì: chỉ để in, không query/tổng hợp (báo cáo chưa cần) → đỡ join, hợp với cơ chế sửa đơn reverse-reapply hiện tại (chỉ thêm 1 field vào UPDATE).

### 3.2 Backend
- `shared/types.ts`: thêm `BankAccount`, `PaymentAccountLine`; thêm `paymentAccounts` vào `Sale`/`CreateSaleInput`/`SaleDetail`.
- `schema.sql`: thêm bảng `bank_accounts`. Thêm cột `sales.payment_accounts`.
  - ⚠️ **Migration**: DB cũ đã có bảng `sales` → `CREATE TABLE IF NOT EXISTS` KHÔNG thêm cột. Phải `ALTER TABLE sales ADD COLUMN payment_accounts TEXT` có kiểm tra tồn tại (PRAGMA table_info). Đây là rủi ro #1.
- `repos/bankAccounts.ts`: CRUD.
- `repos/sales.ts`: serialize/parse JSON khi create/update/get. Update đã reverse-reapply → chỉ thêm field.
- `routes/bank-accounts.ts` + mount; `routes/sales.ts`: nới Zod schema nhận `paymentAccounts`.

### 3.3 Frontend
- Trang mới **"Tài khoản nhận tiền"** (CRUD) + thêm vào nav `App.tsx`.
- `SaleForm.tsx`: khối lặp "Tài khoản nhận tiền" (Select TK + MoneyInput số tiền + nút thêm/xóa dòng). Cảnh báo mềm nếu tổng ≠ Tổng cộng.
- `printInvoice.ts`: thêm block "THÔNG TIN CHUYỂN KHOẢN" (tên TK, ngân hàng, số TK, chủ TK, số tiền).
- `SaleDetailModal.tsx`: hiển thị các dòng chia.
- `api.ts`: thêm `bankAccounts` client.

## 4. Rủi ro & lưu ý
1. **Migration cột mới trên DB cũ** — bắt buộc xử lý ALTER có guard, nếu không create/get đơn sẽ lỗi.
2. **Snapshot vs tham chiếu** — phải snapshot để phiếu cũ không đổi khi danh mục TK thay đổi.
3. **Không nhầm sang kế toán** — tuyệt đối không cộng vào `paid_vnd`/công nợ. Chỉ là dữ liệu in.
4. Cảnh báo tổng lệch để **mềm** (không chặn lưu) — vì là chỉ dẫn, có thể khác Tổng cộng.
5. UI đơn bán đang khá dài → đặt khối TK gọn, chỉ hiện khi cần (có thể ẩn sau toggle "Chia tài khoản nhận tiền").

## 5. Out of scope (YAGNI)
- Báo cáo tổng tiền theo TK / theo nhân viên.
- Gắn TK vào từng lần thu nợ (debt_payments).
- Đối soát/khóa tổng = Khách trả.

## 6. Next steps
1. User duyệt phương án này.
2. Chuyển `/fix:hard`: planner lập plan chi tiết → implement → tester → code-reviewer.
