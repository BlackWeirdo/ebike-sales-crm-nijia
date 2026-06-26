# Phase 02 — Backend bank_accounts (repo + route + mount)

## Context links
- Plan cha: [plan.md](plan.md)
- Deps: [phase-01-foundation.md](phase-01-foundation.md) (cần type `BankAccount` + bảng `bank_accounts`).
- Block: 04 (FE cần API CRUD này).

## Overview
- Date: 2026-06-26
- Description: CRUD đầy đủ cho danh mục tài khoản nhận tiền: repo + route Express + mount vào app.
- Priority: P0
- Implementation status: Pending
- Review status: Not reviewed

## Key Insights
- Theo pattern repo sẵn có (`server/repos/*.ts`): hàm `list/get/create/update/remove`, dùng prepared statement của `node:sqlite`.
- Route theo pattern `server/routes/*.ts`: `validateBody(zodSchema)` cho create/update; mount trong `app.ts` SAU `requireAuth`.
- KISS: bank_accounts không có quan hệ phức tạp → CRUD phẳng, không transaction.

## Requirements
- Endpoints: `GET /api/bank-accounts` (list), `POST` (create), `PUT/:id` (update), `DELETE/:id` (remove).
- Validate shape bằng Zod: label/bankName/accountNumber/accountHolder string non-empty; active boolean/optional.
- Xóa mềm hay cứng: xem Unresolved Q2 — đề xuất xóa mềm (active=0). Plan dưới mô tả cả 2, mặc định mềm.

## Architecture
- `repos/bankAccounts.ts`: map row snake_case → camelCase `BankAccount`. `list()` tùy chọn lọc `active`.
- `routes/bank-accounts.ts`: router Express, gọi repo, trả JSON.
- `app.ts`: `app.use('/api/bank-accounts', bankAccountsRouter)` sau `app.use(requireAuth)`.

## Related code files
- `server/repos/bankAccounts.ts` (MỚI)
- `server/routes/bank-accounts.ts` (MỚI)
- `server/app.ts` (thêm import + mount)
- Tham chiếu pattern: `server/repos/customers.ts`, `server/routes/customers.ts` (mẫu CRUD đơn giản nhất gần nhất).

## Implementation Steps

### Step 2.1 — `repos/bankAccounts.ts`
- Mục tiêu: hàm `list(opts?)`, `get(id)`, `create(input)`, `update(id, input)`, `remove(id)`. Map snake↔camel. created_at = ngày hôm nay (TEXT) khi create.
- File đụng: `server/repos/bankAccounts.ts`
- Rủi ro: Thấp. Nhớ map `active` INTEGER(0/1) ↔ boolean.
- Độ khó: Dễ
- Cách verify: unit test repo trên `:memory:`: create → list trả đúng; update đổi label; remove (mềm) → active=0 và list mặc định ẩn.

### Step 2.2 — `routes/bank-accounts.ts` + Zod
- Mục tiêu: router với 4 endpoint, Zod schema cho create/update, `validateBody`.
- File đụng: `server/routes/bank-accounts.ts`
- Rủi ro: Thấp. Đảm bảo trả lỗi 400 khi body sai shape (theo pattern validateBody hiện có).
- Độ khó: Dễ
- Cách verify: Supertest: POST hợp lệ → 200/201 + body; POST thiếu field → 400.

### Step 2.3 — Mount vào `app.ts`
- Mục tiêu: import `bankAccountsRouter`, `app.use('/api/bank-accounts', ...)` đặt SAU `requireAuth`.
- File đụng: `server/app.ts`
- Rủi ro: Thấp nhưng quan trọng: nếu đặt TRƯỚC `requireAuth` → endpoint hở (không auth). Phải đặt sau, cùng nhóm các router khác.
- Độ khó: Dễ
- Cách verify: Supertest gọi không kèm auth → 401; kèm auth → 200. Grep vị trí dòng mount nằm dưới requireAuth.

## Todo list
- [ ] 2.1 repo CRUD + map active
- [ ] 2.2 route + Zod + validateBody
- [ ] 2.3 mount sau requireAuth
- [ ] test CRUD + auth gate

## Success Criteria
- 4 endpoint hoạt động, có auth gate, validate shape.
- Xóa mềm: TK remove không hiện ở list mặc định nhưng vẫn `get` được (để snapshot cũ tham chiếu nếu cần).

## Risk Assessment
- Hở auth nếu mount sai chỗ → verify bằng test 401.
- Đổi giữa xóa mềm/cứng về sau là breaking nhỏ → chốt sớm (Unresolved Q2).

## Security Considerations
- Tất cả endpoint sau `requireAuth`.
- Không trả `account_number` ra log. Cân nhắc che bớt khi list? → KHÔNG cần (user nội bộ cần thấy đủ để in). Để nguyên.

## Next steps
→ Phase 04 dùng `api.bankAccounts.*` để dựng màn CRUD + Select trong SaleForm.
