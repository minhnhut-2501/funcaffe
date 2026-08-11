/** @type {import('next').NextConfig} */
const nextConfig = {
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
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**', '**/backend/**'],
      };
    }
    return config;
  },
};

export default nextConfig;
