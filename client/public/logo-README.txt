CÁCH THÊM LOGO VÀO HÓA ĐƠN
===========================

1. Lưu file logo công ty (NIJIA) vào chính thư mục này với tên:  logo.png
   → Đường dẫn đầy đủ:  client/public/logo.png

2. Chạy lại build / deploy:
   - Local:   npm run build   (rồi npm start)
   - Cloud:   flyctl deploy

Logo sẽ tự hiển thị ở góc trên bên phải hóa đơn in.
(Cấu hình đường dẫn logo nằm ở: client/src/lib/shopConfig.ts → logoUrl = '/logo.png')

Định dạng khác (.jpg, .webp) cũng được — chỉ cần đổi logoUrl cho khớp tên file.
