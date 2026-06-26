# Plan: Chia tài khoản nhận tiền trên đơn bán

> Ngày: 2026-06-26 · Dự án: eBike CRM (`c:\Project web app CRM`)
> Brainstorm gốc (ĐÃ CHỐT): [docs/brainstorm-payment-accounts.md](../../docs/brainstorm-payment-accounts.md)

## Mục tiêu

Cho phép 1 đơn bán chia tiền nhận về **nhiều tài khoản** (TK công ty, TK cá nhân NV...). Mỗi dòng: chọn TK từ danh mục + nhập số tiền. In các dòng này lên phiếu bán hàng làm **chỉ dẫn chuyển khoản** cho khách.

## Nguyên tắc kiến trúc (locked — KHÔNG vi phạm)

- **Hướng A**: thông tin chia TK **CHỈ ĐỂ IN**. KHÔNG ảnh hưởng `paid_vnd`, công nợ, dashboard, đối soát, `computeAndValidate`.
- In cả khi đơn còn nợ (là chỉ dẫn khách sẽ chuyển, không phải đã nhận).
- KHÔNG validation cứng. Chỉ **cảnh báo mềm non-blocking** nếu tổng chia ≠ tổng đơn.
- Nguồn TK = bảng `bank_accounts` mới + màn CRUD.
- Per-sale = cột JSON `sales.payment_accounts` lưu **SNAPSHOT** (sửa/xóa TK trong danh mục KHÔNG làm sai phiếu cũ).
- Báo cáo theo TK/NV: **chưa làm** (YAGNI).

## Các Phase

| # | Phase | Status | File |
|---|---|---|---|
| 01 | Foundation: types + schema + migration | Pending | [phase-01-foundation.md](phase-01-foundation.md) |
| 02 | Backend bank_accounts (repo + route + mount) | Pending | [phase-02-backend-bank-accounts.md](phase-02-backend-bank-accounts.md) |
| 03 | Backend sales (lưu/đọc payment_accounts + Zod) | Pending | [phase-03-backend-sales.md](phase-03-backend-sales.md) |
| 04 | Frontend hạ tầng (api client + page CRUD + nav) | Pending | [phase-04-frontend-infra.md](phase-04-frontend-infra.md) |
| 05 | Frontend đơn bán (khối chia TK trong SaleForm) | Pending | [phase-05-frontend-saleform.md](phase-05-frontend-saleform.md) |
| 06 | Hiển thị (printInvoice + SaleDetailModal) | Pending | [phase-06-display.md](phase-06-display.md) |
| 07 | Tests | Pending | [phase-07-tests.md](phase-07-tests.md) |

**Progress: 0/7 phases (0%)**

## Thứ tự thực thi & dependency

```
01 (foundation) ─┬─> 02 (bank repo/route) ─┬─> 04 (fe infra) ─> 05 (saleform) ─> 06 (display)
                 └─> 03 (sales repo/zod)  ─┘                                       │
                                                                07 (tests) <───────┘ (sau 03 cho BE; sau 06 cho đủ)
```
- 02 và 03 độc lập nhau, đều chỉ phụ thuộc 01.
- 05 phụ thuộc 04 (cần `api.bankAccounts.list`) + 03 (BE nhận `paymentAccounts`).
- 06 phụ thuộc 03 (BE trả `paymentAccounts` trong SaleDetail).
- 07 nên viết tăng dần: test BE ngay sau 03; bổ sung sau 06.

## Quyết định chốt quan trọng (trade-off)

**Client gửi sẵn SNAPSHOT đầy đủ** (accountId + label + bankName + accountNumber + accountHolder + amountVnd), server chỉ `JSON.stringify` lưu — KHÔNG re-fetch TK để snapshot.
- Lý do: client đã có `api.bankAccounts.list()` để render Select → có sẵn full thông tin TK, đỡ 1 vòng query + transaction phức tạp ở server (KISS).
- Trade-off: client là nguồn snapshot → client gửi sai/cũ thì lưu sai. Chấp nhận được vì: (a) dữ liệu chỉ để in, không ảnh hưởng tiền; (b) form luôn load list TK mới nhất ngay trước khi save. Server vẫn validate **shape** bằng Zod (chống payload rác), không validate **giá trị** TK.

## Quyết định đã chốt (user 2026-06-26)

1. **Select TK trong SaleForm**: **hiện TẤT CẢ** TK (không lọc `active`). → Phase 05: `api.bankAccounts.list()` không filter; dropdown render hết. (Lưu ý nhỏ khi implement: TK đã xóa-mềm vẫn lọt vào Select — chấp nhận theo lựa chọn user; nếu vướng có thể bàn lại.)
2. **Xóa TK = XÓA MỀM** (`active=0`), không xóa cứng. → Phase 02: route DELETE = `UPDATE bank_accounts SET active=0`. Màn CRUD hiện cột trạng thái + nút bật/tắt.
3. **Cảnh báo mềm: KHÔNG LÀM**. → Phase 05: BỎ bước Alert so tổng chia ≠ tổng đơn. Người dùng nhập tự do. (Giảm 1 bước, đỡ phức tạp.)
4. **Quyền truy cập**: giữ `requireAuth` chung như toàn app (không phân quyền riêng).

## Trạng thái: PLAN HOÀN TẤT — chờ lệnh implement

User chọn **dừng ở plan**, chưa code. Khi nào muốn làm: chạy `/fix:hard` hoặc yêu cầu implement theo thứ tự phase 01→07.
