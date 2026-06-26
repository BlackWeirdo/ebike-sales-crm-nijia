# Phase 04 — Frontend hạ tầng (api client + page CRUD + nav)

## Context links
- Plan cha: [plan.md](plan.md)
- Deps: [phase-02-backend-bank-accounts.md](phase-02-backend-bank-accounts.md) (API có thật).
- Block: 05 (SaleForm cần `api.bankAccounts.list`).

## Overview
- Date: 2026-06-26
- Description: Thêm `api.bankAccounts.*` vào client api layer; trang `BankAccountsPage` CRUD; mục nav "Tài khoản nhận tiền".
- Priority: P1
- Implementation status: Pending
- Review status: Not reviewed

## Key Insights
- `client/src/lib/api.ts`: object `api` với `api.products/customers/sales/...`, mỗi cái có `list/get/create/update/remove` gọi http helper. Thêm `api.bankAccounts` y hệt pattern.
- `client/src/App.tsx`: mảng `NAV = [{to,label,icon}]` render NavLink + lazy pages + Routes. Thêm 1 mục + lazy `BankAccountsPage` + route.
- Stack UI: Mantine 7 + TanStack Query. Tái dùng pattern page CRUD sẵn có (vd CustomersPage) → DRY.
- Icon gợi ý: `IconBuildingBank` từ `@tabler/icons-react`.

## Requirements
- `api.bankAccounts.{list,get,create,update,remove}`.
- Trang CRUD: bảng list + form thêm/sửa (label, bankName, accountNumber, accountHolder, active) + nút xóa.
- Nav item + route `/bank-accounts` (lazy).

## Architecture
- TanStack Query: `useQuery(['bankAccounts'], api.bankAccounts.list)`; mutations create/update/remove `invalidateQueries(['bankAccounts'])`.
- Form: Mantine `TextInput` x4 + `Switch` active; modal hoặc inline (theo pattern page CRUD gần nhất trong dự án).

## Related code files
- `client/src/lib/api.ts` (thêm `api.bankAccounts`)
- `client/src/pages/BankAccountsPage.tsx` (MỚI — đặt theo thư mục pages hiện có)
- `client/src/App.tsx` (NAV + lazy + Route)
- Tham chiếu pattern: trang CRUD khách hàng/sản phẩm hiện có (mẫu gần nhất).

## Implementation Steps

### Step 4.1 — `api.bankAccounts` trong api.ts
- Mục tiêu: thêm object `bankAccounts` với list/get/create/update/remove trỏ `/api/bank-accounts`.
- File đụng: `client/src/lib/api.ts`
- Rủi ro: Thấp. Khớp đường dẫn endpoint phase 02.
- Độ khó: Dễ
- Cách verify: gọi `api.bankAccounts.list()` ở page thấy data; Network tab 200.

### Step 4.2 — `BankAccountsPage.tsx` CRUD
- Mục tiêu: bảng + form thêm/sửa/xóa, dùng TanStack Query + Mantine, theo pattern page sẵn có.
- File đụng: `client/src/pages/BankAccountsPage.tsx`
- Rủi ro: Thấp–TB. Đảm bảo invalidate query sau mutation để UI cập nhật.
- Độ khó: TB
- Cách verify: thủ công — thêm/sửa/xóa TK thấy bảng cập nhật; reload vẫn còn (đã lưu DB).

### Step 4.3 — Nav + route trong App.tsx
- Mục tiêu: thêm `{to:'/bank-accounts', label:'Tài khoản nhận tiền', icon: IconBuildingBank}` vào NAV; `const BankAccountsPage = lazy(...)`; thêm `<Route path="/bank-accounts" .../>`.
- File đụng: `client/src/App.tsx`
- Rủi ro: Thấp. Import icon đúng tên; lazy path đúng.
- Độ khó: Dễ
- Cách verify: nav xuất hiện, click vào mở trang không lỗi console.

## Todo list
- [ ] 4.1 api.bankAccounts
- [ ] 4.2 BankAccountsPage CRUD
- [ ] 4.3 nav + lazy + route
- [ ] verify CRUD end-to-end qua UI

## Success Criteria
- Vào `/bank-accounts` CRUD được TK, lưu xuống DB, reload còn.
- Nav hiển thị đúng, icon đúng.

## Risk Assessment
- Quên invalidate → UI cũ. Verify thủ công bắt được.
- Phân quyền màn này: xem Unresolved Q3.

## Security Considerations
- Page gọi API đã `requireAuth`. Không lưu account_number vào localStorage/cache ngoài Query cache thông thường.

## Next steps
→ Phase 05 dùng `api.bankAccounts.list()` để render Select chọn TK trong SaleForm.
