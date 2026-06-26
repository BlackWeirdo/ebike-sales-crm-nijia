# Phase 07 — Tests

## Context links
- Plan cha: [plan.md](plan.md)
- Deps: [phase-01](phase-01-foundation.md), [phase-02](phase-02-backend-bank-accounts.md), [phase-03](phase-03-backend-sales.md) (BE); [phase-05](phase-05-frontend-saleform.md), [phase-06](phase-06-display.md) (FE/e2e tùy chọn).
- Block: không (gate chất lượng cuối).

## Overview
- Date: 2026-06-26
- Description: Test backend (Vitest + Supertest, DB `:memory:`) cho bank_accounts CRUD, lưu/đọc payment_accounts, migration không phá dữ liệu cũ, và **regression: paymentAccounts KHÔNG ảnh hưởng collected/remaining/công nợ/tồn kho**.
- Priority: P0 (regression là yêu cầu cốt lõi của Hướng A)
- Implementation status: Pending
- Review status: Not reviewed

## Key Insights
- Test stack sẵn: Vitest + Supertest, DB `:memory:`. Có file test mẫu (vd `api.test.ts`) → tái dùng setup app + auth.
- Trọng tâm KHÔNG phải coverage cao mà là **chứng minh tính bất biến của tiền** (Hướng A) + migration an toàn.
- Viết tăng dần: nhóm BE chạy được ngay sau phase 03.

## Requirements
- bank_accounts: create/list/update/remove + auth gate + validate 400.
- sales: create/update lưu & get trả đúng paymentAccounts; đơn cũ NULL → `[]`.
- Migration: DB chỉ có sales (không cột) → init → cột thêm, data cũ nguyên.
- **Regression**: tạo/sửa đơn có & không có paymentAccounts → `paid_vnd`, total, debt, tồn kho GIỐNG nhau.

## Architecture
- File test mới: `server/__tests__/bankAccounts.test.ts`, `server/__tests__/salePaymentAccounts.test.ts`, `server/__tests__/migration.test.ts` (theo vị trí test hiện có trong repo — chỉnh path cho khớp).

## Implementation Steps

### Step 7.1 — bank_accounts CRUD + auth + validate
- Mục tiêu: phủ 4 endpoint, 401 khi thiếu auth, 400 khi body sai.
- File đụng: test file bankAccounts.
- Rủi ro: Thấp.
- Độ khó: Dễ
- Cách verify: `npm test` xanh; cố tình bỏ mount → 404/401 (chứng minh test có hiệu lực).

### Step 7.2 — sales lưu/đọc payment_accounts
- Mục tiêu: POST sale kèm 2 dòng → GET trả đúng 2 dòng (đủ field snapshot). Đơn không kèm → `[]`. Update đổi dòng → get phản ánh.
- File đụng: test file salePaymentAccounts.
- Rủi ro: Thấp–TB (so khớp shape snapshot).
- Độ khó: TB
- Cách verify: `npm test` xanh.

### Step 7.3 — Regression tiền/tồn kho (CỐT LÕI)
- Mục tiêu: 2 đơn input giống hệt, 1 có paymentAccounts 1 không → assert `paid_vnd`, `total_vnd`, debt record, tồn kho SP bằng nhau. Cảnh báo mềm mismatch KHÔNG chặn create.
- File đụng: test file salePaymentAccounts.
- Rủi ro: TB — phải đọc đúng nguồn tồn kho/debt để assert. Đây là test quan trọng nhất.
- Độ khó: TB
- Cách verify: `npm test` xanh; thử cố ý cộng amountVnd vào paid_vnd ở repo → test PHẢI đỏ (chứng minh test bắt được vi phạm Hướng A).

### Step 7.4 — Migration không phá dữ liệu cũ
- Mục tiêu: dựng DB `:memory:` chỉ với bảng sales kiểu cũ (không payment_accounts) + 1 row → chạy ensureColumn/init → cột xuất hiện, row cũ còn, `paymentAccounts` đọc ra `[]`.
- File đụng: test file migration.
- Rủi ro: TB — mô phỏng schema cũ đúng cách.
- Độ khó: TB
- Cách verify: `npm test` xanh.

## Todo list
- [ ] 7.1 bank_accounts CRUD/auth/validate
- [ ] 7.2 sales lưu/đọc paymentAccounts (+ NULL→[])
- [ ] 7.3 regression tiền/tồn kho/debt bất biến
- [ ] 7.4 migration giữ data cũ
- [ ] toàn bộ `npm test` xanh

## Success Criteria
- Tất cả test xanh.
- Test 7.3 chứng minh được Hướng A (đỏ khi cố tình vi phạm).
- Không regression test cũ.

## Risk Assessment
- Test giả (luôn xanh) → mitigate bằng "mutation check": cố ý phá code thấy test đỏ.

## Security Considerations
- Test auth gate cho bank_accounts (401 khi thiếu token) là 1 phần security.

## Next steps
- Cập nhật `plan.md` status các phase → Completed.
- Cân nhắc smoke test thủ công e2e (tạo TK → tạo đơn chia → in → kiểm phiếu) trước khi giao.
