# Phase 01 — Foundation: types + schema + migration

## Context links
- Plan cha: [plan.md](plan.md)
- Brainstorm: [docs/brainstorm-payment-accounts.md](../../docs/brainstorm-payment-accounts.md)
- Deps: không (phase đầu tiên). Block: 02, 03.

## Overview
- Date: 2026-06-26
- Description: Định nghĩa kiểu dữ liệu chung (`shared/types.ts`), schema bảng `bank_accounts` + cột `sales.payment_accounts` (`schema.sql`), và migration an toàn cho DB cũ (`ensureColumn`).
- Priority: P0 (nền tảng, mọi phase sau phụ thuộc)
- Implementation status: Pending
- Review status: Not reviewed

## Key Insights
- `shared/types.ts` = single source of truth, FE + BE đều import → sửa 1 chỗ.
- DB thật `data/crm.db` ĐÃ tồn tại bảng `sales` → `CREATE TABLE` không thêm cột mới. **BẮT BUỘC** dùng `ensureColumn` (đã có sẵn trong `server/db.ts`, chạy mỗi boot: PRAGMA table_info → ALTER ADD COLUMN nếu thiếu).
- `bank_accounts` dùng `CREATE TABLE IF NOT EXISTS` an toàn cho cả DB cũ/mới.
- Money = INTEGER VND. Dates = TEXT 'YYYY-MM-DD'. Tuân theo convention sẵn có.

## Requirements
- Type `BankAccount`, `PaymentAccountLine` mới.
- `Sale`, `SaleDetail`, `CreateSaleInput` thêm field `paymentAccounts`.
- Bảng `bank_accounts` + cột `sales.payment_accounts TEXT`.
- DB cũ không mất dữ liệu, không lỗi boot.

## Architecture
- `PaymentAccountLine` = snapshot 1 dòng chia: `{ accountId: number|null, label, bankName, accountNumber, accountHolder, amountVnd }`. `accountId` nullable phòng TK gốc bị xóa cứng về sau (snapshot vẫn còn).
- `BankAccount` = bản ghi danh mục: `{ id, label, bankName, accountNumber, accountHolder, active, createdAt }`.
- `CreateSaleInput.paymentAccounts?: PaymentAccountLine[]` (optional → backward compatible).

## Related code files
- `shared/types.ts` (thêm interfaces + field)
- `server/schema.sql` (thêm bảng + cột)
- `server/db.ts` (thêm 1 dòng `ensureColumn` ở chỗ migration boot)

## Implementation Steps

### Step 1.1 — Thêm types vào `shared/types.ts`
- Mục tiêu: khai báo `BankAccount`, `PaymentAccountLine`; thêm `paymentAccounts: PaymentAccountLine[]` vào `Sale` & `SaleDetail`; `paymentAccounts?: PaymentAccountLine[]` vào `CreateSaleInput`.
- File đụng: `shared/types.ts`
- Rủi ro: Thấp. Field bắt buộc trên `Sale`/`SaleDetail` có thể vỡ type ở chỗ build object nếu quên gán → bù bằng `[]` mặc định trong repo (phase 03).
- Độ khó: Dễ
- Cách verify: `npx tsc --noEmit` (hoặc build) pass; grep thấy interface mới.

### Step 1.2 — Schema cho DB mới (`schema.sql`)
- Mục tiêu: `CREATE TABLE IF NOT EXISTS bank_accounts (...)` với cột id, label, bank_name, account_number, account_holder, active (INTEGER default 1), created_at TEXT. Thêm `payment_accounts TEXT` vào định nghĩa `sales` (cho DB tạo mới sạch).
- File đụng: `server/schema.sql`
- Rủi ro: Thấp — chỉ ảnh hưởng DB tạo từ đầu. DB cũ bỏ qua nhờ `IF NOT EXISTS`.
- Độ khó: Dễ
- Cách verify: tạo DB `:memory:` (test) thấy bảng + cột tồn tại (PRAGMA table_info).

### Step 1.3 — Migration cột cho DB cũ (`db.ts`)
- Mục tiêu: thêm `ensureColumn('sales', 'payment_accounts', 'payment_accounts TEXT')` vào khối migration boot. (bank_accounts không cần ensureColumn vì IF NOT EXISTS trong schema chạy lúc init.)
- File đụng: `server/db.ts`
- Rủi ro: **Trung bình (rủi ro #1 của dự án)** — nếu đặt sai thứ tự (trước khi schema.sql chạy / trước khi bảng sales tồn tại) sẽ lỗi. Phải đặt sau khi schema init, cùng chỗ các `ensureColumn` hiện có.
- Độ khó: Dễ–TB
- Cách verify: (a) boot trên bản copy `data/crm.db` không lỗi, `SELECT payment_accounts FROM sales LIMIT 1` chạy được; (b) test migration: tạo DB chỉ có `sales` không cột → gọi init → cột xuất hiện, data cũ còn nguyên.

## Todo list
- [ ] 1.1 types
- [ ] 1.2 schema.sql bank_accounts + cột
- [ ] 1.3 ensureColumn migration
- [ ] tsc pass + boot copy DB cũ OK

## Success Criteria
- `tsc --noEmit` pass.
- Boot với DB cũ (copy) không lỗi; cột `payment_accounts` xuất hiện; data cũ nguyên vẹn.
- DB `:memory:` mới có cả bảng `bank_accounts` + cột.

## Risk Assessment
- **#1 Migration phá DB cũ**: mitigate bằng `ensureColumn` (idempotent) + test trên copy, KHÔNG chạy thẳng trên `data/crm.db` chưa backup. Khuyến nghị backup `data/crm.db` trước khi chạy lần đầu.

## Security Considerations
- `account_number`/`account_holder` là PII tài chính nhẹ → không log ra console; chỉ trả qua API đã `requireAuth`. Không có vấn đề mới ở phase này (chỉ schema).

## Next steps
→ Phase 02 (bank_accounts repo/route) và Phase 03 (sales repo/zod), chạy song song được.
