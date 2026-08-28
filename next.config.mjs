/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cho phép đổi thư mục dựng qua biến môi trường.
  //
  // `npm run dev` và `npm run build` dùng chung `.next`, nên chạy hai bản Next cùng
  // lúc là hỏng bản đang chạy (xem CLAUDE.md). Khi cần dựng một bản thứ hai — ví dụ
  // máy chủ nháp cho kịch bản kiểm thử đầu-cuối chạy song song với bản dev đang mở —
  // đặt NEXT_DIST_DIR=.next-e2e là hai bản không đụng nhau nữa.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['localhost'],
  devIndicators: false,
  webpack: (config, { dev }) => {
    // KHÔNG đặt lại `config.output.hashFunction`. Trước đây ở đây có dòng
    // `config.output.hashFunction = 'sha256'` để né lỗi WasmHash (xxhash64) của
    // webpack trên Node 24. Bản webpack đi kèm Next 15.5 đã sửa lỗi đó, và chính
    // dòng né ấy giờ mới là thứ làm hỏng bản dựng: `next build` chết ngay từ đầu
    // với "The data argument must be of type string or an instance of Buffer...
    // Received undefined" (webpack gọi hash.update() với dữ liệu rỗng, hàm băm
    // native của Node từ chối còn WasmHash thì bỏ qua). Bỏ dòng đó, build chạy lại.

    // Backend Laravel nằm CÙNG thư mục dự án, và Sanctum ghi bảng token vào
    // backend/database/database.sqlite ở MỖI lần đăng nhập / đăng xuất. Watcher
    // của Next thấy file đổi -> recompile -> đẩy HMR -> cây React remount ngay
    // giữa lúc đang chuyển trang, nên lệnh chuyển sang dashboard bị huỷ và
    // người dùng đứng lại ở trang đăng nhập. Backend không có gì để Next build,
    // vậy nên loại hẳn khỏi danh sách theo dõi.
    //
    // `.next*` CÓ DẤU SAO, và đó là phần dễ bỏ sót nhất ở đây. Gán `ignored` là
    // THAY TRỌN danh sách mặc định của Next — trong đó có mục loại trừ chính
    // thư mục dựng đang dùng. Ghi cứng `.next` thì bản chạy với
    // `NEXT_DIST_DIR=.next-e2e` sẽ NGỒI THEO DÕI ĐẦU RA CỦA CHÍNH NÓ: dựng xong
    // ghi file, watcher thấy file đổi, dựng lại, ghi tiếp — quay vòng mãi. Đo được
    // 216 lượt biên dịch cho đúng 12 lượt truy cập, máy nóng ran mà không ai đụng
    // vào mã. Trớ trêu là đúng biến môi trường sinh ra để hai bản Next sống chung
    // lại là biến kích hoạt lỗi này.
    //
    // Dấu sao cũng gom luôn thư mục dựng CỦA BẢN KIA: chạy song song thì bản dùng
    // `.next` phải bỏ qua `.next-e2e` và ngược lại, thiếu một chiều là hai bản
    // thay nhau đánh thức nhau.
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next*/**', '**/backend/**'],
      };
    }
    return config;
  },
};

export default nextConfig;
