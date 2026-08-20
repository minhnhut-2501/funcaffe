# FunCafe — Cấu trúc dữ liệu

Cơ sở dữ liệu: **MongoDB**, database `funcafe`. Là NoSQL nên "khóa ngoại" ở đây là **tham
chiếu logic** — lưu `ObjectId` của document bên kia, không có ràng buộc cứng như SQL.

Ký hiệu: **PK** khóa chính · **FK** khóa ngoại · **UK** duy nhất · **NN** bắt buộc.

`created_at` / `updated_at` do Laravel tự sinh và tự cập nhật ở mọi collection, mang nghĩa
"tạo lúc nào / sửa lần cuối lúc nào"; bên dưới chỉ ghi lại khi trường đó có thêm vai trò
nghiệp vụ.

Ngoài 17 collection dưới đây còn bảng `personal_access_tokens` nằm ở **SQLite** — Laravel
Sanctum bắt buộc một bảng quan hệ để lưu token đăng nhập, không thuộc dữ liệu nghiệp vụ.

---

## Danh sách collection

| # | Collection | Vai trò |
|---|---|---|
| 1 | `users` | Tài khoản chủ quán và quản trị viên |
| 2 | `packages` | Gói dịch vụ (Fun Free / Pro / Pro Max) |
| 3 | `time_subscriptions` | Thời hạn và giá bán của từng gói |
| 4 | `subscriptions` | Quyền dùng gói của một quán |
| 5 | `package_payments` | Chứng từ thanh toán gói |
| 6 | `cafes` | Quán cà phê |
| 7 | `tables` | Bàn trong quán |
| 8 | `categories` | Danh mục món |
| 9 | `items` | Món trong thực đơn |
| 10 | `item_prices` | Giá theo size của món |
| 11 | `toppings` | Topping của quán |
| 12 | `item_toppings` | Món ↔ Topping (N–N) |
| 13 | `orders` | Đơn bán hàng, kiêm hóa đơn khi đã thanh toán |
| 14 | `order_details` | Dòng món trong đơn |
| 15 | `order_detail_toppings` | Topping của từng dòng món |
| 16 | `reviews` | Đánh giá dịch vụ FunCafe |
| 17 | `contact_messages` | Tin nhắn liên hệ từ trang công khai |

---

## 1. `users` — Tài khoản

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh tài khoản, được `cafes.user_id` và `package_payments.user_id` trỏ tới |
| `full_name` | String | NN | Họ tên, hiện trên thanh tài khoản và trong màn quản trị người dùng |
| `email` | String | UK, NN | Tên đăng nhập, đồng thời là nơi nhận thư đặt lại mật khẩu. Duy nhất toàn hệ thống |
| `password` | String | NN | Mật khẩu đã băm bcrypt. Không bao giờ trả ra API |
| `phone` | String | | Số liên lạc, chỉ để hiển thị và để admin liên hệ khi cần |
| `avatar` | String | | Đường dẫn ảnh đại diện (Cloudinary hoặc thư mục public) |
| `role` | String | NN | `user` = chủ quán, `admin` = quản trị viên. Quyết định vào được khu `/user` hay `/admin` |
| `status` | String | NN | `active` \| `locked`. Bị `locked` là không đăng nhập được nữa, dùng để khóa tài khoản vi phạm |
| `has_used_free_trial` | Boolean | | Tài khoản này đã nhận gói dùng thử Fun Free chưa. Đi **cặp** với `cafes.has_used_free_trial`: thiếu vế tài khoản thì chủ quán chỉ cần tạo quán mới là lại có 7 ngày Pro Max, lặp vô hạn |
| `reset_token` | String | | **Bản băm SHA-256** của token đặt lại mật khẩu; bản thô chỉ đi qua email. Băm để ai đọc được CSDL cũng không chiếm được tài khoản |
| `reset_token_expires_at` | Date | | Hạn của token trên (1 giờ). Quá hạn thì liên kết đặt lại mật khẩu vô hiệu |

