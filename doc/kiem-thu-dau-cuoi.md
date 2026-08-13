# Kiểm thử đầu–cuối — sáu kịch bản nghiệp vụ

Tài liệu này là **bằng chứng cho chương Kiểm thử của báo cáo**. Mỗi dòng trong bảng kết
quả ứng với một phép khẳng định đã chạy thật, không phải một ô đánh dấu điền tay.

- **Kịch bản tự động:** [`scripts/kich-ban-dau-cuoi.mjs`](../scripts/kich-ban-dau-cuoi.mjs)
- **Ngày chạy:** 13/08/2026
- **Kết quả:** **45/45 phép khẳng định đạt**
- **Môi trường:** Next.js dev (cổng 3000) · Laravel `artisan serve` (cổng 8000) · MongoDB máy đơn

## Cách chạy lại

Kịch bản **ghi dữ liệu**: nó tạo tài khoản, tạo quán, bán hàng, mua gói và khóa tài khoản.
Vì vậy nó chạy trên một cơ sở dữ liệu **nháp**, không bao giờ trên dữ liệu thật.

```bash
cd backend
MONGODB_DATABASE=funcafe_e2e php artisan db:seed --class=DemoSeeder --force
MONGODB_DATABASE=funcafe_e2e php artisan db:indexes

# Cắm CỌC đánh dấu — chốt an toàn của kịch bản dựa vào nó
MONGODB_DATABASE=funcafe_e2e php artisan tinker --execute="App\Models\Package::updateOrCreate(['name'=>'__E2E_SANDBOX__'],['type'=>'free','status'=>'active','features'=>[]]);"

MONGODB_DATABASE=funcafe_e2e php artisan serve --port=8000
```

Rồi ở cửa sổ khác: `node scripts/kich-ban-dau-cuoi.mjs`

Xong việc thì xóa cơ sở dữ liệu nháp đi.

> **Về chốt an toàn.** Kịch bản hỏi *chính máy chủ* xem nó đang nói chuyện với cơ sở dữ
> liệu nào, bằng cách tìm cái cọc `__E2E_SANDBOX__` trong danh sách gói. Không thấy cọc
> thì nó dừng, không chạy gì hết.
>
> Bản đầu tiên chỉ đọc tệp `backend/.env` để kiểm — và **đã thủng**. Tệp `.env` chỉ nói
> lên *ý định*; thứ quyết định là biến môi trường mà tiến trình PHP thật sự nhận được, và
> biến đó có thể không tới nơi (tiến trình cũ chưa chết, trình bao nuốt mất tiền tố…).
> Lần đó kịch bản ghi 54 bản ghi vào dữ liệu thật, phải dọn lại bằng tay. Bài học: **kiểm
> sự thật ở đầu bên kia, đừng kiểm ý định ở đầu bên này.**

---

## Kịch bản 1 (8.6.1) — Đăng ký → tạo quán → nhận gói dùng thử → vào khu làm việc

Đường đi của một chủ quán hoàn toàn mới, từ lúc chưa có gì.

| # | Phép khẳng định | Kết quả |
|---|---|---|
| 1.1 | Đăng ký xong vào thẳng bước tạo quán đầu tiên | Đạt |
| 1.2 | Tài khoản mới đăng nhập được ngay | Đạt |
| 1.3 | Vai trò mặc định là chủ quán, không phải quản trị | Đạt |
| 1.4 | Tạo được quán đầu tiên | Đạt |
| 1.5 | Bảng giá có gói dùng thử | Đạt |
| 1.6 | Nhận được gói dùng thử miễn phí | Đạt |
| 1.7 | Gói dùng thử đúng **7 ngày** | Đạt |
| 1.8 | Gói ở trạng thái đang hiệu lực, dùng được ngay | Đạt |
| 1.9 | **Không** xin được gói dùng thử lần thứ hai | Đạt |

## Kịch bản 2 (8.6.2) — Dựng thực đơn → bán một đơn có topping và giảm giá → hóa đơn → doanh thu

Vòng đời tiền đầy đủ. Phép tính được chọn để mọi con số kiểm được bằng đầu:
**2 ly × (30.000 đ món + 7.000 đ topping) = 74.000 đ**, giảm 4.000 đ → thu **70.000 đ**,
khách đưa 100.000 đ → thối **30.000 đ**.

| # | Phép khẳng định | Kết quả |
|---|---|---|
| 2.1–2.4 | Tạo được danh mục, món 30.000 đ, topping 7.000 đ, bàn | Đạt |
| 2.5 | Lên được order có topping | Đạt |
| 2.6 | Tạm tính = **74.000 đ** | Đạt |
| 2.7 | Thanh toán thành công | Đạt |
| 2.8 | Sau giảm giá phải thu = **70.000 đ** | Đạt |
| 2.9 | Tiền thối = **30.000 đ** | Đạt |
| 2.10 | Sinh mã hóa đơn (`INV-20260813-0001`) | Đạt |
| 2.11 | Bàn được trả về trống sau khi thu tiền | Đạt |
| 2.12 | Doanh thu quán = đúng 70.000 đ | Đạt |
| 2.13 | Hóa đơn hiện ra ở màn hình Hóa đơn *(kiểm trên giao diện thật)* | Đạt |
| 2.14 | Số tiền trên màn hình khớp 70.000 đ | Đạt |

