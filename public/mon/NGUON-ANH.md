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

Gán ảnh cho món bằng `node scripts/gan-anh-thuc-don.mjs` (chạy thử trước, thêm
`--ap-dung` mới ghi).

## Giấy phép

Toàn bộ là **CC0** — miễn trừ bản quyền, dùng được cho mọi mục đích, **không bắt buộc
ghi công**. Bảng dưới ghi lại nguồn để đối chiếu khi cần, không phải để thỏa mãn điều
kiện giấy phép. Tìm qua [Openverse](https://openverse.org) với bộ lọc `license=cc0`,
đã cắt vuông và nén còn 600×600.

| Tệp | Giấy phép | Tên gốc | Trang nguồn |
|---|---|---|---|
| `banh-flan.jpg` | CC0 | File:Custard Pudding.JPG | https://commons.wikimedia.org/w/index.php?curid=20453240 |
| `banh-mi-bo-toi.jpg` | CC0 | A round slice of toasted Garlic bread topped with melted che | https://wordpress.org/photos/photo/8436992157/ |
| `brownie.jpg` | CC0 | Chocolate Brownie | https://stocksnap.io/photo/chocolate-brownie-9BD568520F |
| `ca-phe-den.jpg` | CC0 | Black coffee cup | https://www.rawpixel.com/image/3283425/free-photo-image-cup-black-people-coffee-mug |
| `ca-phe-nong.jpg` | CC0 | Coffee Latte | https://stocksnap.io/photo/coffee-latte-WDJES619M1 |
| `ca-phe-sua-da.jpg` | CC0 | Vietnamese iced coffee - Roland in Vancouver (271) | https://www.flickr.com/photos/35034347371@N01/204209415 |
| `cappuccino.jpg` | CC0 | Free cappuccino cups cinnamon stick | https://www.rawpixel.com/image/5915197/image-public-domain-coffee-chocolate |
| `cheesecake.jpg` | CC0 | Free strawberry cheesecake slice image | https://www.rawpixel.com/image/5924639/photo-image-public-domain-illustration-fruit |
| `cold-brew.jpg` | CC0 | Rodd's Coffee Cold Brew Oat Latte bottle | https://commons.wikimedia.org/w/index.php?curid=168435017 |
| `croissant.jpg` | CC0 | Croissants Pastries | https://stocksnap.io/photo/croissants-pastries-3D35639910 |
| `da-xay.jpg` | CC0 | A tall glass of iced chocolate drink with whipped cream, cho | https://wordpress.org/photos/photo/53867ffd2d/ |
| `espresso.jpg` | CC0 | Free coffee image | https://www.rawpixel.com/image/5917503/image-public-domain-glass-coffee |
| `kem-tuoi.jpg` | CC0 | Whipped cream glass bowl | https://www.rawpixel.com/image/6016803/photo-image-public-domain-glass-food |
| `matcha.jpg` | CC0 | Matcha latte with strawberry | https://www.flickr.com/photos/7633518@N08/55188258515 |
| `pudding.jpg` | CC0 | Rhubarb ‘fool’ Panna Cotta | https://commons.wikimedia.org/w/index.php?curid=141403035 |
| `syrup.jpg` | CC0 | — | https://www.rawpixel.com/image/5954033/free-public-domain-cc0-photo |
| `thach-dua.jpg` | CC0 | 09978jfCuisine Breads Fruits Baliuag Landmarks Bulacanfvf 30 | https://commons.wikimedia.org/w/index.php?curid=61428904 |
| `tiramisu.jpg` | CC0 | A slice of tiramisu on a beige plate with a metal spoon besi | https://wordpress.org/photos/photo/27569f2114/ |
| `tra-sua.jpg` | CC0 | Ice bubble milk tea with tapioca balls of Mister Donut in Ja | https://commons.wikimedia.org/w/index.php?curid=82969757 |
| `tra-trai-cay.jpg` | CC0 | Lemon iced tea | https://www.rawpixel.com/image/3283780/free-photo-image-iced-tea-citrus-lemon |
| `tra-vai.jpg` | CC0 | Iced lychee tea and Es teh manis - Bali 2025-09-25 | https://commons.wikimedia.org/w/index.php?curid=175582832 |

`tran-chau.jpg` cắt ra từ chính `tra-sua.jpg` (phần trân châu dưới đáy ly), cùng nguồn
và cùng giấy phép.
