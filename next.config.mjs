/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['localhost'],
  devIndicators: false,
  webpack: (config) => {
    // Node 24 làm crash WasmHash (xxhash64) trong webpack mà Next đóng gói:
    // "TypeError: Cannot read properties of undefined (reading 'length')
    //  at WasmHash._updateWithBuffer". Hậu quả: chunk không build được -> 404.
    // Ép dùng hàm băm native của Node (crypto) để né WasmHash.
    config.output.hashFunction = 'sha256';
    return config;
  },
};

export default nextConfig;
