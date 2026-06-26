# Phase 06 — Hiển thị (printInvoice + SaleDetailModal)

## Context links
- Plan cha: [plan.md](plan.md)
- Deps: [phase-03-backend-sales.md](phase-03-backend-sales.md) (SaleDetail trả `paymentAccounts`), [phase-05-frontend-saleform.md](phase-05-frontend-saleform.md) (tạo dữ liệu).
- Block: không (lá cuối chuỗi feature).

## Overview
- Date: 2026-06-26
- Description: In block "THÔNG TIN CHUYỂN KHOẢN" trên phiếu bán hàng và hiển thị các dòng chia TK trong modal chi tiết đơn.
- Priority: P1
- Implementation status: Pending
- Review status: Not reviewed

## Key Insights
- `client/src/lib/printInvoice.ts`: `buildInvoiceHtml(sale, logo)` build HTML chuỗi. Có khối totals + khối customer. Mọi text PHẢI qua `esc()` (chống vỡ HTML / injection trong template chuỗi).
- `client/src/components/SaleDetailModal.tsx`: hiển thị data đơn → thêm danh sách `data.paymentAccounts` nếu có.
- Render cả khi đơn còn nợ (đúng tinh thần "chỉ dẫn khách sẽ chuyển").

## Requirements
- printInvoice: block hiển thị từng dòng — `label`, ngân hàng, số TK, chủ TK, số tiền (`formatVnd`). Đặt sau totals hoặc gần khối customer. Ẩn block nếu `paymentAccounts` rỗng.
- SaleDetailModal: section liệt kê các dòng chia (read-only). Ẩn nếu rỗng.

## Architecture
- printInvoice: hàm con `renderPaymentAccounts(lines)` trả HTML string, mỗi field qua `esc()`, số tiền qua `formatVnd`. Nếu `!lines?.length` → trả `''`.
- Modal: map `data.paymentAccounts` ra list Mantine (Stack/Table), dùng `formatVnd`.

## Related code files
- `client/src/lib/printInvoice.ts`
- `client/src/components/SaleDetailModal.tsx`
- `shared/types.ts` (`PaymentAccountLine` — đã có từ phase 01)

## Implementation Steps

### Step 6.1 — Block chuyển khoản trong printInvoice
- Mục tiêu: thêm `renderPaymentAccounts` + chèn vào template; esc() mọi text; formatVnd cho amount; ẩn khi rỗng.
- File đụng: `client/src/lib/printInvoice.ts`
- Rủi ro: TB — template là chuỗi HTML thủ công, sai dấu nháy/thiếu esc() có thể vỡ layout hoặc XSS trong cửa sổ in. Bắt buộc esc().
- Độ khó: TB
- Cách verify: in thử đơn có chia → block hiện đúng số liệu, format VND đúng; đơn không chia → không có block; thử label chứa `<` → không vỡ HTML.

### Step 6.2 — Section trong SaleDetailModal
- Mục tiêu: liệt kê các dòng chia (label, bank, số TK, chủ TK, số tiền), ẩn khi rỗng.
- File đụng: `client/src/components/SaleDetailModal.tsx`
- Rủi ro: Thấp. `paymentAccounts` luôn `[]` (không undefined) nhờ repo default → an toàn map.
- Độ khó: Dễ
- Cách verify: mở chi tiết đơn có chia → thấy section; đơn cũ/không chia → không thấy.

## Todo list
- [ ] 6.1 printInvoice block + esc + formatVnd + ẩn khi rỗng
- [ ] 6.2 SaleDetailModal section
- [ ] verify in + modal cho đơn có/không chia + text đặc biệt

## Success Criteria
- Phiếu in hiển thị thông tin chuyển khoản đúng, an toàn (escaped), ẩn khi không có.
- Modal chi tiết hiển thị các dòng chia.

## Risk Assessment
- XSS/vỡ HTML trong print template → mitigate bắt buộc `esc()` mọi field text.

## Security Considerations
- `esc()` cho label/bankName/accountNumber/accountHolder (dữ liệu người dùng nhập ở danh mục TK) trước khi nhúng vào HTML in.

## Next steps
→ Phase 07 hoàn tất test (bao gồm hiển thị nếu có e2e).
