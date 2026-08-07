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
php artisan migrate          # bảng token Sanctum, cache và queue (SQLite)
php artisan db:indexes       # tạo chỉ mục MongoDB
php artisan db:seed          # dữ liệu khởi tạo: gói dịch vụ và thời hạn gói
php artisan serve            # http://localhost:8000
```

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
npm run typecheck      # kiểm tra kiểu TypeScript

cd backend
php artisan serve      # chạy API
php artisan test       # bộ kiểm thử tự động (29 bài)
php artisan db:indexes # tạo lại chỉ mục MongoDB
```

## Kiểm thử

Bộ kiểm thử tự động viết bằng PHPUnit, tập trung vào các quy tắc liên quan tới tiền và tới quyền — những chỗ sai sót không hiện ra trên giao diện:

| Bộ | Loại | Nội dung |
|---|---|---|
| `VnpaySignatureTest` | Unit | Xác thực chữ ký HMAC-SHA512 của VNPay |
| `ProratedCreditTest` | Unit | Cấn trừ theo tỉ lệ khi nâng cấp gói giữa kỳ |
| `SubscriptionActivatorTest` | Feature | Kích hoạt gói khi cổng thanh toán xác nhận |
| `OrderPricingTest` | Feature | Tính tiền đơn hàng, giảm giá, tiền thối |
| `AiSuggestionsTest` | Feature | Gợi ý trợ lý AI và chặn quyền theo gói |

Các bài kiểm thử ghi vào cơ sở dữ liệu riêng `funcafe_testing` và từ chối chạy nếu bị trỏ nhầm vào dữ liệu thật.

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

---

Đồ án tốt nghiệp. Báo cáo đầy đủ nằm trong thư mục [`doc/`](doc/).