## 2. `packages` — Gói dịch vụ

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh gói |
| `name` | String | NN | Tên hiển thị: "Fun Free", "Pro", "Pro Max" |
| `type` | String | NN | `free` \| `pro` \| `promax`. Mã máy đọc, dùng trong logic phân quyền ở frontend |
| `level` | Int | NN | Bậc 0 / 1 / 2. So sánh hai `level` để biết thao tác là mua mới, nâng cấp hay hạ cấp (hạ cấp bị chặn) |
| `is_trial` | Boolean | | Đánh dấu đây là gói dùng thử: giá 0, thời hạn cố định 7 ngày, không tính VAT, mỗi tài khoản và mỗi quán chỉ một lần |
| `description` | String | | Mô tả ngắn hiện trên thẻ gói ở trang bảng giá |
| `features` | Array\<String\> | | Danh sách gạch đầu dòng hiện trên thẻ gói. Chỉ để trưng bày, không sinh ra quyền nào |
| `max_tables` | Int \| null | | Trần số bàn quán được tạo. **null = không giới hạn**. Backend chặn thật ở `EnforcesPackageLimits` |
| `max_menu_items` | Int \| null | | Trần số món trong thực đơn. **null = không giới hạn** |
| `can_use_ai` | Boolean | | Cho phép dùng trợ lý AI đọc số liệu quán hay không. Middleware `RequiresAI` đọc trường này |
| `status` | String | NN | `active` \| `inactive`. Gói `inactive` không còn hiện để mua, nhưng quán đang dùng vẫn giữ nguyên quyền |

> Thuế VAT không lưu ở đây — lấy từ cấu hình `funcafe.vat_rate` lúc đọc; gói dùng thử luôn 0%.

## 3. `time_subscriptions` — Thời hạn và giá

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh một mốc thời hạn |
| `package_id` | ObjectId | FK → `packages` | Mốc này thuộc gói nào. Một gói có nhiều mốc (1 tháng, 3 tháng, 12 tháng…) |
| `duration_value` | Int | NN | Độ dài thời hạn, tính theo đơn vị ở trường kế bên |
| `duration_unit` | String | NN | `day` \| `month`. Cùng `duration_value` quyết định `end_date` khi kích hoạt gói |
| `price` | Number | ≥ 0 | Giá niêm yết **chưa gồm VAT** của mốc này |
| `label` | String | | Nhãn hiển thị cho người mua ("1 tháng", "6 tháng"…) |
| `status` | String | | `active` \| `inactive`. Mốc `inactive` không còn bán, không ảnh hưởng gói đã mua |

## 4. `subscriptions` — Quyền dùng gói của quán

Collection này mô tả **ai được làm gì tới khi nào**, không phải chứng từ tài chính. Mọi chi
tiết tiền bạc nằm ở `package_payments`.

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh lượt đăng ký |
| `cafe_id` | ObjectId | FK → `cafes` | **Gói tính theo QUÁN, không theo tài khoản.** Không có `user_id`: chủ sở hữu suy qua `cafes.user_id`, giữ thêm bản sao chỉ tạo nguồn sự thật thứ hai có thể lệch |
| `package_id` | ObjectId | FK → `packages` | Gói đang được cấp, dùng để tra hạn mức bàn/món và quyền AI |
| `time_subscription_id` | ObjectId | FK → `time_subscriptions` | Mốc thời hạn đã chọn lúc mua |
| `package_name_snapshot` | String | | Tên gói **tại thời điểm mua**. Admin đổi tên gói về sau thì lịch sử cũ vẫn hiện đúng tên hồi đó |
| `start_date` | Date | NN | Ngày bắt đầu chu kỳ hiện hành |
| `end_date` | Date | NN | Ngày hết hạn. **Còn hiệu lực = `status` là `active` VÀ `end_date` > hiện tại** — không có tiến trình nền nào đổi `status` thành `expired`, nên chỉ kiểm `status` là sai |
| `status` | String | NN | `active` (đã cấp quyền) \| `pending` (chờ cổng thanh toán xác nhận) \| `cancelled` (đơn bị bỏ dở hoặc thất bại) |
| `total_amount` | Number | | **Tổng** tiền đã trả cho chu kỳ `start_date → end_date`, đã gồm VAT. Giữ ở đây vì công thức cấn trừ khi nâng cấp phải chia số này theo thời gian còn lại. Gia hạn kéo dài `end_date` trên chính document này nên `total_amount` phải **cộng dồn** theo, nếu không khách bị cấn trừ thiếu |

