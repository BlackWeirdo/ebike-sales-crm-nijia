# Phase 02 — Confirm / Loading / Responsive / A11y · status: done

**Date:** 2026-06-14 · Priority: High

## Đã làm
- **Thông báo đẹp:** [confirm.ts](../../client/src/lib/confirm.ts) `confirmDelete` thay 3 `confirm()` native (ProductsPage, CustomersPage, DebtPaymentsManager); [notify.ts](../../client/src/lib/notify.ts) toast có icon ✓/⚠ + viền; `alert()` trong printInvoice → toast.
- **Loading đẹp:** [LoadingBlock.tsx](../../client/src/components/LoadingBlock.tsx) (Loader căn giữa) thay text "Đang tải..." ở SaleDetailModal, CustomerDetailModal, DebtsPage, DebtPaymentsManager; ListTable hiện **skeleton rows** khi tải; Suspense fallback Loader cho lazy route.
- **Responsive:** Header + Burger; navbar thu gọn `breakpoint sm`; [PageHeader](../../client/src/components/PageHeader.tsx) wrap; KPI/grid xếp dọc mobile; bảng cuộn ngang.
- **Keyboard/A11y:** ActionIcon xóa có `aria-label`; hàng KH bấm được thêm `tabIndex` + Enter; Burger có aria-label; modal Esc/Enter; focusRing auto.

## Verify — ĐẠT
typecheck sạch · build OK · 33 test pass · confirm modal hiện (không native) · burger mobile · 0 lỗi console.
