# Rubik Coach 3D

Ứng dụng học Rubik 3×3 bằng tiếng Việt, nhập thủ công 54 ô và chia sẻ trạng thái chính xác với ChatGPT. Chưa có nhận diện camera.

## Chạy và kiểm tra

Cần Node.js 22.14 trở lên và npm. Không mở trực tiếp `index.html` bằng `file://`.

```sh
npm ci
npm run dev
```

Mở địa chỉ Vite in ra, có hậu tố `/Rubik-coach/`.

```sh
npm test
npm run build
npm run preview
```

Bản preview mặc định: http://127.0.0.1:4173/Rubik-coach/ (nếu cổng bận, xem cổng Vite in ra). Chỉ `dist/` là sản phẩm triển khai; không đưa `node_modules/` lên Pages. Các lệnh được quản lý ở [package.json](package.json), đường dẫn public ở [vite.config.js](vite.config.js).

## Vì sao thay cách tải 3D

Bản cục bộ ban đầu có import tĩnh `https://cdn.jsdelivr.net/npm/cubing@0.63.3/+esm` ở `index.html:10`; kiểm tra HTTP thực tế trả **404**, chặn toàn bộ script, khiến editor và các nút cũng không hoạt động.

Remote `main` tại [`c1f7252`](https://github.com/vudinhquanhn/Rubik-coach/blob/c1f72523a3cc18c010167595b262731badd56f56/index.html#L11-L32) mới hơn bản cục bộ: `CUBING_SOURCES` và `loadTwistyPlayer()` đã thử CDN dự phòng. Trình duyệt trên URL public ghi nhận `Failed to resolve module specifier "three/src/constants.js". Relative references must start with either "/", "./", or "../".` ở entrypoint CDN `twisty/index.js:1540` và các chunk 3D. Loader chỉ xác nhận class `TwistyPlayer`; phụ thuộc 3D được import muộn sau đó mới lỗi, nên nhánh fallback không xử lý được. Không có import map trong revision đã đối chiếu.

Dùng entrypoint `cubing/twisty`, bundle cùng `three` bằng Vite và khóa dependency bằng `package-lock.json`, thay vì tiếp tục sửa URL CDN/import map. [src/viewer.js](src/viewer.js) sở hữu tích hợp 3D; [src/cube.js](src/cube.js) chuyển trực tiếp facelets sang pattern, không cần `cubejs` hoặc bảng solver. Điều này tránh tính lời giải trên main thread cho từng nước xoay.

`cubing` chỉ khởi tạo khi viewer xuất hiện trên màn hình. Vì thế tải trang ở vị trí editor sẽ hiển thị lời nhắc cuộn lên, không báo lỗi timeout giả. Lỗi tải/khởi tạo có thông báo và nút thử lại; editor và JSON vẫn hoạt động khi 3D lỗi. Tải lại trang nếu asset cũ bị cache sau một lần triển khai.

## Nhập khối và chia sẻ buổi học

Giữ U trắng ở trên, F xanh lá ở trước; R đỏ, D vàng, L cam, B xanh dương. Mỗi mặt đọc theo hàng từ trái sang phải khi nhìn trực diện từ ngoài. Cạnh trên U hướng B; cạnh trên D hướng F; cạnh trên bốn mặt bên hướng U. Tâm cố định. Viên cạnh có **2 ô màu**, viên góc có **3 ô màu**. Kéo mô hình chỉ đổi camera; dùng nút để xoay tầng.

Chọn màu, chạm ô cần sửa, bấm **Kiểm tra 54 ô**, rồi **Áp dụng vào 3D**. Trạng thái bất khả thi bị từ chối. Áp dụng đặt mốc gốc mới và xóa lịch sử sau khi xác nhận. Bản nháp có thể chưa hợp lệ; 3D tiếp tục biểu diễn trạng thái đã áp dụng, không phải bản nháp.

Bấm **Xuất JSON** để gửi tệp cho ChatGPT hoặc chuyển thiết bị; dùng ô nhập tệp để khôi phục. JSON gồm trạng thái, mốc gốc, lịch sử, redo, bản nháp và quy ước hướng/màu. Ví dụ đầy đủ: [examples/solved.json](examples/solved.json). ChatGPT cần đọc `state` thành sáu nhóm 9 ký tự theo `faceletOrder`; không suy đoán từ ảnh chụp. Chỉ `state` là trạng thái khối đã xác nhận, không dùng `draft` để hướng dẫn xoay.

Lưu tự động dùng cùng khóa cũ `rubik-coach-mvp-v1`; hỗ trợ dữ liệu lưu v1 và JSON v1 hợp lệ. Lịch sử phải tái tạo đúng trạng thái từ mốc gốc, không tự cắt bỏ nước lỗi. Nếu dữ liệu cũ hỏng, ứng dụng báo lỗi và chưa ghi đè khi khởi động; sao lưu giá trị khóa trong DevTools → Application → Local Storage trước thao tác mới. localStorage thuộc **origin/trình duyệt/thiết bị**, không đồng bộ giữa localhost, GitHub Pages, Chrome và Safari. Khi bị chặn lưu hoặc hết dung lượng, hãy xuất JSON.

## Triển khai GitHub Pages

Đích theo handoff: https://vudinhquanhn.github.io/Rubik-coach/.

**Phải xin phép trước khi push hoặc thay thiết lập Pages.** Workflow [pages.yml](.github/workflows/pages.yml) sẽ triển khai khi có push lên `main`, hoặc chạy thủ công trên `main`; pull request chỉ kiểm tra và build. Chỉ chép cấu hình vào repo chưa làm thay đổi site đang chạy.

1. Clone repository nếu chưa có bản Git cục bộ. Đối chiếu remote trước khi tích hợp; không ghi đè thay đổi mới trên remote và không upload `dist/` hoặc `node_modules/` vào nhánh nguồn.
2. Chạy các lệnh kiểm tra phía trên; review và commit. Chỉ push khi chủ dự án cho phép.
3. Khi được phép đổi cấu hình: GitHub repository → **Settings → Pages → Build and deployment → Source: GitHub Actions**. Cách cũ “Deploy from a branch / main / root” không build được mã nguồn mới.
4. Push lên `main` hoặc vào **Actions → Build and deploy Pages → Run workflow** trên `main`. Job test/build phải xanh trước khi deploy; nếu environment `github-pages` yêu cầu review, chủ repo phải duyệt.
5. Mở URL ở environment `github-pages`; kiểm tra cube trắng–xanh lá–đỏ, R rồi R', undo/redo, refresh và xuất/nhập JSON. DevTools Network không được có asset 404 hay request CDN; Console không có lỗi bare module.
6. Trên iPhone Safari: chạm sửa ô, đổi màu, thử cả 18 nút, kéo camera, chuyển ứng dụng rồi trở lại, refresh và nhập lại JSON bằng Files. Thử cả chiều dọc/ngang. Đây là kiểm tra thiết bị thật, không được thay bằng viewport Chrome.

Nếu asset 404: kiểm tra đúng chữ hoa/thường `/Rubik-coach/`, Pages dùng Actions, artifact là `dist`, và lần chạy Actions hiện hành. Nếu WebGL lỗi: thử bật tăng tốc phần cứng/đổi trình duyệt, cuộn viewer vào màn hình và bấm thử lại; không tiếp tục dựa vào mô hình cũ nếu trạng thái báo chưa đồng bộ.

Rollback: sau khi được phép, revert commit gây lỗi trên `main`, chạy lại kiểm tra và push để workflow triển khai bản rollback. Không xóa localStorage để sửa deployment; xuất JSON trước mọi thay đổi dữ liệu.

## Bằng chứng bàn giao cục bộ

- 57 kiểm thử Node đạt: [tests/cube.test.js](tests/cube.test.js), [tests/session.test.js](tests/session.test.js); đủ 18 biến thể nước xoay so với pattern chính thức, nghịch đảo, bốn lần xoay, góc/cạnh bất khả thi và JSON/lịch sử.
- Production build thành công, audit npm không có lỗ hổng được báo tại thời điểm kiểm tra. Vite còn cảnh báo chunk 3D khoảng 511 kB trước gzip; giữ nguyên cảnh báo, chưa tối ưu ngoài phạm vi sửa lỗi.
- Chromium desktop: thấy cube thật; thử đủ 18 nút, đối chiếu model và sơ đồ, undo/redo, refresh khôi phục chính xác, nhập tệp mẫu và tải xuống JSON.
- Viewport mobile 390×844: không tràn ngang, chỉnh màu và chặn bản nhập sai, giữ bản nháp qua refresh; cuộn trở lại khởi tạo được 3D và xoay R. Đây **không phải** xác nhận iPhone Safari thật.
- Chặn tải chunk viewer để mô phỏng lỗi mạng: hiện thông báo lỗi, nút U vẫn cập nhật lịch sử; bỏ chặn và bấm thử lại khôi phục được mô hình.
- Kết quả xuất bản hiện hành xem tại [GitHub Actions](https://github.com/vudinhquanhn/Rubik-coach/actions) và environment `github-pages`; bằng chứng cục bộ không thay thế kiểm tra URL public hoặc iPhone thật.
