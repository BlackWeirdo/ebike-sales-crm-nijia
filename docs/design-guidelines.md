# Design Guidelines — App Quản lý cửa hàng xe đạp điện

Nguồn token duy nhất: theme Mantine trong [client/src/main.tsx](../client/src/main.tsx).
**Không hardcode mã màu hex** trong component — luôn dùng token Mantine (`color="teal"`, `c="dimmed"`)
hoặc CSS var (`var(--mantine-color-*)`). Màu phụ thuộc nền sáng/tối dùng `light-dark(a, b)`.

## Bộ màu (palette)

| Vai trò | Token | Dùng cho |
|---|---|---|
| Primary (thương hiệu) | `teal` (shade light 6 / dark 5) | nút chính, link active, doanh thu, "đã trả" |
| Tích cực / tiền vào | `teal` / `green` | đã thanh toán, tiền đã thu |
| Cảnh báo | `orange` | tồn thấp, sắp hết |
| Nguy hiểm / nợ | `red` | công nợ, nút xóa, hết hàng |
| Phụ / đại lý | `grape` | đại lý, phụ kiện |
| Thông tin | `blue` | loại xe, giá trị tồn |
| Nền phụ (adaptive) | `light-dark(gray-0, dark-6/8)` | nền trang, header bảng, card phụ |

## Token chung
- **Radius:** `md` mặc định (Card, Button, Modal).
- **Font:** Inter, system-ui.
- **autoContrast: true** — chữ tự chọn màu đọc được trên nền filled.
- **focusRing: 'auto'** — viền focus chỉ hiện khi dùng bàn phím (a11y).
- **cursorType: 'pointer'** — checkbox/switch hiện con trỏ tay.

## Dark / Light mode
- `defaultColorScheme="auto"` (theo OS) + `localStorageColorSchemeManager` key `crm-color-scheme` (nhớ lựa chọn).
- Script chống nháy (FOUC) đặt sớm trong [client/index.html](../client/index.html).
- Nút chuyển: [ColorSchemeToggle.tsx](../client/src/components/ColorSchemeToggle.tsx).

## Component dùng chung (DRY)
- [ListTable](../client/src/components/ListTable.tsx) — bảng danh sách (header adaptive + skeleton tải + dòng rỗng).
- [ChartCard / SectionTitle](../client/src/components/ChartCard.tsx) — khung biểu đồ dashboard.
- [LoadingBlock](../client/src/components/LoadingBlock.tsx) — trạng thái đang tải căn giữa.
- [notify.ts](../client/src/lib/notify.ts) — toast `toastOk`/`toastError` (có icon, viền).
- [confirm.ts](../client/src/lib/confirm.ts) — `confirmDelete` (dialog xác nhận, KHÔNG dùng `confirm()` native).
- [labels.ts](../client/src/lib/labels.ts) — nhãn + màu loại KH/SP.

## Quy tắc
- Hiệu ứng hover/click: định nghĩa tập trung ở [styles.css](../client/src/styles.css), tôn trọng `prefers-reduced-motion`.
- Responsive: AppShell có Header + Burger; navbar thu gọn `breakpoint: sm`; bảng cuộn ngang qua `Table.ScrollContainer`.
- Accessibility: ActionIcon xóa có `aria-label`; hàng bảng bấm được có `tabIndex` + Enter; modal đóng bằng Esc.
- Thông báo: thành công/lỗi dùng toast; xác nhận xóa dùng `confirmDelete`. Tuyệt đối không `alert()`/`confirm()`.
