# Plan: Dashboard biểu đồ Khách hàng & Sản phẩm

**Date:** 2026-06-14 · **Status:** Done

Thêm 8 biểu đồ thống kê vào trang Tổng quan (DashboardPage), nhóm theo Khách hàng & Sản phẩm.
Không đổi schema DB — chỉ thêm 2 endpoint analytics, types, api client, UI.

## Phases
- [Phase 01 — Backend analytics](phase-01-backend-analytics.md) — `status: done`
- [Phase 02 — Frontend charts](phase-02-frontend-charts.md) — `status: done`

## Biểu đồ
Khách hàng: (1) Cơ cấu Cá nhân/Đại lý — donut · (2) Top KH theo doanh thu — bar ·
(3) Khách mới theo thời gian — bar · (4) KH theo công nợ — donut/stat.
Sản phẩm: (5) Doanh thu theo loại Xe/Phụ kiện — donut · (6) Top SP SL & doanh thu — composite bar ·
(7) Tình trạng tồn kho — donut · (8) Giá trị tồn kho theo SP — bar.

## Quy ước
- Biểu đồ theo doanh thu/đơn/khách-mới → tôn trọng bộ lọc Từ/Đến.
- Tồn kho (status, value) → trạng thái hiện tại (point-in-time), không lọc theo ngày.