## 5. `package_payments` — Chứng từ thanh toán gói

Một `subscription` có thể có **nhiều** payment: gia hạn dùng lại chính lượt đăng ký cũ và chỉ
thêm một chứng từ mới.

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh giao dịch |
| `user_id` | ObjectId | FK → `users` | **Người trả tiền.** Lưu thẳng ở đây (dù suy được qua `cafe_id`) để màn quản trị gom tổng chi tiêu của một tài khoản bằng một truy vấn duy nhất |
| `cafe_id` | ObjectId | FK → `cafes` | Quán được cấp quyền dùng nhờ giao dịch này |
| `package_id` | ObjectId | FK → `packages` | Gói đã mua |
| `time_subscription_id` | ObjectId | FK → `time_subscriptions` | Mốc thời hạn đã mua |
| `subscription_id` | ObjectId | FK → `subscriptions` | Lượt đăng ký mà giao dịch này thanh toán cho |
| `transaction_code` | String | UK | Mã giao dịch `TXN-YYYYMMDD-NNNN` hiện trên biên lai và màn đối soát |
| `subtotal` | Number | | Giá gói chưa VAT |
| `vat_rate` | Number | | % VAT áp **lúc mua**, lưu lại để biên lai cũ không đổi khi cấu hình VAT thay đổi. Gói dùng thử = 0 |
| `vat_amount` | Number | | Tiền thuế = `subtotal × vat_rate%` |
| `amount` | Number | | **Số tiền thực trả**: đã gồm VAT và đã trừ khoản cấn trừ. Đây là con số gửi sang cổng thanh toán |
| `payment_method` | String | | Cổng đã dùng. Hiện chỉ phát sinh `vnpay` và `momo` — cả hai tự kích hoạt gói qua callback, không cần admin duyệt |
| `payment_status` | String | | `pending` (đang chờ cổng) \| `paid` \| `failed` \| `rejected`. Chỉ `paid` mới tính vào doanh thu hệ thống |
| `paid_at` | Date | | Thời điểm cổng xác nhận thu tiền. Mốc thống kê doanh thu bán gói |
| `note` | String | | Ghi chú tự do của giao dịch |
| `action_type` | String | | `new` \| `renew` \| `upgrade` — **nguồn chân lý duy nhất** cho biết giao dịch này là mua mới, gia hạn hay nâng cấp |
| `previous_subscription_id` | ObjectId | FK → `subscriptions` | Gói bị thay thế khi nâng cấp, để lần ngược lại lịch sử |
| `previous_end_date` | Date | | Hạn cũ trước khi gia hạn. Giữ để lùi lại được nếu giao dịch cuối cùng không thành |
| `credit_amount` | Number | | Giá trị còn lại của gói cũ được **cấn trừ thẳng** vào giá gói mới (0 nếu không có). **Không phải hoàn tiền mặt** — khách chỉ trả phần chênh lệch. "Đã cấn trừ hay chưa" suy từ `credit_amount > 0` nên không cần cờ riêng |
| `gateway_txn_no` | String | | Mã giao dịch do cổng sinh ra, dùng khi đối soát với VNPay/MoMo |
| `gateway_bank_code` | String | | Ngân hàng khách đã dùng, do cổng trả về |
| `gateway_order_id` | String | | Mã đơn **đã gửi sang cổng** khi nó khác `transaction_code`. Cần cho MoMo: MoMo bắt mã đơn duy nhất theo mã đối tác, mà mã đối tác môi trường thử nghiệm là dùng chung, trong khi `transaction_code` lại đếm theo từng CSDL nên hai máy cùng sinh ra `TXN-<ngày>-0001`. Gửi kèm đuôi ngẫu nhiên rồi lưu lại đây để callback tra đúng đơn |

