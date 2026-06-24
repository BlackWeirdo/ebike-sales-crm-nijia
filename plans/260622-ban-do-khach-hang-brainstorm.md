# Brainstorm — Bản đồ khách hàng theo tỉnh (Tổng quan)

**Ngày:** 2026-06-22 · **Trạng thái:** Đã chốt hướng, chưa implement

## 1. Problem statement

Trên trang **Tổng quan**, bỏ card "Doanh thu theo loại SP" (donut), thay bằng **bản đồ Việt Nam tương tác**: tô màu theo mật độ khách hàng từng tỉnh; hover (hoặc tap) vào tỉnh → hiện thông tin khách hàng tỉnh đó.

## 2. Ràng buộc hiện trạng (quan trọng)

- `customers.address` = **free-text, KHÔNG có trường tỉnh**. Dữ liệu thực không đồng nhất: `"...Yên Khánh, Ninh Bình"` vs `"Q1 HCM"`.
- Stack: React 18 + Vite + TS + Mantine 7 + Recharts (Recharts/Mantine KHÔNG vẽ được geo-map).
- 1 cửa hàng → khách tập trung 1–3 tỉnh → đa số tỉnh trống.
- **Sáp nhập tỉnh 2025: 63 → 34 đơn vị.** Địa chỉ cũ dùng tên 63 cũ; map mới dùng 34.

## 3. Quyết định đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Nguồn dữ liệu tỉnh | **Thêm dropdown Tỉnh/Thành có cấu trúc** (+ backfill khách cũ) |
| Dạng hiển thị | **Bản đồ VN tương tác** |
| Bộ tỉnh | **34 tỉnh mới (sau sáp nhập 2025)** |

> Lý do chốt field có cấu trúc: parse free-text dễ sai → map đầy "Không xác định". Field chuẩn = map chính xác, tái dùng cho lọc/báo cáo sau này.

## 4. Giải pháp khuyến nghị (kiến trúc)

### 4.1 Data foundation (làm TRƯỚC, bắt buộc)
- `shared/provinces.ts`: hằng số 34 tỉnh `{ code, name }` (code ổn định, vd `VN-HN`).
- Schema: thêm cột `customers.province_code TEXT` (nullable) + migration `ensureColumn` (đã có pattern sẵn trong `db.ts`).
- Form khách hàng (`CustomersPage`): thêm `Select` "Tỉnh/Thành" (searchable). Giữ `address` cho địa chỉ chi tiết.
- API customer trả thêm `provinceCode`.
- **Backfill khách cũ:** best-effort parse địa chỉ → mapping tên-cũ-63 → code-mới-34; không khớp → null, sửa tay (ít khách nên rẻ).

### 4.2 Aggregation API
- `GET /api/dashboard/customers-by-province` → `[{ code, name, customerCount, revenueVnd, customers: [{id,name,phone}] }]`.
- `customerCount` all-time; `revenueVnd` theo from/to (join sales). Hover hiện: tên tỉnh · số khách · (doanh thu) · danh sách top N tên khách.

### 4.3 Map component (lazy-load)
- Lib: **`react-simple-maps`** (+`d3-geo`) — lean, hợp Mantine, hover dễ. (echarts-map nặng hơn → loại theo KISS.)
- GeoJSON/TopoJSON **34 tỉnh** bundle kèm app (KHÔNG gọi CDN). Màu theo `customerCount` (thang màu Mantine teal).
- Hover/tap tỉnh → Mantine `HoverCard`/`Popover` hiện thông tin.
- **Code-split**: `React.lazy` cho map + dynamic import GeoJSON → không phình bundle Tổng quan ban đầu.

### 4.4 Layout
- Bỏ donut "Doanh thu theo loại SP". Map cần rộng → cho ≥ `md:6` hoặc 1 hàng riêng (map 1/3 cột sẽ quá nhỏ).
- Cân nhắc dời số "Xe vs Phụ kiện" vào dải KPI để không mất hẳn thông tin.

## 5. Approaches đã cân nhắc

| | A — Bảng "Khách theo tỉnh" | **B — Field chuẩn + Map (CHỐT)** | C — Auto-parse + Map |
|---|---|---|---|
| Data tỉnh | dropdown | dropdown | regex parse (dễ sai) |
| Effort | S | L | M-L |
| Độ tin cậy | cao | cao | thấp-TB |
| Wow | thấp | cao | cao nhưng flaky |

## 6. Rủi ro & giảm thiểu

1. **GeoJSON 34 tỉnh (lớn nhất):** bản sạch/free hiếm. → Lấy GeoJSON 63 tỉnh uy tín, **merge polygon** theo mapping sáp nhập chính thức bằng `mapshaper`, rồi simplify. Verify đủ 34.
2. **Backfill tỉnh khách cũ:** parse gợi ý + sửa tay; cần bảng mapping 63→34.
3. **Bundle size:** lazy-load map + geojson.
4. **Touch không hover:** tap→popover; màn nhỏ → fallback bảng.
5. **Đặt tên tỉnh đổi:** lưu `code` không lưu tên hiển thị.
6. **Tỉnh trống nhiều:** style xám nhạt + legend; có thể kèm danh sách bên cạnh.

## 7. Success metrics
- 100% khách active có `province_code` sau backfill.
- Map đủ 34 tỉnh, hover/tap đúng số khách + danh sách.
- Bundle Tổng quan ban đầu KHÔNG tăng đáng kể (map tách chunk).
- 0 request ra ngoài (GeoJSON bundle sẵn).

## 8. Phases
1. **Data foundation:** provinces.ts(34) + cột province_code + migration + Select form + backfill + API customer.
2. **Aggregation:** endpoint customers-by-province + type + api client.
3. **Map:** component lazy + GeoJSON 34 + thang màu + HoverCard + thay donut + rebalance layout.
4. **Polish:** tỉnh trống, legend, dark mode, fallback bảng cho mobile/touch.

## 9. Open questions
- Hover hiện gì chính xác? (đề xuất: tên tỉnh · số khách · doanh thu range · top 5 tên khách + "xem tất cả").
- Có giữ lại số "Doanh thu Xe vs Phụ kiện" ở chỗ khác không? (đề xuất: đưa vào KPI strip).
- Backfill: tự parse trước rồi sửa, hay nhập tay toàn bộ (ít khách)?
- Click tỉnh có cần điều hướng sang danh sách khách đã lọc tỉnh đó không?
