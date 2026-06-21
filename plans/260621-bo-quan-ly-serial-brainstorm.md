# Brainstorm: Bỏ bắt buộc quản lý xe theo serial

Ngày: 2026-06-21 · Trạng thái: Chốt phương án (chưa implement)

## 1. Vấn đề

- Xe điện đang nhập ở loại `SERIALIZED` → bán hàng **bắt buộc chọn 1 serial**.
- Chưa nhập serial = tồn 0 = xe **không hiện trong picker bán hàng** (lọc `unitsInStock > 0`).
- Phần lớn bán buôn đại lý số lượng lớn → nhập serial từng chiếc là thừa, gây tắc.

## 2. Phát hiện cốt lõi

Hệ thống **đã có sẵn 2 chế độ**, chạy đầy đủ end-to-end:

| Loại | Quản lý | Bán hàng |
|------|---------|----------|
| `SERIALIZED` | Từng chiếc có serial (`inventory_units`) | Bắt buộc chọn serial |
| `QUANTITY` | Chỉ đếm `qty_on_hand` | Chọn số lượng, **không cần serial** |

→ Không phải "xóa serial", mà là **cho xe chạy chế độ `QUANTITY`** đã có sẵn.

## 3. Các hướng đã cân nhắc

| Hướng | Mô tả | Đánh giá |
|-------|-------|----------|
| **A — Đổi mặc định sang QUANTITY, giữ SERIALIZED làm tùy chọn** | Sửa nhãn + default. Không đụng schema/logic. | ⭐ **Chọn.** Rủi ro ~0, vẫn giữ serial khi cần bảo hành lẻ |
| B — Xóa hẳn serial (drop `inventory_units`) | Phá tính năng đang chạy tốt | ❌ Mất traceability, tốn migration, lợi ích = 0 so với A |
| C — Serial thành optional trong SERIALIZED (lai) | Trộn 2 chế độ | ❌ Over-engineering, QUANTITY đã làm được |

## 4. Quyết định của chủ dự án

1. **Giữ serial làm tùy chọn** (không bỏ hẳn).
2. **Chưa có dữ liệu thật** → không cần migration.
3. **Màu không tách tồn kho** → field `color` giữ làm ghi chú, không cần SKU theo màu.

## 5. Phương án chốt (Hướng A)

Chỉ thay đổi UI/mặc định — **không đụng** `schema.sql`, `sales.ts`, `products.ts`:

1. `EMPTY_PRODUCT.type`: `'SERIALIZED'` → `'QUANTITY'` — sản phẩm mới mặc định theo số lượng.
   (`client/src/pages/ProductsPage.tsx:34`)
2. Đổi nhãn dropdown "Loại" cho trung tính, đặt QUANTITY lên đầu:
   - `Theo số lượng (bán buôn — không cần serial)`
   - `Theo serial (định danh từng xe — cần bảo hành)`
   (`ProductsPage.tsx:188-195`)
3. Sửa subtitle trang & nhãn badge "Phụ kiện"/"Xe (serial)" cho khớp ngữ cảnh mới.
   (`ProductsPage.tsx:100`, `:137-139`)

Field `color` đã có sẵn cho mọi loại → màu xe nhập bình thường, không cần thêm gì.

## 6. Giữ nguyên (không làm — YAGNI)

- Schema, bảng `inventory_units`, logic bán theo serial trong `sales.ts`.
- Import Excel sheet `SerialXe` (vẫn dùng được cho xe nào cần serial).
- Không xây hệ thống biến thể (variant) theo màu.

## 7. Rủi ro & lưu ý

- **Thấp.** Chỉ là default + nhãn. Bán theo số lượng đã có test (`sales.test.ts`).
- Lưu ý: SKU là UNIQUE. Nếu sau này muốn tách tồn kho theo màu → tạo SKU riêng từng màu (chưa cần bây giờ).
- Khi cần bán lẻ kèm bảo hành 1 xe cụ thể → vẫn chọn loại "Theo serial" cho riêng mẫu đó.

## 8. Tiêu chí nghiệm thu

- Tạo xe mới không cần nhập serial, xe **hiện ngay** trong picker bán hàng.
- Bán nhiều xe cùng lúc bằng số lượng cho đại lý, trừ tồn đúng.
- Vẫn tạo được sản phẩm loại serial khi cần (tùy chọn còn nguyên).