## 6. `cafes` — Quán cà phê

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh quán. Mọi dữ liệu bán hàng đều gắn với id này, đây là ranh giới tách dữ liệu giữa các quán |
| `user_id` | ObjectId | FK → `users` | Chủ quán. Một tài khoản mở được nhiều quán |
| `name` | String | NN | Tên quán, in trên hóa đơn cho khách |
| `address` | String | | Địa chỉ, in trên hóa đơn |
| `phone` | String | | Số điện thoại quán, in trên hóa đơn |
| `description` | String | | Mô tả ngắn về quán |
| `logo` | String | | Đường dẫn ảnh logo, dùng ở đầu phiếu in |
| `status` | String | | `open` \| `closed` \| `inactive`. Quán **không xóa được**, chỉ đổi trạng thái — `closed` thì không mở đơn mới được |
| `bank_bin` | String | | Mã ngân hàng theo chuẩn VietQR, để sinh mã QR cho khách quét trả tiền |
| `bank_account_number` | String | | Số tài khoản nhận tiền của quán |
| `bank_account_name` | String | | Tên chủ tài khoản, hiện kèm mã QR để khách đối chiếu |
| `has_used_free_trial` | Boolean | | Quán này đã dùng Fun Free chưa. Mỗi quán chỉ một lần; đi cặp với `users.has_used_free_trial` |

## 7. `tables` — Bàn

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh bàn |
| `cafe_id` | ObjectId | FK → `cafes` | Bàn thuộc quán nào |
| `name` | String | NN | Tên bàn hiện trên sơ đồ ("Bàn 1", "VIP 2"…) |
| `capacity` | Int | | Số chỗ ngồi, chỉ để tham khảo khi xếp khách |
| `status` | String | NN | `empty` \| `serving`. **Chỉ là bộ nhớ đệm** cho tiện hiển thị — nguồn chân lý là "có đơn `active` nào trỏ vào bàn này không". Mongo chạy standalone nên không có transaction thật, hai lệnh ghi tách rời có thể làm trường này kẹt ở `serving`; màn Bán hàng vì vậy dẫn xuất lại trạng thái từ danh sách đơn đang mở |
| `current_order_id` | ObjectId | FK → `orders` | Đơn đang phục vụ tại bàn, null khi bàn trống. **Cũng là bộ nhớ đệm**, cùng lý do trên |
| `display_order` | Int | | Thứ tự bàn trên sơ đồ, để chủ quán sắp xếp cho khớp mặt bằng thật |

## 8. `categories` — Danh mục món

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh danh mục |
| `cafe_id` | ObjectId | FK → `cafes` | Danh mục thuộc quán nào |
| `name` | String | NN | Tên nhóm món ("Cà phê", "Trà sữa"…), dùng làm tab lọc ở màn bán hàng |
| `description` | String | | Mô tả ngắn cho nhóm món |
| `is_active` | Boolean | | Bật/tắt hiển thị. Danh mục chỉ được **ẩn, không xóa** — xóa sẽ làm các món bên trong mồ côi |

## 9. `items` — Món

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh món |
| `cafe_id` | ObjectId | FK → `cafes` | Món thuộc quán nào |
| `category_id` | ObjectId | FK → `categories` | Món nằm trong danh mục nào |
| `name` | String | NN | Tên món hiện trên thực đơn và trên hóa đơn |
| `base_price` | Int | ≥ 0 | Giá dùng khi món **không** chia size. Món có size thì lấy giá ở `item_prices` |
| `has_size` | Boolean | | Món có chia size hay không. Bật thì màn bán hàng bắt chọn size trước khi thêm vào đơn |
| `allow_topping` | Boolean | | Cho phép gắn topping hay không. Tắt thì không hiện bước chọn topping |
| `is_available` | Boolean | | Còn bán hay tạm hết. Món chỉ được **ẩn, không xóa** vì hóa đơn cũ còn tham chiếu tới |
| `image` | String | | Đường dẫn ảnh món, giúp nhân viên mới chọn đúng |
| `description` | String | | Mô tả món |
| `display_order` | Int | | Thứ tự hiện trong danh mục, để xếp món bán chạy lên đầu |

## 10. `item_prices` — Giá theo size

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh một mức giá |
| `item_id` | ObjectId | FK → `items` | Mức giá này của món nào |
| `size_name` | String | NN | Tên size ("S" / "M" / "L"), **lưu thẳng chuỗi**, không có collection `sizes` riêng vì tên size chỉ có nghĩa trong phạm vi một món |
| `price` | Int | ≥ 0 | Giá bán của size này |
| `is_active` | Boolean | | Size này còn bán hay không, tắt mà không phải xóa để hóa đơn cũ vẫn tra được |

