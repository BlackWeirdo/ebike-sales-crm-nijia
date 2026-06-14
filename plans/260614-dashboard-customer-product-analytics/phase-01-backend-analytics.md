# Phase 01 — Backend analytics · status: done

**Date:** 2026-06-14 · **Priority:** High

## Mục tiêu
2 endpoint analytics cho dashboard, không đổi schema DB.

## Files đã sửa
- `shared/types.ts` — thêm `CustomerAnalytics`, `ProductAnalytics`.
- `server/repos/dashboard.ts` — thêm `customerAnalytics(from,to)`, `productAnalytics(from,to)`.
- `server/routes/dashboard.ts` — GET `/customer-analytics`, `/product-analytics`.
- `client/src/lib/api.ts` — `api.dashboard.customerAnalytics`, `.productAnalytics`.

## Quy tắc dữ liệu
- byType.count = tổng KH theo loại (point-in-time); revenue = trong khoảng.
- topCustomers/topProducts/newCustomersSeries/revenueByType = lọc theo sale_date/created_at trong khoảng.
- debt + stockStatus + stockValue = trạng thái hiện tại (point-in-time), không lọc ngày.
- stockStatus dùng `productsRepo.list()` (tồn thực tế: serial đếm in_stock, quantity = qty_on_hand).

## Success criteria — ĐẠT
- typecheck sạch · test API thật (range đủ/mặc định/rỗng) trả số đúng & cấu trúc ổn định.
