# FunCafe

Nền tảng quản lý quán cà phê theo mô hình đăng ký gói dịch vụ. Một tài khoản mở được nhiều quán, mỗi quán có gói và hạn mức riêng.

Hệ thống gồm ba khu vực: **Public Website** (giới thiệu, bảng giá, đăng ký), **User Portal** (chủ quán vận hành) và **Admin Portal** (quản trị hệ thống).

## Chức năng chính

- **Bán hàng theo bàn** — sơ đồ bàn, lên order, thêm món và topping, thanh toán tiền mặt hoặc mã VietQR sinh từ tài khoản ngân hàng của quán.
- **Thực đơn** — danh mục, món, size và giá theo từng size, topping gắn cho món.
- **Hóa đơn và doanh thu** — tra cứu, in lại, biểu đồ theo thời gian, top món bán chạy, xuất Excel, tổng hợp doanh thu nhiều quán.
- **Gói dịch vụ** — Fun Free (7 ngày) / Pro / Pro Max, thanh toán qua VNPay hoặc MoMo, nâng cấp giữa kỳ tự cấn trừ phần chưa dùng của gói cũ.
- **Trợ lý AI** (gói Pro Max) — hỏi đáp về tình hình quán và phân tích doanh thu bằng Google Gemini.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| Backend | Laravel 13, PHP 8.3, Laravel Sanctum |
| Cơ sở dữ liệu | MongoDB (`mongodb/laravel-mongodb`) — SQLite chỉ giữ bảng token của Sanctum |
| Dịch vụ ngoài | Cloudinary, VNPay, MoMo, Google Gemini |

## Yêu cầu môi trường

- Node.js 20 trở lên
- PHP 8.3 kèm phần mở rộng `mongodb`
- Composer 2
- MongoDB 6 trở lên (chạy máy đơn là đủ)

## Cài đặt

### 1. Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate

# Tệp SQLite KHÔNG nằm trong kho (xem database/.gitignore) nên máy trắng chưa có nó.
# Thiếu bước này thì `migrate` dừng lại hỏi có tạo không — kịch bản tự động sẽ treo.
touch database/database.sqlite

php artisan migrate          # bảng token Sanctum, cache và queue (SQLite)
php artisan db:indexes       # tạo chỉ mục MongoDB — BẮT BUỘC, xem ghi chú bên dưới
php artisan db:seed          # tối thiểu: 3 gói, 7 mốc thời hạn, 1 tài khoản quản trị
php artisan serve            # http://localhost:8000
```

Muốn có **dữ liệu demo đầy đủ** để xem giao diện có gì (nhiều quán, thực đơn, ~2.000 đơn
trải 60 ngày, hóa đơn, giao dịch gói) thì chạy thêm:

```bash
php artisan db:seed --class=DemoSeeder
```

> `DemoSeeder` **xóa sạch rồi gieo lại** các collection nó quản lý. Đừng chạy trên cơ sở
> dữ liệu đang có dữ liệu thật. Muốn thử an toàn thì trỏ sang CSDL khác:
> `MONGODB_DATABASE=funcafe_thu php artisan db:seed --class=DemoSeeder`

> `php artisan db:indexes` là lệnh **bắt buộc**, không phải tuỳ chọn. MongoDB không đi qua hệ thống migration của Laravel nên chỉ mục phải khai báo và tạo bằng lệnh riêng. Bỏ qua bước này thì hệ thống vẫn chạy, nhưng mọi truy vấn phải quét toàn bộ collection. Lệnh chạy lại được nhiều lần mà không hỏng gì.

Các biến trong `backend/.env` cần chú ý:

| Biến | Ghi chú |
|---|---|
| `MONGODB_DSN`, `MONGODB_DATABASE` | Chuỗi kết nối MongoDB |
| `APP_TIMEZONE` | Để `Asia/Ho_Chi_Minh`. Đặt UTC sẽ khiến doanh thu bán từ 0h–7h sáng bị tính sang ngày hôm trước |
| `MONGODB_TRANSACTIONS` | Chỉ đặt `true` khi Mongo chạy replica set hoặc Atlas. Máy đơn không hỗ trợ giao dịch |
| `GEMINI_API_KEY` | Thiếu thì trợ lý AI không chạy, phần còn lại vẫn bình thường |
| `VNPAY_*`, `MOMO_*` | Khoá của môi trường thử nghiệm; thiếu thì không mua được gói |
| `CLOUDINARY_URL` | Bỏ trống ở local sẽ tự lưu ảnh vào thư mục `public` |
| `CA_BUNDLE` | **Chỉ Windows.** PHP trên Windows không kèm bộ chứng chỉ gốc, nên mọi lời gọi HTTPS ra ngoài (Gemini, MoMo) báo `cURL error 60`. Tải `cacert.pem` về rồi trỏ tới đây. Trên Linux/Render để trống |
| `CORS_ALLOWED_ORIGINS` | Local để `*`. Khi triển khai **phải** đặt đúng tên miền frontend — để `*` nghĩa là bất kỳ trang web nào cũng gọi được API bằng token của người đang đăng nhập |
| `SANCTUM_EXPIRATION_MINUTES` | Hạn dùng token đăng nhập, mặc định 43200 (30 ngày). Để rỗng là token sống mãi |

### 2. Frontend

```bash
npm install
npm run dev                  # http://localhost:3000
```

Mặc định frontend gọi API ở `http://localhost:8000/api`. Đổi bằng cách tạo `.env.local` ở thư mục gốc:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_STORAGE_URL=http://localhost:8000
```

## Các lệnh hay dùng

```bash
npm run dev            # chạy frontend ở chế độ phát triển
npm run build          # dựng bản production
npm run typecheck      # kiểm tra kiểu TypeScript (phải 0 lỗi)
npm run lint           # soát mã
npm test               # bộ kiểm thử frontend (Vitest)

