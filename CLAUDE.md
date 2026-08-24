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
`rm -rf .next && npm run dev`. Cần chạy hai bản Next cùng lúc (ví dụ máy chủ nháp cho
kịch bản đầu–cuối) thì đặt `NEXT_DIST_DIR=.next-e2e` — `next.config.mjs` đọc biến đó.

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
- **Gói gắn với QUÁN, không gắn với tài khoản**: `subscriptions.shop_id`, chủ sở hữu suy
  từ `shops.user_id`. Không có `subscriptions.user_id`.
- **Hai quan hệ NGƯỢC CHIỀU giữa `users` và `shops`**, đừng lẫn: `shops.user_id` = quán
  này *của ai* (chủ quán, luôn có); `users.shop_id` = người này *làm ở đâu* (chỉ tài
  khoản `role='staff'`). Mọi chỗ đọc `users.shop_id` phải hiểu **trống = không vào được
  quán nào**, không phải "không giới hạn". Chỗ duy nhất tạo nhân viên là
  `StaffController@store`, nó đặt `role` và `shop_id` cùng lúc.
- **Chặn quyền nhân viên nằm ở máy chủ**, không phải ở menu: middleware `chu-quan`
  (`OwnerOnly`) từ chối mọi tuyến ngoài Bán hàng / Hóa đơn / Hồ sơ. Ẩn mục trong sidebar
  chỉ là trang trí. Thêm tuyến mới cho khu `/user` thì phải phân loại nó — bài kiểm
  `StaffPermissionTest` quét cả bảng tuyến nên tuyến chưa phân loại sẽ làm test đỏ.
- **Đơn mang về không có bàn**: `orders.order_type` (`dine_in` | `takeaway`) mới là nguồn
  chân lý, đừng suy từ `table_id` rỗng. Đơn mang về trả tiền mặt/VietQR được **tạo và
  chốt trong một lượt gọi** — tách hai lượt là sinh đơn ma không gắn bàn, không màn hình
  nào thấy để hủy.
- **`orders.paid_by` để TRỐNG khi thu qua cổng VNPay** — không có con người nào bấm nút
  thu; ghi tên người đang mở màn hình vào đó là làm sai chứng từ.
- **VNPay chỉ gọi MỘT địa chỉ IPN** đã khai trong cổng thương nhân, không gửi kèm theo
  từng giao dịch như Return URL. Vì vậy luồng mua gói và luồng bán hàng **nhận chung một
  cửa** rồi rẽ theo tiền tố mã (`TXN-` vs `OD`). Đừng tách tuyến riêng — tuyến đó sẽ
  không bao giờ được gọi tới.
- **Bàn, danh mục, món, topping, quán, nhân viên: chỉ ẩn/khóa, KHÔNG xóa.** Hóa đơn cũ
  còn trỏ tới chúng. Bàn ẩn (`tables.is_active = false`) và nhân viên bị khóa **vẫn tính**
  vào hạn mức gói — hạn mức đếm thứ đã tạo, không đếm thứ đang bật.
- Mọi API theo quán đi qua `shops/{shopId}/...`; phía frontend là `getShopId()` trong
  [src/services/shop-id.ts](src/services/shop-id.ts), ném `Error('NO_SHOP')` khi tài khoản
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

Tài khoản demo — mật khẩu đều là `12345678`:

| Vai trò | Tài khoản |
|---|---|
| Quản trị | `adminfuncafe@gmail.com` |
| Chủ quán (3 quán) | `nphec4007@gmail.com` |
| Nhân viên | `phin76.nv1@` · `benhien.nv1@` · `benhien.nv2@` · `nangsg.nv1@` … `nangsg.nv3@` (đuôi `funcafe.vn`) |

Hạn mức gói và mốc giá **chỉ khai một nơi**: `backend/database/seeders/data/*.json`. Cả
`ProductionSeeder` lẫn `DemoSeeder` đều đọc từ đó — đừng chép lại danh sách gói vào mã.

## Tài liệu

- [doc/ERD.md](doc/ERD.md) — 17 collection, **mọi trường** kèm ý nghĩa và ràng buộc.
- [doc/erd-drawio.mmd](doc/erd-drawio.mmd) — bốn sơ đồ ERD (một tổng quan + ba cụm), chỉ
  vẽ khóa và 2–3 trường định danh. Dựng ảnh: `node scripts/ve-erd.mjs`.
- [doc/usecase-user.puml](doc/usecase-user.puml) · [usecase-nhanvien.puml](doc/usecase-nhanvien.puml)
  · [usecase-admin.puml](doc/usecase-admin.puml) · [statechart-order.puml](doc/statechart-order.puml)
  — dựng ảnh: `node scripts/ve-puml.mjs` (máy không có Java, script gửi sang plantuml.com).
- [doc/kiem-thu-dau-cuoi.md](doc/kiem-thu-dau-cuoi.md) — 9 kịch bản, 68 phép khẳng định.

Hai script dựng ảnh trên **cũng là bước kiểm cú pháp**: sơ đồ hỏng thì chúng thoát khác 0
chứ không lặng lẽ ghi ra một tấm ảnh lỗi.

## Bí mật

`backend/.env` và `.env.local` **không có trong kho** (kho này công khai). Khóa VNPay,
MoMo, Gemini, Cloudinary, mật khẩu email phải mang tay sang máy mới. Thiếu chúng thì hệ
thống vẫn chạy, chỉ mất mua gói / trợ lý AI / gửi thư thật.
Không bao giờ commit `.env`, tệp `mongo-*.ndjson.gz`, hay dán khóa vào mã.
