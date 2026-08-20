# FunCafe — ghi chú cho Claude Code

Quản lý quán cà phê theo mô hình gói dịch vụ. Next.js 15 (App Router) + Laravel 13 +
MongoDB. Một tài khoản mở nhiều quán, **mỗi quán có gói và hạn mức riêng**.

Đọc [README.md](README.md) để cài đặt. Tệp này chỉ ghi những gì không nhìn ra được từ mã.

## Chạy dự án

```bash
node scripts/setup-may-moi.mjs   # máy mới: kiểm tra môi trường + dựng, bỏ qua bước đã xong
npm run dev                      # frontend  http://localhost:3000
cd backend && php artisan serve  # API       http://localhost:8000
```

Trước khi báo xong bất kỳ thay đổi nào: `npm run typecheck` (phải 0 lỗi), `npm test`,
`cd backend && php artisan test`.

`npm run build` **xóa sạch `.next`** mà `npm run dev` dùng chung thư mục đó — dựng lại
trong lúc server dev đang chạy sẽ làm hỏng nút Xuất Excel (gói mã nạp động). Gặp thì
`rm -rf .next && npm run dev`.

## Quy ước viết mã

- **Tiếng Việt** cho chú thích, thông báo giao diện, thông điệp commit (commit không dấu).
  Tên biến/hàm mới trong script và phần nghiệp vụ cũng đặt tiếng Việt không dấu
  (`chuaCoQuan`, `xemTruoc`, `docCauHinh`) — theo mã đang có.
- Chú thích giải thích **vì sao**, nhất là chỗ từng sai. Đừng mô tả lại điều mã đã nói.
- Không đặt tên màn hình chỉ đọc là "Quản lý ..." — GVHD bắt đổi. Màn hình chỉ xem thì
  gọi "Thông tin", "Tra cứu", "Doanh thu".

## Bẫy đã vấp, đừng vấp lại

- **MongoDB máy đơn không có transaction** (`MONGODB_TRANSACTIONS=false`). Mọi thao tác
  nhiều bước phải ghi có điều kiện và tự lùi được, không dựa vào transaction.
- **Ngày giờ**: `APP_TIMEZONE=Asia/Ho_Chi_Minh`. Mongo lưu UTC; để UTC ở app là doanh thu
  bán từ 0h–7h sáng rơi sang ngày hôm trước. Phần backend đã kiểm là đúng — đừng "sửa" lại.
- **Tiền là số nguyên VND**. Có `php artisan db:normalize-money` để soát.
- **Chỉ mục Mongo không đi qua migration**: sau khi xóa/nạp lại collection phải chạy
  `php artisan db:indexes`.
- **Gói gắn với QUÁN, không gắn với tài khoản**: `subscriptions.cafe_id`, chủ sở hữu suy
  từ `cafes.user_id`. Không có `subscriptions.user_id`.
- Mọi API theo quán đi qua `cafes/{cafeId}/...`; phía frontend là `getCafeId()` trong
  [src/services/cafe-id.ts](src/services/cafe-id.ts), ném `Error('NO_CAFE')` khi tài khoản
  chưa có quán — chuỗi đó là **mã nội bộ**, không được để lọt ra màn hình.

## Dữ liệu

Dữ liệu **không nằm trong kho mã**. Hai đường dựng lại:

```bash
cd backend
php artisan db:seed                       # 3 gói, 7 mốc thời hạn, tài khoản admin
php artisan db:seed --class=DemoSeeder    # bộ demo đầy đủ — XÓA SẠCH rồi gieo lại
```

hoặc chép nguyên trạng từ máy khác:

```bash
node scripts/xuat-mongo.mjs                 # máy nguồn -> mongo-<db>-<ngày>.ndjson.gz
node scripts/nhap-mongo.mjs <tệp>           # máy đích (xóa sạch rồi nạp, có hỏi xác nhận)
cd backend && php artisan db:indexes
```

Tài khoản demo: `adminfuncafe@gmail.com` (admin), `nphec4007@gmail.com` (chủ quán) —
mật khẩu `12345678`.

## Bí mật

`backend/.env` và `.env.local` **không có trong kho** (kho này công khai). Khóa VNPay,
MoMo, Gemini, Cloudinary, mật khẩu email phải mang tay sang máy mới. Thiếu chúng thì hệ
thống vẫn chạy, chỉ mất mua gói / trợ lý AI / gửi thư thật.
Không bao giờ commit `.env`, tệp `mongo-*.ndjson.gz`, hay dán khóa vào mã.