## Kịch bản 3 (8.6.3) — Mua gói qua VNPay → cổng gọi về → hạn gói cộng đúng

Cổng thanh toán được giả lập ở tầng mạng nhưng **chữ ký ký thật** bằng khóa HMAC-SHA512
trong cấu hình — chữ ký sai thì máy chủ từ chối, nên phép kiểm này không thể qua bằng may.

| # | Phép khẳng định | Kết quả |
|---|---|---|
| 3.1 | Có mốc thời hạn để mua (1 tháng) | Đạt |
| 3.2 | Tạo được giao dịch mua gói | Đạt |
| 3.3 | Máy chủ trả về đường dẫn sang cổng VNPay | Đạt |
| 3.4 | Đường dẫn mang đủ mã giao dịch và số tiền (218.900 đ = 199.000 + VAT 10%) | Đạt |
| 3.5 | **Trước** khi cổng xác nhận: gói Pro **chưa** được cấp | Đạt |
| 3.6 | Cổng gọi về được chấp nhận | Đạt |
| 3.7 | **Sau** khi cổng xác nhận: giao dịch chuyển sang *đã thanh toán* | Đạt |
| 3.8 | Gói Pro đã được kích hoạt | Đạt |
| 3.9 | Hạn gói cộng đúng khoảng một tháng (đo được 31 ngày) | Đạt |
| 3.10 | **Cổng gọi về lần hai không cộng hạn thêm lần nữa** | Đạt |

> Phép 3.10 là quan trọng nhất trong kịch bản này. VNPay gửi **hai** thông báo cho cùng
> một giao dịch — Return URL qua trình duyệt và IPN từ máy chủ của họ — thường cách nhau
> vài phần nghìn giây. Xử lý cả hai là quán được thêm một tháng mà không trả tiền.

## Kịch bản 4 (8.6.4) — Gói hết hạn → thao tác ghi bị chặn → gia hạn → mở khóa ngay

| # | Phép khẳng định | Kết quả |
|---|---|---|
| 4.1 | Gói hết hạn thì thao tác **ghi** bị chặn (403) | Đạt |
| 4.2 | Nhưng vẫn **đọc** được số liệu cũ — dữ liệu của quán không bị giam | Đạt |
| 4.3 | Gia hạn xong là ghi được **ngay**, không phải đăng nhập lại | Đạt |

> Phép 4.2 là một quyết định nghiệp vụ có chủ ý: hết hạn gói thì ngừng bán hàng, nhưng
> chủ quán vẫn phải xem lại được hóa đơn và doanh thu của chính mình. Giam dữ liệu để ép
> gia hạn là điều hệ thống này không làm.

## Kịch bản 5 (8.6.5) — Quản trị khóa tài khoản → phiên đang mở dừng ngay

| # | Phép khẳng định | Kết quả |
|---|---|---|
| 5.1 | Đăng nhập được tài khoản quản trị | Đạt |
| 5.2 | Trước khi khóa: chủ quán dùng bình thường | Đạt |
| 5.3 | Quản trị thấy tài khoản chủ quán trong danh sách | Đạt |
| 5.4 | Khóa tài khoản thành công | Đạt |
| 5.5 | **Token đang cầm mất hiệu lực ngay** (401) | Đạt |
| 5.6 | Và cũng không đăng nhập lại được | Đạt |

> Phép 5.5 kiểm đúng chỗ từng có lỗ hổng: trước đây khóa tài khoản chỉ chặn *lần đăng
> nhập sau*, còn người đang mở màn hình vẫn bán hàng bình thường cho tới khi tự đăng xuất.

## Kịch bản 6 (8.6.6) — Hai quán → doanh thu gộp khớp tổng từng quán

| # | Phép khẳng định | Kết quả |
|---|---|---|
| 6.1 | Tạo được quán thứ hai | Đạt |
| 6.2 | Danh sách quán trả về đúng 2 quán | Đạt |
| 6.3 | Doanh thu gộp = tổng cộng tay của hai quán | Đạt |

---

## Quan hệ với bộ kiểm thử tự động

Sáu kịch bản trên đi **xuyên qua cả hệ thống** — giao diện, API, cơ sở dữ liệu và cổng
thanh toán — nên chúng trả lời câu *"ghép lại có chạy không"*. Chúng không thay thế bộ
kiểm thử đơn vị và tích hợp, vốn trả lời câu *"từng luật có đúng không"*:

| Bộ | Số bài | Trả lời câu hỏi |
|---|---|---|
| PHPUnit (máy chủ) | 203 bài · 576 khẳng định | Từng quy tắc nghiệp vụ có đúng không |
| Vitest (giao diện) | 132 bài | Các hàm tính toán và định dạng có đúng không |
| Kịch bản đầu–cuối | 45 khẳng định | Ghép lại thành luồng thật thì có chạy không |
