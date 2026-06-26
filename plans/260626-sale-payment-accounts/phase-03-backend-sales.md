# Phase 03 — Backend sales (lưu/đọc payment_accounts + Zod)

## Context links
- Plan cha: [plan.md](plan.md)
- Deps: [phase-01-foundation.md](phase-01-foundation.md) (type + cột `payment_accounts`).
- Block: 05 (FE save), 06 (SaleDetail trả paymentAccounts), 07 (tests).

## Overview
- Date: 2026-06-26
- Description: Lưu/đọc cột JSON `sales.payment_accounts` trong `repos/sales.ts` (create/update/get/list) và nới Zod `routes/sales.ts` nhận `paymentAccounts`. **KHÔNG đụng tính toán tiền.**
- Priority: P0
- Implementation status: Pending
- Review status: Not reviewed

## Key Insights
- `repos/sales.ts`: `SALE_COLS` là chuỗi cột để đọc; `create()`/`update()` chạy trong `transaction`. `update()` theo cơ chế **reverse-and-reapply** (restoreInventory → dropDebtsAndItems → UPDATE sales → writeItems → createDebtIfUnderpaid).
- `paymentAccounts` chỉ là 1 cột phẳng JSON → chỉ thêm vào INSERT/UPDATE + thêm vào SALE_COLS để đọc, parse JSON string→array trong `get()`/`list()`.
- **TUYỆT ĐỐI** không truyền `paymentAccounts` vào `computeAndValidate` hay bất kỳ logic `paid_vnd`/công nợ nào.
- Snapshot do CLIENT gửi sẵn (xem trade-off ở plan.md) → server chỉ `JSON.stringify(input.paymentAccounts ?? [])`.

## Requirements
- `create()`: lưu `payment_accounts = JSON.stringify(paymentAccounts ?? [])`.
- `update()`: cập nhật cột trong bước UPDATE sales (reverse-reapply giữ nguyên phần tiền).
- `get()`/`list()`: parse JSON → `paymentAccounts: PaymentAccountLine[]` (mặc định `[]` nếu null/lỗi parse).
- Zod `createSchema`: thêm `paymentAccounts` optional = mảng object shape `PaymentAccountLine`.

## Architecture
- Helper nội bộ `parsePaymentAccounts(text): PaymentAccountLine[]` — try/catch JSON.parse, trả `[]` khi null/rỗng/lỗi (DB cũ cột NULL).
- `SALE_COLS` thêm `payment_accounts`.

## Related code files
- `server/repos/sales.ts` (SALE_COLS, create, update, get, list)
- `server/routes/sales.ts` (createSchema Zod — và updateSchema nếu tách riêng)

## Implementation Steps

### Step 3.1 — Đọc: SALE_COLS + parse trong get/list
- Mục tiêu: thêm `payment_accounts` vào SALE_COLS; trong build SaleDetail (`get`) và `list` map `paymentAccounts = parsePaymentAccounts(row.payment_accounts)`.
- File đụng: `server/repos/sales.ts`
- Rủi ro: Thấp–TB. Đơn cũ có cột NULL → parse phải trả `[]`, không throw. Đảm bảo `list` (nhiều row) cũng map, tránh sót.
- Độ khó: Dễ
- Cách verify: test `get` đơn cũ (payment_accounts NULL) → `paymentAccounts: []`, không lỗi.

### Step 3.2 — Ghi: create()
- Mục tiêu: thêm `payment_accounts` vào câu INSERT, value = `JSON.stringify(input.paymentAccounts ?? [])`.
- File đụng: `server/repos/sales.ts`
- Rủi ro: Thấp. Không được để ảnh hưởng thứ tự cột/placeholder INSERT khác → thêm cẩn thận cuối danh sách.
- Độ khó: Dễ
- Cách verify: test create với 2 dòng chia → get trả đúng 2 dòng; `paid_vnd`/`total_vnd` không đổi so với input.

### Step 3.3 — Ghi: update() (reverse-reapply)
- Mục tiêu: thêm `payment_accounts` vào bước UPDATE sales bên trong transaction. KHÔNG đụng restoreInventory/dropDebts/createDebtIfUnderpaid.
- File đụng: `server/repos/sales.ts`
- Rủi ro: **TB** — update là chỗ phức tạp nhất (transaction nhiều bước). Sửa nhầm có thể vỡ tồn kho/công nợ. Chỉ thêm 1 field vào câu UPDATE sales, không động bước khác.
- Độ khó: TB
- Cách verify: test update đổi paymentAccounts → get trả mới; đồng thời assert tồn kho + debt + paid_vnd KHÔNG đổi (regression).

### Step 3.4 — Nới Zod `routes/sales.ts`
- Mục tiêu: `createSchema` (và update tương ứng) thêm `paymentAccounts: z.array(lineSchema).optional()`. `lineSchema` = accountId nullable number, các string, amountVnd int ≥ 0.
- File đụng: `server/routes/sales.ts`
- Rủi ro: Thấp. Để optional → đơn không gửi vẫn pass (backward compat).
- Độ khó: Dễ
- Cách verify: Supertest POST sale kèm paymentAccounts hợp lệ → 200; kèm amountVnd âm/sai type → 400; KHÔNG kèm → vẫn 200.

## Todo list
- [ ] 3.1 SALE_COLS + parse get/list (NULL→[])
- [ ] 3.2 create INSERT
- [ ] 3.3 update UPDATE (giữ nguyên phần tiền)
- [ ] 3.4 Zod optional array
- [ ] test: lưu/đọc + regression tiền không đổi

## Success Criteria
- Create/update lưu & trả đúng `paymentAccounts`.
- Đơn cũ (NULL) → `[]`, không lỗi.
- `paid_vnd`, công nợ, tồn kho KHÔNG bị ảnh hưởng (regression test xanh).

## Risk Assessment
- Vỡ logic tiền ở update() — mitigate: chỉ thêm field, regression test bắt buộc trước khi coi xong.
- Parse JSON lỗi làm sập `get`/`list` — mitigate: try/catch → `[]`.

## Security Considerations
- Zod chỉ validate **shape**, không validate **giá trị** TK (snapshot từ client) — chấp nhận theo trade-off (chỉ để in). Vẫn chặn payload rác/oversize? Cân nhắc giới hạn độ dài mảng (vd ≤ 20 dòng) để tránh abuse — đề xuất thêm `.max(20)` vào Zod array.

## Next steps
→ Phase 05 (FE gửi snapshot), Phase 06 (hiển thị), Phase 07 (test BE chạy được ngay sau phase này).