## 11. `toppings` — Topping

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh topping |
| `cafe_id` | ObjectId | FK → `cafes` | Topping thuộc quán nào |
| `name` | String | NN | Tên topping ("Trân châu", "Thạch"…) |
| `price` | Number | ≥ 0 | Giá cộng thêm cho mỗi phần topping |
| `is_available` | Boolean | | Còn dùng hay tạm hết. Chỉ ẩn, không xóa |
| `image` | String | | Đường dẫn ảnh topping |

## 12. `item_toppings` — Món ↔ Topping (N–N)

Bảng nối: quy định **topping nào được phép gắn vào món nào**, để nhân viên không chọn nhầm
trân châu vào ly espresso.

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh cặp ghép |
| `item_id` | ObjectId | FK → `items` | Món được phép gắn |
| `topping_id` | ObjectId | FK → `toppings` | Topping được phép gắn vào món đó |

## 13. `orders` — Đơn bán hàng, kiêm hóa đơn

Không có collection `invoices` riêng: hóa đơn **chính là** đơn ở trạng thái đã thanh toán —
tách hai bảng sẽ sinh nguy cơ đơn và hóa đơn lệch nhau.

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh đơn |
| `cafe_id` | ObjectId | FK → `cafes` | Đơn của quán nào — mọi thống kê doanh thu đều lọc theo trường này |
| `table_id` | ObjectId | FK → `tables` | Đơn đang phục vụ ở bàn nào |
| `code` | String | UK theo quán | Mã đơn `ORD-YYYYMMDD-NNNN`, cấp ngay khi mở đơn |
| `status` | String | NN | `active` (đang phục vụ) \| `paid` (đã thanh toán) \| `cancelled` (hủy trước khi thu tiền). Hệ thống **không có nghiệp vụ hoàn tiền**: lỡ tay thì hủy trước khi thanh toán |
| `note` | String | | Ghi chú chung cho cả đơn |
| `subtotal` | Number | | Tổng tiền các dòng món, chưa trừ giảm giá |
| `discount_amount` | Number | | Giảm giá do thu ngân nhập. Backend luôn kẹp lại `min(số gửi lên, subtotal)` nên tổng tiền không bao giờ âm — không tin con số client gửi |
| `total_amount` | Number | ≥ 0 | Số tiền khách phải trả = `subtotal − discount_amount` |
| `invoice_code` | String | UK theo quán | Mã phiếu `INV-YYYYMMDD-NNNN`, **chỉ cấp lúc thanh toán**. Là tên tệp khi in và là mã tra cứu hóa đơn |
| `payment_method` | String | | `cash` (tiền mặt) \| `vietqr` (khách quét QR chuyển khoản). Chỉ có khi đã thanh toán |
| `payment_status` | String | | `paid`. **Trường này chỉ xuất hiện khi đơn đã thanh toán** — đơn đang phục vụ hoàn toàn không có trường này, và doanh thu chỉ tính các đơn có nó |
| `paid_at` | Date | | Thời điểm thu tiền. **Mốc tính doanh thu** theo ngày/tháng, không dùng `created_at` |
| `cash_received` | Int | | Tiền khách đưa, chỉ có với thanh toán tiền mặt |
| `change_amount` | Int | | Tiền thối lại, in trên phiếu để khách đối chiếu |

## 14. `order_details` — Dòng món trong đơn

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh dòng món |
| `order_id` | ObjectId | FK → `orders` | Dòng này thuộc đơn nào |
| `item_id` | ObjectId | FK → `items` | Món được gọi |
| `item_name_snapshot` | String | NN | Tên món **lúc bán**. Chủ quán đổi tên món về sau thì hóa đơn cũ vẫn giữ nguyên nội dung đã in cho khách |
| `item_price_id` | ObjectId | FK → `item_prices` | Size đã chọn, null nếu món không chia size |
| `size_name_snapshot` | String | | Tên size **lúc bán**, cùng lý do như tên món |
| `quantity` | Int | ≥ 1 | Số phần khách gọi |
| `unit_price` | Number | | Đơn giá lúc bán, **lấy từ CSDL** chứ không tin giá client gửi lên |
| `subtotal` | Number | | `unit_price × quantity` |
| `topping_total` | Number | | Tổng tiền topping của riêng dòng này |
| `total_price` | Number | | `subtotal + topping_total`. Đây là **số tiền đã thực thu**, không phải giá trị tính lại được: giá món và giá topping đổi theo thời gian nên tính lại bằng bảng giá hôm nay sẽ ra số khác tờ hóa đơn đã in. Cũng là nguồn tính "món bán chạy" ở trang Doanh thu và ở phân tích AI |
| `note` | String | | Yêu cầu riêng của khách cho dòng món ("ít đá", "không đường"…) |

