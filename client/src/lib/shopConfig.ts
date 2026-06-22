// Thông tin công ty in trên hóa đơn. Sửa trực tiếp tại đây.
export const SHOP = {
  name: 'CÔNG TY TNHH NIJIA VIỆT NAM',

  // Các dòng thông tin hiển thị dưới tên công ty (mỗi phần tử = 1 dòng).
  // Thêm/bớt thoải mái — hóa đơn tự render hết.
  infoLines: [
    'Trụ sở: Tầng 6, toà nhà Minh Đạo, Số 13 KP Nguyễn Du, xã Thường Tín, TP Hà Nội',
    'VPMN: 40 Luỹ Bán Bích, Phường Tân Phú, TP HCM',
    'Nhà máy SX: Km 36 Cụm CN Quất Động, Xã Thượng Phúc, TP Hà Nội',
    'SĐT: 0936372927 - 0972429595',
  ],

  // Logo công ty — hiển thị ở GÓC TRÊN BÊN PHẢI hóa đơn. Để '' = chưa có logo.
  // Cách thêm logo (chọn 1 trong 2):
  //   (1) Lưu file ảnh logo vào  client/public/  (vd: logo.jpg / logo.png) → đặt logoUrl khớp tên → chạy lại "npm run build" (hoặc deploy).
  //   (2) Dán trực tiếp data URI ảnh, ví dụ: 'data:image/png;base64,iVBORw0KGgo...'  hoặc URL ảnh online.
  logoUrl: '/logo.jpg',

  note: 'Cảm ơn quý khách! Xe đã kiểm tra trước khi giao.',
}
