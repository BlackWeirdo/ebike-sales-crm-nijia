# Phase 02 — Frontend charts · status: done

**Date:** 2026-06-14 · **Priority:** High

## Mục tiêu
8 biểu đồ trong trang Tổng quan, 2 section: Phân tích khách hàng & Phân tích sản phẩm.

## Files
- `client/src/components/ChartCard.tsx` — MỚI: khung thẻ biểu đồ + empty state dùng chung (DRY).
- `client/src/pages/DashboardPage.tsx` — thêm 4 query (summary/series/customer/product) + 2 section chart.

## Biểu đồ (Mantine charts)
KH: DonutChart cơ cấu · BarChart ngang top KH · BarChart khách mới · DonutChart công nợ + tổng dư nợ.
SP: DonutChart doanh thu theo loại · CompositeChart top SP (bar doanh thu + line SL, 2 trục Y) ·
DonutChart tình trạng tồn · BarChart ngang giá trị tồn.
Tất cả tôn trọng bộ lọc Từ/Đến (trừ tồn kho & công nợ = point-in-time).

## Success criteria — ĐẠT
- typecheck sạch · build OK · render headless: 9 SVG, đủ 8 tiêu đề + 2 section, 0 lỗi console.
