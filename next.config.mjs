/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['localhost'],
  devIndicators: false,
  webpack: (config, { dev }) => {
    // Node 24 làm crash WasmHash (xxhash64) trong webpack mà Next đóng gói:
    // "TypeError: Cannot read properties of undefined (reading 'length')
    //  at WasmHash._updateWithBuffer". Hậu quả: chunk không build được -> 404.
    // Ép dùng hàm băm native của Node (crypto) để né WasmHash.
    config.output.hashFunction = 'sha256';

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