## 15. `order_detail_toppings` — Topping của dòng món

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh dòng topping |
| `order_detail_id` | ObjectId | FK → `order_details` | Topping này gắn vào dòng món nào |
| `topping_id` | ObjectId | FK → `toppings` | Topping được chọn |
| `topping_name_snapshot` | String | | Tên topping **lúc bán**, giữ cho hóa đơn cũ không đổi nội dung |
| `quantity` | Int | ≥ 1 | Số phần topping thêm vào |
| `price_at_time` | Number | | Giá topping **lúc bán**, không đọc lại giá hiện hành |
| `subtotal` | Number | | `price_at_time × quantity`, cộng vào `order_details.topping_total` |

## 16. `reviews` — Đánh giá dịch vụ FunCafe

Mỗi chủ quán chỉ có **một** đánh giá cho **mỗi quán**: gửi lại là cập nhật chính document cũ
(upsert theo cặp `user_id` + `cafe_id`), không sinh bản ghi mới.

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh đánh giá |
| `user_id` | ObjectId | FK → `users` | Người viết đánh giá |
| `cafe_id` | ObjectId | FK → `cafes` | Đánh giá đứng tên quán nào |
| `package_id` | ObjectId | FK → `packages` | Gói đang dùng lúc đánh giá — để biết lời khen/chê đến từ người dùng gói nào |
| `rating` | Int | 1–5 | Số sao, dùng tính điểm trung bình hiện ở trang giới thiệu |
| `title` | String | | Tiêu đề ngắn của đánh giá |
| `comment` | String | | Nội dung đánh giá |
| `status` | String | | `visible` \| `hidden`. Admin bật/tắt việc hiện đánh giá này ở trang chủ |
| `history` | Array\<Object\> | | **Mảng lồng** các bản đã bị ghi đè, tối đa 20 bản gần nhất. Mỗi phần tử gồm `rating`, `title`, `comment`, `package_id`, `written_at` (viết lúc nào), `replaced_at` (bị thay lúc nào). Cần vì đánh giá hiện công khai — admin phải đối chiếu được khi ai đó sửa từ 5 sao xuống 1 sao. Để dạng mảng lồng chứ không tách collection vì số bản nhỏ, có trần, và luôn đọc kèm đánh giá |
| `updated_at` | Date | | Lần sửa gần nhất — chính là thời điểm bản đánh giá hiện tại được viết |

## 17. `contact_messages` — Tin nhắn liên hệ

Người gửi là **khách vãng lai chưa có tài khoản**, nên không có khóa ngoại tới `users`.

| Trường | Kiểu | Ràng buộc | Ý nghĩa và tác dụng |
|---|---|---|---|
| `_id` | ObjectId | PK | Định danh tin nhắn |
| `full_name` | String | NN | Tên người gửi |
| `email` | String | NN | Nơi nhận thư trả lời của admin |
| `phone` | String | | Số điện thoại để gọi lại nếu cần |
| `cafe_name` | String | | Tên quán khách khai, giúp admin nắm bối cảnh trước khi tư vấn |
| `content` | String | NN | Nội dung khách hỏi |
| `is_read` | Boolean | | Admin đã đọc chưa, dùng đếm số tin chưa xử lý |
| `reply` | String | | Nội dung admin đã trả lời, lưu lại để tra cứu về sau |
| `replied_at` | Date | | Thời điểm trả lời. Có giá trị nghĩa là tin đã được xử lý |
| `replied_by` | String | | Tên admin đã trả lời — **ảnh chụp tên tại thời điểm đó**, cố ý lưu chuỗi chứ không phải khóa ngoại: chuẩn hóa thì dấu vết sẽ đổi theo khi admin đổi tên, và mất hẳn nếu tài khoản đó bị xóa |