cd backend
php artisan serve             # chạy API
php artisan test              # bộ kiểm thử máy chủ
php artisan db:indexes        # tạo lại chỉ mục MongoDB
php artisan db:normalize-money # đưa mọi trường tiền về số nguyên (mặc định chỉ báo cáo)
php artisan sanctum:prune-expired --hours=24  # dọn token đã quá hạn
```

> **`npm run build` xóa sạch thư mục `.next`, mà `npm run dev` cũng dùng chung thư mục
> đó.** Dựng lại trong lúc server dev đang chạy sẽ làm hỏng nó theo kiểu khó đoán: những
> gì đã nạp vào trình duyệt vẫn chạy, nhưng gói mã nạp động (`exceljs` — nút Xuất Excel)
> không sinh ra được nữa, nên chỉ mình nút đó hỏng. Gặp thì: `rm -rf .next && npm run dev`.

### Kịch bản kiểm trên trình duyệt

Bốn lệnh trên **không mở trình duyệt và không bấm nút nào**. Hai kịch bản dưới đây bù vào
chỗ đó — cần cả `php artisan serve` (cổng 8000) và frontend đang chạy:

```bash
node scripts/thu-xuat-excel.mjs       # bấm nút Xuất Excel, mở lại tệp đối chiếu kiểu dữ liệu
node scripts/thu-ban-in-hoa-don.mjs   # bản in A4 + giấy nhiệt 58/80mm
node scripts/doi-chieu-doanh-thu.mjs  # doanh thu ở năm nơi phải ra cùng một số
```

Cả ba chỉ đọc, không tạo hay sửa bản ghi nào.

## Kiểm thử

**195 bài máy chủ** (PHPUnit) và **126 bài frontend** (Vitest), tập trung vào các quy tắc liên quan tới **tiền** và tới **quyền** — những chỗ sai sót không hiện ra trên giao diện:

| Bộ | Nội dung |
|---|---|
| `VnpaySignatureTest` · `MomoSignatureTest` | Xác thực chữ ký HMAC của hai cổng thanh toán |
| `GatewayCallbackTest` | Cổng gọi về hai đường (Return + IPN) không được cộng hạn hai lần |
| `SubscriptionLifecycleTest` · `SubscriptionActivatorTest` | Mua mới, gia hạn cộng dồn, nâng cấp cấn trừ giữa kỳ |
| `OrderLifecycleTest` · `OrderPricingTest` | Vòng đời đơn, tính tiền, giảm giá, tiền thối, thanh toán hai lần |
| `AuthFlowTest` | Đăng ký/đăng nhập/đặt lại mật khẩu; token chết đúng lúc; không tự nâng quyền |
| `AdminPanelTest` · `AdminUserGuardTest` | Ranh giới quyền quản trị; không xóa cứng thứ đã bán |
| `CatalogRulesTest` · `PackageLimitTest` · `TableGuardTest` · `CafeStatusTest` | Hạn mức gói, trạng thái quán, quy tắc thực đơn |
| `ReviewRulesTest` · `AiSuggestionsTest` | Đánh giá không lộ thông tin cá nhân; chặn AI theo gói |

Các bài kiểm thử ghi vào cơ sở dữ liệu riêng `funcafe_testing` và **từ chối chạy nếu bị trỏ nhầm vào dữ liệu thật**. Máy không chạy MongoDB thì các bài Feature tự bỏ qua thay vì báo đỏ.

## Cấu trúc mã nguồn

```
src/
  app/          Route theo App Router: trang public, /user/*, /admin/*
  components/   Component dùng lại: layout ba khu vực, bảng, form, thẻ
  services/     Hàm gọi API và ánh xạ dữ liệu backend sang kiểu của frontend
  hooks/        use-api (gọi API kèm trạng thái tải/lỗi), use-toast
  lib/          Client gọi API, định dạng tiền/ngày, quy tắc quyền theo gói
  context/      Phiên đăng nhập, quán đang chọn, gói đang dùng
  types/        Khai báo kiểu dùng chung

backend/app/
  Http/Controllers/           Controller API, thư mục Admin riêng
  Http/Controllers/Concerns/  Trait dùng chung: quyền sở hữu quán, hạn mức gói
  Http/Middleware/            Chặn theo vai trò, kiểm tra gói, quyền dùng AI
  Models/                     Model MongoDB
  Services/                   VNPay, MoMo, Gemini, kích hoạt gói
  Console/Commands/           db:indexes và các lệnh chạy tay khác

doc/                          Báo cáo đồ án, sơ đồ ERD và Use Case
```

## Triển khai

Frontend đưa lên Vercel, backend đóng gói Docker đưa lên Render, cơ sở dữ liệu dùng MongoDB Atlas, ảnh lưu ở Cloudinary. Ba điểm cần xử lý riêng:

1. Backend cần phần mở rộng MongoDB cho PHP mà môi trường dựng sẵn không có — đã có `backend/Dockerfile` để cài.
2. Đĩa của máy chủ bị xoá sạch sau mỗi lần triển khai lại, nên ảnh phải đẩy sang Cloudinary thay vì ghi vào thư mục ứng dụng.
3. Frontend và backend nằm ở hai tên miền khác nhau — khai báo `CORS_ALLOWED_ORIGINS` và `FRONTEND_URL` cho đúng.

### Năm thứ phải kiểm trước khi coi là xong

Phần lớn **không làm hỏng gì ngay** — ứng dụng chạy bình thường, không báo lỗi nào — nên
rất dễ lên mạng rồi vẫn còn nguyên. Ứng dụng tự ghi cảnh báo vào log khi phát hiện, nhưng
đừng đợi tới đó:

| Biến | Phải là | Nếu sai thì sao |
|---|---|---|
| `APP_DEBUG` | `false` | Một lỗi 500 bất kỳ là in ra **toàn bộ biến môi trường** — khóa cổng thanh toán, chuỗi kết nối CSDL — cho người gây ra lỗi đó |
| `CORS_ALLOWED_ORIGINS` | tên miền frontend thật | Mọi trang web gọi được API này bằng token của người dùng đang đăng nhập |
| `APP_KEY` | đã sinh | Mọi thứ Laravel mã hóa đều không đáng tin |
| `APP_TIMEZONE` | `Asia/Ho_Chi_Minh` | Doanh thu bán từ 0h–7h sáng bị tính sang ngày hôm trước |
| `MAIL_MAILER` + `RESEND_API_KEY` + `MAIL_FROM_ADDRESS` | `resend`, khóa API, địa chỉ thuộc tên miền đã xác thực | Thiếu `MAIL_MAILER` thì Laravel lặng lẽ dùng mailer `log`: thư đặt lại mật khẩu và thư admin trả lời khách được ghi vào tệp log, **giao diện vẫn báo gửi thành công**, hộp thư người nhận trống trơn |

`FRONTEND_URL` cũng phải là tên miền frontend thật, không phải `localhost:3000` — liên kết
trong thư đặt lại mật khẩu được dựng từ chính biến này, đặt sai thì thư gửi đi đúng nhưng
người nhận bấm vào không mở được gì.

### Vì sao bản triển khai gửi thư qua Resend chứ không phải Gmail

Render **chặn mọi kết nối ra cổng SMTP (25/465/587)** trên dịch vụ web gói miễn phí, hiệu
lực từ 26/09/2025. Nó không từ chối thẳng mà nuốt gói tin, nên triệu chứng rất dễ đọc
nhầm — đo trên bản đang chạy:

| Lượt gọi | Thời gian |
|---|---|
| `forgot-password`, email **có** tài khoản (phải gửi thư) | **61s** rồi hết giờ |
| `forgot-password`, email **không** tồn tại (không gửi gì) | 0,9s |
| `/up` (chỉ đường truyền) | 0,55s |

Resend đi qua HTTPS cổng 443 nên không dính lệnh chặn. Máy phát triển vẫn dùng Gmail SMTP
bình thường — cổng 587 ở nhà không ai chặn — nên `CauHinhMail` chấp nhận cả hai đường.
`MAIL_FROM_ADDRESS` bắt buộc thuộc tên miền đã xác thực ở Resend (`funcafe.pro`); để một
địa chỉ `@gmail.com` là bị từ chối. Đặt thêm `MAIL_REPLY_TO_ADDRESS` trỏ về hòm thư có
người đọc, nếu không thư khách bấm "Trả lời" sẽ đi vào hòm `no-reply` không ai mở.

Máy chủ ở gói miễn phí của Render **ngủ sau một thời gian không dùng**; lượt gọi đầu tiên
sau đó mất vài chục giây. Trước buổi trình bày nên mở trước một lượt cho nó dậy.

---

Đồ án tốt nghiệp. Báo cáo đầy đủ nằm trong thư mục [`doc/`](doc/).
