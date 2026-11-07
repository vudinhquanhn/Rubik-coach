# Rubik Coach 3D MVP

Mở `index.html` trong trình duyệt có Internet (Chrome, Safari hoặc Edge). Ứng dụng sử dụng `cubing.js` và `cubejs` qua CDN. Để tránh giới hạn `file://` của một số trình duyệt, chạy `python3 -m http.server 8080` trong thư mục này rồi mở http://localhost:8080. Khi dùng iPhone, triển khai thư mục lên GitHub Pages/Netlify hoặc máy chủ HTTPS.

## Tính năng
- Nhập/sửa 54 ô trên sáu mặt theo thứ tự URFDLB.
- Kiểm tra số màu, tâm, danh tính viên cạnh/góc, tổng hướng và parity.
- 3D cubing.js đồng bộ từ trạng thái bất kỳ hợp lệ bằng `cubejs` solver.
- Nước xoay U/D/F/B/L/R, nghịch đảo và 180 độ; hoàn tác/làm lại.
- Lưu tự động localStorage, xuất/nhập JSON, giải thích nước xoay bằng tiếng Việt.

## Giới hạn
- Chưa có camera scan tự động.
- Để đồng bộ 3D từ trạng thái bất kỳ, `cubejs` tải bảng giải lần đầu và có thể chậm.
- Lịch sử là thao tác người dùng xác nhận, không phải phát hiện xoay vật lý tự động.
- Lưu cục bộ tùy trình duyệt; xuất JSON là bản sao lưu đáng tin cậy.
- Quy ước màu chuẩn U trắng, R đỏ, F xanh lá, D vàng, L cam, B xanh dương. Nếu Rubik của bạn có thứ tự màu khác, cần cập nhật ánh xạ.
