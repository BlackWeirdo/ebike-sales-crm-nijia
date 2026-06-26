# Phase 05 — Frontend đơn bán (khối chia TK trong SaleForm)

## Context links
- Plan cha: [plan.md](plan.md)
- Deps: [phase-04-frontend-infra.md](phase-04-frontend-infra.md) (`api.bankAccounts.list`), [phase-03-backend-sales.md](phase-03-backend-sales.md) (BE nhận `paymentAccounts`).
- Block: 06 (gián tiếp — sinh dữ liệu để hiển thị).

## Overview
- Date: 2026-06-26
- Description: Thêm vào `SaleForm` toggle "Chia tài khoản nhận tiền" + khối lặp các dòng (chọn TK + nhập số tiền) + cảnh báo mềm khi tổng chia ≠ tổng đơn. Build snapshot vào payload create/update.
- Priority: P1
- Implementation status: Pending
- Review status: Not reviewed

## Key Insights
- `SaleForm.tsx` là state-based form (useState: customerId, paymentMethod, discountVnd, paidVnd, cart...). `saveMut` build payload → `api.sales.create/update`. Có khối "Card" tổng tiền (subtotal/total/paidVnd/balance).
- Pattern Mantine sẵn dùng: Select, NumberInput, MoneyInput, Group, Stack, Divider, ActionIcon, Button → tái dùng (DRY).
- **CLIENT build snapshot đầy đủ** từ list TK trước khi gửi (trade-off ở plan.md): map `accountId → {label,bankName,accountNumber,accountHolder}` lấy từ `api.bankAccounts.list()`, gắn `amountVnd` user nhập.
- Edit mode: hydrate `paymentAccounts` từ `editSale.paymentAccounts` (đã là snapshot).

## Requirements
- State `paymentAccounts: { accountId:number|null, amountVnd:number }[]` (UI giữ tối thiểu; snapshot build lúc save).
- Toggle bật/tắt khối (Switch/Checkbox). Tắt → gửi `[]`.
- Mỗi dòng: `Select` TK (option từ list, label hiển thị `label — bankName`) + `MoneyInput` số tiền + `ActionIcon` xóa dòng. Nút "Thêm dòng".
- Cảnh báo mềm `Alert` color="yellow" khi `sum(amountVnd) !== total` — **non-blocking** (vẫn lưu được).
- KHÔNG đụng tính toán paid_vnd/balance trong Card tổng.

## Architecture
- `const { data: bankAccounts } = useQuery(['bankAccounts'], api.bankAccounts.list)` — chỉ TK active (xem Unresolved Q1).
- Lúc save: `paymentAccounts.map(line => { const acc = bankAccounts.find(a=>a.id===line.accountId); return { accountId: acc?.id ?? null, label: acc?.label, bankName:..., accountNumber:..., accountHolder:..., amountVnd: line.amountVnd } })`.
- Cảnh báo: `const splitTotal = sum(amountVnd); const mismatch = enabled && splitTotal !== total`.

## Related code files
- `client/src/components/SaleForm.tsx`
- `client/src/lib/api.ts` (đọc `api.bankAccounts.list`, `api.sales.create/update`)
- `shared/types.ts` (`PaymentAccountLine`, `CreateSaleInput.paymentAccounts`)

## Implementation Steps

### Step 5.1 — State + toggle + load list TK
- Mục tiêu: thêm state `paymentAccounts`, `splitEnabled`; query list TK.
- File đụng: `SaleForm.tsx`
- Rủi ro: Thấp. Đảm bảo không re-render loop (query key ổn định).
- Độ khó: Dễ
- Cách verify: bật toggle thấy khối hiện; list TK đổ vào Select.

### Step 5.2 — Khối lặp dòng (Select + MoneyInput + xóa + thêm)
- Mục tiêu: render rows, thêm/xóa dòng, cập nhật accountId/amountVnd.
- File đụng: `SaleForm.tsx`
- Rủi ro: TB — quản lý mảng trong state (immutable update), key React ổn định (dùng index hoặc id tạm).
- Độ khó: TB
- Cách verify: thêm 2 dòng, đổi TK/số tiền, xóa 1 dòng → state đúng.

### Step 5.3 — Cảnh báo mềm
- Mục tiêu: `Alert` vàng khi tổng chia ≠ total, non-blocking. Mốc so sánh = `total` (xem Unresolved Q4).
- File đụng: `SaleForm.tsx`
- Rủi ro: Thấp. KHÔNG được disable nút Lưu khi mismatch.
- Độ khó: Dễ
- Cách verify: nhập lệch → thấy cảnh báo, vẫn bấm Lưu được; nhập khớp → cảnh báo biến mất.

### Step 5.4 — Build snapshot vào payload + hydrate edit
- Mục tiêu: map snapshot lúc save; edit mode hydrate từ editSale.
- File đụng: `SaleForm.tsx`
- Rủi ro: TB — phải đảm bảo snapshot có đủ field cho print; edit hydrate đúng (tránh mất dòng cũ).
- Độ khó: TB
- Cách verify: tạo đơn có chia → mở lại sửa thấy đúng dòng; payload Network chứa snapshot đầy đủ; tiền (paid/balance) không đổi.

## Todo list
- [ ] 5.1 state + toggle + query list
- [ ] 5.2 rows CRUD trong form
- [ ] 5.3 cảnh báo mềm non-blocking
- [ ] 5.4 snapshot payload + hydrate edit
- [ ] verify tiền không đổi

## Success Criteria
- Tạo/sửa đơn với nhiều dòng chia TK, lưu thành công, mở lại đúng.
- Cảnh báo mềm hoạt động, không chặn lưu.
- Card tổng tiền (paid/balance/công nợ) KHÔNG đổi hành vi.

## Risk Assessment
- Đụng nhầm logic paidVnd → mitigate: chỉ thêm block mới, không sửa các handler tiền hiện có.
- Snapshot thiếu field → print trống → verify payload có đủ field.

## Security Considerations
- Hiển thị account_number trên form nội bộ OK (user đã auth). Không có input injection (số tiền NumberInput, TK từ Select cố định).

## Next steps
→ Phase 06 render snapshot lên phiếu in + modal chi tiết.
