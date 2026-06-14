# Brainstorm Summary — E-bike Shop CRM Desktop App

**Date:** 2026-06-13
**Status:** Decided, ready to plan

## Problem Statement
Cửa hàng xe đạp điện cần app desktop quản lý bán hàng. Đặc thù: quản lý theo **số serial xe** (bắt buộc cho bảo hành), bảo hành **pin riêng / khung riêng** (nhiều mốc hết hạn / 1 xe), nhắc **bảo dưỡng định kỳ** để giữ chân khách.

## Confirmed Constraints (from user)
- **Người làm:** mới học, dùng AI hỗ trợ → chọn stack phổ biến nhất, ổn định, nhiều tài liệu.
- **Scope v1:** MVP + Công nợ = 5 module: Tồn kho (serial), POS, Khách hàng, Bảo hành, Công nợ.
- **Người dùng:** 1 người (chủ shop), 1 máy → KHÔNG cần auth/phân quyền, KHÔNG cần đồng bộ đa máy.
- **Phần cứng:** chỉ in **phiếu bảo hành A5/A4** (máy in thường) → KHÔNG cần máy in nhiệt ESC/POS, KHÔNG máy quét mã vạch ở v1.
- **OS:** Windows 10 (1 máy duy nhất).

## Decided Stack
| Lớp | Chọn | Lý do |
|---|---|---|
| Desktop shell | **Electron** (scaffold `electron-vite`) | Phổ biến nhất → AI hỗ trợ tốt; nặng/RAM cao không quan trọng vì 1 máy |
| UI | **React + TypeScript + Vite** | Hệ sinh thái lớn; TS bắt lỗi sớm cho người mới |
| Component lib | **Mantine** (chốt thay shadcn) | Pin sẵn: DataTable, form, date picker, charts, notifications → ít tự chế |
| Database | **SQLite** qua **better-sqlite3** | Synchronous, code dễ đọc, đúng quy mô 1 shop |
| Query layer | **Drizzle ORM** | TS-native, nhẹ, tránh Prisma (đóng gói Electron đau) |
| Charts | **Recharts** / Mantine charts | Dashboard, doanh thu |
| In phiếu bảo hành | **HTML + Electron `printToPDF`/`window.print()`** | 1 trang HTML in thẳng, không cần lib PDF nặng |
| Backup | `better-sqlite3` `.backup()` → copy ra thư mục Google Drive/OneDrive | Bắt buộc v1; 1 file SQLite = 1 điểm chết |

## Key Design Decisions (data model)
- **Tách 2 loại sản phẩm:** `serialized` (xe → mỗi chiếc 1 unit có serial) vs `stock` (phụ kiện/sạc đếm số lượng).
- **Bảo hành nhiều mốc/1 xe:** bán xe sinh nhiều dòng warranty (loại khung / pin, ngày bắt đầu + hết hạn riêng).
- **Nhắc bảo dưỡng:** `next_service_date` gắn unit/khách → dashboard lọc xe cần nhắc.
- **Công nợ:** `debts` + `debt_payments`; aging report **tính ra** từ ngày đến hạn, không lưu cứng.
- **Tiền tệ:** lưu **VND số nguyên** (đồng), không float.

## Approach to Build
- **Vertical slice** (không làm ngang): cho chạy trọn 1 luồng (nhập 1 xe → bán → xe hiện trong lịch sử khách → in phiếu bảo hành) trước, rồi thêm module.

## Top Risks
1. **Native module rebuild** (`better-sqlite3` + Electron packaging) — cạm bẫy #1 cho người mới. Mitigate: dùng electron-vite, làm theo guide.
2. **Scope creep** — 5 module vẫn lớn cho người mới. Mitigate: vertical slices, MVP nghiêm ngặt.
3. **Mất dữ liệu** (1 file SQLite). Mitigate: auto-backup ngay từ v1.

## Out of Scope (v1) — YAGNI
Auth/phân quyền, đa máy/đồng bộ, máy in nhiệt, quét mã vạch, phân tích ABC, dự báo mục tiêu, voucher/khuyến mãi phức tạp, online channel.
