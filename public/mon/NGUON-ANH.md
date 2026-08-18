# Nguồn ảnh thực đơn

Ảnh minh họa cho món và topping của ba quán demo. Chúng là **dữ liệu demo**, không
phải tài sản giao diện — trang bảng giá, banner và ảnh sản phẩm nằm ở `public/banners`
và `public/product`.

**Vì sao ảnh nằm trong mã nguồn thay vì trên kho ảnh Cloudinary như ảnh chủ quán thật
tải lên:** đường tải ảnh của bản triển khai đang hỏng — Cloudinary từ chối quyền
`create` cho khóa API hiện tại (việc 8.7.2). Đặt ở đây thì trường `image` chỉ cần giữ
đường dẫn tương đối `/mon/<tên>.jpg`, trình duyệt tự ghép với tên miền của chính trang,
nên ảnh hiện được mà không phụ thuộc Cloudinary lẫn mạng ngoài, và còn nguyên sau mỗi
lần triển khai lại. Khi khóa Cloudinary được sửa, chủ quán vẫn tải ảnh riêng lên đè
bình thường — không có gì phải gỡ ở đây.

`DemoSeeder` gán thẳng đường dẫn ảnh vào trường `image` lúc nạp dữ liệu, không cần
chạy thêm script gán ảnh nào.

## 43 ảnh món

Gốc là ảnh sản phẩm chụp từ trang đặt hàng của **Highlands Coffee**
(`order.highlandscoffee.com.vn`, lấy 8/2026). Thực đơn ba quán demo cũng dựng theo
đúng danh mục và giá niêm yết ở đó, để dữ liệu mẫu giống một quán cà phê Việt Nam có
thật thay vì các món tự nghĩ ra.

> Ảnh gốc thuộc về Highlands Coffee, **không phải ảnh miễn trừ bản quyền**. Chúng chỉ
> dùng làm dữ liệu mẫu trong đồ án. Bản gốc chưa qua xử lý nằm ở `.local/anh-goc/`
> (thư mục này không lên Git).

### Đã xử lý những gì

**32 ảnh đồ uống** có logo Highlands in trên thân ly. Xử lý bằng cách **vẽ lại vùng
có logo bằng AI (Gemini)**: ly giữ nguyên hình dáng và màu nước, chỉ phần nhãn hiệu
được thay bằng bề mặt ly trơn.

Trước khi chọn cách đó đã thử bốn cách xử lý bằng thuật toán, ghi lại để khỏi ai thử
lại lần nữa:

| Cách | Vì sao hỏng |
|---|---|
| Mặt nạ elip trùm thân ly rồi `cv2.inpaint` | Mặt nạ phủ gần hết ly nên phải bịa cả mảng lớn, nhòe be bét |
| Ngưỡng Otsu trên từng ảnh để bắt nét logo | Ly màu nhạt (trà xanh, freeze) có logo trắng trên nền sáng, chia trượt |
| Đo độ lệch so với nền cục bộ | Bắt luôn hạt nước đọng trên thành ly, vá ra vệt trắng |
| Khuôn hình dạng logo + `inpaint` + mượn vân | Chạy được, logo sạch, nhưng chỗ vá trơn hơn xung quanh, soi kỹ thấy |

Cũng đã thử **cắt khung dừng trên logo**. Bỏ vì tuy sạch tuyệt đối nhưng món nào cũng
thành nửa ly cụt ngang, mà thẻ món dùng khung 4:3 với `object-cover` nên còn bị cắt
thêm lần nữa.

**11 ảnh bánh** không dính nhãn hiệu, giữ nguyên ảnh gốc.

Tất cả đều được tách khỏi nền quảng cáo (nền cam/hồng/xanh kèm chữ "MỚI!",
"THỬ NGAY!") đưa về nền trắng, cắt vuông 600×600. Món chiếm tối đa **72% chiều cao
khung** — thẻ món dùng khung 4:3 nên ảnh vuông bị cắt 12,5% trên và dưới, vượt ngưỡng
này là mất chân ly.

Sáu món bị **bỏ khỏi thực đơn** vì ảnh quảng cáo dính nhãn hiệu quá sâu: Trà Sen Vàng
Cốm Non, Trà Sen Vàng Trân Châu Dừa/Khoai Môn, PhinĐI Matcha Dâu, Bánh Flan, Bánh
Cuộn Vị Quế.

## 4 ảnh topping

`tran-chau.jpg`, `thach-dua.jpg`, `pudding.jpg`, `kem-tuoi.jpg` — ảnh chụp riêng từng
loại trong bát, do chủ dự án cung cấp. Bộ ảnh CC0 cũ lấy qua Openverse đã bỏ vì chụp
trong ly nên nhìn không ra món.
