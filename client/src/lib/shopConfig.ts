// Thông tin cửa hàng in trên hóa đơn. Sửa trực tiếp tại đây (bạn bổ sung sau).
export const SHOP = {
  name: 'CỬA HÀNG XE ĐẠP ĐIỆN',
  taxCode: 'Mã số thuế: ...........................',
  address: 'Địa chỉ: .................................................',
  phone: 'Điện thoại: ...........................',
  website: 'Website: ...........................',

  // Logo công ty — hiển thị ở GÓC TRÊN BÊN PHẢI hóa đơn. Để '' = chưa có logo.
  // Cách thêm logo (chọn 1 trong 2):
  //   (1) Đặt file ảnh vào thư mục  client/public/logo.png  → đặt logoUrl = '/logo.png' → chạy lại "npm run build".
  //   (2) Dán trực tiếp data URI ảnh, ví dụ: 'data:image/png;base64,iVBORw0KGgo...'  hoặc URL ảnh online.
  logoUrl: '',

  note: 'Cảm ơn quý khách! Xe đã kiểm tra trước khi giao.',
}
